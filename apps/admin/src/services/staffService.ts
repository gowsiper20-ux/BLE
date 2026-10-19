import { api } from './api';
import type { StaffListResponse, Staff, ClassCounselor } from '../types';

export const staffService = {
  // --- Staff ---
  getStaff: async (params?: { search?: string; status?: string; role?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const queryString = query.toString();
    const qs = queryString ? `?${queryString}` : '';
    const res = await api.get<{ data: StaffListResponse }>(`/api/staff${qs}`);
    return res.data;
  },
  
  getStaffById: async (id: string) => {
    const res = await api.get<{ data: Staff }>(`/api/staff/${id}`);
    return res.data;
  },

  // --- Class Counselors ---
  getCounselorAssignments: async (params?: { classId?: string; academicYearId?: string; staffId?: string }) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined) query.set(key, value);
    }
    const queryString = query.toString();
    const qs = queryString ? `?${queryString}` : '';
    const res = await api.get<{ data: ClassCounselor[] }>(`/api/class-counselors${qs}`);
    return res.data;
  },

  assignCounselor: async (
    data: Pick<ClassCounselor, 'classId' | 'staffId' | 'academicYearId'> & Partial<Pick<ClassCounselor, 'status'>>
  ) => {
    const res = await api.post<{ data: ClassCounselor }>('/api/class-counselors', data);
    return res.data;
  },

  updateCounselorStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
    const res = await api.patch<{ data: ClassCounselor }>(`/api/class-counselors/${id}/status`, { status });
    return res.data;
  },

  removeCounselor: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/api/class-counselors/${id}`);
    return res;
  }
};
