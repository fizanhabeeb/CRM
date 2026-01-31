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
  const [meterInput, setMeterInput] = useState(''); // Start/End Meter
  const [testingInput, setTestingInput] = useState('0'); // Calibration Qty
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
    if(!cashInput || !meterInput) return Alert.alert("Error", "Enter Opening Cash & Meter Reading");
    
    const startTime = new Date().toLocaleString();
    await db.runAsync(
        'INSERT INTO shifts (user_id, start_time, opening_cash, start_meter, status) VALUES (?, ?, ?, ?, "OPEN")',
        [user.id, startTime, parseFloat(cashInput), parseFloat(meterInput)]
    );
    await logAudit(user.username, 'SHIFT_OPEN', `Started. Cash: ${cashInput}, Meter: ${meterInput}`);
    
    setCashInput(''); setMeterInput('');
    checkShift();
    Alert.alert("Success", "Shift Opened!");
  };

  const handleCloseShift = async () => {
    if(!cashInput || !meterInput) return Alert.alert("Error", "Enter Closing Cash & Meter Reading");
    
    const endTime = new Date().toLocaleString();
    const actualCash = parseFloat(cashInput);
    const endMeter = parseFloat(meterInput);
    const testingVol = parseFloat(testingInput) || 0;
    
    const expectedCash = activeShift.opening_cash + shiftStats.cashCollected;
    const cashDiff = actualCash - expectedCash;
    
    // 🧮 METER RECONCILIATION LOGIC
    const physicalSales = (endMeter - activeShift.start_meter) - testingVol;
    const appSales = shiftStats.totalLiters;
    const variance = physicalSales - appSales; // Positive means Fuel Missing (Theft?), Negative means App Error
    
    await db.runAsync(
        `UPDATE shifts SET 
            end_time = ?, closing_cash = ?, expected_cash = ?, actual_cash = ?, 
            end_meter = ?, testing_vol = ?, notes = ?, status = "CLOSED" 
        WHERE id = ?`,
        [endTime, actualCash, expectedCash, actualCash, endMeter, testingVol, notesInput, activeShift.id]
    );

    let msg = `Shift Closed Report\n\n💰 CASH:\nExpected: ₹${expectedCash}\nActual: ₹${actualCash}\nDiff: ₹${cashDiff}\n\n⛽ FUEL STOCK:\nPhysical Sale: ${physicalSales.toFixed(2)}L\nApp Logged: ${appSales.toFixed(2)}L\n`;
    
    if (Math.abs(variance) > 1) {
        msg += `\n🚨 VARIANCE DETECTED: ${variance.toFixed(2)}L\n(Check for theft or missed entries)`;
    } else {
        msg += `\n✅ Meter Matches App!`;
    }

    await logAudit(user.username, 'SHIFT_CLOSE', `Closed. Cash Diff: ${cashDiff}, Fuel Var: ${variance.toFixed(2)}L`);
    
    setCashInput(''); setMeterInput(''); setTestingInput('0'); setNotesInput('');
    setActiveShift(null);
    Alert.alert("Shift Report", msg, [{ text: "OK", onPress: () => navigation.navigate('Dashboard') }]);
  };

  if (!activeShift) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="sunny" size={50} color="#ff9800" style={{alignSelf:'center', marginBottom:20}} />
          <Text style={styles.title}>Start Your Shift</Text>
          <Text style={styles.subtitle}>Count cash & Check pump meter.</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Opening Cash Amount (₹)" 
            keyboardType="numeric"
            value={cashInput}
            onChangeText={setCashInput}
          />

          <TextInput 
            style={styles.input} 
            placeholder="Start Meter Reading (e.g. 100500)" 
            keyboardType="numeric"
            value={meterInput}
            onChangeText={setMeterInput}
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
          <View style={styles.row}>
             <Text style={styles.label}>Start Meter:</Text>
             <Text>{activeShift.start_meter}</Text>
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
            keyboardType="numeric"
            value={cashInput}
            onChangeText={setCashInput}
          />

          <Text style={styles.inputLabel}>End Meter Reading</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. 101000" 
            keyboardType="numeric"
            value={meterInput}
            onChangeText={setMeterInput}
          />

          <Text style={styles.inputLabel}>Testing/Calibration Volume (L)</Text>
          <Text style={{fontSize:10, color:'#666', marginBottom:5}}>Fuel removed for testing (not sold).</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0" 
            keyboardType="numeric"
            value={testingInput}
            onChangeText={setTestingInput}
          />

          <Text style={styles.inputLabel}>Shift Notes (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Any issues? (e.g. Printer stuck)" 
            value={notesInput}
            onChangeText={setNotesInput}
          />

          <TouchableOpacity style={[styles.btn, {backgroundColor:'#f44336'}]} onPress={handleCloseShift}>
             <Text style={styles.btnText}>Close Shift & Reconcile</Text>
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
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 15 },
  inputLabel: { fontWeight:'bold', marginBottom: 5, color:'#333' },
  btn: { backgroundColor: '#4caf50', padding: 15, borderRadius: 8, alignItems: 'center', marginTop:10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '48%', backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  row: { flexDirection:'row', justifyContent:'space-between', marginBottom:5 },
  label: { fontWeight:'bold', color:'#555' }
});