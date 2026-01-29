import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function InventoryScreen() {
  const { user } = useContext(AuthContext);
  const [tanks, setTanks] = useState([]);
  // Refill State
  const [refill, setRefill] = useState({ type: 'Petrol', qty: '' });
  // Price Update State
  const [priceUpdate, setPriceUpdate] = useState({ type: 'Petrol', price: '' });

  const loadData = async () => {
    const res = await db.getAllAsync('SELECT * FROM tanks');
    setTanks(res);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const addFuel = async () => {
    if(!refill.qty) return Alert.alert("Error", "Enter Quantity");
    await db.runAsync('UPDATE tanks SET current_level = current_level + ? WHERE fuel_type = ?', [refill.qty, refill.type]);
    await db.runAsync('INSERT INTO tank_logs (fuel_type, liters_added, date) VALUES (?, ?, ?)', [refill.type, refill.qty, new Date().toLocaleString()]);
    await logAudit(user.username, 'STOCK_REFILL', `Added ${refill.qty}L to ${refill.type}`);
    Alert.alert("Success", "Stock Updated");
    setRefill({ ...refill, qty: '' });
    loadData();
  };

  const updateCostPrice = async () => {
    if(!priceUpdate.price) return Alert.alert("Error", "Enter Price");
    await db.runAsync('UPDATE tanks SET buy_price = ? WHERE fuel_type = ?', [priceUpdate.price, priceUpdate.type]);
    await logAudit(user.username, 'PRICE_UPDATE', `Updated ${priceUpdate.type} Buy Price to ₹${priceUpdate.price}`);
    Alert.alert("Success", "Cost Price Updated");
    setPriceUpdate({ ...priceUpdate, price: '' });
    loadData();
  };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl onRefresh={loadData} refreshing={false} />}>
      <Text style={styles.header}>Underground Tank Status</Text>

      {/* TANK VISUALIZATION */}
      <View style={styles.tankContainer}>
        {tanks.map(tank => {
          const percent = (tank.current_level / tank.capacity) * 100;
          const isLow = tank.current_level < tank.low_alert_level;
          return (
            <View key={tank.fuel_type} style={styles.tankCard}>
              <Text style={styles.tankTitle}>{tank.fuel_type}</Text>
              <View style={styles.gauge}>
                <View style={[styles.fill, { height: `${percent}%`, backgroundColor: tank.fuel_type === 'Petrol' ? '#ff9800' : '#607d8b' }]} />
              </View>
              <Text style={styles.levelText}>{tank.current_level.toFixed(0)} L</Text>
              <Text style={{fontSize:10, color:'#666'}}>Cost: ₹{tank.buy_price || 0}/L</Text>
              {isLow && <Text style={styles.alertText}>⚠️ LOW STOCK</Text>}
            </View>
          );
        })}
      </View>

      {/* REFILL FORM */}
      <View style={styles.form}>
        <Text style={styles.formHeader}>🚛 Log Tanker Refill</Text>
        <View style={{flexDirection:'row', marginBottom:10}}>
           {['Petrol', 'Diesel'].map(t => (
             <TouchableOpacity key={t} onPress={()=>setRefill({...refill, type:t})} style={[styles.chip, refill.type===t && styles.chipActive]}>
               <Text style={refill.type===t?{color:'white'}:{color:'black'}}>{t}</Text>
             </TouchableOpacity>
           ))}
        </View>
        
        <TextInput 
          style={styles.input} 
          placeholder="Quantity (Liters)" 
          placeholderTextColor="#999" // ✅ FIX ADDED
          keyboardType="numeric" 
          value={refill.qty} 
          onChangeText={t => setRefill({...refill, qty:t})} 
        />
        
        <TouchableOpacity style={styles.addBtn} onPress={addFuel}>
          <Text style={{color:'white', fontWeight:'bold'}}>Add Stock</Text>
        </TouchableOpacity>
      </View>

      {/* PROFIT SETTING FORM (Admin Only) */}
      {user.role === 'Admin' && (
        <View style={[styles.form, {marginTop: 20}]}>
          <Text style={styles.formHeader}>💰 Update Buying Price (Cost)</Text>
          <Text style={{fontSize:10, color:'#666', marginBottom:10}}>Used to calculate daily profit.</Text>
          <View style={{flexDirection:'row', marginBottom:10}}>
             {['Petrol', 'Diesel'].map(t => (
               <TouchableOpacity key={t} onPress={()=>setPriceUpdate({...priceUpdate, type:t})} style={[styles.chip, priceUpdate.type===t && styles.chipActive]}>
                 <Text style={priceUpdate.type===t?{color:'white'}:{color:'black'}}>{t}</Text>
               </TouchableOpacity>
             ))}
          </View>
          
          <TextInput 
            style={styles.input} 
            placeholder="New Cost Price (₹/L)" 
            placeholderTextColor="#999" // ✅ FIX ADDED
            keyboardType="numeric" 
            value={priceUpdate.price} 
            onChangeText={t => setPriceUpdate({...priceUpdate, price:t})} 
          />
          
          <TouchableOpacity style={[styles.addBtn, {backgroundColor:'#673ab7'}]} onPress={updateCostPrice}>
            <Text style={{color:'white', fontWeight:'bold'}}>Update Cost</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  tankContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  tankCard: { backgroundColor: 'white', padding: 15, borderRadius: 10, alignItems: 'center', width: '45%', elevation:2 },
  tankTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  gauge: { width: 50, height: 120, borderWidth: 2, borderColor: '#ddd', borderRadius: 25, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor:'#f0f0f0' },
  fill: { width: '100%' },
  levelText: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  alertText: { color: 'red', fontWeight: 'bold', marginTop: 5, fontSize:12 },
  form: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 2 },
  formHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 15 },
  addBtn: { backgroundColor: '#4caf50', padding: 15, borderRadius: 8, alignItems: 'center' },
  chip: { padding: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, marginRight: 10, flex:1, alignItems:'center' },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
});