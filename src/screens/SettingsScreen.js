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
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Operator' });

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
      
      if (user) {
        await logAudit(user.username, 'SETTINGS_UPDATE', `Updated Prices: P=${newPetrolPrice}, D=${newDieselPrice}`);
      }
      
      Alert.alert("✅ Success", "Fuel Prices Updated Globally");
    } catch (error) {
      console.log("DB Error:", error);
      Alert.alert("Failed", "Could not update database. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createNewUser = async () => {
    if (!newUser.username || !newUser.password) return Alert.alert("Error", "Please enter username and password");

    try {
      const check = await db.getAllAsync('SELECT * FROM users WHERE username = ?', [newUser.username]);
      if (check.length > 0) {
        return Alert.alert("Error", "Username already exists");
      }

      await db.runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
        [newUser.username, newUser.password, newUser.role]);

      if (user) {
        await logAudit(user.username, 'USER_CREATE', `Created new user: ${newUser.username} (${newUser.role})`);
      }
      
      Alert.alert("Success", `User '${newUser.username}' created successfully!`);
      setNewUser({ username: '', password: '', role: 'Operator' }); 
    } catch (e) {
      Alert.alert("Error", "Could not create user");
      console.log(e);
    }
  };

  // 🛡️ Safety Check: If user is missing (logged out), show nothing or a loading view
  if (!user) return <View style={styles.container} />;

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

      {/* 🔐 UPDATED CHECK: Added '?' to prevent crashes */}
      {user?.role === 'Admin' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 User Management</Text>
          <Text style={styles.subText}>Add new staff members to the system.</Text>

          <View style={styles.inputRow}>
            <Text style={styles.label}>New Username:</Text>
            <TextInput 
              style={styles.input} 
              value={newUser.username}
              onChangeText={t => setNewUser({...newUser, username: t})}
              placeholder="e.g. manager1"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Password:</Text>
            <TextInput 
              style={styles.input} 
              value={newUser.password}
              onChangeText={t => setNewUser({...newUser, password: t})}
              placeholder="Enter password"
              secureTextEntry
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Role:</Text>
            <View style={{flexDirection:'row'}}>
              <TouchableOpacity 
                style={[styles.roleBtn, newUser.role === 'Operator' && styles.roleBtnActive]}
                onPress={() => setNewUser({...newUser, role: 'Operator'})}
              >
                <Text style={[styles.roleText, newUser.role === 'Operator' && styles.roleTextActive]}>Operator</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.roleBtn, newUser.role === 'Admin' && styles.roleBtnActive]}
                onPress={() => setNewUser({...newUser, role: 'Admin'})}
              >
                <Text style={[styles.roleText, newUser.role === 'Admin' && styles.roleTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, {backgroundColor:'#673ab7'}]} onPress={createNewUser}>
              <Text style={styles.saveBtnText}>Create User</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎁 Loyalty Program</Text>
        <View style={styles.rowBetween}>
           <Text>Enable Loyalty Points</Text>
           <Switch value={loyaltyEnabled} onValueChange={setLoyaltyEnabled} />
        </View>
        <Text style={styles.subText}>Current Rule: 1 Liter = 1 Point. 10 Points = ₹1 Discount.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ About & Help</Text>
        <View style={styles.infoRow}>
          <Ionicons name="business" size={20} color="#666" />
          <Text style={styles.infoText}>FuelCore Station CRM</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color="#666" />
          <Text style={styles.infoText}>Support: +91 XXXXXXXXXX</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="code-slash" size={20} color="#666" />
          <Text style={styles.infoText}>Version: 5.3.0 (Rebranded)</Text>
        </View>
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
  roleBtn: { flex:1, padding:10, borderWidth:1, borderColor:'#ddd', alignItems:'center', marginRight:10, borderRadius:8 },
  roleBtnActive: { backgroundColor: '#2196f3', borderColor:'#2196f3' },
  roleText: { color: '#666' },
  roleTextActive: { color: 'white', fontWeight:'bold' }
});