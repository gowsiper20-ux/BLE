import api from './api';
import type { Student } from '../types';

export interface StudentImportRow {
  rowNumber: number;
  registerNumber: string;
  name: string;
  collegeEmail: string;
  className: string;
  classId: string | null;
  isValid: boolean;
  errors: Array<{ code: string; message: string }>;
}

export interface StudentImportPreview {
  totalRows: number;
  valid: number;
  errors: number;
  data: StudentImportRow[];
}

export interface StudentImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  rows: Array<{ rowNumber: number; status: 'created' | 'skipped'; errors: Array<{ code: string; message: string }> }>;
}

export const studentService = {
  async getStudents(params: {
    search?: string;
    classId?: string;
    batchId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, String(value));
    }
    const response = await api.get<{ data: { students: Student[]; pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
      `/api/students?${query.toString()}`,
    );
    return response.data;
  },

  async createStudent(data: Pick<Student, 'registerNumber' | 'name' | 'collegeEmail' | 'classId'>) {
    const response = await api.post<{ data: Student }>('/api/students', data);
    return response.data;
  },

  async updateStudent(id: string, data: Partial<Pick<Student, 'registerNumber' | 'name' | 'collegeEmail' | 'classId'>>) {
    const response = await api.put<{ data: Student }>(`/api/students/${id}`, data);
    return response.data;
  },

  async updateStudentStatus(id: string, status: Student['status']) {
    const response = await api.patch<{ data: Student }>(`/api/students/${id}/status`, { status });
    return response.data;
  },

  async previewImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await api.postForm<{ data: StudentImportPreview }>('/api/students/import/preview', form);
    return response.data;
  },

  async confirmImport(file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await api.postForm<{ data: StudentImportResult }>('/api/students/import/confirm', form);
    return response.data;
  },

  downloadTemplate: () => api.download('/api/students/import/template'),
};
