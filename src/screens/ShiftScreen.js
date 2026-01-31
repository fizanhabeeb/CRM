import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function ShiftScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [activeShift, setActiveShift] = useState(null);
  
  // Form State
  const [cashInput, setCashInput] = useState('');
  const [notesInput, setNotesInput] = useState(''); // Shift Notes
  
  const [shiftStats, setShiftStats] = useState({ totalSales: 0, cashCollected: 0, creditSales: 0, totalLiters: 0 });

  useEffect(() => {
    checkShift();
  }, []);

  const checkShift = async () => {
    const res = await db.getAllAsync('SELECT * FROM shifts WHERE user_id = ? AND status = "OPEN"', [user.id]);
    if (res.length > 0) {
      setActiveShift(res[0]);
      calculateShiftStats(res[0].id);
    } else {
      setActiveShift(null);
    }
  };

  const calculateShiftStats = async (shiftId) => {
    const res = await db.getAllAsync(
      'SELECT SUM(total_amount) as total, SUM(quantity) as liters, payment_mode FROM transactions WHERE shift_id = ? GROUP BY payment_mode', 
      [shiftId]
    );
    let total = 0;
    let cash = 0;
    let credit = 0;
    let liters = 0;

    res.forEach(r => {
        total += r.total;
        liters += r.liters;
        if(r.payment_mode === 'Cash') cash += r.total;
        else credit += r.total;
    });
    setShiftStats({ totalSales: total, cashCollected: cash, creditSales: credit, totalLiters: liters });
  };

  const handleOpenShift = async () => {
    if(!cashInput) return Alert.alert("Error", "Enter Opening Cash Amount");
    
    const startTime = new Date().toLocaleString();
    // Passing 0 for start_meter since feature is removed
    await db.runAsync(
        'INSERT INTO shifts (user_id, start_time, opening_cash, start_meter, status) VALUES (?, ?, ?, 0, "OPEN")',
        [user.id, startTime, parseFloat(cashInput)]
    );
    await logAudit(user.username, 'SHIFT_OPEN', `Started. Cash: ${cashInput}`);
    
    setCashInput('');
    checkShift();
    Alert.alert("Success", "Shift Opened!");
  };

  const handleCloseShift = async () => {
    if(!cashInput) return Alert.alert("Error", "Enter Closing Cash Amount");
    
    const endTime = new Date().toLocaleString();
    const actualCash = parseFloat(cashInput);
    
    // Meter & Testing logic removed, setting defaults to 0
    const endMeter = 0;
    const testingVol = 0;
    
    const expectedCash = activeShift.opening_cash + shiftStats.cashCollected;
    const cashDiff = actualCash - expectedCash;
    
    // 🧮 LOGIC UPDATED: Only Cash & App Sales (No Physical Meter Check)
    const appSales = shiftStats.totalLiters;
    
    await db.runAsync(
        `UPDATE shifts SET 
            end_time = ?, closing_cash = ?, expected_cash = ?, actual_cash = ?, 
            end_meter = ?, testing_vol = ?, notes = ?, status = "CLOSED" 
        WHERE id = ?`,
        [endTime, actualCash, expectedCash, actualCash, endMeter, testingVol, notesInput, activeShift.id]
    );

    let msg = `Shift Closed Report\n\n💰 CASH:\nExpected: ₹${expectedCash}\nActual: ₹${actualCash}\nDiff: ₹${cashDiff}\n\n⛽ SALES (App Log):\nTotal Volume: ${appSales.toFixed(2)}L\n`;
    
    await logAudit(user.username, 'SHIFT_CLOSE', `Closed. Cash Diff: ${cashDiff}`);
    
    setCashInput(''); setNotesInput('');
    setActiveShift(null);
    Alert.alert("Shift Report", msg, [{ text: "OK", onPress: () => navigation.navigate('Dashboard') }]);
  };

  if (!activeShift) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="sunny" size={50} color="#ff9800" style={{alignSelf:'center', marginBottom:20}} />
          <Text style={styles.title}>Start Your Shift</Text>
          <Text style={styles.subtitle}>Enter your opening cash to begin.</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Opening Cash Amount (₹)"
            placeholderTextColor="#888" 
            keyboardType="numeric"
            value={cashInput}
            onChangeText={setCashInput}
          />
          
          <TouchableOpacity style={styles.btn} onPress={handleOpenShift}>
             <Text style={styles.btnText}>Open Shift</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
       <View style={[styles.card, {backgroundColor: '#e8f5e9'}]}>
          <Text style={styles.title}>Shift Active 🟢</Text>
          <View style={styles.row}>
             <Text style={styles.label}>Started:</Text>
             <Text>{activeShift.start_time}</Text>
          </View>
          <View style={styles.row}>
             <Text style={styles.label}>Opening Cash:</Text>
             <Text>₹{activeShift.opening_cash}</Text>
          </View>
       </View>

       <View style={styles.statsContainer}>
          <View style={styles.statBox}>
             <Text style={{fontSize:12, color:'#666'}}>App Sales (L)</Text>
             <Text style={styles.statValue}>{shiftStats.totalLiters.toFixed(2)} L</Text>
          </View>
          <View style={styles.statBox}>
             <Text style={{fontSize:12, color:'#666'}}>Cash Sales</Text>
             <Text style={styles.statValue}>₹ {shiftStats.cashCollected}</Text>
          </View>
          <View style={styles.statBox}>
             <Text style={{fontSize:12, color:'#666'}}>Credit/Online</Text>
             <Text style={styles.statValue}>₹ {shiftStats.creditSales}</Text>
          </View>
          <View style={styles.statBox}>
             <Text style={{fontSize:12, color:'#666'}}>Expected Cash</Text>
             <Text style={[styles.statValue, {color:'#2196f3'}]}>
                ₹ {activeShift.opening_cash + shiftStats.cashCollected}
             </Text>
          </View>
       </View>

       <View style={styles.card}>
          <Text style={styles.title}>End Shift</Text>
          
          <Text style={styles.inputLabel}>Closing Cash (₹)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.00" 
            placeholderTextColor="#888"
            keyboardType="numeric"
            value={cashInput}
            onChangeText={setCashInput}
          />

          <Text style={styles.inputLabel}>Shift Notes (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Any issues? (e.g. Printer stuck)" 
            placeholderTextColor="#888"
            value={notesInput}
            onChangeText={setNotesInput}
          />

          <TouchableOpacity style={[styles.btn, {backgroundColor:'#f44336'}]} onPress={handleCloseShift}>
             <Text style={styles.btnText}>Close Shift</Text>
          </TouchableOpacity>
       </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 3, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign:'center' },
  subtitle: { color: '#666', textAlign:'center', marginBottom: 20 },
  input: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 12, 
    borderRadius: 8, 
    fontSize: 16, 
    marginBottom: 15,
    color: '#000' 
  },
  inputLabel: { fontWeight:'bold', marginBottom: 5, color:'#333' },
  btn: { backgroundColor: '#4caf50', padding: 15, borderRadius: 8, alignItems: 'center', marginTop:10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  row: { flexDirection:'row', justifyContent:'space-between', marginBottom:5 },
  label: { fontWeight:'bold', color:'#555' }
});