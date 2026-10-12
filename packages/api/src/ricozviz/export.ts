/**
 * Export centre endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order, query-string construction and return types are
 * unchanged so the migrated pages keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type { ExportJobData, ExportRequestPayload, ExportResult } from '@repo/types';

export async function apiExportResource(payload: ExportRequestPayload): Promise<ExportResult> {
  return apiFetch<ExportResult>("/api/v1/exports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiListExportHistory(
  workspaceId?: string,
  limit: number = 50
): Promise<ExportJobData[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  params.set("limit", String(limit));
  return apiFetch<ExportJobData[]>(`/api/v1/exports/history?${params.toString()}`);
}