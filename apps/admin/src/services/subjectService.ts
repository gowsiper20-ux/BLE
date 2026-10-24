import { api } from './api';
import type { SubjectListResponse, Subject, SubjectStats } from '../types';

export const subjectService = {
  getSubjects: async (params?: { search?: string; type?: string; year?: number; regulationId?: string; status?: string; page?: number; limit?: number }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const res = await api.get<{ data: SubjectListResponse }>(`/api/subjects${qs}`);
    return res.data;
  },
  
  getSubjectById: async (id: string) => {
    const res = await api.get<{ data: Subject }>(`/api/subjects/${id}`);
    return res.data;
  },

  getSubjectStats: async () => {
    const res = await api.get<{ data: SubjectStats }>(`/api/subjects/stats`);
    return res.data;
  },

  createSubject: async (data: any) => {
    const res = await api.post<{ data: Subject }>('/api/subjects', data);
    return res.data;
  },

  updateSubject: async (id: string, data: any) => {
    const res = await api.patch<{ data: Subject }>(`/api/subjects/${id}`, data);
    return res.data;
  },

  deactivateSubject: async (id: string) => {
    const res = await api.patch<{ data: Subject }>(`/api/subjects/${id}/status`, { status: 'INACTIVE' });
    return res.data;
  },

  activateSubject: async (id: string) => {
    const res = await api.patch<{ data: Subject }>(`/api/subjects/${id}/status`, { status: 'ACTIVE' });
    return res.data;
  },

  deleteSubject: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/api/subjects/${id}`);
    return res;
  },

  // --- Bulk Import ---
  downloadTemplate: () => api.download('/api/subjects/import/template'),

  previewImport: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.postForm<{ data: any }>('/api/subjects/import/preview', form);
    return res.data;
  },

  confirmImport: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await api.postForm<{ data: any }>('/api/subjects/import/confirm', form);
    return res.data;
  }
};
