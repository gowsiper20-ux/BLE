import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import Colors from '../../constants/Colors';
import { AttendanceScreenState } from '../../components/attendance/types';
import { AttendanceSession } from '@smart-attendance/shared';
import { attendanceService } from '../../services/api/attendanceService';

import NoSessionCard from '../../components/attendance/NoSessionCard';
import ActiveSessionCard from '../../components/attendance/ActiveSessionCard';

export default function AttendanceScreen() {
  const [state, setState] = useState<AttendanceScreenState>('LOADING');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const currentSession = await attendanceService.getCurrentSession();
      if (currentSession) {
        setSession(currentSession);
        setState('ACTIVE_SESSION');
      } else {
        setSession(null);
        setState('NO_SESSION');
      }
    } catch (error) {
      console.error('Failed to load session', error);
      setState('ERROR');
    }
  }, []);

  useEffect(() => {
    setState('LOADING');
    fetchSession();
  }, [fetchSession]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSession();
    setRefreshing(false);
  }, [fetchSession]);

  const renderContent = () => {
    switch (state) {
      case 'LOADING':
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Checking for active attendance...</Text>
          </View>
        );
      
      case 'ERROR':
        return (
          <View style={styles.centerContainer}>
            <Text style={styles.errorTitle}>Unable to load attendance session.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setState('LOADING'); fetchSession(); }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        );

      case 'NO_SESSION':
        return <NoSessionCard />;
      
      case 'ACTIVE_SESSION':
        if (!session) return null;
        return (
          <>
            {process.env.EXPO_PUBLIC_DEV_LOGIN_MODE === 'true' && (
              <View style={styles.devBanner}>
                <Text style={styles.devBannerText}>DEV PREVIEW</Text>
              </View>
            )}
            <ActiveSessionCard session={session} />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Text style={styles.screenTitle}>Attendance</Text>
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    padding: 16,
    flexGrow: 1,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  devBanner: {
    backgroundColor: Colors.warning + '33',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.warning,
    alignItems: 'center',
    marginBottom: 8,
  },
  devBannerText: {
    color: Colors.warning,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  }
});
