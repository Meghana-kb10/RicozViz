/**
 * Audit log endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order, query-string construction and return types are
 * unchanged so the migrated pages keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type { AuditLogStatsResponse, QueryAuditLogsParams, QueryAuditLogsResponse } from '@repo/types';

export async function apiQueryAuditLogs(
  params?: QueryAuditLogsParams
): Promise<QueryAuditLogsResponse> {
  const q = new URLSearchParams();
  if (params?.workspaceId) q.set("workspaceId", params.workspaceId);
  if (params?.action) q.set("action", params.action);
  if (params?.resourceType) q.set("resourceType", params.resourceType);
  if (params?.userId) q.set("userId", params.userId);
  if (params?.status) q.set("status", params.status);
  if (params?.startDate) q.set("startDate", params.startDate);
  if (params?.endDate) q.set("endDate", params.endDate);
  if (params?.search) q.set("search", params.search);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<QueryAuditLogsResponse>(`/api/v1/audit-logs${qs ? `?${qs}` : ""}`);
}

export async function apiGetAuditLogStats(workspaceId?: string): Promise<AuditLogStatsResponse> {
  const q = new URLSearchParams();
  if (workspaceId) q.set("workspaceId", workspaceId);
  const qs = q.toString();
  return apiFetch<AuditLogStatsResponse>(`/api/v1/audit-logs/stats${qs ? `?${qs}` : ""}`);
}