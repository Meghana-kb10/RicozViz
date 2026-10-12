/**
 * KPI / metric layer endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order, query-string construction and return types are
 * unchanged so the migrated pages keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type { CalculatedMetricResult, CalculateMetricOptions, CreateMetricPayload, MetricData } from '@repo/types';

export async function apiCreateMetric(payload: CreateMetricPayload): Promise<MetricData> {
  return apiFetch<MetricData>("/api/v1/metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiListMetrics(
  workspaceId?: string,
  datasetId?: string
): Promise<MetricData[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (datasetId) params.set("datasetId", datasetId);
  const qs = params.toString();
  return apiFetch<MetricData[]>(`/api/v1/metrics${qs ? `?${qs}` : ""}`);
}

export async function apiGetMetric(id: string): Promise<MetricData> {
  return apiFetch<MetricData>(`/api/v1/metrics/${id}`);
}

export async function apiUpdateMetric(
  id: string,
  payload: Partial<CreateMetricPayload>
): Promise<MetricData> {
  return apiFetch<MetricData>(`/api/v1/metrics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteMetric(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/metrics/${id}`, {
    method: "DELETE",
  });
}

/**
 * Trigger a metric calculation.
 *
 * `body` is deliberately left `undefined` when no options are supplied: the
 * transport must not send an empty JSON object to this POST.
 */
export async function apiCalculateMetric(
  id: string,
  options?: CalculateMetricOptions
): Promise<CalculatedMetricResult> {
  return apiFetch<CalculatedMetricResult>(`/api/v1/metrics/${id}/calculate`, {
    method: "POST",
    body: options ? JSON.stringify(options) : undefined,
  });
}