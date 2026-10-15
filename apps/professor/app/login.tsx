import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { router } from 'expo-router';
import Colors from '../constants/Colors';

export default function LoginScreen() {
  const [staffCode, setStaffCode] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login(staffCode);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Attendance</Text>
      <Text style={styles.subtitle}>Professor Portal</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Staff Code (e.g. DEV-STAFF-001)"
        placeholderTextColor={Colors.textSecondary}
        value={staffCode}
        onChangeText={setStaffCode}
        autoCapitalize="none"
      />
      
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    backgroundColor: Colors.surface,
    color: Colors.text,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  }
});
