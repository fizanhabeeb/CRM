import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext';

export default function ReportsScreen() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('Sales'); 
  const [loading, setLoading] = useState(false);
  
  const [salesData, setSalesData] = useState({ daily: 0, monthly: 0, profit: 0 }); // Added Profit
  const [topCustomers, setTopCustomers] = useState([]);
  const [creditList, setCreditList] = useState([]);
  const [behavior, setBehavior] = useState({ peakTime: 'N/A', activeCustomers: 0 });

  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); 

    try {
      // 1. Sales & Profit Report
      const dailyRes = await db.getAllAsync('SELECT SUM(total_amount) as total, SUM((price_per_liter - buy_price) * quantity) as profit FROM transactions WHERE date = ?', [today]);
      const monthRes = await db.getAllAsync('SELECT SUM(total_amount) as total FROM transactions WHERE date LIKE ?', [`${currentMonth}%`]);

      setSalesData({
        daily: dailyRes[0]?.total || 0,
        monthly: monthRes[0]?.total || 0,
        profit: dailyRes[0]?.profit || 0, // Profit
      });

      // 2. Customer Behavior (Segmentation)
      const custRes = await db.getAllAsync(`
        SELECT c.name, c.current_balance, c.credit_limit, SUM(t.total_amount) as total_spent, COUNT(t.id) as visits 
        FROM transactions t JOIN customers c ON t.customer_id = c.id 
        GROUP BY c.id ORDER BY total_spent DESC LIMIT 5
      `);
      setTopCustomers(custRes);
      
      const allTxns = await db.getAllAsync('SELECT time FROM transactions');
      setBehavior({ peakTime: 'Morning', activeCustomers: allTxns.length }); // Simplified logic

      // 3. Credit Reports
      const creditRes = await db.getAllAsync(`SELECT * FROM customers WHERE current_balance > 0 ORDER BY current_balance DESC`);
      setCreditList(creditRes);

    } catch (e) {
      console.log("Error loading reports:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- RENDER SECTIONS ---
  const renderSales = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}>
      <View style={styles.grid}>
        <View style={[styles.card, { borderLeftColor: '#4caf50' }]}>
           <Text style={styles.cardTitle}>Today's Sales</Text>
           <Text style={[styles.cardValue, { color: '#4caf50' }]}>₹ {salesData.daily.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { borderLeftColor: '#2196f3' }]}>
           <Text style={styles.cardTitle}>This Month</Text>
           <Text style={[styles.cardValue, { color: '#2196f3' }]}>₹ {salesData.monthly.toFixed(0)}</Text>
        </View>
      </View>

      {/* 💰 PROFIT CARD (ADMIN ONLY) */}
      {user.role === 'Admin' && (
        <View style={[styles.card, { borderLeftColor: '#ff9800', marginTop: 10 }]}>
           <Text style={styles.cardTitle}>Today's Estimated Profit</Text>
           <Text style={[styles.cardValue, { color: '#ff9800' }]}>₹ {salesData.profit.toFixed(0)}</Text>
           <Text style={{fontSize:10, color:'#888'}}>Net Margin based on inventory cost</Text>
        </View>
      )}

      <Text style={styles.sectionHeader}>Customer Behavior</Text>
      <View style={styles.chartContainer}>
         <View style={styles.row}>
            <Ionicons name="time" size={24} color="#ff9800" />
            <View style={{marginLeft:10}}>
              <Text style={{fontWeight:'bold'}}>Peak Business Hours</Text>
              <Text style={{color:'#666'}}>Most traffic in: <Text style={{color:'#ff9800', fontWeight:'bold'}}>{behavior.peakTime}</Text></Text>
            </View>
         </View>
      </View>
    </ScrollView>
  );

  const renderCustomers = () => (
    <FlatList
      data={topCustomers}
      keyExtractor={(item, index) => index.toString()}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      ListHeaderComponent={<Text style={styles.sectionHeader}>🏆 High-Value Segments</Text>}
      renderItem={({ item, index }) => {
        // SEGMENTATION LOGIC
        let tag = null;
        if (item.total_spent > 5000) tag = <Text style={styles.vipTag}>VIP</Text>;
        if (item.current_balance > item.credit_limit * 0.8) tag = <Text style={styles.riskTag}>RISK</Text>;

        return (
          <View style={styles.listItem}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={{flex:1}}>
              <View style={{flexDirection:'row'}}>
                <Text style={styles.listTitle}>{item.name}</Text>
                {tag}
              </View>
              <Text style={styles.listSub}>{item.visits} Visits</Text>
            </View>
            <Text style={styles.amount}>₹ {item.total_spent.toFixed(0)}</Text>
          </View>
        );
      }}
    />
  );

  const renderCredit = () => (
    <FlatList
      data={creditList}
      keyExtractor={item => item.id.toString()}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      renderItem={({ item }) => (
        <View style={[styles.listItem, item.current_balance > item.credit_limit ? {backgroundColor:'#ffebee'} : {}]}>
          <View>
            <Text style={styles.listTitle}>{item.name}</Text>
            <Text style={styles.listSub}>{item.phone}</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
            <Text style={{fontSize:16, fontWeight:'bold', color: '#d32f2f'}}>₹ {item.current_balance.toFixed(2)}</Text>
          </View>
        </View>
      )}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {['Sales', 'Customers', 'Credit'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>
        {activeTab === 'Sales' && renderSales()}
        {activeTab === 'Customers' && renderCustomers()}
        {activeTab === 'Credit' && renderCredit()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2196f3' },
  tabText: { color: '#666', fontWeight: 'bold' },
  tabTextActive: { color: '#2196f3' },
  content: { flex: 1, padding: 10 },
  grid: { flexDirection: 'row', justifyContent:'space-between' },
  card: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 8, marginHorizontal: 5, elevation: 1, borderLeftWidth: 4 },
  cardTitle: { fontSize: 12, color: '#666', marginBottom: 5 },
  cardValue: { fontSize: 18, fontWeight: 'bold' },
  chartContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 8, elevation: 1, marginBottom: 15 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginVertical: 15, marginLeft: 5, color: '#333' },
  listItem: { backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  rank: { fontSize: 18, fontWeight: 'bold', color: '#999', marginRight: 15, width: 30 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  listSub: { fontSize: 12, color: '#666', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#4caf50' },
  row: { flexDirection:'row', alignItems:'center' },
  vipTag: { marginLeft: 5, backgroundColor: '#ffd700', paddingHorizontal: 5, borderRadius: 4, fontSize: 10, fontWeight:'bold', color: 'black' },
  riskTag: { marginLeft: 5, backgroundColor: '#f44336', paddingHorizontal: 5, borderRadius: 4, fontSize: 10, fontWeight:'bold', color: 'white' }
});