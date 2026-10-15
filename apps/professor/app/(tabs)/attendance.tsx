import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../constants/Colors';

export default function AttendanceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.subject}>DBMS</Text>
        <Text style={styles.detail}>II IT-A</Text>
        <Text style={styles.detail}>09:00 – 09:50</Text>
        <Text style={styles.detail}>A-204</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.statusLabel}>Session: READY</Text>
        
        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startButtonText}>Start Attendance</Text>
        </TouchableOpacity>

        <View style={styles.bleNotice}>
          <Text style={styles.bleNoticeText}>BLE scanning will be enabled in the next mobile phase.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subject: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  detail: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  statusLabel: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  startButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  bleNotice: {
    backgroundColor: '#333333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bleNoticeText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  }
});
