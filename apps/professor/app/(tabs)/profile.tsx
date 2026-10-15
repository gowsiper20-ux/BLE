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
        
        <Text style={styles.label}>Staff Code</Text>
        <Text style={styles.value}>{user?.staffCode}</Text>
        
        <Text style={styles.label}>Department</Text>
        <Text style={styles.value}>{user?.department}</Text>
        
        <Text style={styles.label}>Roles</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
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
  },
  roleBadge: {
    backgroundColor: Colors.primary + '33', // with opacity
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  roleText: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 12,
  }
});
