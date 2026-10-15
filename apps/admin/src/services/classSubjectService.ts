import { api } from './api';
import type { ClassSubject } from '../types';

export const classSubjectService = {
  getClassSubjects: async (classId: string, academicYearId?: string) => {
    const qs = `?classId=${classId}${academicYearId ? `&academicYearId=${academicYearId}` : ''}`;
    const res = await api.get<{ data: ClassSubject[] }>(`/api/class-subjects${qs}`);
    return res.data;
  },

  getAssignedClasses: async (subjectId: string, academicYearId?: string) => {
    const qs = `?subjectId=${subjectId}${academicYearId ? `&academicYearId=${academicYearId}` : ''}`;
    const res = await api.get<{ data: ClassSubject[] }>(`/api/class-subjects${qs}`);
    return res.data;
  },

  assignSubjectToClass: async (data: { classId: string; subjectId: string; academicYearId: string; status?: 'ACTIVE' | 'INACTIVE' }) => {
    const res = await api.post<{ data: ClassSubject }>('/api/class-subjects', data);
    return res.data;
  },

  updateAssignmentStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
    const res = await api.patch<{ data: ClassSubject }>(`/api/class-subjects/${id}/status`, { status });
    return res.data;
  },

  removeSubjectFromClass: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/api/class-subjects/${id}`);
    return res;
  }
};
