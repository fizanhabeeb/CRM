import React, { useState, useContext } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch 
} from 'react-native';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';

export default function AddCustomerScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [creditLimit, setCreditLimit] = useState('');

  const saveCustomer = async () => {
    if (!name || !phone) {
      Alert.alert("Error", "Name and Phone are required");
      return;
    }

    if (phone.length < 10) {
      Alert.alert("Error", "Please enter a valid 10-digit phone number");
      return;
    }

    try {
      // Check for duplicates
      const check = await db.getAllAsync('SELECT * FROM customers WHERE phone = ?', [phone]);
      if (check.length > 0) {
        Alert.alert("Error", "Customer with this phone number already exists!");
        return;
      }

      await db.runAsync(
        'INSERT INTO customers (name, phone, address, type, credit_limit, current_balance, loyalty_points, reg_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          name, 
          phone, 
          address, 
          isCredit ? 'Credit' : 'Regular', 
          isCredit ? parseFloat(creditLimit) || 0 : 0, 
          0, 
          0, 
          new Date().toISOString()
        ]
      );
      
      await logAudit(user.username, 'ADD_CUSTOMER', `Added ${name} (${phone})`);
      
      Alert.alert("Success", "Customer Added Successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
      
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Could not save customer");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formCard}>
        
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Enter Customer Name"  // ✅ Updated
          value={name} 
          onChangeText={setName} 
        />

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Enter 10-digit Mobile No" 
          value={phone} 
          onChangeText={setPhone} 
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={styles.label}>Address</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Enter Address (City/Area)" // ✅ Updated
          value={address} 
          onChangeText={setAddress} 
        />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable Credit Account?</Text>
          <Switch value={isCredit} onValueChange={setIsCredit} />
        </View>

        {isCredit && (
          <View>
            <Text style={styles.label}>Credit Limit (₹)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 5000" 
              value={creditLimit} 
              onChangeText={setCreditLimit} 
              keyboardType="numeric"
            />
            <Text style={styles.helper}>
              Transaction will be blocked if debt exceeds this limit.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={saveCustomer}>
          <Text style={styles.saveBtnText}>Save Customer</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  formCard: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 3 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: '#2196f3', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  helper: { color: '#666', fontSize: 12, marginTop: -15, marginBottom: 20 }
});