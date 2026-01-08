import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, StyleSheet, 
  Modal, TextInput, Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import * as Linking from 'expo-linking'; 

export default function CustomerDetailScreen({ route }) {
  const { customer } = route.params;
  const [vehicles, setVehicles] = useState([]);
  const [custData, setCustData] = useState(customer);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newVehicleNo, setNewVehicleNo] = useState('');

  const refreshData = async () => {
    const vRes = await db.getAllAsync('SELECT * FROM vehicles WHERE customer_id = ?', [customer.id]);
    setVehicles(vRes);
    const cRes = await db.getAllAsync('SELECT * FROM customers WHERE id = ?', [customer.id]);
    setCustData(cRes[0]);
  };

  useFocusEffect(React.useCallback(() => { refreshData(); }, []));

  const handleSaveVehicle = async () => {
    if (!newVehicleNo.trim()) {
      Alert.alert("Error", "Please enter a vehicle number");
      return;
    }

    try {
      await db.runAsync(
        'INSERT INTO vehicles (customer_id, vehicle_no, vehicle_type, fuel_type) VALUES (?, ?, ?, ?)', 
        [customer.id, newVehicleNo, 'Car', 'Petrol']
      );
      setModalVisible(false); // Close popup
      setNewVehicleNo(''); // Clear text
      refreshData(); // Update list
    } catch (e) {
      console.log(e);
    }
  };

  // ✅ UPDATED NAME HERE
  const sendReminder = () => {
    const msg = `Hello ${custData.name}, this is a gentle reminder to pay your outstanding balance of ₹${custData.current_balance} at FuelCore Station.`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}&phone=${custData.phone}`;
    Linking.openURL(url).catch(() => {
        Alert.alert("Error", "WhatsApp is not installed");
    });
  };

  return (
    <View style={{flex: 1}}>
      <ScrollView style={styles.container}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{custData.name}</Text>
          <Text style={{color:'#ddd'}}>{custData.address}</Text>
          
          <View style={styles.balanceCard}>
            <Text style={{color:'white'}}>Outstanding Credit</Text>
            <Text style={{fontSize:24, fontWeight:'bold', color:'white'}}>₹ {custData.current_balance}</Text>
          </View>

          {custData.current_balance > 0 && (
            <TouchableOpacity onPress={sendReminder} style={{backgroundColor:'#25D366', padding:10, borderRadius:8, marginTop:10, flexDirection:'row', justifyContent:'center', alignItems:'center'}}>
              <Ionicons name="logo-whatsapp" size={20} color="white" />
              <Text style={{color:'white', fontWeight:'bold', marginLeft:5}}>Send Payment Reminder</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.balanceCard, {backgroundColor: '#ff9800', marginTop: 10}]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
               <View>
                 <Text style={{color:'white'}}>Loyalty Points</Text>
                 <Text style={{fontSize:24, fontWeight:'bold', color:'white'}}>⭐ {custData.loyalty_points || 0}</Text>
               </View>
               <Ionicons name="gift" size={40} color="white" />
            </View>
            <Text style={{color:'white', fontSize:12, marginTop: 5}}>1 Liter = 1 Point</Text>
          </View>
        </View>

        <View style={{padding:15}}>
          <Text style={styles.sectionHeader}>🚙 Vehicles</Text>
          {vehicles.map((v, i) => (
            <View key={i} style={styles.miniCard}>
              <Text style={{fontWeight:'bold'}}>{v.vehicle_no}</Text>
              <Text style={{color:'#666'}}>{v.vehicle_type} • {v.fuel_type}</Text>
            </View>
          ))}
          
          <TouchableOpacity style={styles.smallBtn} onPress={() => setModalVisible(true)}>
            <Text style={{color:'#2196f3', fontWeight:'bold', fontSize: 16}}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Add New Vehicle</Text>
            
            <TextInput 
              style={styles.modalInput}
              placeholder="Enter Vehicle No (e.g. KL-10-AB-1234)"
              value={newVehicleNo}
              onChangeText={setNewVehicleNo}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, {backgroundColor: '#ff5252'}]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, {backgroundColor: '#2196f3'}]} 
                onPress={handleSaveVehicle}
              >
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
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
  sectionHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  miniCard: { backgroundColor: '#fff', padding: 10, borderRadius: 6, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#2196f3', elevation: 1 },
  smallBtn: { marginTop: 5, padding: 15, backgroundColor: '#e3f2fd', borderRadius: 8, alignItems: 'center' },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '80%', backgroundColor: 'white', borderRadius: 10, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 20 },
  modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtn: { flex: 1, padding: 10, borderRadius: 5, marginHorizontal: 5, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold' }
});