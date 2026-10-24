import { api } from "./api";
import type { ApiResponse } from "../types";

export const timetableService = {
  // Periods
  getPeriods: () => api.get<ApiResponse<any[]>>("/api/periods"),
  createPeriod: (data: any) => api.post<ApiResponse<any>>("/api/periods", data),
  updatePeriod: (id: string, data: any) => api.patch<ApiResponse<any>>(`/api/periods/${id}`, data),
  deletePeriod: (id: string) => api.delete<ApiResponse<any>>(`/api/periods/${id}`),


  // Timetables
  getTimetableByClass: (classId: string, academicYearId?: string) => 
    api.get<ApiResponse<any[]>>(`/api/timetable?classId=${classId}${academicYearId ? `&academicYearId=${academicYearId}` : ''}`),
  getTimetableByStaff: (staffId: string, academicYearId?: string) => 
    api.get<ApiResponse<any[]>>(`/api/timetable?staffId=${staffId}${academicYearId ? `&academicYearId=${academicYearId}` : ''}`),
  createTimetableEntry: (data: any) => api.post<ApiResponse<any>>("/api/timetable", data),
  updateTimetableEntry: (id: string, data: any) => api.patch<ApiResponse<any>>(`/api/timetable/${id}`, data),
  deleteTimetableEntry: (id: string) => api.delete<ApiResponse<any>>(`/api/timetable/${id}`),
  getStats: () => api.get<ApiResponse<any>>("/api/timetable/stats"),

  // Overrides
  getOverrides: () => api.get<ApiResponse<any[]>>("/api/timetable/overrides"),
  createOverride: (data: any) => api.post<ApiResponse<any>>("/api/timetable/overrides", data),
  updateOverride: (id: string, data: any) => api.patch<ApiResponse<any>>(`/api/timetable/overrides/${id}`, data),
  deleteOverride: (id: string) => api.delete<ApiResponse<any>>(`/api/timetable/overrides/${id}`),
};
