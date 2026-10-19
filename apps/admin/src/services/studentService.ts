import api from './api';
export interface DirectoryStudent {
  id: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  academicBatch: string | null;
  academicClass: string | null;
  accountEnabled: boolean | null;
  lastSyncedAt: string;
}

export interface DirectoryStudentResult {
  identities: DirectoryStudent[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { batches: string[]; classes: string[] };
  classificationConfigured: boolean;
  academicAttributesConfigured: boolean;
  batchAttributeConfigured: boolean;
  classAttributeConfigured: boolean;
}

class StudentService {
  async getDirectoryStudents(params: {
    search?: string;
    academicBatch?: string;
    academicClass?: string;
    accountStatus?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.academicBatch) query.append('academicBatch', params.academicBatch);
    if (params.academicClass) query.append('academicClass', params.academicClass);
    if (params.accountStatus) query.append('accountStatus', params.accountStatus);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    const res = await api.get<{ data: DirectoryStudentResult }>(`/api/auth/directory-students?${query.toString()}`);
    return res.data;
  }

  async getDirectoryStaff(params: {
    search?: string;
    accountStatus?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.accountStatus) query.append('accountStatus', params.accountStatus);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    const res = await api.get<{ data: DirectoryStudentResult }>(`/api/auth/directory-staff?${query.toString()}`);
    return res.data;
  }
}

export const studentService = new StudentService();
