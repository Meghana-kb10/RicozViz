/**
 * Dashboard endpoints.
 *
 * Covers CRUD, public share links, collaborators, real-time collaboration
 * state/presence/update, embedded analytics, version history, report
 * scheduling and report generation.
 *
 * Mirrored verbatim from `RicozViz_old/apps/web/lib/api.ts`, including the
 * response post-processing in `apiGrantDashboardCollaborator` (which rebuilds a
 * collaborator from two different backend shapes), `apiCreateDashboardEmbed`
 * (which duplicates `iframeCode` into `embedCode`) and `apiGetDashboardEmbed`.
 *
 * `apiListDashboards` keeps the legacy falsy-value query guards rather than
 * `toQueryString`, because `page = 0` must produce no query parameter.
 */

import { apiFetch } from './client.js';
import type {
  CollaborationStateResult,
  WsTicketResponse,
  CreateDashboardInput,
  DashboardAccessLevel,
  DashboardCollaboratorData,
  DashboardCollaboratorsResponse,
  DashboardData,
  DashboardListResponse,
  DashboardReportSnapshot,
  DashboardScheduleData,
  DashboardVersionRecord,
  DatasetQueryResult,
  EmbedConfig,
  EmbedStatusResult,
  ReportExecutionData,
  ReportFormat,
  ReportFrequency,
  SharedDashboardData,
  ShareLinkStatusResponse,
  UpdateDashboardInput,
  VersionComparisonResult
} from '@repo/types';

// ---- CRUD ---------------------------------------------------------------------

export async function apiListDashboards(params?: {
  search?: string;
  status?: string;
  workspaceId?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}): Promise<DashboardListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  return apiFetch<DashboardListResponse>(`/api/v1/dashboards${qs ? `?${qs}` : ""}`);
}

/** Legacy alias kept for pages that still import the plural name. */
export const apiGetDashboards = apiListDashboards;

export async function apiGetDashboard(id: string): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/api/v1/dashboards/${id}`);
}

export async function apiCreateDashboard(input: CreateDashboardInput): Promise<DashboardData> {
  return apiFetch<DashboardData>("/api/v1/dashboards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateDashboard(
  id: string,
  input: UpdateDashboardInput
): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/api/v1/dashboards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDashboard(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/dashboards/${id}`, {
    method: "DELETE",
  });
}

// ---- Share links --------------------------------------------------------------

export async function apiCreateShareLink(dashboardId: string, expiresAt?: string): Promise<ShareLinkStatusResponse> {
  return apiFetch<ShareLinkStatusResponse>(`/api/v1/dashboards/${dashboardId}/share`, {
    method: "POST",
    body: expiresAt ? JSON.stringify({ expiresAt }) : undefined,
  });
}

export async function apiGetShareLinkStatus(dashboardId: string): Promise<ShareLinkStatusResponse> {
  return apiFetch<ShareLinkStatusResponse>(`/api/v1/dashboards/${dashboardId}/share`);
}

export async function apiDisableShareLink(dashboardId: string): Promise<ShareLinkStatusResponse> {
  return apiFetch<ShareLinkStatusResponse>(`/api/v1/dashboards/${dashboardId}/share`, {
    method: "DELETE",
  });
}

export async function apiGetSharedDashboard(shareToken: string): Promise<SharedDashboardData> {
  return apiFetch<SharedDashboardData>(`/api/v1/dashboards/shared/${shareToken}`);
}

export async function apiGetSharedChartData(
  shareToken: string,
  chartId: string,
  filters?: unknown[]
): Promise<DatasetQueryResult> {
  return apiFetch<DatasetQueryResult>(`/api/v1/dashboards/shared/${shareToken}/charts/${chartId}/data`, {
    method: "POST",
    body: JSON.stringify({ filters }),
  });
}

// ---- Collaborators ------------------------------------------------------------

export async function apiListDashboardCollaborators(
  dashboardId: string
): Promise<DashboardCollaboratorsResponse> {
  return apiFetch<DashboardCollaboratorsResponse>(`/api/v1/dashboards/${dashboardId}/collaborators`);
}

/**
 * Grant (or update) a collaborator's access level.
 *
 * The backend answers with either the collaborator row itself or a bare user
 * record; the legacy client normalises both into a `DashboardCollaboratorData`.
 * That normalisation is preserved verbatim below.
 */
