import { api } from "./api";
import type { ApiResponse } from "../types";

export const academicService = {
  getAcademicYears: () => api.get<ApiResponse<any[]>>("/api/academic-years"),
  getClasses: () => api.get<ApiResponse<any[]>>("/api/classes"),
  getDepartments: () => api.get<ApiResponse<any[]>>("/api/departments"),
  getBatches: () => api.get<ApiResponse<any[]>>("/api/batches"),
  getRegulations: () => api.get<ApiResponse<any[]>>("/api/regulations"),
};
