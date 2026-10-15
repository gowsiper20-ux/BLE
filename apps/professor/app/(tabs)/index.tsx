import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import Colors from '../../constants/Colors';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.detail}>{user?.staffCode} • {user?.department}</Text>
        <Text style={styles.detail}>Role: {user?.role}</Text>
      </View>

      <Text style={styles.sectionTitle}>Today's Classes</Text>
      
      <View style={styles.classCard}>
        <Text style={styles.time}>09:00 – 09:50</Text>
        <Text style={styles.subject}>DBMS</Text>
        <Text style={styles.detail}>II IT-A • A-204</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Text style={styles.actionButtonText}>Start Attendance</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.classCard}>
        <Text style={styles.time}>10:00 – 10:50</Text>
        <Text style={styles.subject}>Java</Text>
        <Text style={styles.detail}>II IT-B • A-204</Text>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Text style={styles.actionButtonText}>Start Attendance</Text>
        </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  classCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  time: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  subject: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
  }
});
