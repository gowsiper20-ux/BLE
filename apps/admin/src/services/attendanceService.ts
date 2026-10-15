import api from './api';
import type { ApiResponse, AttendanceSession, SessionStats } from '../types';

export const attendanceService = {
  getSessions: (params?: any) => {
    const qs = params ? new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as any).toString() : '';
    return api.get<ApiResponse<AttendanceSession[]>>(`/api/attendance/sessions${qs ? `?${qs}` : ''}`);
  },

  getSession: (id: string) => {
    return api.get<ApiResponse<AttendanceSession>>(`/api/attendance/sessions/${id}`);
  },

  getStats: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return api.get<ApiResponse<SessionStats>>(`/api/attendance/sessions/stats${qs}`);
  },

  startSession: (data: { timetableId: string; staffId: string; date: string }) => {
    return api.post<ApiResponse<AttendanceSession>>('/api/attendance/sessions/start', data);
  },

  endSession: (id: string) => {
    return api.post<ApiResponse<AttendanceSession>>(`/api/attendance/sessions/${id}/end`);
  },

  cancelSession: (id: string, reason: string) => {
    return api.post<ApiResponse<AttendanceSession>>(`/api/attendance/sessions/${id}/cancel`, { reason });
  },

  startBle: (id: string) => {
    return api.post<ApiResponse<any>>(`/api/attendance/sessions/${id}/ble/start`);
  },

  stopBle: (id: string) => {
    return api.post<ApiResponse<any>>(`/api/attendance/sessions/${id}/ble/stop`);
  },

  getLiveAttendance: (id: string) => {
    return api.get<ApiResponse<import('../types').LiveAttendanceData>>(`/api/attendance/sessions/${id}/live`);
  }
};
