/**
 * Dashboard chart endpoints.
 *
 * Charts are always nested under their parent dashboard, so every function
 * takes `dashboardId` first. Paths, verbs, parameter order and return types are
 * mirrored verbatim from the legacy web client (`RicozViz_old/apps/web/lib/api.ts`)
 * so existing pages keep working against this package.
 */

import { apiFetch } from './client.js';
import type { ChartData, CreateChartInput, UpdateChartInput } from '@repo/types';

export async function apiListCharts(dashboardId: string): Promise<ChartData[]> {
  return apiFetch<ChartData[]>(`/api/v1/dashboards/${dashboardId}/charts`);
}

export async function apiGetChart(
  dashboardId: string,
  chartId: string
): Promise<ChartData> {
  return apiFetch<ChartData>(`/api/v1/dashboards/${dashboardId}/charts/${chartId}`);
}

export async function apiCreateChart(
  dashboardId: string,
  input: CreateChartInput
): Promise<ChartData> {
  return apiFetch<ChartData>(`/api/v1/dashboards/${dashboardId}/charts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateChart(
  dashboardId: string,
  chartId: string,
  input: UpdateChartInput
): Promise<ChartData> {
  return apiFetch<ChartData>(
    `/api/v1/dashboards/${dashboardId}/charts/${chartId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function apiDeleteChart(
  dashboardId: string,
  chartId: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(
    `/api/v1/dashboards/${dashboardId}/charts/${chartId}`,
    {
      method: "DELETE",
    }
  );
}