export async function apiGrantDashboardCollaborator(
  dashboardId: string,
  data: { targetUserId: string; accessLevel: DashboardAccessLevel }
): Promise<{ collaborator: DashboardCollaboratorData; message?: string }> {
  const result = await apiFetch<any>(
    `/api/v1/dashboards/${dashboardId}/collaborators`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return {
    collaborator: {
      id: result.id || result.userId,
      userId: result.userId,
      name: result.name || result.user?.name,
      email: result.email || result.user?.email,
      avatarUrl: result.avatarUrl || result.user?.avatarUrl || null,
      accessLevel: result.accessLevel,
      grantedAt: result.grantedAt || new Date().toISOString(),
      user: result.user || {
        id: result.userId,
        name: result.name || "",
        email: result.email || "",
        avatarUrl: result.avatarUrl || null,
      },
    },
    message: "Collaborator access updated",
  };
}

export async function apiRevokeDashboardCollaborator(
  dashboardId: string,
  accessId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/dashboards/${dashboardId}/collaborators/${accessId}`,
    {
      method: "DELETE",
    }
  );
}

// ---- Real-time collaboration --------------------------------------------------


export async function apiGetDashboardWsTicket(
  dashboardId: string
): Promise<WsTicketResponse> {
  return apiFetch<WsTicketResponse>(
    `/api/v1/dashboards/${dashboardId}/ws-ticket`,
    {
      method: "POST",
    }
  );
}

export async function apiGetCollaborationState(
  dashboardId: string
): Promise<CollaborationStateResult> {
  return apiFetch<CollaborationStateResult>(
    `/api/v1/dashboards/${dashboardId}/collaboration/state`
  );
}

export async function apiSendCollaborationPresence(
  dashboardId: string,
  payload?: { clientId?: string; activeWidgetId?: string | null }
): Promise<{ status: string; timestamp: number }> {
  return apiFetch<{ status: string; timestamp: number }>(
    `/api/v1/dashboards/${dashboardId}/collaboration/presence`,
    {
      method: "POST",
      body: JSON.stringify(payload || { clientId: "web-" + Math.random().toString(36).substring(2, 9) }),
    }
  );
}

export async function apiCollaborativeUpdate(
  dashboardId: string,
  payload: {
    baseVersionNumber?: number;
    name?: string;
    description?: string | null;
    layoutConfig?: Record<string, unknown>;
    chartsSnapshot?: any[];
    changeSummary?: string;
    clientId?: string;
  }
): Promise<{
  dashboardId: string;
  versionNumber: number;
  name: string;
  layoutConfig: Record<string, unknown>;
  changeSummary: string;
}> {
  return apiFetch<{
    dashboardId: string;
    versionNumber: number;
    name: string;
    layoutConfig: Record<string, unknown>;
    changeSummary: string;
  }>(`/api/v1/dashboards/${dashboardId}/collaboration/update`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- Embedded analytics -------------------------------------------------------

export async function apiCreateDashboardEmbed(
  dashboardId: string,
  config?: {
    enabled?: boolean;
    allowedOrigins?: string[];
    expiresAt?: string | null;
    expiresInDays?: number;
    theme?: "light" | "dark" | "system";
    showTitle?: boolean;
    showFilters?: boolean;
    showRefresh?: boolean;
    showControls?: boolean;
  }
): Promise<EmbedStatusResult> {
  const result = await apiFetch<{
    embedToken: string;
    embedUrl: string;
    iframeCode: string;
    config: EmbedConfig;
  }>(`/api/v1/dashboards/${dashboardId}/embed`, {
    method: "POST",
    body: JSON.stringify(config || {}),
  });
  return {
    enabled: true,
    embedToken: result.embedToken,
    embedUrl: result.embedUrl,
    iframeCode: result.iframeCode,
    embedCode: result.iframeCode,
    expiresAt: result.config?.expiresAt || null,
    config: result.config,
  };
}

export async function apiGetDashboardEmbed(
  dashboardId: string
): Promise<EmbedStatusResult> {
  const result = await apiFetch<EmbedStatusResult>(`/api/v1/dashboards/${dashboardId}/embed`);
  return {
    ...result,
    embedCode: result.iframeCode || result.embedCode || null,
    expiresAt: result.config?.expiresAt || result.expiresAt || null,
  };
}

export async function apiRevokeDashboardEmbed(
  dashboardId: string
): Promise<{ message: string; enabled: boolean }> {
  return apiFetch<{ message: string; enabled: boolean }>(
    `/api/v1/dashboards/${dashboardId}/embed`,
    {
      method: "DELETE",
    }
  );
}

export async function apiGetEmbeddedDashboard(
  embedToken: string
): Promise<{
  id: string;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  embedConfig: {
    theme: string;
    showTitle: boolean;
    showFilters: boolean;
    showRefresh: boolean;
  };
  charts: any[];
}> {
  return apiFetch<any>(`/api/v1/dashboards/embed/${embedToken}`);
}

export async function apiGetEmbeddedChartData(
  embedToken: string,
  chartId: string,
  filters?: unknown[]
): Promise<DatasetQueryResult> {
  return apiFetch<DatasetQueryResult>(
    `/api/v1/dashboards/embed/${embedToken}/charts/${chartId}/data`,
    {
      method: "POST",
      body: JSON.stringify({ filters }),
    }
  );
}

// ---- Version history ----------------------------------------------------------

export async function apiListDashboardVersions(
  dashboardId: string
): Promise<DashboardVersionRecord[]> {
  return apiFetch<DashboardVersionRecord[]>(`/api/v1/dashboards/${dashboardId}/versions`);
}

export async function apiGetDashboardVersion(
  dashboardId: string,
  versionNumber: number
): Promise<DashboardVersionRecord> {
  return apiFetch<DashboardVersionRecord>(`/api/v1/dashboards/${dashboardId}/versions/${versionNumber}`);
}

export async function apiCompareDashboardVersions(
  dashboardId: string,
  baseVersion: number,
  targetVersion: number
): Promise<VersionComparisonResult> {
  return apiFetch<VersionComparisonResult>(
    `/api/v1/dashboards/${dashboardId}/versions/compare?v1=${baseVersion}&v2=${targetVersion}`
  );
}

export async function apiRestoreDashboardVersion(
  dashboardId: string,
  versionNumber: number
): Promise<{
  dashboard: any;
  restoredFromVersion: number;
  newVersionNumber: number;
}> {
  return apiFetch<{
    dashboard: any;
    restoredFromVersion: number;
    newVersionNumber: number;
  }>(`/api/v1/dashboards/${dashboardId}/versions/${versionNumber}/restore`, {
    method: "POST",
  });
}

// ---- Report scheduling & generation -------------------------------------------

export async function apiGetDashboardSchedule(
  dashboardId: string
): Promise<DashboardScheduleData | null> {
  return apiFetch<DashboardScheduleData | null>(`/api/v1/dashboards/${dashboardId}/schedule`);
}

export async function apiSaveDashboardSchedule(
  dashboardId: string,
  payload: {
    frequency: ReportFrequency;
    format?: ReportFormat;
    enabled?: boolean;
    recipients?: string[];
    webhookUrl?: string;
    deliveryType?: "EMAIL" | "WEBHOOK" | "BOTH";
  }
): Promise<DashboardScheduleData> {
  return apiFetch<DashboardScheduleData>(`/api/v1/dashboards/${dashboardId}/schedule`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteDashboardSchedule(
  dashboardId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/dashboards/${dashboardId}/schedule`,
    {
      method: "DELETE",
    }
  );
}

export async function apiGenerateDashboardReport(
  dashboardId: string
): Promise<DashboardReportSnapshot> {
  return apiFetch<DashboardReportSnapshot>(`/api/v1/dashboards/${dashboardId}/reports/generate`, {
    method: "POST",
  });
}

export async function apiGetDashboardReportHistory(
  dashboardId: string
): Promise<ReportExecutionData[]> {
  return apiFetch<ReportExecutionData[]>(`/api/v1/dashboards/${dashboardId}/reports/history`);
}

export async function apiRunDashboardReport(
  dashboardId: string,
  reportIdOrFormat?: string
): Promise<{
  id: string;
  reportId: string;
  executionId: string;
  execution: {
    id: string;
    format: string;
    status: string;
    executedAt: string;
    durationMs: number;
  };
  status: string;
  executedAt: string;
  durationMs: number;
  chartCount: number;
  totalRecords: number;
  snapshot: DashboardReportSnapshot;
}> {
  return apiFetch(`/api/v1/dashboards/${dashboardId}/reports/${reportIdOrFormat || "PDF"}/run`, {
    method: "POST",
  });
}
