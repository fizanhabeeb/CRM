import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, logAudit } from '../database/db'; //
import { AuthContext } from '../context/AuthContext'; //

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export default function SettingsScreen({ navigation }) {
  const { user, isDarkMode, toggleTheme } = useContext(AuthContext);
  
  const [prices, setPrices] = useState({ petrol: '', diesel: '' });
  const [loading, setLoading] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  
  // User Management State
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'Operator' });
  const [usersList, setUsersList] = useState([]);
  
  // Edit Password Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Dynamic Styles
  const themeStyles = {
    container: { backgroundColor: isDarkMode ? '#121212' : '#f5f5f5' },
    section: { backgroundColor: isDarkMode ? '#1e1e1e' : 'white' },
    text: { color: isDarkMode ? '#ffffff' : '#333333' },
    subText: { color: isDarkMode ? '#aaaaaa' : '#888888' },
    input: { 
      borderColor: isDarkMode ? '#333' : '#ddd', 
      color: isDarkMode ? '#fff' : '#000',
      backgroundColor: isDarkMode ? '#2c2c2c' : '#fff'
    },
    userRow: { borderColor: isDarkMode ? '#333' : '#eee' }
  };

  useEffect(() => {
    fetchCurrentPrices();
    if (user?.role === 'Admin') fetchUsers();
  }, [user]);

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
    } catch(e) { console.log("Error fetching prices:", e); } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await db.getAllAsync('SELECT * FROM users');
      setUsersList(res);
    } catch (e) { console.log("Error fetching users:", e); }
  };

  const updatePrices = async () => {
    if(!prices.petrol || !prices.diesel) return Alert.alert("Error", "Prices cannot be empty");
    const newPetrol = parseFloat(prices.petrol);
    const newDiesel = parseFloat(prices.diesel);

    if (isNaN(newPetrol) || isNaN(newDiesel)) return Alert.alert("Error", "Enter valid numbers");

    try {
      setLoading(true);
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = ?', [newPetrol, 'Petrol']);
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = ?', [newDiesel, 'Diesel']);
      if (user) await logAudit(user.username, 'SETTINGS_UPDATE', `Updated Prices: P=${newPetrol}, D=${newDiesel}`);
      Alert.alert("✅ Success", "Fuel Prices Updated Globally");
    } catch (error) {
      Alert.alert("Failed", "Could not update: " + error.message);
    } finally { setLoading(false); }
  };

  const createNewUser = async () => {
    if (!newUser.username || !newUser.password) return Alert.alert("Error", "Enter username/password");
    try {
      const check = await db.getAllAsync('SELECT * FROM users WHERE username = ?', [newUser.username]);
      if (check.length > 0) return Alert.alert("Error", "Username already exists");

      await db.runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [newUser.username, newUser.password, newUser.role]);
      Alert.alert("Success", "User Created");
      setNewUser({ username: '', password: '', role: 'Operator' });
      fetchUsers();
    } catch (e) { Alert.alert("Error", "Could not create user"); }
  };

  const deleteUser = (id, username) => {
    if (id === user.id) return Alert.alert("Error", "Cannot delete yourself");
    Alert.alert("Delete", `Delete ${username}?`, [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
          await db.runAsync('DELETE FROM users WHERE id = ?', [id]);
          fetchUsers();
          await logAudit(user.username, 'USER_DELETE', `Deleted user: ${username}`);
      }}
    ]);
  };

  const savePassword = async () => {
    if (!newPassword) return Alert.alert("Error", "Password empty");
    await db.runAsync('UPDATE users SET password = ? WHERE id = ?', [newPassword, selectedUser.id]);
    setModalVisible(false);
    fetchUsers();
    Alert.alert("Success", "Password Updated");
    await logAudit(user.username, 'USER_UPDATE', `Changed password for: ${selectedUser.username}`);
  };

  // ✅ BACKUP
  const handleBackup = async () => {
    try {
      setLoading(true);
      const dbName = 'fuel_crm_v9.db';
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbName}`;
      const backupPath = `${FileSystem.documentDirectory}${dbName}`; 

      const info = await FileSystem.getInfoAsync(dbPath);
      if (!info.exists) {
        Alert.alert("Error", "Database file not found at: " + dbPath);
        return;
      }

      await FileSystem.copyAsync({ from: dbPath, to: backupPath });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          dialogTitle: 'Backup Database',
          UTI: 'public.database',
          mimeType: 'application/x-sqlite3'
        });
      } else {
        Alert.alert("Success", "Backup saved to Documents folder (Sharing not available)");
      }
    } catch (error) {
      Alert.alert("Backup Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔄 RESTORE (Moved from Dashboard)
  const restoreDatabase = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (result.canceled) return;
      
      Alert.alert(
        "⚠️ DANGER: Restore Database", 
        "This will DELETE all current data and replace it with the selected file.\n\nAre you sure?", 
        [
          { text: "Cancel", style: "cancel" },
          { text: "Restore & Restart", style: 'destructive', onPress: async () => {
              const dbName = 'fuel_crm_v9.db';
              await FileSystem.deleteAsync(`${FileSystem.documentDirectory}SQLite/${dbName}`, { idempotent: true });
              await FileSystem.copyAsync({ from: result.assets[0].uri, to: `${FileSystem.documentDirectory}SQLite/${dbName}` });
              Alert.alert("✅ Success", "Data restored successfully! Please restart the app.");
          }}
        ]
      );
    } catch (err) { 
      console.log(err); 
      Alert.alert("Error", "Restore failed: " + err.message);
    }
  };

  if (!user) return <View style={[styles.container, themeStyles.container]} />;

  return (
    <View style={{flex:1}}>
    <ScrollView style={[styles.container, themeStyles.container]}>
      
      {/* 🎨 Appearance */}
      <View style={[styles.section, themeStyles.section]}>
        <Text style={[styles.sectionTitle, themeStyles.text]}>🎨 Appearance</Text>
        <View style={styles.rowBetween}>
           <View style={{flexDirection:'row', alignItems:'center'}}>
             <Ionicons name={isDarkMode ? "moon" : "sunny"} size={20} color={isDarkMode ? "#bb86fc" : "#f57c00"} />
             <Text style={[themeStyles.text, {marginLeft: 10}]}>Dark Mode</Text>
           </View>
           <Switch value={isDarkMode} onValueChange={toggleTheme} trackColor={{ false: "#767577", true: "#bb86fc" }} thumbColor={isDarkMode ? "#fff" : "#f4f3f4"} />
        </View>
      </View>

      {/* ⛽ Fuel Pricing */}
      <View style={[styles.section, themeStyles.section]}>
        <Text style={[styles.sectionTitle, themeStyles.text]}>⛽ Fuel Pricing</Text>
        <Text style={[styles.subText, themeStyles.subText]}>This updates the default price in New Sale.</Text>
        {loading ? <ActivityIndicator color="#2196f3" /> : (
          <>
            <View style={styles.inputRow}>
              <Text style={[styles.label, themeStyles.text]}>Petrol Price (₹):</Text>
              <TextInput style={[styles.input, themeStyles.input]} value={prices.petrol} onChangeText={t=>setPrices({...prices, petrol:t})} placeholder="0.00" placeholderTextColor="#888" keyboardType="numeric"/>
            </View>
            <View style={styles.inputRow}>
              <Text style={[styles.label, themeStyles.text]}>Diesel Price (₹):</Text>
              <TextInput style={[styles.input, themeStyles.input]} value={prices.diesel} onChangeText={t=>setPrices({...prices, diesel:t})} placeholder="0.00" placeholderTextColor="#888" keyboardType="numeric"/>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={updatePrices}><Text style={styles.saveBtnText}>Update Prices</Text></TouchableOpacity>
          </>
        )}
      </View>

      {/* 📂 DATA MANAGEMENT (Backup & Restore) */}
      <View style={[styles.section, themeStyles.section]}>
        <Text style={[styles.sectionTitle, themeStyles.text]}>📂 Data Management</Text>
        <Text style={[styles.subText, themeStyles.subText]}>Backup or restore your database.</Text>
        
        <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#ff9800'}]} onPress={handleBackup}>
           <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
             <Ionicons name="cloud-upload-outline" size={20} color="white" style={{marginRight:8}}/>
             <Text style={styles.saveBtnText}>Backup Database</Text>
           </View>
        </TouchableOpacity>

        {user?.role === 'Admin' && (
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#555', marginTop: 15}]} onPress={restoreDatabase}>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
              <Ionicons name="cloud-download-outline" size={20} color="white" style={{marginRight:8}}/>
              <Text style={styles.saveBtnText}>Restore Database</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* 👤 Admin Panel */}
      {user?.role === 'Admin' && (
        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>👤 User Management</Text>
          <Text style={[styles.subText, themeStyles.subText]}>Add new staff members to the system.</Text>
          
          <View style={styles.inputRow}>
             <Text style={[styles.label, themeStyles.text]}>New Username:</Text>
             <TextInput style={[styles.input, themeStyles.input]} value={newUser.username} onChangeText={t=>setNewUser({...newUser, username:t})} placeholder="e.g. manager1" placeholderTextColor="#888" autoCapitalize="none"/>
          </View>

          <View style={styles.inputRow}>
             <Text style={[styles.label, themeStyles.text]}>Password:</Text>
             <TextInput style={[styles.input, themeStyles.input]} value={newUser.password} onChangeText={t=>setNewUser({...newUser, password:t})} placeholder="Enter password" placeholderTextColor="#888" secureTextEntry/>
          </View>
          
          <View style={[styles.inputRow, {flexDirection:'row'}]}>
             <Text style={[styles.label, themeStyles.text, {marginRight:10, alignSelf:'center'}]}>Role:</Text>
             {['Operator', 'Admin'].map(r => (
               <TouchableOpacity key={r} onPress={()=>setNewUser({...newUser, role:r})} style={[styles.roleBtn, newUser.role===r && styles.roleBtnActive, {borderColor: isDarkMode?'#444':'#ddd'}]}>
                 <Text style={[styles.roleText, newUser.role===r && styles.roleTextActive, {color: isDarkMode && newUser.role!==r ?'#aaa':'#666'}]}>{r}</Text>
               </TouchableOpacity>
             ))}
          </View>
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor:'#673ab7'}]} onPress={createNewUser}><Text style={styles.saveBtnText}>Create User</Text></TouchableOpacity>

          <Text style={[styles.sectionTitle, themeStyles.text, {marginTop: 25}]}>📋 Existing Staff</Text>
          {usersList.map((u, i) => (
             <View key={i} style={[styles.userRow, themeStyles.userRow]}>
                <View>
                   <Text style={[themeStyles.text, {fontWeight:'bold', fontSize:16}]}>{u.username} <Text style={{fontSize:12, color:'#666'}}>({u.role})</Text></Text>
                   <Text style={{color:'#999', fontSize:10}}>ID: {u.id}</Text>
                </View>
                <View style={{flexDirection:'row'}}>
                   <TouchableOpacity onPress={() => { setSelectedUser(u); setNewPassword(u.password); setModalVisible(true); }} style={styles.iconBtn}><Ionicons name="pencil" size={20} color="#2196f3" /></TouchableOpacity>
                   {u.id !== user.id && <TouchableOpacity onPress={() => deleteUser(u.id, u.username)} style={[styles.iconBtn, {backgroundColor:'#ffebee'}]}><Ionicons name="trash" size={20} color="#d32f2f" /></TouchableOpacity>}
                </View>
             </View>
          ))}
        </View>
      )}

      {/* 🎁 LOYALTY SECTION */}
      <View style={[styles.section, themeStyles.section]}>
        <Text style={[styles.sectionTitle, themeStyles.text]}>🎁 Loyalty Program</Text>
        <View style={styles.rowBetween}>
           <Text style={themeStyles.text}>Enable Loyalty Points</Text>
           <Switch value={loyaltyEnabled} onValueChange={setLoyaltyEnabled} />
        </View>
        <Text style={[styles.subText, themeStyles.subText]}>Current Rule: 1 Liter = 1 Point. 10 Points = ₹1 Discount.</Text>
      </View>

      {/* ℹ️ About & Help */}
      <View style={[styles.section, themeStyles.section]}>
        <Text style={[styles.sectionTitle, themeStyles.text]}>ℹ️ About & Help</Text>
        <View style={styles.infoRow}>
          <Ionicons name="business" size={20} color={isDarkMode ? "#aaa" : "#666"} />
          <Text style={[styles.infoText, themeStyles.text]}>FuelCore Station CRM</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={20} color={isDarkMode ? "#aaa" : "#666"} />
          <Text style={[styles.infoText, themeStyles.text]}>Support: +91 XXXXXXXXXX</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="code-slash" size={20} color={isDarkMode ? "#aaa" : "#666"} />
          <Text style={[styles.infoText, themeStyles.text]}>Version: 5.5.0 (Full Features)</Text>
        </View>
      </View>

    </ScrollView>

    {/* Edit Password Modal */}
    <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={()=>setModalVisible(false)}>
       <View style={styles.centeredView}>
          <View style={[styles.modalView, {backgroundColor: isDarkMode ? '#1e1e1e' : 'white'}]}>
             <Text style={[styles.modalTitle, themeStyles.text]}>Edit Password: {selectedUser?.username}</Text>
             <TextInput style={[styles.modalInput, themeStyles.input]} value={newPassword} onChangeText={setNewPassword} placeholder="New Password" placeholderTextColor="#888"/>
             <View style={styles.modalActions}>
                <TouchableOpacity onPress={()=>setModalVisible(false)} style={[styles.modalBtn, {backgroundColor:'#ff5252'}]}><Text style={styles.modalBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={savePassword} style={[styles.modalBtn, {backgroundColor:'#2196f3'}]}><Text style={styles.modalBtnText}>Update</Text></TouchableOpacity>
             </View>
          </View>
       </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  section: { padding: 20, borderRadius: 10, marginBottom: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  subText: { fontSize: 12, marginBottom: 15 },
  inputRow: { marginBottom: 15 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  saveBtn: { backgroundColor: '#4caf50', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom:10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { marginLeft: 10, fontSize: 16 },
  roleBtn: { flex:1, padding:10, borderWidth:1, alignItems:'center', marginRight:10, borderRadius:8 },
  roleBtnActive: { backgroundColor: '#2196f3', borderColor:'#2196f3' },
  roleText: { },
  roleTextActive: { color: 'white', fontWeight:'bold' },
  userRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:1 },
  iconBtn: { padding:8, borderRadius:50, backgroundColor:'#e3f2fd', marginLeft:10 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '85%', borderRadius: 10, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 20 },
  modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  modalBtn: { flex: 1, padding: 10, borderRadius: 5, marginHorizontal: 5, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold' }
});