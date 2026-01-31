import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Dimensions, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import * as Linking from 'expo-linking';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const { user, isDarkMode } = useContext(AuthContext); // 🌑 Dark Mode
  const [activeTab, setActiveTab] = useState('Sales'); 
  const [loading, setLoading] = useState(false);
  
  const [salesData, setSalesData] = useState({ daily: 0, monthly: 0, grossProfit: 0, netProfit: 0, expenses: 0 });
  const [topCustomers, setTopCustomers] = useState([]);
  const [creditList, setCreditList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [trendData, setTrendData] = useState([]);
  const [fuelPieData, setFuelPieData] = useState([]);

  // 🌑 Dark Mode Styles
  const theme = {
    bg: isDarkMode ? '#121212' : '#f5f5f5',
    card: isDarkMode ? '#1e1e1e' : '#fff',
    text: isDarkMode ? '#fff' : '#000',
    subText: isDarkMode ? '#aaa' : '#666',
    border: isDarkMode ? '#333' : '#ddd',
    tabBar: isDarkMode ? '#1e1e1e' : '#fff',
    listBorder: isDarkMode ? '#333' : '#eee'
  };

  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); 

    try {
      // 1. Sales & Profit & Expenses
      const dailyRes = await db.getAllAsync('SELECT SUM(total_amount) as total, SUM((price_per_liter - buy_price) * quantity) as gross FROM transactions WHERE date = ?', [today]);
      const monthRes = await db.getAllAsync('SELECT SUM(total_amount) as total FROM transactions WHERE date LIKE ?', [`${currentMonth}%`]);
      const expRes = await db.getAllAsync('SELECT SUM(amount) as total FROM expenses WHERE date = ?', [today]);

      const gross = dailyRes[0]?.gross || 0;
      const expenses = expRes[0]?.total || 0;

      setSalesData({
        daily: dailyRes[0]?.total || 0,
        monthly: monthRes[0]?.total || 0,
        grossProfit: gross,
        expenses: expenses,
        netProfit: gross - expenses
      });

      // 2. Load History
      const txns = await db.getAllAsync('SELECT t.*, c.name as customer_name FROM transactions t JOIN customers c ON t.customer_id = c.id ORDER BY t.id DESC LIMIT 50');
      setTransactions(txns);

      // 3. Chart Data
      const last7Days = [];
      for(let i=6; i>=0; i--) {
         const d = new Date(); d.setDate(d.getDate() - i);
         const dateStr = d.toISOString().split('T')[0];
         const res = await db.getAllAsync('SELECT SUM(total_amount) as total FROM transactions WHERE date = ?', [dateStr]);
         last7Days.push({ value: res[0]?.total || 0, label: dateStr.substring(5) });
      }
      setTrendData(last7Days);

      const pRes = await db.getAllAsync('SELECT SUM(quantity) as qty FROM transactions WHERE fuel_type = "Petrol" AND date = ?', [today]);
      const dRes = await db.getAllAsync('SELECT SUM(quantity) as qty FROM transactions WHERE fuel_type = "Diesel" AND date = ?', [today]);
      
      const pQty = pRes[0]?.qty || 0;
      const dQty = dRes[0]?.qty || 0;
      if (pQty > 0 || dQty > 0) {
        setFuelPieData([
            { value: pQty, color: '#ff9800', text: `${pQty.toFixed(0)}L` },
            { value: dQty, color: '#2196f3', text: `${dQty.toFixed(0)}L` }
        ]);
      } else {
        setFuelPieData([]);
      }

      // 4. Customer Lists
      const custRes = await db.getAllAsync(`
        SELECT c.name, c.current_balance, c.credit_limit, SUM(t.total_amount) as total_spent, COUNT(t.id) as visits 
        FROM transactions t JOIN customers c ON t.customer_id = c.id 
        GROUP BY c.id ORDER BY total_spent DESC LIMIT 5
      `);
      setTopCustomers(custRes);
      
      const creditRes = await db.getAllAsync(`SELECT * FROM customers WHERE current_balance > 0 ORDER BY current_balance DESC`);
      setCreditList(creditRes);

    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // 🗑️ DELETE TRANSACTION
  const deleteTransaction = (txn) => {
    Alert.alert("Delete Sale?", `Delete Inv: ${txn.invoice_no} (₹${txn.total_amount})?\nThis RESTORES stock & balance.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: 'destructive', onPress: async () => {
          try {
             if (txn.payment_mode === 'Credit') {
                 await db.runAsync('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?', [txn.total_amount, txn.customer_id]);
             }
             if (txn.points_earned > 0) {
                 await db.runAsync('UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ?', [txn.points_earned, txn.customer_id]);
             }
             await db.runAsync('UPDATE tanks SET current_level = current_level + ? WHERE fuel_type = ?', [txn.quantity, txn.fuel_type]);
             await db.runAsync('DELETE FROM transactions WHERE id = ?', [txn.id]);
             Alert.alert("Success", "Transaction Deleted & Stock Reverted");
             loadData();
          } catch(e) { Alert.alert("Error", e.message); }
      }}
    ]);
  };

  const sendLowBalanceAlert = (phone, balance) => {
    const msg = `⚠️ Alert: Your outstanding fuel balance is ₹${balance}. Please pay soon.`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}&phone=${phone}`).catch(() => Alert.alert("Error", "WhatsApp not installed"));
  };

  const renderSales = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}>
      <View style={styles.grid}>
        <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: '#4caf50' }]}>
           <Text style={[styles.cardTitle, { color: theme.subText }]}>Today's Sales</Text>
           <Text style={[styles.cardValue, { color: '#4caf50' }]}>₹ {salesData.daily.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: '#f44336' }]}>
           <Text style={[styles.cardTitle, { color: theme.subText }]}>Expenses</Text>
           <Text style={[styles.cardValue, { color: '#f44336' }]}>₹ {salesData.expenses.toFixed(0)}</Text>
        </View>
      </View>

      {user.role === 'Admin' && (
        <View style={[styles.card, { backgroundColor: theme.card, borderLeftColor: '#673ab7', marginTop: 10, marginBottom: 20 }]}>
           <Text style={[styles.cardTitle, { color: theme.subText }]}>Net Profit (Gross - Exp)</Text>
           <Text style={[styles.cardValue, { color: '#673ab7' }]}>₹ {salesData.netProfit.toFixed(0)}</Text>
        </View>
      )}

      <Text style={[styles.sectionHeader, { color: theme.text }]}>📈 Sales Trend</Text>
      <View style={[styles.chartContainer, { backgroundColor: theme.card, paddingLeft: 0 }]}>
          <LineChart 
            data={trendData} height={200} width={screenWidth - 60} color="#2196f3" thickness={3}
            startFillColor="rgba(33, 150, 243, 0.3)" endFillColor="rgba(33, 150, 243, 0.01)" areaChart noOfSections={4}
            yAxisTextStyle={{color: theme.subText}} xAxisLabelTextStyle={{color: theme.subText}}
          />
      </View>

      <Text style={[styles.sectionHeader, { color: theme.text }]}>⛽ Fuel Distribution</Text>
      {fuelPieData.length > 0 ? (
          <View style={[styles.chartContainer, { backgroundColor: theme.card, alignItems:'center' }]}>
            <PieChart data={fuelPieData} donut showText textColor={theme.text} radius={100} innerRadius={60} textSize={14} />
            <View style={{flexDirection:'row', marginTop:10}}>
                <View style={{flexDirection:'row', alignItems:'center', marginRight:15}}>
                    <View style={{width:10, height:10, backgroundColor:'#ff9800', marginRight:5}}/>
                    <Text style={{color: theme.text}}>Petrol</Text>
                </View>
                <View style={{flexDirection:'row', alignItems:'center'}}>
                    <View style={{width:10, height:10, backgroundColor:'#2196f3', marginRight:5}}/>
                    <Text style={{color: theme.text}}>Diesel</Text>
                </View>
            </View>
          </View>
      ) : (
          <Text style={{textAlign:'center', color: theme.subText, marginBottom:20}}>No sales today yet.</Text>
      )}
    </ScrollView>
  );

  const renderHistory = () => (
    <FlatList
      data={transactions}
      keyExtractor={item => item.id.toString()}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      renderItem={({ item }) => (
        <View style={[styles.listItem, { backgroundColor: theme.card }]}>
          <View style={{flex:1}}>
            <Text style={[styles.listTitle, { color: theme.text }]}>#{item.invoice_no} • {item.customer_name}</Text>
            <Text style={[styles.listSub, { color: theme.subText }]}>{item.fuel_type} {item.quantity}L @ ₹{item.price_per_liter}</Text>
            <Text style={{fontSize:10, color: theme.subText}}>{item.date} {item.time} ({item.payment_mode})</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
             <Text style={styles.amount}>₹ {item.total_amount.toFixed(0)}</Text>
             <TouchableOpacity onPress={() => deleteTransaction(item)} style={{marginTop:5}}>
               <Ionicons name="trash-outline" size={20} color="#f44336" />
             </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.tabBar, { backgroundColor: theme.tabBar }]}>
        {['Sales', 'Customers', 'Credit', 'History'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.tabItem, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? '#2196f3' : theme.subText }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>
        {activeTab === 'Sales' && renderSales()}
        
        {activeTab === 'Customers' && (
             <FlatList data={topCustomers} keyExtractor={(item,i)=>i.toString()} renderItem={({item, index})=>(
                <View style={[styles.listItem, { backgroundColor: theme.card }]}>
                    <Text style={styles.rank}>#{index+1}</Text>
                    <View style={{flex:1}}><Text style={[styles.listTitle, { color: theme.text }]}>{item.name}</Text></View>
                    <Text style={styles.amount}>₹ {item.total_spent.toFixed(0)}</Text>
                </View>
             )} />
        )}

        {activeTab === 'Credit' && (
            <FlatList data={creditList} keyExtractor={item => item.id.toString()} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />} renderItem={({ item }) => (
                <View style={[styles.listItem, { backgroundColor: item.current_balance > item.credit_limit ? (isDarkMode ? '#3e2723' : '#ffebee') : theme.card }]}>
                  <View style={{flex:1}}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.listSub, { color: theme.subText }]}>{item.phone}</Text>
                  </View>
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={{fontSize:16, fontWeight:'bold', color: '#d32f2f'}}>₹ {item.current_balance.toFixed(2)}</Text>
                    <TouchableOpacity onPress={() => sendLowBalanceAlert(item.phone, item.current_balance)} style={{marginTop:5}}>
                        <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                    </TouchableOpacity>
                  </View>
                </View>
            )} />
        )}

        {activeTab === 'History' && renderHistory()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: 'row', elevation: 2 },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2196f3' },
  tabText: { fontWeight: 'bold' },
  content: { flex: 1, padding: 10 },
  grid: { flexDirection: 'row', justifyContent:'space-between' },
  card: { flex: 1, padding: 15, borderRadius: 8, marginHorizontal: 5, elevation: 1, borderLeftWidth: 4 },
  cardTitle: { fontSize: 12, marginBottom: 5 },
  cardValue: { fontSize: 18, fontWeight: 'bold' },
  chartContainer: { padding: 20, borderRadius: 8, elevation: 1, marginBottom: 15 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginVertical: 15, marginLeft: 5 },
  listItem: { padding: 15, marginBottom: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
  rank: { fontSize: 18, fontWeight: 'bold', color: '#999', marginRight: 15, width: 30 },
  listTitle: { fontSize: 16, fontWeight: 'bold' },
  listSub: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: 'bold', color: '#4caf50' },
});