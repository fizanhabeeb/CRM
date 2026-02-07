import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { db, logAudit } from '../database/db'; //
import { AuthContext } from '../context/AuthContext'; //
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Forgot Password State
  const [modalVisible, setModalVisible] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');

  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if(!username || !password) return Alert.alert("Error", "Enter credentials");

    const res = await db.getAllAsync('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    
    if (res.length > 0) {
      const user = res[0];
      login(user); 
      await logAudit(user.username, 'LOGIN', 'User logged into the system');
    } else {
      Alert.alert("Failed", "Invalid Username or Password");
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      return Alert.alert("Required", "Please enter your Username in the login box first.");
    }

    // Check if user exists
    const res = await db.getAllAsync('SELECT * FROM users WHERE username = ?', [username]);
    if (res.length === 0) {
      return Alert.alert("Error", "User not found");
    }

    setModalVisible(true);
  };

  const performReset = async () => {
    if (masterKey !== '123456') {
      return Alert.alert("Access Denied", "Invalid Master Key!");
    }
    if (!newResetPassword) {
      return Alert.alert("Error", "Please enter a new password.");
    }

    try {
      await db.runAsync('UPDATE users SET password = ? WHERE username = ?', [newResetPassword, username]);
      await logAudit(username, 'PASSWORD_RESET', 'Password reset using Master Key');
      
      Alert.alert("Success", "Password reset successfully! You can now login.");
      setModalVisible(false);
      setMasterKey('');
      setNewResetPassword('');
      setPassword(''); // Clear old password field
    } catch (e) {
      Alert.alert("Error", "Failed to reset password.");
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
          placeholderTextColor="#999"
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#999"
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        
        <TouchableOpacity style={styles.btn} onPress={handleLogin}>
          <Text style={styles.btnText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      {/* Master Key Reset Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Admin Reset</Text>
            <Text style={{marginBottom:15, color:'#666', textAlign:'center'}}>Reset password for: {username}</Text>
            
            <TextInput 
              style={styles.modalInput} 
              placeholder="Enter Master Key" 
              placeholderTextColor="#999"
              secureTextEntry
              keyboardType="numeric"
              value={masterKey} 
              onChangeText={setMasterKey} 
            />

            <TextInput 
              style={styles.modalInput} 
              placeholder="New Password" 
              placeholderTextColor="#999"
              secureTextEntry
              value={newResetPassword} 
              onChangeText={setNewResetPassword} 
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#f44336'}]} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#4caf50'}]} onPress={performReset}>
                <Text style={styles.btnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2196f3', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'white', padding: 30, borderRadius: 15, alignItems: 'center', elevation: 5 },
  iconCircle: { width: 80, height: 80, backgroundColor: '#2196f3', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: -60, borderWidth:4, borderColor:'white' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  input: { width: '100%', borderBottomWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 20, fontSize: 16, color: '#000' }, 
  btn: { backgroundColor: '#2196f3', width: '100%', padding: 15, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  forgotBtn: { marginTop: 15, padding: 5 },
  forgotText: { color: '#888', fontSize: 14 },
  
  // Modal Styles
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '85%', backgroundColor: 'white', borderRadius: 10, padding: 25, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color:'#333' },
  modalInput: { width: '100%', borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, fontSize: 16 },
  modalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.48, padding: 12, borderRadius: 8, alignItems: 'center' }
});