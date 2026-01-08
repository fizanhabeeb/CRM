import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '../database/db';

export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const res = await db.getAllAsync('SELECT * FROM audit_logs ORDER BY id DESC');
      setLogs(res);
    })();
  }, []));

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={{flexDirection:'row', justifyContent:'space-between'}}>
               <Text style={styles.user}>{item.user_name}</Text>
               <Text style={styles.time}>{item.timestamp}</Text>
            </View>
            <Text style={styles.action}>{item.action}</Text>
            <Text style={styles.details}>{item.details}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  item: { backgroundColor: 'white', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  user: { fontWeight: 'bold', color: '#2196f3' },
  action: { fontWeight: 'bold', marginTop: 5 },
  details: { color: '#666', fontSize: 12 },
  time: { color: '#999', fontSize: 10 }
});