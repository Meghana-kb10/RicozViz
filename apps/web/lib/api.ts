// ========================================
// API Client — typed fetch wrapper
// ========================================
// Communicates with the RicozViz backend API.
// Attaches the Authorization header automatically.
// Handles refresh token flow on 401.
// ========================================

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---- Token storage (sessionStorage for XSS mitigation) ----
const ACCESS_TOKEN_KEY = "ricozviz_at";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

// ---- Core fetch wrapper ----
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  skipAuthHeader = false
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuthHeader) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // Send refresh cookie automatically
  });

  const body = await res.json() as { success: boolean; data?: T; error?: { code: string; message: string; details?: Record<string, string[]> } };

  if (!body.success) {
    throw new ApiError(
      res.status,
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "An error occurred",
      body.error?.details
    );
  }

  return body.data as T;
}

// ============================================================
// Auth API calls
// ============================================================

export interface UserData {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
}

export interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  status?: string;
}

export interface AuthResponse {
  user: UserData;
  organization: OrganizationData;
  role: string;
  permissions: string[];
  accessToken: string;
}

export interface MeResponse {
  user: UserData;
  organization: OrganizationData;
  role: string;
  permissions: string[];
}

export interface RefreshResponse {
  accessToken: string;
  permissions: string[];
}

export async function apiRegister(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiLogin(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/v1/auth/me");
}

export async function apiRefresh(): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>(
    "/api/v1/auth/refresh",
    { method: "POST" },
    true // Skip auth header — refresh uses the cookie
  );
}

export async function apiLogout(): Promise<void> {
  await apiFetch<{ message: string }>("/api/v1/auth/logout", {
    method: "POST",
  });
}

// ============================================================
// DATA SOURCE TYPES & API METHODS
// ============================================================

export type DataSourceType = "POSTGRESQL" | "CSV" | "REST_API";
export type DataSourceStatus = "CONNECTED" | "PENDING" | "FAILED" | "INACTIVE";

export interface DataSourceData {
  id: string;
  name: string;
  description: string | null;
  type: DataSourceType;
  status: DataSourceStatus;
  connection: Record<string, unknown>;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  status: "CONNECTED" | "FAILED";
  message: string;
  details?: Record<string, unknown>;
}

export async function apiListDataSources(): Promise<DataSourceData[]> {
  return apiFetch<DataSourceData[]>("/api/v1/data-sources");
}

export async function apiGetDataSource(id: string): Promise<DataSourceData> {
  return apiFetch<DataSourceData>(`/api/v1/data-sources/${id}`);
}

export async function apiCreateDataSource(input: {
  name: string;
  description?: string;
  type: DataSourceType;
  connection: Record<string, unknown>;
}): Promise<DataSourceData> {
  return apiFetch<DataSourceData>("/api/v1/data-sources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateDataSource(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    connection?: Record<string, unknown>;
    status?: string;
  }
): Promise<DataSourceData> {
  return apiFetch<DataSourceData>(`/api/v1/data-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDataSource(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/data-sources/${id}`, {
    method: "DELETE",
  });
}

