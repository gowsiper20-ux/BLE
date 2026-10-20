import { api } from './api';
import type { StaffListResponse, Staff, ClassCounselor } from '../types';

export interface StaffImportRow {
  rowNumber: number;
  staffCode: string;
  name: string;
  collegeEmail: string;
  isValid: boolean;
  errors: Array<{ code: string; message: string }>;
}

export interface StaffImportPreview {
  totalRows: number;
  valid: number;
  errors: number;
  data: StaffImportRow[];
}

export interface StaffImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  rows: Array<{ rowNumber: number; status: 'created' | 'skipped'; errors: Array<{ code: string; message: string }> }>;
}

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

  createStaff: async (data: Pick<Staff, 'staffCode' | 'name' | 'collegeEmail'>) => {
    const res = await api.post<{ data: Staff }>('/api/staff', data);
    return res.data;
  },

  updateStaff: async (id: string, data: Partial<Pick<Staff, 'staffCode' | 'name' | 'collegeEmail'>>) => {
    const res = await api.put<{ data: Staff }>(`/api/staff/${id}`, data);
    return res.data;
  },

  updateStaffStatus: async (id: string, status: Staff['status']) => {
    const res = await api.patch<{ data: Staff }>(`/api/staff/${id}/status`, { status });
    return res.data;
  },

  previewImport: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.postForm<{ data: StaffImportPreview }>('/api/staff/import/preview', form);
    return res.data;
  },

  confirmImport: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.postForm<{ data: StaffImportResult }>('/api/staff/import/confirm', form);
    return res.data;
  },

  downloadTemplate: () => api.download('/api/staff/import/template'),

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
