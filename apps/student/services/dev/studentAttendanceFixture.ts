import { AttendanceSession } from '@smart-attendance/shared';

// DEVELOPMENT ONLY FIXTURE
// Do not send this to the backend or use for real data

export const devActiveSessionFixture: AttendanceSession = {
  id: 'dev-session-001',
  timetableId: 'tt-dev-123',
  sessionDate: new Date().toISOString().split('T')[0],
  status: 'ACTIVE',
  startedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  
  // Joined fields for display
  className: 'II IT-A',
  subjectName: 'DBMS',
  staffName: 'Dr. Kumar',
  periodName: 'P1',
  periodStartTime: '09:00',
  periodEndTime: '09:50',
  roomName: 'A-204'
};
