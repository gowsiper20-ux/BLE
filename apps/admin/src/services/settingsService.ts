import { api } from "./api";

export const settingsService = {
  getSettings: (category?: string) => 
    api.get<any>(`/api/settings${category ? `?category=${category}` : ''}`),
    
  updateSettings: (updates: { key: string; value: string }[]) => 
    api.put<any>('/api/settings', { updates }),
};
