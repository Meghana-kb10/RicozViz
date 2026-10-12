/**
 * Dashboard template endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order, query-string construction and return types are
 * unchanged so the migrated pages keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type {
  CreateTemplateFromDashboardPayload,
  DashboardData,
  DashboardTemplateData,
  InstantiateDashboardPayload
} from '@repo/types';

export async function apiListTemplates(
  category?: string,
  workspaceId?: string
): Promise<DashboardTemplateData[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (workspaceId) params.set("workspaceId", workspaceId);
  const qs = params.toString();
  return apiFetch<DashboardTemplateData[]>(`/api/v1/templates${qs ? `?${qs}` : ""}`);
}

export async function apiGetTemplate(id: string): Promise<DashboardTemplateData> {
  return apiFetch<DashboardTemplateData>(`/api/v1/templates/${id}`);
}

export async function apiCreateTemplateFromDashboard(
  payload: CreateTemplateFromDashboardPayload
): Promise<DashboardTemplateData> {
  return apiFetch<DashboardTemplateData>("/api/v1/templates/from-dashboard", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiInstantiateDashboardFromTemplate(
  templateId: string,
  payload: InstantiateDashboardPayload
): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/api/v1/templates/${templateId}/instantiate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}