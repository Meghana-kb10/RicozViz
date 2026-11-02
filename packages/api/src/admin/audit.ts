/**
 * Platform Admin Global Audit Ledger API
 */

import { adminApiFetch } from './admin-client.js';
import type { AdminAuditQueryInput } from '@repo/validation';

export interface AdminAuditLogEntry {
  id: string;
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousHash: string;
  currentHash: string;
  sequenceNumber: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditListResponse {
  logs: AdminAuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAuditVerifyResponse {
  valid: boolean;
  totalChecked: number;
  brokenAtId?: string;
  reason?: string;
}

export async function apiAdminListAuditLogs(
  query: Partial<AdminAuditQueryInput> = {}
): Promise<AdminAuditListResponse> {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.action) params.set('action', query.action);
  if (query.resourceType) params.set('resourceType', query.resourceType);
  if (query.search) params.set('search', query.search);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  return adminApiFetch<AdminAuditListResponse>(`/admin/audit${qs ? `?${qs}` : ''}`, {
    method: 'GET'
  });
}

export async function apiAdminVerifyAuditChain(
  organizationId?: string
): Promise<AdminAuditVerifyResponse> {
  return adminApiFetch<AdminAuditVerifyResponse>('/admin/audit/verify', {
    method: 'POST',
    body: JSON.stringify(organizationId ? { organizationId } : {})
  });
}
