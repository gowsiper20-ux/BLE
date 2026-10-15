import { api } from './api';
import type { StaffListResponse, Staff, Role, StaffRole, ClassCounselor } from '../types';

export const staffService = {
  // --- Staff ---
  getStaff: async (params?: { search?: string; status?: string; role?: string; page?: number; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const res = await api.get<{ data: StaffListResponse }>(`/api/staff${qs}`);
    return res.data;
  },
  
  getStaffById: async (id: string) => {
    const res = await api.get<{ data: Staff }>(`/api/staff/${id}`);
    return res.data;
  },

  createStaff: async (data: any) => {
    const res = await api.post<{ data: Staff }>('/api/staff', data);
    return res.data;
  },

  updateStaff: async (id: string, data: any) => {
    const res = await api.patch<{ data: Staff }>(`/api/staff/${id}`, data);
    return res.data;
  },

  deleteStaff: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/api/staff/${id}`);
    return res;
  },

  // --- Roles ---
  getRoles: async () => {
    const res = await api.get<{ data: Role[] }>('/api/roles');
    return res.data;
  },

  getStaffRoles: async (staffId: string) => {
    const res = await api.get<{ data: StaffRole[] }>(`/api/staff/${staffId}/roles`);
    return res.data;
  },

  assignRole: async (staffId: string, roleName: string) => {
    const res = await api.post<{ data: any }>(`/api/staff/${staffId}/roles`, { role: roleName });
    return res.data;
  },

  removeRole: async (staffId: string, roleName: string) => {
    const res = await api.delete<{ data: any }>(`/api/staff/${staffId}/roles/${roleName}`);
    return res.data;
  },

  // --- Class Counselors ---
  getCounselorAssignments: async (params?: { classId?: string; academicYearId?: string; staffId?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const res = await api.get<{ data: ClassCounselor[] }>(`/api/class-counselors${qs}`);
    return res.data;
  },

  assignCounselor: async (data: any) => {
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
