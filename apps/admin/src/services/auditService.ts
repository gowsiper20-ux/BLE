import { api } from "./api";

export interface AuditLog {
  id: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const auditService = {
  getLogs: (filters: Record<string, string | number>) => 
    api.get<any>(`/api/audit/logs?${new URLSearchParams(filters as Record<string, string>).toString()}`),
};
