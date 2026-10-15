import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AttendanceSession } from '@smart-attendance/shared';
import Colors from '../../constants/Colors';

interface ActiveSessionCardProps {
  session: AttendanceSession;
}

export default function ActiveSessionCard({ session }: ActiveSessionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>ACTIVE</Text>
        </View>
      </View>
      
      <Text style={styles.subject}>{session.subjectName}</Text>
      <Text style={styles.detail}>{session.className}</Text>
      <Text style={styles.detail}>{session.periodStartTime} – {session.periodEndTime}</Text>
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Professor</Text>
          <Text style={styles.value}>{session.staffName}</Text>
        </View>
        <View style={styles.columnRight}>
          <Text style={styles.label}>Room</Text>
          <Text style={styles.value}>{session.roomName}</Text>
        </View>
      </View>
      
      <View style={styles.divider} />
      
      <Text style={styles.statusTitle}>Attendance Active</Text>
      
      <TouchableOpacity 
        style={[styles.button, styles.buttonDisabled]}
        disabled={true}
      >
        <Text style={styles.buttonText}>Enable Attendance</Text>
      </TouchableOpacity>
      
      <Text style={styles.devNote}>
        Bluetooth attendance will be enabled in the next phase.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '22', // 22 is hex opacity
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: 6,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
  },
  columnRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.background, // Since it's dark text on bright button, or if disabled, we might want it lighter.
    fontWeight: 'bold',
    fontSize: 16,
  },
  devNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});
