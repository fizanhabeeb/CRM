import React, { useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { FUEL_TYPES } from '../utils/constants';

export default function InventoryScreen() {
  const { user, theme, isDarkMode } = useContext(AuthContext); // 🎨
  const [tanks, setTanks] = useState([]);
  const [tanker, setTanker] = useState({ fuelType: 'Petrol', qty: '', dipBefore: '', dipAfter: '', newPrice: '' });

  const loadData = async () => {
    const res = await db.getAllAsync('SELECT * FROM tanks');
    setTanks(res);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleStockArrival = async () => {
    if(!tanker.qty || !tanker.dipBefore || !tanker.dipAfter || !tanker.newPrice) {
        return Alert.alert("Error", "Fill all fields");
    }
    const qty = parseFloat(tanker.qty);
    const price = parseFloat(tanker.newPrice);
    
    const tRes = await db.getAllAsync('SELECT buy_price FROM tanks WHERE fuel_type = ?', [tanker.fuelType]);
    const oldPrice = tRes[0]?.buy_price || 0;

    await db.runAsync('UPDATE tanks SET current_level = current_level + ?, buy_price = ? WHERE fuel_type = ?', [qty, price, tanker.fuelType]);
    await db.runAsync(`INSERT INTO tanker_logs (fuel_type, quantity, dip_before, dip_after, old_buy_price, new_buy_price, date) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [tanker.fuelType, qty, tanker.dipBefore, tanker.dipAfter, oldPrice, price, new Date().toLocaleString()]);

    await logAudit(user.username, 'TANKER_UNLOAD', `Added ${qty}L ${tanker.fuelType} @ ₹${price}`);
    Alert.alert("✅ Success", "Stock & Price Updated!");
    setTanker({ fuelType: 'Petrol', qty: '', dipBefore: '', dipAfter: '', newPrice: '' });
    loadData();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} refreshControl={<RefreshControl onRefresh={loadData} refreshing={false} />}>
      <Text style={[styles.header, { color: theme.text }]}>Underground Tank Status</Text>

      <View style={styles.tankContainer}>
        {tanks.map(tank => {
          const percent = Math.min((tank.current_level / tank.capacity) * 100, 100);
          return (
            <View key={tank.fuel_type} style={[styles.tankCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.tankTitle, { color: theme.text }]}>{tank.fuel_type}</Text>
              <View style={[styles.gauge, { borderColor: theme.border, backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
                <View style={[styles.fill, { height: `${percent}%`, backgroundColor: tank.fuel_type === 'Petrol' ? '#ff9800' : '#607d8b' }]} />
              </View>
              <Text style={[styles.levelText, { color: theme.text }]}>{tank.current_level.toFixed(0)} L</Text>
              <Text style={{fontSize:10, color: theme.subText}}>Buy: ₹{tank.buy_price || 0}/L</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.form, { backgroundColor: theme.card }]}>
        <Text style={[styles.formHeader, { color: theme.text }]}>🚛 Tanker Stock Arrival</Text>
        
        <View style={{flexDirection:'row', marginBottom:15}}>
           {FUEL_TYPES.map(t => (
             <TouchableOpacity key={t} onPress={()=>setTanker({...tanker, fuelType:t})} style={[styles.chip, { borderColor: theme.border }, tanker.fuelType===t && styles.chipActive]}>
               <Text style={tanker.fuelType===t?{color:'white'}:{color: theme.text}}>{t}</Text>
             </TouchableOpacity>
           ))}
        </View>
        
        <View style={styles.row}>
            <TextInput style={[styles.input, {flex:1, marginRight:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} placeholderTextColor={theme.subText} placeholder="Invoice Qty (L)" keyboardType="numeric" value={tanker.qty} onChangeText={t=>setTanker({...tanker, qty:t})} />
            <TextInput style={[styles.input, {flex:1, marginLeft:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} placeholderTextColor={theme.subText} placeholder="New Buy Price (₹)" keyboardType="numeric" value={tanker.newPrice} onChangeText={t=>setTanker({...tanker, newPrice:t})} />
        </View>
        <View style={styles.row}>
            <TextInput style={[styles.input, {flex:1, marginRight:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} placeholderTextColor={theme.subText} placeholder="Dip Before" keyboardType="numeric" value={tanker.dipBefore} onChangeText={t=>setTanker({...tanker, dipBefore:t})} />
            <TextInput style={[styles.input, {flex:1, marginLeft:5, color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} placeholderTextColor={theme.subText} placeholder="Dip After" keyboardType="numeric" value={tanker.dipAfter} onChangeText={t=>setTanker({...tanker, dipAfter:t})} />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleStockArrival}>
          <Text style={{color:'white', fontWeight:'bold'}}>Confirm Arrival</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  tankContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30 },
  tankCard: { padding: 15, borderRadius: 10, alignItems: 'center', width: '45%', elevation:2 },
  tankTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  gauge: { width: 50, height: 120, borderWidth: 2, borderRadius: 25, justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { width: '100%' },
  levelText: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  form: { padding: 20, borderRadius: 10, elevation: 2, marginBottom: 50 },
  formHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, padding: 10, borderRadius: 8, marginBottom: 15 },
  addBtn: { backgroundColor: '#673ab7', padding: 15, borderRadius: 8, alignItems: 'center' },
  chip: { padding: 10, borderWidth: 1, borderRadius: 20, marginRight: 10, flex:1, alignItems:'center' },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  row: { flexDirection: 'row' }
});