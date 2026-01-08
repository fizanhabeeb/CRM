import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { db } from '../database/db';

export default function AddCustomerScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', type: 'Regular', limit: '0' });

  const saveCustomer = async () => {
    if(!form.name) return Alert.alert("Error", "Name is required");
    const date = new Date().toISOString().split('T')[0];
    
    await db.runAsync(
      'INSERT INTO customers (name, phone, address, type, credit_limit, current_balance, reg_date) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [form.name, form.phone, form.address, form.type, form.limit, 0, date]
    );
    Alert.alert("Success", "Customer Profile Created!");
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="Ex: Hotel Grace" onChangeText={(t)=>setForm({...form, name: t})} />
      
      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} keyboardType="phone-pad" onChangeText={(t)=>setForm({...form, phone: t})} />
      
      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} placeholder="Mananthavady, Wayanad" onChangeText={(t)=>setForm({...form, address: t})} />
      
      <Text style={styles.label}>Customer Type</Text>
      <View style={styles.row}>
         {['Regular', 'Credit', 'Fleet'].map(t => (
           <TouchableOpacity key={t} onPress={()=>setForm({...form, type:t})} 
             style={[styles.chip, form.type===t && styles.chipActive]}>
             <Text style={form.type===t?{color:'white'}:{color:'black'}}>{t}</Text>
           </TouchableOpacity>
         ))}
      </View>
      
      {form.type === 'Credit' && (
        <>
          <Text style={styles.label}>Credit Limit (₹)</Text>
          <TextInput style={styles.input} keyboardType="numeric" placeholder="50000" onChangeText={(t)=>setForm({...form, limit: t})} />
        </>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={saveCustomer}>
        <Text style={styles.saveBtnText}>Save Customer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  formContainer: { padding: 20, backgroundColor: '#fff', flex: 1 },
  label: { fontWeight: 'bold', marginTop: 15, marginBottom: 5, color:'#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: '#2196f3', padding: 15, borderRadius: 8, marginTop: 30, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', flexWrap:'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
});