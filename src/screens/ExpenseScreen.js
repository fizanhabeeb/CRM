import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { db } from '../database/db'; 
import { AuthContext } from '../context/AuthContext'; //
import { useFocusEffect } from '@react-navigation/native';

export default function ExpenseScreen() {
  // ✅ FIX: Get 'theme' and 'isDarkMode' directly from AuthContext
  const { user, theme, isDarkMode } = useContext(AuthContext);
  
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

  // Dynamic Styles
  const placeholderColor = isDarkMode ? '#888' : '#999';

  return (
    // ✅ FIX: Use theme.bg from context
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      
      <View style={[styles.form, { backgroundColor: theme.card }]}>
         <Text style={[styles.header, { color: theme.text }]}>Add Expense</Text>
         <TextInput 
           style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
           placeholder="Expense Title (e.g., Electricity)" 
           placeholderTextColor={placeholderColor}
           value={form.title} 
           onChangeText={t=>setForm({...form, title:t})}
         />
         <TextInput 
           style={[styles.input, { color: theme.text, borderColor: theme.border }]} 
           placeholder="Amount (₹)" 
           keyboardType="numeric"
           placeholderTextColor={placeholderColor}
           value={form.amount} 
           onChangeText={t=>setForm({...form, amount:t})}
         />
         <TouchableOpacity style={styles.btn} onPress={addExpense}>
            <Text style={{color:'white', fontWeight:'bold'}}>Save Expense</Text>
         </TouchableOpacity>
      </View>

      <FlatList 
        data={expenses}
        keyExtractor={item => item.id.toString()}
        renderItem={({item}) => (
            <View style={[styles.item, { backgroundColor: theme.card }]}>
                <View>
                    <Text style={{fontWeight:'bold', color: theme.text}}>{item.title}</Text>
                    <Text style={{fontSize:12, color: theme.subText}}>{item.date} • {item.category}</Text>
                </View>
                <Text style={{fontWeight:'bold', color:'#d32f2f'}}>- ₹{item.amount}</Text>
            </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  form: { padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  header: { fontWeight: 'bold', marginBottom: 15 },
  input: { borderBottomWidth: 1, padding: 10, marginBottom: 15 },
  btn: { backgroundColor: '#f44336', padding: 12, borderRadius: 5, alignItems: 'center' },
  item: { padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});