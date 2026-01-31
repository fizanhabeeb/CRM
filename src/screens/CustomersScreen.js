import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext'; // 🌑

export default function CustomersScreen({ navigation }) {
  const { isDarkMode } = useContext(AuthContext); // 🌑
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [search, setSearch] = useState('');

  // 🌑 Dark Mode Styles
  const theme = {
    bg: isDarkMode ? '#121212' : '#f5f5f5',
    card: isDarkMode ? '#1e1e1e' : '#fff',
    text: isDarkMode ? '#fff' : '#000',
    subText: isDarkMode ? '#aaa' : '#666',
    inputBg: isDarkMode ? '#2c2c2c' : '#fff'
  };

  const fetchCustomers = async () => {
    const result = await db.getAllAsync(`
      SELECT c.*, GROUP_CONCAT(v.vehicle_no) as vehicles 
      FROM customers c 
      LEFT JOIN vehicles v ON c.id = v.customer_id 
      GROUP BY c.id 
      ORDER BY c.id DESC
    `);
    setCustomers(result);
    setFilteredCustomers(result);
  };

  useFocusEffect(React.useCallback(() => { fetchCustomers(); }, []));

  const handleDelete = (id, name) => {
    Alert.alert(
      "⚠️ Delete Customer?",
      `Are you sure you want to delete ${name}? This will also delete their VEHICLES and SALES HISTORY.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: 'destructive',
          onPress: async () => {
               await db.runAsync('DELETE FROM vehicles WHERE customer_id = ?', [id]);
               await db.runAsync('DELETE FROM transactions WHERE customer_id = ?', [id]);
               await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
               fetchCustomers();
          }
        }
      ]
    );
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (text) {
      const newData = customers.filter(item => {
        const itemData = `${item.name.toUpperCase()} ${item.phone} ${item.vehicles ? item.vehicles.toUpperCase() : ''}`;
        return itemData.indexOf(text.toUpperCase()) > -1;
      });
      setFilteredCustomers(newData);
    } else {
      setFilteredCustomers(customers);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
        <Ionicons name="search" size={20} color={theme.subText} style={{marginRight: 10}} />
        <TextInput 
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search Name, Phone, or Vehicle..."
          placeholderTextColor={theme.subText}
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddCustomer')}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
      
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{paddingBottom: 80}}
        renderItem={({ item }) => (
          <View style={[styles.listItem, { backgroundColor: theme.card }]}>
             <TouchableOpacity 
               style={{flex: 1}} 
               onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
             >
                <Text style={[styles.listTitle, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.listSub, { color: theme.subText }]}>{item.type} • {item.phone}</Text>
                {search.length > 0 && item.vehicles && (
                   <Text style={{fontSize:10, color:'#2196f3', marginTop:2}}>Match: {item.vehicles}</Text>
                )}
             </TouchableOpacity>

             <View style={{flexDirection:'row', alignItems:'center'}}>
                <View style={{alignItems:'flex-end', marginRight: 15}}>
                   <Text style={{fontWeight:'bold', color: item.current_balance > 0 ? 'red' : 'green'}}>
                     Due: ₹{item.current_balance.toFixed(0)}
                   </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={{padding:5}}>
                   <Ionicons name="trash-outline" size={22} color="#f44336" />
                </TouchableOpacity>
             </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: { flexDirection: 'row', margin: 15, padding: 10, borderRadius: 10, alignItems: 'center', elevation: 2 },
  searchInput: { flex: 1, fontSize: 16 },
  listItem: { padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation:1 },
  listTitle: { fontWeight: 'bold', fontSize: 16 },
  listSub: { marginTop: 2 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#2196f3', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 10 },
});