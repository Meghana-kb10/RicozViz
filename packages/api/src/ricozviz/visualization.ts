/**
 * Standalone visualization endpoints.
 *
 * Visualizations are chart definitions that may or may not be attached to a
 * dashboard (`VisualizationData.dashboardId`). Sharing here is token-based and
 * separate from the dashboard share-link endpoints in `dashboard.ts`.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts`. `apiListVisualizations`
 * keeps the legacy falsy-value query guard rather than `toQueryString`, because
 * `includeData = false` must produce no query parameter.
 */

import { apiFetch } from './client.js';
import type {
  CreateVisualizationInput,
  DatasetQueryResult,
  UpdateVisualizationInput,
  VisualizationData
} from '@repo/types';

export async function apiListVisualizations(params?: {
  workspaceId?: string;
  includeData?: boolean;
}): Promise<VisualizationData[]> {
  const query = new URLSearchParams();
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
  if (params?.includeData) query.set("includeData", "true");
  const qs = query.toString();
  return apiFetch<VisualizationData[]>(`/api/v1/visualizations${qs ? `?${qs}` : ""}`);
}

export async function apiGetVisualization(
  id: string,
  includeData?: boolean
): Promise<VisualizationData> {
  const qs = includeData ? "?includeData=true" : "";
  return apiFetch<VisualizationData>(`/api/v1/visualizations/${id}${qs}`);
}

export async function apiGetVisualizationData(
  id: string
): Promise<{ visualization: VisualizationData } & DatasetQueryResult> {
  return apiFetch<{ visualization: VisualizationData } & DatasetQueryResult>(
    `/api/v1/visualizations/${id}/data`
  );
}

export async function apiCreateVisualization(
  input: CreateVisualizationInput
): Promise<VisualizationData> {
  return apiFetch<VisualizationData>("/api/v1/visualizations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateVisualization(
  id: string,
  input: UpdateVisualizationInput
): Promise<VisualizationData> {
  return apiFetch<VisualizationData>(`/api/v1/visualizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteVisualization(
  id: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/visualizations/${id}`, {
    method: "DELETE",
  });
}

// ---- Sharing ------------------------------------------------------------------

export async function apiShareVisualization(
  chartId: string
): Promise<{ shareToken: string; shareUrl: string; isPublic: boolean; sharedAt: string }> {
  return apiFetch<{ shareToken: string; shareUrl: string; isPublic: boolean; sharedAt: string }>(
    `/api/v1/visualizations/${chartId}/share`,
    {
      method: "POST",
    }
  );
}

export async function apiRevokeVisualizationShare(
  chartId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/visualizations/${chartId}/share`,
    {
      method: "DELETE",
    }
  );
}

export async function apiGetSharedVisualization(
  shareToken: string
): Promise<{ chart: Record<string, unknown> }> {
  return apiFetch<{ chart: Record<string, unknown> }>(`/api/v1/visualizations/shared/${shareToken}`);
}

export async function apiGetSharedVisualizationData(
  shareToken: string
): Promise<{ rows: Array<Record<string, unknown>>; columns: Array<{ name: string; type: string }>; rowCount: number }> {
  return apiFetch<{ rows: Array<Record<string, unknown>>; columns: Array<{ name: string; type: string }>; rowCount: number }>(
    `/api/v1/visualizations/shared/${shareToken}/data`,
    {
      method: "POST",
    }
  );
}