export async function apiTestDataSourceConnection(
  id: string
): Promise<ConnectionTestResult> {
  return apiFetch<ConnectionTestResult>(
    `/api/v1/data-sources/${id}/test-connection`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// DATASET TYPES & API METHODS
// ============================================================

export type DatasetType = "CONNECTED" | "UPLOADED" | "DERIVED";
export type DatasetStatus = "READY" | "DRAFT" | "FAILED" | "ARCHIVED";

export interface DatasetColumn {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "date";
  nullable: boolean;
}

export interface DatasetData {
  id: string;
  name: string;
  description: string | null;
  type: DatasetType;
  status: DatasetStatus;
  dataSourceId: string | null;
  dataSourceName: string | null;
  dataSourceType: string | null;
  columns: DatasetColumn[];
  tableName: string | null;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetPreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export interface CsvPreviewSchemaResult {
  columns: DatasetColumn[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
}

export interface SourceTable {
  name: string;
  type: "table" | "view";
}

export async function apiListDatasets(params?: {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<DatasetData[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.type) query.set("type", params.type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<DatasetData[]>(`/api/v1/datasets${qs ? `?${qs}` : ""}`);
}

export async function apiGetDataset(id: string): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/${id}`);
}

export async function apiCreateDataset(input: {
  name: string;
  description?: string;
  type?: DatasetType;
  dataSourceId?: string | null;
  tableName?: string;
  columns?: DatasetColumn[];
  sampleData?: Record<string, unknown>[];
  csvText?: string;
}): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateDataset(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    status?: string;
  }
): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDataset(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${id}`, {
    method: "DELETE",
  });
}

export async function apiPreviewDataset(
  id: string,
  limit = 25
): Promise<DatasetPreviewResult> {
  return apiFetch<DatasetPreviewResult>(`/api/v1/datasets/${id}/preview?limit=${limit}`);
}

export async function apiPreviewCsvSchema(
  csvText: string,
  delimiter = ","
): Promise<CsvPreviewSchemaResult> {
  return apiFetch<CsvPreviewSchemaResult>("/api/v1/datasets/csv/preview-schema", {
    method: "POST",
    body: JSON.stringify({ csvText, delimiter }),
  });
}

export async function apiListSourceTables(dataSourceId: string): Promise<SourceTable[]> {
  return apiFetch<SourceTable[]>(`/api/v1/datasets/source/${dataSourceId}/tables`);
}

export async function apiGetSourceTableSchema(
  dataSourceId: string,
  tableName: string
): Promise<{ tableName: string; columns: DatasetColumn[] }> {
  return apiFetch<{ tableName: string; columns: DatasetColumn[] }>(
    `/api/v1/datasets/source/${dataSourceId}/tables/${tableName}/schema`
  );
}

export type FilterOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull";

export type AggregationFunction = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export interface DatasetQueryFilter {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface DatasetQueryMeasure {
  column: string;
  aggregation: AggregationFunction;
  alias?: string;
}

export interface DatasetQueryParams {
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: "asc" | "desc" | "ASC" | "DESC";
  };
  filters?: DatasetQueryFilter[];
  filterLogic?: "AND" | "OR";
  dimensions?: string[];
  measures?: DatasetQueryMeasure[];
}

export interface QueryResultColumn {
  name: string;
  type: string;
}

export interface DatasetQueryResult {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
}

export async function apiQueryDataset(
  id: string,
  params: DatasetQueryParams
): Promise<DatasetQueryResult> {
  return apiFetch<DatasetQueryResult>(`/api/v1/datasets/${id}/query`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ============================================================
// DASHBOARD TYPES & API METHODS
// ============================================================

export type DashboardStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type DashboardVisibility = "PRIVATE" | "ORGANIZATION" | "PUBLIC";

export interface DashboardChart {
  id: string;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  datasetId: string | null;
}

export interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  status: DashboardStatus;
  visibility: DashboardVisibility;
  organizationId: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  layoutConfig: Record<string, unknown>;
  chartCount: number;
  charts: DashboardChart[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardListResponse {
  dashboards: DashboardData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function apiListDashboards(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}): Promise<DashboardListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  return apiFetch<DashboardListResponse>(`/api/v1/dashboards${qs ? `?${qs}` : ""}`);
}

export async function apiGetDashboard(id: string): Promise<DashboardData> {
  return apiFetch<DashboardData>(`/api/v1/dashboards/${id}`);
}

export async function apiCreateDashboard(input: {
  name: string;
  description?: string | null;
  status?: DashboardStatus;
  visibility?: DashboardVisibility;
  layoutConfig?: Record<string, unknown>;
}): Promise<DashboardData> {
  return apiFetch<DashboardData>("/api/v1/dashboards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateDashboard(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    status?: DashboardStatus;
    visibility?: DashboardVisibility;
    layoutConfig?: Record<string, unknown>;
  }
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



