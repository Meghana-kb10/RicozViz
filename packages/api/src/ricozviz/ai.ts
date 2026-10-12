/**
 * AI / natural-language analytics endpoints.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts` — names, verbs,
 * paths, parameter order and return types are unchanged so the migrated pages
 * keep calling these by the same signature.
 */

import { apiFetch } from './client.js';
import type {
  AnalystQueryResponse,
  AskDataAnalystParams,
  DashboardSummaryParams,
  DashboardSummaryResponse,
  InsightsParams,
  InsightsResponse,
  NlToChartParams,
  NlToChartResponse
} from '@repo/types';

export async function apiAskDataAnalyst(params: AskDataAnalystParams): Promise<AnalystQueryResponse> {
  return apiFetch<AnalystQueryResponse>("/api/v1/ai/ask", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiNlToChart(params: NlToChartParams): Promise<NlToChartResponse> {
  return apiFetch<NlToChartResponse>("/api/v1/ai/nl-to-chart", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiGetInsights(params: InsightsParams): Promise<InsightsResponse> {
  return apiFetch<InsightsResponse>(
    "/api/v1/ai/insights",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

export async function apiGetDashboardSummary(params: DashboardSummaryParams): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>("/api/v1/ai/dashboard-summary", {
    method: "POST",
    body: JSON.stringify(params),
  });
}