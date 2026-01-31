import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext'; 
import * as FileSystem from 'expo-file-system'; 
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen({ navigation }) {
  const { user, logout, isDarkMode } = useContext(AuthContext);
  const [stats, setStats] = useState({ totalSales: 0, creditOutstanding: 0, totalTxns: 0 });
  const [prediction, setPrediction] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  
  // Daily Price Check
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [todayPrices, setTodayPrices] = useState({ petrol: '', diesel: '' });

  // 🌑 Dark Mode Styles
  const theme = {
    bg: isDarkMode ? '#121212' : '#f5f5f5',
    card: isDarkMode ? '#1e1e1e' : '#fff',
    text: isDarkMode ? '#fff' : '#000',
    subText: isDarkMode ? '#aaa' : '#666',
    border: isDarkMode ? '#333' : '#eee',
    modal: isDarkMode ? '#2c2c2c' : '#fff',
    inputBg: isDarkMode ? '#1e1e1e' : '#fff'
  };

  const fetchStats = async () => {
    try {
      const salesRes = await db.getAllAsync('SELECT SUM(total_amount) as total, COUNT(*) as count FROM transactions');
      const creditRes = await db.getAllAsync('SELECT SUM(current_balance) as outstanding FROM customers');
      setStats({
        totalSales: salesRes[0]?.total || 0,
        totalTxns: salesRes[0]?.count || 0,
        creditOutstanding: creditRes[0]?.outstanding || 0
      });

      const demandRes = await db.getAllAsync('SELECT SUM(quantity) as total_qty, COUNT(DISTINCT date) as days FROM transactions');
      if (demandRes[0].days > 0) {
        setPrediction(demandRes[0].total_qty / demandRes[0].days);
      }

      const shiftRes = await db.getAllAsync('SELECT * FROM shifts WHERE user_id = ? AND status = "OPEN"', [user.id]);
      if(shiftRes.length > 0) setActiveShift(shiftRes[0]);
      else setActiveShift(null);
      
      const newAlerts = [];
      const tankRes = await db.getAllAsync('SELECT * FROM tanks');
      tankRes.forEach(t => {
        if(t.current_level < t.low_alert_level) newAlerts.push({ type: 'warning', msg: `⚠️ Low Stock: ${t.fuel_type}` });
      });
      
      const debtRes = await db.getAllAsync('SELECT COUNT(*) as count FROM customers WHERE current_balance > credit_limit AND credit_limit > 0');
      if (debtRes[0].count > 0) {
        newAlerts.push({ type: 'danger', msg: `🚨 ${debtRes[0].count} Customers exceeded credit limit!` });
      }

      setAlerts(newAlerts);

    } catch (e) { console.log(e); }
  };

  const checkDailyPrice = async () => {
    const today = new Date().toDateString();
    const lastCheck = await AsyncStorage.getItem('last_price_check_date');
    
    if (lastCheck !== today) {
        const res = await db.getAllAsync('SELECT * FROM tanks');
        const p = res.find(t => t.fuel_type === 'Petrol')?.sell_price || 0;
        const d = res.find(t => t.fuel_type === 'Diesel')?.sell_price || 0;
        setTodayPrices({ petrol: String(p), diesel: String(d) });
        setPriceModalVisible(true);
    }
  };

  const confirmPrices = async () => {
    try {
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = "Petrol"', [parseFloat(todayPrices.petrol)]);
      await db.runAsync('UPDATE tanks SET sell_price = ? WHERE fuel_type = "Diesel"', [parseFloat(todayPrices.diesel)]);
      await AsyncStorage.setItem('last_price_check_date', new Date().toDateString());
      setPriceModalVisible(false);
      Alert.alert("Success", "Daily prices confirmed.");
    } catch(e) {
      Alert.alert("Error", "Invalid prices");
    }
  };

  useFocusEffect(React.useCallback(() => { fetchStats(); checkDailyPrice(); }, []));

  // ☁️ BACKUP
  const exportDatabase = async () => {
    try {
      const dbName = 'fuel_crm_v9.db'; // Updated DB Name
      const sourceUri = `${FileSystem.documentDirectory}SQLite/${dbName}`;
      const targetUri = `${FileSystem.cacheDirectory}${dbName}`;
      await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, { dialogTitle: 'Backup DB', mimeType: 'application/x-sqlite3', UTI: 'public.database' });
      }
    } catch (error) { Alert.alert("Backup Failed", error.message); }
  };

  // 🔄 RESTORE
  const restoreDatabase = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (result.canceled) return;
      Alert.alert("⚠️ Restore DB", "This will replace current data. Continue?", [
          { text: "Cancel", style: "cancel" },
          { text: "Restore", style: 'destructive', onPress: async () => {
              const dbName = 'fuel_crm_v9.db';
              await FileSystem.deleteAsync(`${FileSystem.documentDirectory}SQLite/${dbName}`, { idempotent: true });
              await FileSystem.copyAsync({ from: result.assets[0].uri, to: `${FileSystem.documentDirectory}SQLite/${dbName}` });
              Alert.alert("Success", "Restored! Restart app.");
          }}
      ]);
    } catch (err) { console.log(err); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView>
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
         <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>⛽ FuelCore CRM</Text>
            <Text style={[styles.headerSubtitle, { color: theme.subText }]}>User: {user?.username} ({user?.role})</Text>
         </View>
         <TouchableOpacity onPress={() => logout()}>
            <Ionicons name="log-out-outline" size={24} color="red" />
         </TouchableOpacity>
      </View>

      {/* Alerts */}
      {alerts.length > 0 && (
        <View style={styles.alertContainer}>
          {alerts.map((alert, i) => (
            <View key={i} style={[styles.alertBadge, { backgroundColor: alert.type === 'danger' ? '#ffebee' : '#fff3e0' }]}>
               <Ionicons name="alert-circle" size={20} color={alert.type === 'danger' ? '#d32f2f' : '#ff9800'} />
               <Text style={[styles.alertText, { color: alert.type === 'danger' ? '#d32f2f' : '#ef6c00' }]}>{alert.msg}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity 
         style={[styles.shiftBanner, {backgroundColor: activeShift ? '#4caf50' : '#f44336'}]}
         onPress={() => navigation.navigate('Shift')}
      >
         <Ionicons name={activeShift ? "time" : "moon"} size={24} color="white" />
         <View style={{marginLeft: 10}}>
             <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>
                 {activeShift ? "Shift Active" : "Shift Closed"}
             </Text>
         </View>
      </TouchableOpacity>
      
      <View style={styles.predictionCard}>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
           <Text style={{color:'white', fontWeight:'bold'}}>🤖 AI Demand Prediction</Text>
           <Ionicons name="trending-up" color="white" size={20} />
        </View>
        <Text style={{color:'white', fontSize:28, fontWeight:'bold', marginTop:5}}>
           {prediction.toFixed(1)} Liters
        </Text>
      </View>

      <View style={styles.cardContainer}>
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#1a237e' : '#e3f2fd' }]}>
          <Text style={[styles.cardLabel, { color: isDarkMode ? '#bbb' : '#555' }]}>Total Revenue</Text>
          <Text style={[styles.cardValue, { color: isDarkMode ? '#fff' : '#000' }]}>₹ {stats.totalSales.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#3e2723' : '#ffebee' }]}>
          <Text style={[styles.cardLabel, { color: isDarkMode ? '#bbb' : '#555' }]}>Credit Due</Text>
          <Text style={[styles.cardValue, {color:'#d32f2f'}]}>₹ {stats.creditOutstanding.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#4caf50'}]} onPress={() => navigation.navigate('NewSale')}>
          <Ionicons name="filter" size={24} color="#fff" />
          <Text style={styles.actionText}>New Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#795548'}]} onPress={() => navigation.navigate('Inventory')}>
          <Ionicons name="water" size={24} color="#fff" />
          <Text style={styles.actionText}>Fuel Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#9c27b0'}]} onPress={() => navigation.navigate('Expenses')}>
          <Ionicons name="wallet" size={24} color="#fff" />
          <Text style={styles.actionText}>Expenses</Text>
        </TouchableOpacity>

        {user?.role !== 'Operator' && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Customers')}>
            <Ionicons name="people" size={24} color="#fff" />
            <Text style={styles.actionText}>Customers</Text>
          </TouchableOpacity>
        )}

        {user?.role !== 'Operator' && (
          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ff9800'}]} onPress={() => navigation.navigate('Offers')}>
            <Ionicons name="pricetag" size={24} color="#fff" />
            <Text style={styles.actionText}>Offers</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#607d8b'}]} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings" size={24} color="#fff" />
            <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>

        {user?.role === 'Admin' && (
           <>
             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#333'}]} onPress={exportDatabase}>
               <Ionicons name="cloud-upload" size={24} color="#fff" />
               <Text style={styles.actionText}>Backup</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#555'}]} onPress={restoreDatabase}>
               <Ionicons name="cloud-download" size={24} color="#fff" />
               <Text style={styles.actionText}>Restore</Text>
             </TouchableOpacity>
           </>
        )}
      </View>

      {/* PRICE CONFIRM MODAL */}
      <Modal visible={priceModalVisible} transparent animationType="fade">
         <View style={styles.centeredView}>
            <View style={[styles.modalView, { backgroundColor: theme.modal }]}>
               <Text style={[styles.modalTitle, { color: theme.text }]}>☀️ Good Morning!</Text>
               <Text style={{textAlign:'center', marginBottom:15, color: theme.subText}}>Confirm prices for today.</Text>
               
               <Text style={{fontWeight:'bold', marginTop:10, color: theme.text}}>Petrol (₹/L)</Text>
               <TextInput 
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
                  keyboardType="numeric" 
                  value={todayPrices.petrol} 
                  onChangeText={t=>setTodayPrices({...todayPrices, petrol:t})} 
               />
               
               <Text style={{fontWeight:'bold', marginTop:10, color: theme.text}}>Diesel (₹/L)</Text>
               <TextInput 
                  style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBg }]} 
                  keyboardType="numeric" 
                  value={todayPrices.diesel} 
                  onChangeText={t=>setTodayPrices({...todayPrices, diesel:t})} 
               />

               <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#2196f3', marginTop:20, width:'100%'}]} onPress={confirmPrices}>
                  <Text style={{color:'white', fontWeight:'bold'}}>Confirm Prices</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { marginTop: 2 },
  shiftBanner: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginTop: 15, borderRadius: 10, elevation: 2 },
  predictionCard: { margin: 15, padding: 15, backgroundColor: '#673ab7', borderRadius: 10, elevation: 3 },
  cardContainer: { flexDirection: 'row', padding: 10 },
  card: { flex: 1, padding: 15, borderRadius: 10, margin: 5, elevation: 1 },
  cardLabel: { fontSize: 12 },
  cardValue: { fontSize: 18, fontWeight: 'bold', marginTop:5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 }, 
  actionBtn: { width: '45%', backgroundColor: '#2196f3', padding: 15, margin: 8, borderRadius: 8, alignItems: 'center' }, 
  actionText: { color: '#fff', fontWeight: 'bold', marginTop: 5 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalView: { width: '85%', borderRadius: 10, padding: 20, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { width: '100%', borderWidth: 1, padding: 10, borderRadius: 5, marginTop: 5, fontSize:18, textAlign:'center' },
  alertContainer: { padding: 10 },
  alertBadge: { flexDirection: 'row', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 5, marginHorizontal: 5 },
  alertText: { marginLeft: 10, fontWeight: 'bold', fontSize: 12 }
});