import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext'; 
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext); 
  const [stats, setStats] = useState({ totalSales: 0, creditOutstanding: 0, totalTxns: 0 });
  const [prediction, setPrediction] = useState(0);
  const [alerts, setAlerts] = useState([]);

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
        const avgDaily = demandRes[0].total_qty / demandRes[0].days;
        setPrediction(avgDaily);
      }

      const newAlerts = [];
      const tankRes = await db.getAllAsync('SELECT * FROM tanks');
      tankRes.forEach(t => {
        if(t.current_level < t.low_alert_level) {
          newAlerts.push({ type: 'warning', msg: `⚠️ Low Stock: ${t.fuel_type} is below ${t.low_alert_level}L` });
        }
      });
      const debtRes = await db.getAllAsync('SELECT COUNT(*) as count FROM customers WHERE current_balance > credit_limit AND credit_limit > 0');
      if (debtRes[0].count > 0) {
        newAlerts.push({ type: 'danger', msg: `🚨 ${debtRes[0].count} Customers exceeded credit limit!` });
      }
      setAlerts(newAlerts);

    } catch (e) { console.log(e); }
  };

  useFocusEffect(React.useCallback(() => { fetchStats(); }, []));

  const exportDatabase = async () => {
    try {
      const dbName = 'fuel_crm_v6.db'; 
      const sourceUri = `${FileSystem.documentDirectory}SQLite/${dbName}`;
      const targetUri = `${FileSystem.cacheDirectory}${dbName}`;
      await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, { dialogTitle: 'Backup DB', mimeType: 'application/x-sqlite3', UTI: 'public.database' });
      }
    } catch (error) { Alert.alert("Backup Failed", error.message); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
      <View style={styles.header}>
         <View>
            {/* ✅ UPDATED NAME */}
            <Text style={styles.headerTitle}>⛽ FuelCore CRM</Text>
            <Text style={styles.headerSubtitle}>User: {user?.username} ({user?.role})</Text>
         </View>
         <TouchableOpacity onPress={() => { logout(); navigation.replace('Login'); }}>
            <Ionicons name="log-out-outline" size={24} color="red" />
         </TouchableOpacity>
      </View>

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
      
      <View style={styles.predictionCard}>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
           <Text style={{color:'white', fontWeight:'bold'}}>🤖 AI Demand Prediction</Text>
           <Ionicons name="trending-up" color="white" size={20} />
        </View>
        <Text style={{color:'white', fontSize:12, marginTop:5}}>Based on sales history, tomorrow you need:</Text>
        <Text style={{color:'white', fontSize:28, fontWeight:'bold', marginTop:5}}>
           {prediction.toFixed(1)} Liters
        </Text>
        <Text style={{color:'#e3f2fd', fontSize:10}}>Ensure stock availability.</Text>
      </View>

      <View style={styles.cardContainer}>
        <View style={[styles.card, { backgroundColor: '#e3f2fd' }]}>
          <Text style={styles.cardLabel}>Total Revenue</Text>
          <Text style={styles.cardValue}>₹ {stats.totalSales.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#ffebee' }]}>
          <Text style={styles.cardLabel}>Credit Due</Text>
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
           <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#333'}]} onPress={exportDatabase}>
             <Ionicons name="cloud-upload" size={24} color="#fff" />
             <Text style={styles.actionText}>Backup</Text>
           </TouchableOpacity>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#666', marginTop: 2 },
  predictionCard: { margin: 15, padding: 15, backgroundColor: '#673ab7', borderRadius: 10, elevation: 3 },
  cardContainer: { flexDirection: 'row', padding: 10 },
  card: { flex: 1, padding: 15, borderRadius: 10, margin: 5, elevation: 1 },
  cardLabel: { fontSize: 12, color: '#555' },
  cardValue: { fontSize: 18, fontWeight: 'bold', marginTop:5 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 }, 
  actionBtn: { width: '45%', backgroundColor: '#2196f3', padding: 15, margin: 8, borderRadius: 8, alignItems: 'center' }, 
  actionText: { color: '#fff', fontWeight: 'bold', marginTop: 5 },
  alertContainer: { padding: 10 },
  alertBadge: { flexDirection: 'row', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 5, marginHorizontal: 5 },
  alertText: { marginLeft: 10, fontWeight: 'bold', fontSize: 12 }
});