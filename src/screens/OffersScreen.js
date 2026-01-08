import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../database/db';

export default function OffersScreen() {
  const [offers, setOffers] = useState([]);
  const [newOffer, setNewOffer] = useState({ title: '', discount: '' });
  const [showForm, setShowForm] = useState(false);

  const fetchOffers = async () => {
    try {
      const res = await db.getAllAsync('SELECT * FROM offers ORDER BY id DESC');
      setOffers(res);
    } catch (e) {
      console.log("Error fetching offers", e);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchOffers(); }, []));

  const addOffer = async () => {
    if (!newOffer.title || !newOffer.discount) return Alert.alert("Error", "Fill all fields");
    
    try {
      await db.runAsync('INSERT INTO offers (title, description, discount_value) VALUES (?, ?, ?)', 
        [newOffer.title, 'Flat Discount', parseFloat(newOffer.discount)]);
      setNewOffer({ title: '', discount: '' });
      setShowForm(false);
      fetchOffers();
    } catch (e) {
      console.log(e);
    }
  };

  const toggleOffer = async (id, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    await db.runAsync('UPDATE offers SET is_active = ? WHERE id = ?', [newStatus, id]);
    fetchOffers();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Text style={styles.addBtnText}>{showForm ? "Cancel" : "+ Create New Offer"}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Offer Name (e.g. Diwali Dhamaka)" value={newOffer.title} onChangeText={t => setNewOffer({...newOffer, title: t})} />
          <TextInput style={styles.input} placeholder="Discount Amount (₹)" keyboardType="numeric" value={newOffer.discount} onChangeText={t => setNewOffer({...newOffer, discount: t})} />
          <TouchableOpacity style={styles.saveBtn} onPress={addOffer}>
            <Text style={{color:'white', fontWeight:'bold'}}>Save Offer</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={offers}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.card, {opacity: item.is_active ? 1 : 0.6}]}>
            <View style={{flex:1}}>
              <Text style={styles.offerTitle}>{item.title}</Text>
              <Text style={{color:'green', fontWeight:'bold'}}>₹ {item.discount_value} OFF</Text>
            </View>
            <View style={{alignItems:'center'}}>
              <Switch value={item.is_active === 1} onValueChange={() => toggleOffer(item.id, item.is_active)} />
              <Text style={{fontSize:10}}>{item.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20, color:'#888'}}>No offers created yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 15 },
  addBtn: { backgroundColor: '#2196f3', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  addBtnText: { color: 'white', fontWeight: 'bold' },
  form: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 10 },
  saveBtn: { backgroundColor: 'green', padding: 10, borderRadius: 6, alignItems: 'center' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1 },
  offerTitle: { fontSize: 16, fontWeight: 'bold' },
});