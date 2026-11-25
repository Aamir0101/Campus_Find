import type { AuditActionType, PaginatedAuditLogsResponse } from '../types/domain';
import { apiRequest } from './apiClient';

export interface ListAuditLogsParams {
  action?: 'ALL' | AuditActionType;
  entityType?: string;
  page?: number;
  limit?: number;
}

export const auditService = {
  async listAuditLogs(
    params?: ListAuditLogsParams,
  ): Promise<PaginatedAuditLogsResponse> {
    const query = new URLSearchParams();
    if (params?.action && params.action !== 'ALL') {
      query.set('action', params.action);
    }
    if (params?.entityType) {
      query.set('entityType', params.entityType);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return apiRequest<PaginatedAuditLogsResponse>(
      `/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`,
    );
  },
};
