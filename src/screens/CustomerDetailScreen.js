import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, 
  Modal, TextInput, Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db, logAudit } from '../database/db'; // Added logAudit
import * as Linking from 'expo-linking'; 

export default function CustomerDetailScreen({ route }) {
  const { customer } = route.params;
  const [vehicles, setVehicles] = useState([]);
  const [custData, setCustData] = useState(customer);
  
  // Modals
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [newVehicleNo, setNewVehicleNo] = useState('');
  
  // 💳 Payment Modal State
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'Cash', note: '' });

  // AI Churn Prediction
  const [churnRisk, setChurnRisk] = useState({ isRisk: false, avgDays: 0, daysSinceLast: 0 });

  const refreshData = async () => {
    const vRes = await db.getAllAsync('SELECT * FROM vehicles WHERE customer_id = ?', [customer.id]);
    setVehicles(vRes);
    const cRes = await db.getAllAsync('SELECT * FROM customers WHERE id = ?', [customer.id]);
    setCustData(cRes[0]);
    calculateChurnRisk();
  };

  const calculateChurnRisk = async () => {
    try {
      const tRes = await db.getAllAsync('SELECT date FROM transactions WHERE customer_id = ? ORDER BY date ASC', [customer.id]);
      if (tRes.length < 2) return; 

      let totalInterval = 0;
      for (let i = 1; i < tRes.length; i++) {
        const d1 = new Date(tRes[i-1].date);
        const d2 = new Date(tRes[i].date);
        totalInterval += Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
      }
      const avgDays = totalInterval / (tRes.length - 1);
      const daysSinceLast = Math.ceil(Math.abs(new Date() - new Date(tRes[tRes.length - 1].date)) / (1000 * 60 * 60 * 24));

      if (daysSinceLast > (avgDays * 2) && daysSinceLast > 15) {
         setChurnRisk({ isRisk: true, avgDays: Math.ceil(avgDays), daysSinceLast: daysSinceLast });
      } else {
         setChurnRisk({ isRisk: false, avgDays: 0, daysSinceLast: 0 });
      }
    } catch (e) {}
  };

  useFocusEffect(React.useCallback(() => { refreshData(); }, []));

  const handleSaveVehicle = async () => {
    if (!newVehicleNo.trim()) return Alert.alert("Error", "Enter vehicle number");
    await db.runAsync('INSERT INTO vehicles (customer_id, vehicle_no, vehicle_type, fuel_type) VALUES (?, ?, ?, ?)', [customer.id, newVehicleNo, 'Car', 'Petrol']);
    setVehicleModalVisible(false); setNewVehicleNo(''); refreshData();
  };

  const handleReceivePayment = async () => {
    if(!payment.amount || isNaN(payment.amount)) return Alert.alert("Error", "Enter valid amount");
    
    const amt = parseFloat(payment.amount);
    const date = new Date().toISOString().split('T')[0];

    // 1. Record Payment
    await db.runAsync('INSERT INTO payments (customer_id, amount, date, method, note) VALUES (?, ?, ?, ?, ?)', 
      [customer.id, amt, date, payment.method, payment.note]);

    // 2. Reduce Customer Balance (Credit Clearance)
    await db.runAsync('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?', [amt, customer.id]);

    await logAudit('System', 'PAYMENT_RECEIVED', `Received ₹${amt} from ${custData.name}`);
    
    Alert.alert("Success", "Payment Recorded!");
    setPayModalVisible(false);
    setPayment({ amount: '', method: 'Cash', note: '' });
    refreshData();
  };

  const sendReminder = () => {
    const msg = `Hello ${custData.name}, reminder to pay your balance of ₹${custData.current_balance}.`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}&phone=${custData.phone}`);
  };

  return (
    <View style={{flex: 1}}>
      <ScrollView style={styles.container}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{custData.name}</Text>
          <Text style={{color:'#ddd'}}>{custData.address}</Text>
          
          <View style={styles.balanceCard}>
            <Text style={{color:'white'}}>Outstanding Credit</Text>
            <Text style={{fontSize:24, fontWeight:'bold', color:'white'}}>₹ {custData.current_balance.toFixed(2)}</Text>
          </View>

          <View style={{flexDirection:'row', marginTop:15}}>
              {/* 💳 RECEIVE PAYMENT BUTTON */}
              <TouchableOpacity onPress={() => setPayModalVisible(true)} style={[styles.actionBtn, {backgroundColor:'white', marginRight:10}]}>
                 <Ionicons name="cash" size={20} color="#2196f3" />
                 <Text style={{color:'#2196f3', fontWeight:'bold', marginLeft:5}}>Receive Pay</Text>
              </TouchableOpacity>

              {custData.current_balance > 0 && (
                <TouchableOpacity onPress={sendReminder} style={[styles.actionBtn, {backgroundColor:'#25D366'}]}>
                  <Ionicons name="logo-whatsapp" size={20} color="white" />
                  <Text style={{color:'white', fontWeight:'bold', marginLeft:5}}>Reminder</Text>
                </TouchableOpacity>
              )}
          </View>

          {churnRisk.isRisk && (
            <View style={styles.riskCard}>
               <Text style={{fontWeight:'bold', color:'#d32f2f'}}>⚠️ At Risk of Churning</Text>
               <Text style={{color:'#555', fontSize:12}}>Absent for {churnRisk.daysSinceLast} days (Avg: {churnRisk.avgDays}).</Text>
            </View>
          )}
        </View>

        <View style={{padding:15}}>
          <Text style={styles.sectionHeader}>🚙 Vehicles</Text>
          {vehicles.map((v, i) => (
            <View key={i} style={styles.miniCard}>
              <Text style={{fontWeight:'bold'}}>{v.vehicle_no}</Text>
              <Text style={{color:'#666'}}>{v.vehicle_type} • {v.fuel_type}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.smallBtn} onPress={() => setVehicleModalVisible(true)}>
            <Text style={{color:'#2196f3', fontWeight:'bold'}}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PAYMENT MODAL */}
      <Modal visible={payModalVisible} transparent animationType="slide" onRequestClose={()=>setPayModalVisible(false)}>
         <View style={styles.centeredView}>
            <View style={styles.modalView}>
               <Text style={styles.modalTitle}>Receive Payment</Text>
               <Text style={{marginBottom:10, color:'#666'}}>Current Due: ₹{custData.current_balance}</Text>
               
               <TextInput style={styles.modalInput} placeholder="Amount (₹)" keyboardType="numeric" value={payment.amount} onChangeText={t=>setPayment({...payment, amount:t})} />
               <TextInput style={styles.modalInput} placeholder="Note (Optional)" value={payment.note} onChangeText={t=>setPayment({...payment, note:t})} />
               
               <View style={{flexDirection:'row', marginBottom:20}}>
                  {['Cash', 'UPI', 'Bank'].map(m => (
                      <TouchableOpacity key={m} onPress={()=>setPayment({...payment, method:m})} style={[styles.chip, payment.method===m && styles.chipActive]}>
                          <Text style={{color: payment.method===m?'white':'black'}}>{m}</Text>
                      </TouchableOpacity>
                  ))}
               </View>

               <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#4caf50'}]} onPress={handleReceivePayment}>
                  <Text style={styles.modalBtnText}>Confirm Payment</Text>
               </TouchableOpacity>
               <TouchableOpacity onPress={()=>setPayModalVisible(false)} style={{marginTop:15}}>
                  <Text style={{color:'#999'}}>Cancel</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* VEHICLE MODAL */}
      <Modal visible={vehicleModalVisible} transparent animationType="slide" onRequestClose={()=>setVehicleModalVisible(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <TextInput style={styles.modalInput} placeholder="Vehicle No" value={newVehicleNo} onChangeText={setNewVehicleNo} />
            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#2196f3'}]} onPress={handleSaveVehicle}>
               <Text style={styles.modalBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  detailHeader: { backgroundColor: '#2196f3', padding: 20 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  balanceCard: { marginTop: 15, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  actionBtn: { padding: 10, borderRadius: 8, flexDirection:'row', alignItems:'center', justifyContent:'center', flex:1 },
  riskCard: { marginTop: 15, padding: 10, backgroundColor: '#ffebee', borderRadius: 8, borderWidth:1, borderColor:'#ef9a9a' },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  miniCard: { backgroundColor: '#fff', padding: 10, borderRadius: 6, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2196f3', elevation: 1 },
  smallBtn: { marginTop: 5, padding: 15, backgroundColor: '#e3f2fd', borderRadius: 8, alignItems: 'center' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '85%', backgroundColor: 'white', borderRadius: 10, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 15 },
  modalBtn: { width:'100%', padding: 15, borderRadius: 8, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold' },
  chip: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, minWidth:60, alignItems:'center' },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
});