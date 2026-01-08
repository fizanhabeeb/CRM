import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';

export default function SettingsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [prices, setPrices] = useState({ petrol: '', diesel: '' });
  const [loading, setLoading] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);

  useEffect(() => {
    fetchCurrentPrices();
  }, []);

  const fetchCurrentPrices = async () => {
    try {
      setLoading(true);
      const res = await db.getAllAsync('SELECT * FROM tanks');
      const p = res.find(t => t.fuel_type === 'Petrol');
      const d = res.find(t => t.fuel_type === 'Diesel');

      setPrices({
        petrol: p?.sell_price ? String(p.sell_price) : '100',
        diesel: d?.sell_price ? String(d.sell_price) : '90'
      });
    } catch(e) { 
      console.log("Error fetching prices:", e); 
    } finally {
      setLoading(false);
    }
  };

  const updatePrices = async () => {
    if(!prices.petrol || !prices.diesel) return Alert.alert("Error", "Prices cannot be empty");
    
    const newPetrolPrice = parseFloat(prices.petrol);
    const newDieselPrice = parseFloat(prices.diesel);

    if (isNaN(newPetrolPrice) || isNaN(newDieselPrice)) {
      return Alert.alert("Error", "Please enter valid numbers");
    }

    try {
      setLoading(true);
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = ?', [newPetrolPrice, 'Petrol']);
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = ?', [newDieselPrice, 'Diesel']);
      
      await logAudit(user.username, 'SETTINGS_UPDATE', `Updated Prices: P=${newPetrolPrice}, D=${newDieselPrice}`);
      
      Alert.alert("✅ Success", "Fuel Prices Updated Globally");
    } catch (error) {
      console.log("DB Error:", error);
      Alert.alert("Failed", "Could not update database. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⛽ Fuel Pricing Configuration</Text>
        <Text style={styles.subText}>This updates the default price in New Sale.</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#2196f3" style={{margin: 20}} />
        ) : (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.label}>Petrol Price (₹):</Text>
              <TextInput 
                style={styles.input} 
                value={prices.petrol} 
                onChangeText={t => setPrices(prev => ({...prev, petrol:t}))} 
                keyboardType="numeric" 
                placeholder="0.00"
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.label}>Diesel Price (₹):</Text>
              <TextInput 
                style={styles.input} 
                value={prices.diesel} 
                onChangeText={t => setPrices(prev => ({...prev, diesel:t}))} 
                keyboardType="numeric" 
                placeholder="0.00"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={updatePrices}>
              <Text style={styles.saveBtnText}>Update Prices</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎁 Loyalty Program</Text>
        <View style={styles.rowBetween}>
           <Text>Enable Loyalty Points</Text>
           <Switch value={loyaltyEnabled} onValueChange={setLoyaltyEnabled} />
        </View>
        <Text style={styles.subText}>Current Rule: 1 Liter = 1 Point. 10 Points = ₹1 Discount.</Text>
      </View>

      {/* 3. About & Help - UPDATED NAME */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About & Help</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="business" size={20} color="#666" />
          <Text style={styles.infoText}>FuelCore Station CRM</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color="#666" />
          <Text style={styles.infoText}>Support: +91 98765 43210</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="code-slash" size={20} color="#666" />
          <Text style={styles.infoText}>Version: 5.3.0 (Rebranded)</Text>
        </View>

        <TouchableOpacity style={styles.helpBtn} onPress={() => Alert.alert("User Guide", "1. Dashboard: View Stats & Alerts\n2. New Sale: Bill Customers\n3. Inventory: Check Fuel Levels")}>
           <Ionicons name="book" size={18} color="#2196f3" />
           <Text style={{marginLeft:10, color:'#2196f3', fontWeight:'bold'}}>Read User Guide</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  section: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subText: { fontSize: 12, color: '#888', marginBottom: 15 },
  inputRow: { marginBottom: 15 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  saveBtn: { backgroundColor: '#4caf50', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom:10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { marginLeft: 10, fontSize: 16, color: '#555' },
  helpBtn: { marginTop:10, flexDirection:'row', alignItems:'center', padding:10, backgroundColor:'#e3f2fd', borderRadius:8, justifyContent:'center' }
});