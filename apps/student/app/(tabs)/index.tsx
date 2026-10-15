import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import Colors from '../../constants/Colors';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.detail}>{user?.registerNumber}</Text>
        <Text style={styles.detail}>{user?.className}</Text>
      </View>

      <Text style={styles.sectionTitle}>Today's Timetable</Text>
      <View style={styles.card}>
        <View style={styles.periodRow}>
          <Text style={styles.time}>09:00 – 09:50</Text>
          <Text style={styles.subject}>DBMS</Text>
          <Text style={styles.staff}>Dr. Kumar</Text>
          <Text style={styles.room}>A-204</Text>
        </View>
        <View style={styles.periodRow}>
          <Text style={styles.time}>10:00 – 10:50</Text>
          <Text style={styles.subject}>Java</Text>
          <Text style={styles.staff}>Dr. Priya</Text>
          <Text style={styles.room}>A-204</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Attendance Summary</Text>
      <View style={styles.card}>
        <Text style={styles.detail}>Overall Attendance: <Text style={styles.highlight}>92%</Text></Text>
        <Text style={styles.detail}>Today's Attendance: <Text style={styles.highlight}>Not Started</Text></Text>
      </View>
    </ScrollView>
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
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: {
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
  highlight: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  time: { color: Colors.textSecondary, flex: 1 },
  subject: { color: Colors.text, fontWeight: 'bold', flex: 1 },
  staff: { color: Colors.textSecondary, flex: 1 },
  room: { color: Colors.textSecondary, width: 50, textAlign: 'right' },
});
