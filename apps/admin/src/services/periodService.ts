import { api } from "./api";

export interface Period {
  id: string;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export const periodService = {
  getPeriods: () => api.get<any>("/api/periods"),
  createPeriod: (data: Partial<Period>) => api.post<any>("/api/periods", data),
  updatePeriod: (id: string, data: Partial<Period>) => api.put<any>(`/api/periods/${id}`, data),
  deletePeriod: (id: string) => api.delete<any>(`/api/periods/${id}`),
};
