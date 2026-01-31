import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { db } from '../database/db';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    // Fetch logs descending (newest first)
    const res = await db.getAllAsync('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50');
    setLogs(res);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchLogs(); }, []));

  const renderItem = ({ item }) => {
    // 🕵️ Check for Fraud Flags
    const isSuspicious = item.action === 'SUSPICIOUS_SALE' || item.details.includes('SUSPICIOUS');
    
    return (
      <View style={[styles.logItem, isSuspicious && styles.suspiciousItem]}>
        <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
               {isSuspicious ? (
                   <Ionicons name="warning" size={20} color="#d32f2f" style={{marginRight:5}} />
               ) : (
                   <Ionicons name="person-circle-outline" size={20} color="#666" style={{marginRight:5}} />
               )}
               <Text style={[styles.user, isSuspicious && {color:'#d32f2f'}]}>{item.user_name}</Text>
            </View>
            <Text style={styles.time}>{item.timestamp}</Text>
        </View>
        
        <Text style={[styles.action, isSuspicious && {color:'#d32f2f'}]}>{item.action}</Text>
        <Text style={styles.details}>{item.details}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList 
        data={logs}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchLogs} />}
        contentContainerStyle={{padding: 10}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  logItem: { backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 1 },
  suspiciousItem: { backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ef9a9a' }, // 🚨 RED STYLE
  user: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  action: { fontWeight: 'bold', color: '#2196f3', marginTop: 5 },
  details: { color: '#555', marginTop: 2, fontSize: 12 },
  time: { fontSize: 10, color: '#999' }
});