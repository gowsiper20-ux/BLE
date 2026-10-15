import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '../../constants/Colors';

export default function TimetableScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.dayTitle}>MONDAY</Text>
      
      <View style={styles.card}>
        <Text style={styles.period}>P1</Text>
        <Text style={styles.time}>09:00 – 09:50</Text>
        <Text style={styles.subject}>DBMS</Text>
        <Text style={styles.class}>II IT-A</Text>
        <Text style={styles.room}>A-204</Text>
      </View>
      
      <Text style={styles.emptyState}>Timetable will be loaded from API.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  period: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: 'bold',
  },
  time: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  subject: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  class: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  room: {
    fontSize: 14,
    color: Colors.textSecondary,
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  emptyState: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 24,
    fontStyle: 'italic',
  }
});
