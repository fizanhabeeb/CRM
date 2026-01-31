import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { db } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function ExpenseScreen() {
  const { user } = useContext(AuthContext);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState({ title: '', amount: '', category: 'General' });

  const loadExpenses = async () => {
    const res = await db.getAllAsync('SELECT * FROM expenses ORDER BY id DESC LIMIT 20');
    setExpenses(res);
  };

  useFocusEffect(useCallback(() => { loadExpenses(); }, []));

  const addExpense = async () => {
    if(!form.title || !form.amount) return Alert.alert("Error", "Fill details");
    const date = new Date().toISOString().split('T')[0];
    await db.runAsync(
        'INSERT INTO expenses (title, amount, category, date, user_id) VALUES (?, ?, ?, ?, ?)',
        [form.title, parseFloat(form.amount), form.category, date, user.id]
    );
    setForm({ title: '', amount: '', category: 'General' });
    loadExpenses();
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
         <Text style={styles.header}>Add Expense</Text>
         <TextInput 
           style={styles.input} placeholder="Expense Title (e.g., Electricity)" 
           value={form.title} onChangeText={t=>setForm({...form, title:t})}
         />
         <TextInput 
           style={styles.input} placeholder="Amount (₹)" keyboardType="numeric"
           value={form.amount} onChangeText={t=>setForm({...form, amount:t})}
         />
         <TouchableOpacity style={styles.btn} onPress={addExpense}>
            <Text style={{color:'white', fontWeight:'bold'}}>Save Expense</Text>
         </TouchableOpacity>
      </View>

      <FlatList 
        data={expenses}
        keyExtractor={item => item.id.toString()}
        renderItem={({item}) => (
            <View style={styles.item}>
                <View>
                    <Text style={{fontWeight:'bold'}}>{item.title}</Text>
                    <Text style={{fontSize:12, color:'#666'}}>{item.date} • {item.category}</Text>
                </View>
                <Text style={{fontWeight:'bold', color:'#d32f2f'}}>- ₹{item.amount}</Text>
            </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  form: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  header: { fontWeight: 'bold', marginBottom: 15 },
  input: { borderBottomWidth: 1, borderColor: '#eee', padding: 10, marginBottom: 15 },
  btn: { backgroundColor: '#f44336', padding: 12, borderRadius: 5, alignItems: 'center' },
  item: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});