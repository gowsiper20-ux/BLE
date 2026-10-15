import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '../../constants/Colors';

export default function ClassesScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>All Scheduled Classes (Today)</Text>
      
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>Classes list will be fetched from API.</Text>
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
  }
});
