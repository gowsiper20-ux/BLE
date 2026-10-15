import { apiClient } from './client';
import { AttendanceSession } from '@smart-attendance/shared';
import { devActiveSessionFixture } from '../dev/studentAttendanceFixture';

export const attendanceService = {
  async getCurrentSession(): Promise<AttendanceSession | null> {
    try {
      const response = await apiClient.get<{ success: boolean; session: AttendanceSession | null }>('/api/students/me/attendance/current');
      return response.session;
    } catch (e) {
      console.error('Error fetching current session:', e);
      throw e;
    }
  }
};
