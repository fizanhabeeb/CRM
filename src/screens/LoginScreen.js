import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { db, logAudit } from '../database/db';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if(!username || !password) return Alert.alert("Error", "Enter credentials");

    const res = await db.getAllAsync('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    
    if (res.length > 0) {
      const user = res[0];
      login(user); 
      await logAudit(user.username, 'LOGIN', 'User logged into the system');
      navigation.replace('MainTabs'); 
    } else {
      Alert.alert("Failed", "Invalid Username or Password");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
           <Ionicons name="person" size={40} color="white" />
        </View>
        <Text style={styles.title}>FuelCore Login</Text>
        
        <TextInput 
          style={styles.input} 
          placeholder="Username" 
          placeholderTextColor="#999" // ✅ FIX ADDED
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#999" // ✅ FIX ADDED
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        
        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
          <Text style={styles.btnText}>Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2196f3', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 15, alignItems: 'center', elevation: 5 },
  iconCircle: { width: 80, height: 80, backgroundColor: '#2196f3', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: -60, borderWidth:4, borderColor:'white' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  input: { width: '100%', borderBottomWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 20, fontSize: 16, color: '#000' }, // Added color: #000
  btn: { backgroundColor: '#2196f3', width: '100%', padding: 15, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});