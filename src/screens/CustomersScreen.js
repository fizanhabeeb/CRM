import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../database/db';

export default function CustomersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    // We join with vehicles to allow searching by vehicle number too
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

  // 🔍 SMART SEARCH LOGIC
  const handleSearch = (text) => {
    setSearch(text);
    if (text) {
      const newData = customers.filter(item => {
        const itemData = `${item.name.toUpperCase()} ${item.phone} ${item.vehicles ? item.vehicles.toUpperCase() : ''}`;
        const textData = text.toUpperCase();
        return itemData.indexOf(textData) > -1;
      });
      setFilteredCustomers(newData);
    } else {
      setFilteredCustomers(customers);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🔍 SEARCH BAR */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={{marginRight: 10}} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search Name, Phone, or Vehicle..."
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
          <TouchableOpacity 
            style={styles.listItem} 
            onPress={() => navigation.navigate('CustomerDetail', { customer: item })}
          >
            <View style={{flex: 1}}>
              <Text style={styles.listTitle}>{item.name}</Text>
              <Text style={styles.listSub}>{item.type} • {item.phone}</Text>
              {/* Show vehicles if searched */}
              {search.length > 0 && item.vehicles && (
                 <Text style={{fontSize:10, color:'#2196f3', marginTop:2}}>Match: {item.vehicles}</Text>
              )}
            </View>
            <View style={{alignItems:'flex-end'}}>
               <Text style={{fontWeight:'bold', color: item.current_balance > 0 ? 'red' : 'green'}}>
                 Due: ₹{item.current_balance.toFixed(0)}
               </Text>
               <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 50, color:'#999'}}>No customers found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchContainer: { flexDirection: 'row', backgroundColor: 'white', margin: 15, padding: 10, borderRadius: 10, alignItems: 'center', elevation: 2 },
  searchInput: { flex: 1, fontSize: 16 },
  listItem: { backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation:1 },
  listTitle: { fontWeight: 'bold', fontSize: 16 },
  listSub: { color: '#666', marginTop: 2 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#2196f3', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, zIndex: 10 },
});