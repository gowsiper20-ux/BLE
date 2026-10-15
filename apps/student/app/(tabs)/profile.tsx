import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../store/AuthContext';
import Colors from '../../constants/Colors';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name}</Text>
        
        <Text style={styles.label}>Register Number</Text>
        <Text style={styles.value}>{user?.registerNumber}</Text>
        
        <Text style={styles.label}>Class</Text>
        <Text style={styles.value}>{user?.className || 'Not Assigned'}</Text>
        
        <Text style={styles.label}>Department</Text>
        <Text style={styles.value}>
          {user?.departmentCode === 'IT' ? 'Information Technology' : (user?.departmentCode || 'Not Assigned')}
        </Text>
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
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 16,
    fontWeight: 'bold',
  }
});
