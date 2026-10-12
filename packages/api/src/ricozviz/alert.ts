/**
 * Smart data alert endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order, query-string construction and return types are
 * unchanged so the migrated pages keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type { AlertData, AlertEvaluationResult, CreateAlertPayload } from '@repo/types';

export async function apiCreateAlert(payload: CreateAlertPayload): Promise<AlertData> {
  return apiFetch<AlertData>("/api/v1/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiListAlerts(
  workspaceId?: string,
  metricId?: string
): Promise<AlertData[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (metricId) params.set("metricId", metricId);
  const qs = params.toString();
  return apiFetch<AlertData[]>(`/api/v1/alerts${qs ? `?${qs}` : ""}`);
}

export async function apiGetAlert(id: string): Promise<AlertData> {
  return apiFetch<AlertData>(`/api/v1/alerts/${id}`);
}

export async function apiUpdateAlert(
  id: string,
  payload: Partial<CreateAlertPayload>
): Promise<AlertData> {
  return apiFetch<AlertData>(`/api/v1/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteAlert(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/alerts/${id}`, {
    method: "DELETE",
  });
}

export async function apiEvaluateAlert(id: string): Promise<AlertEvaluationResult> {
  return apiFetch<AlertEvaluationResult>(`/api/v1/alerts/${id}/evaluate`, {
    method: "POST",
  });
}

export async function apiClearAlert(id: string): Promise<AlertData> {
  return apiFetch<AlertData>(`/api/v1/alerts/${id}/clear`, {
    method: "POST",
  });
}

/**
 * Bulk-evaluate every alert in a workspace.
 *
 * The legacy client left the generic off this call, so `apiFetch` inferred the
 * envelope payload. The explicit annotation below keeps that inferred shape
 * byte-compatible with what pages already consume.
 */
export async function apiEvaluateAllWorkspaceAlerts(
  workspaceId: string
): Promise<{ totalEvaluated: number; triggeredCount: number; results: unknown[] }> {
  return apiFetch(`/api/v1/alerts/workspace/${workspaceId}/evaluate-all`, {
    method: "POST",
  });
}