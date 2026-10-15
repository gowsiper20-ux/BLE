import api from './api';
import type { 
  Student, 
  PaginatedResponse, 
  StudentImportPreview, 
  StudentImportResult 
} from '../types';

class StudentService {
  async getStudents(params: { search?: string; classId?: string; status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.classId) query.append('classId', params.classId);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await api.get<{ data: { students: Student[], pagination: PaginatedResponse<any> } }>(`/api/students?${query.toString()}`);
    return res.data;
  }

  async getStudent(id: string) {
    const res = await api.get<{ data: Student }>(`/api/students/${id}`);
    return res.data;
  }

  async createStudent(data: Partial<Student>) {
    const res = await api.post<{ data: Student }>('/api/students', data);
    return res.data;
  }

  async updateStudent(id: string, data: Partial<Student>) {
    const res = await api.patch<{ data: Student }>(`/api/students/${id}`, data);
    return res.data;
  }

  async deactivateStudent(id: string) {
    // Calling DELETE endpoint which performs deactivation as per our logic
    await api.delete(`/api/students/${id}`);
  }

  async validateImport(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // Since api.post currently stringifies data, we need a raw fetch or to update api client.
    // Our api client handles JSON by default. Let's do a raw fetch for FormData.
    const res = await fetch('/api/students/import/validate', {
      method: 'POST',
      body: formData,
      // Omit Content-Type to let browser set boundary
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.message || 'Failed to validate file');
    }
    
    const json = await res.json();
    return json.data as StudentImportPreview;
  }

  async confirmImport(importData: any[]) {
    const res = await api.post<{ data: StudentImportResult }>('/api/students/import/confirm', { importData });
    return res.data;
  }

  downloadCsvTemplate() {
    window.location.href = '/api/students/template/csv';
  }

  downloadXlsxTemplate() {
    window.location.href = '/api/students/template/xlsx';
  }
}

export const studentService = new StudentService();
