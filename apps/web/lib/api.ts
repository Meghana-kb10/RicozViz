 // ========================================
// API Client — typed fetch wrapper
// ========================================
// Communicates with the RicozViz backend API.
// Attaches the Authorization header automatically.
// Handles refresh token flow on 401.
// ========================================
export function getApiBaseUrl(): string {
  const envUrl = process.env["NEXT_PUBLIC_API_URL"]?.trim();

  // 1. If a valid absolute URL with a domain or port is provided (e.g. https://ricozviz-api.onrender.com or http://localhost:4000)
  if (envUrl && envUrl.startsWith("http") && (envUrl.includes(".") || envUrl.includes(":4000"))) {
    return envUrl.replace(/\/+$/, "");
  }

  // 2. If running in browser on Render (*-web.onrender.com), dynamically route directly to *-api.onrender.com
  if (typeof window !== "undefined") {
    if (window.location.origin.includes("-web.onrender.com")) {
      return window.location.origin.replace("-web.onrender.com", "-api.onrender.com");
    }
  }

  // 3. Fallback to envUrl if valid or default local development backend
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/+$/, "");
  }

  return "http://localhost:4000";
}

const API_BASE = getApiBaseUrl();

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
  document.cookie = "ricozviz_auth=true; path=/; max-age=86400; SameSite=Lax";
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = "ricozviz_auth=; path=/; max-age=0; SameSite=Lax";
}

// ---- Core fetch wrapper ----
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  skipAuthHeader = false
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.method !== "GET" && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuthHeader) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}${path}`, {
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
// WORKSPACE TYPES & API METHODS
// ============================================================

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "EDITOR" | "VIEWER";

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberData {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    status: string;
  };
}

export async function apiListWorkspaces(): Promise<WorkspaceData[]> {
  return apiFetch<WorkspaceData[]>("/api/v1/workspaces");
}

export async function apiGetWorkspace(id: string): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>(`/api/v1/workspaces/${id}`);
}

export async function apiCreateWorkspace(input: {
  name: string;
  description?: string;
}): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>("/api/v1/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiUpdateWorkspace(
  id: string,
  input: { name?: string; description?: string | null }
): Promise<WorkspaceData> {
  return apiFetch<WorkspaceData>(`/api/v1/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function apiDeleteWorkspace(id: string): Promise<{ message: string; id: string }> {
  return apiFetch<{ message: string; id: string }>(`/api/v1/workspaces/${id}`, {
    method: "DELETE",
  });
}

export async function apiListWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberData[]> {
  return apiFetch<WorkspaceMemberData[]>(`/api/v1/workspaces/${workspaceId}/members`);
}

export async function apiAddWorkspaceMember(
  workspaceId: string,
  input: { userId: string; role?: "ADMIN" | "MEMBER" }
): Promise<WorkspaceMemberData> {
  return apiFetch<WorkspaceMemberData>(`/api/v1/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiRemoveWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ message: string; workspaceId: string; userId: string }> {
  return apiFetch<{ message: string; workspaceId: string; userId: string }>(
    `/api/v1/workspaces/${workspaceId}/members/${userId}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// DATA SOURCE TYPES & API METHODS
// ============================================================

export type DataSourceType = "POSTGRESQL" | "MYSQL" | "CSV" | "REST_API" | "XLSX" | "JSON";
export type DataSourceStatus = "CONNECTED" | "PENDING" | "FAILED" | "INACTIVE";

export interface DataSourceData {
  id: string;
  workspaceId?: string | null;
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

export async function apiListDataSources(params?: { workspaceId?: string }): Promise<DataSourceData[]> {
  const query = new URLSearchParams();
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
  const qs = query.toString();
  return apiFetch<DataSourceData[]>(`/api/v1/data-sources${qs ? `?${qs}` : ""}`);
}

export async function apiGetDataSource(id: string): Promise<DataSourceData> {
  return apiFetch<DataSourceData>(`/api/v1/data-sources/${id}`);
}

export async function apiCreateDataSource(input: {
  workspaceId?: string | null;
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
export type DatasetStatus = "READY" | "PROCESSING" | "FAILED" | "ACTIVE" | "DRAFT" | "ARCHIVED" | "ERROR";
export type DatasetSourceType = "CSV" | "XLSX" | "JSON";

export interface DatasetColumn {
  name: string;
  type: "string" | "number" | "integer" | "decimal" | "boolean" | "date" | "datetime" | string;
  nullable: boolean;
  ordinalPosition?: number;
  isCalculated?: boolean;
  expression?: string;
}

export interface DatasetData {
  id: string;
  workspaceId?: string | null;
  name: string;
  description: string | null;
  sourceType?: DatasetSourceType;
  fileName?: string | null;
  fileSize?: number | null;
  rowCount: number;
  columnCount?: number;
  type: DatasetType;
  status: DatasetStatus;
  dataSourceId: string | null;
  dataSourceName: string | null;
  dataSourceType: string | null;
  dataSource?: {
    id: string;
    name: string;
    type: string;
  } | null;
  blendConfig?: {
    datasetAId: string;
    datasetAName: string;
    datasetBId: string;
    datasetBName: string;
    joinColumnA: string;
    joinColumnB: string;
    joinType: "INNER" | "LEFT";
    createdAt: string;
  } | null;
  columns: DatasetColumn[];
  calculatedFields?: CalculatedFieldConfig[];
  currentVersion?: number;
  parentDatasetId?: string | null;
  transformationSteps?: unknown;
  tableName: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetPreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total?: number;
  limit: number;
  offset?: number;
  dataset?: DatasetData;
  datasetId?: string;
  columnNames?: string[];
  columnTypes?: Array<{ name: string; type: string; dataType?: string }>;
  totalRowCount?: number;
  totalColumnCount?: number;
  previewRows?: Record<string, unknown>[];
  previewLimit?: number;
  columnDefinitions?: DatasetColumn[];
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
  workspaceId?: string;
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<DatasetData[]> {
  const query = new URLSearchParams();
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
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
  workspaceId?: string | null;
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

export async function apiUploadDataset(formData: FormData): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets/upload", {
    method: "POST",
    body: formData,
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

// ---- Scheduled Dataset Refresh ----
export interface DatasetRefreshSchedule {
  enabled: boolean;
  frequency: "1H" | "6H" | "12H" | "DAILY" | "WEEKLY" | string;
  intervalMinutes?: number;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: "IDLE" | "SUCCESS" | "FAILED" | "RUNNING" | string;
  lastError?: string | null;
  history?: Array<{
    executedAt: string;
    status: "SUCCESS" | "FAILED";
    durationMs: number;
    rowsAffected?: number;
    errorMessage?: string | null;
  }>;
}

export async function apiGetDatasetRefreshSchedule(
  datasetId: string
): Promise<DatasetRefreshSchedule> {
  return apiFetch<DatasetRefreshSchedule>(`/api/v1/datasets/${datasetId}/refresh-schedule`);
}

export async function apiSaveDatasetRefreshSchedule(
  datasetId: string,
  schedule: {
    enabled: boolean;
    frequency: string;
    intervalMinutes?: number;
  }
): Promise<DatasetRefreshSchedule> {
  return apiFetch<DatasetRefreshSchedule>(`/api/v1/datasets/${datasetId}/refresh-schedule`, {
    method: "POST",
    body: JSON.stringify(schedule),
  });
}

export async function apiDeleteDatasetRefreshSchedule(
  datasetId: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${datasetId}/refresh-schedule`, {
    method: "DELETE",
  });
}

export async function apiTriggerDatasetRefresh(
  datasetId: string
): Promise<{ success: boolean; durationMs: number; rowCount?: number; message?: string }> {
  return apiFetch<{ success: boolean; durationMs: number; rowCount?: number; message?: string }>(
    `/api/v1/datasets/${datasetId}/refresh`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// DEMO DATASET TYPES & API METHODS
// ============================================================

export interface DemoDatasetColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DemoDatasetCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceUrl: string;
  license: string;
  sourceAttribution: string;
  fileName: string;
  sourceType: string;
  rowCount: number;
  columnCount: number;
  tags: string[];
  columns: DemoDatasetColumn[];
  sampleData: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
}

export interface ImportedDatasetData extends DatasetData {
  alreadyImported?: boolean;
}

export async function apiGetDemoCatalog(params?: {
  category?: string;
  search?: string;
}): Promise<DemoDatasetCatalogItem[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return apiFetch<DemoDatasetCatalogItem[]>(`/api/v1/datasets/demo/catalog${qs ? `?${qs}` : ""}`);
}

export async function apiGetDemoDataset(demoId: string): Promise<DemoDatasetCatalogItem> {
  return apiFetch<DemoDatasetCatalogItem>(`/api/v1/datasets/demo/${demoId}`);
}

export async function apiImportDemoDataset(
  demoId: string,
  input?: { workspaceId?: string | null; customName?: string }
): Promise<ImportedDatasetData> {
  return apiFetch<ImportedDatasetData>(`/api/v1/datasets/demo/${demoId}/import`, {
    method: "POST",
    body: JSON.stringify(input || {}),
  });
}

// ============================================================
// DATASET BLENDING TYPES & API METHODS
// ============================================================

export type BlendJoinType = "INNER" | "LEFT";

export interface DatasetBlendPreviewRequest {
  datasetAId: string;
  datasetBId: string;
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
  limit?: number;
}

export interface DatasetBlendPreviewResult {
  datasetA: {
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
  };
  datasetB: {
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
  };
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
  resultingColumns: Array<{
    name: string;
    type: string;
    origin: "A" | "B";
  }>;
  rowCount: number;
  previewRowCount: number;
  rows: Record<string, unknown>[];
}

export interface CreateDatasetBlendRequest {
  name: string;
  description?: string;
  datasetAId: string;
  datasetBId: string;
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
}

export async function apiPreviewDatasetBlend(
  input: DatasetBlendPreviewRequest
): Promise<DatasetBlendPreviewResult> {
  return apiFetch<DatasetBlendPreviewResult>("/api/v1/datasets/blends/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiCreateDatasetBlend(
  input: CreateDatasetBlendRequest
): Promise<DatasetData> {
  return apiFetch<DatasetData>("/api/v1/datasets/blends", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiListDatasetBlends(params?: {
  workspaceId?: string;
}): Promise<DatasetData[]> {
  const query = new URLSearchParams();
  if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
  const qs = query.toString();
  return apiFetch<DatasetData[]>(`/api/v1/datasets/blends${qs ? `?${qs}` : ""}`);
}

export async function apiGetDatasetBlend(id: string): Promise<DatasetData> {
  return apiFetch<DatasetData>(`/api/v1/datasets/blends/${id}`);
}

export async function apiDeleteDatasetBlend(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/v1/datasets/blends/${id}`, {
    method: "DELETE",
  });
}

// ============================================================
// CALCULATED FIELDS TYPES & API METHODS
// ============================================================

export interface CalculatedFieldConfig {
  id: string;
  name: string;
  expression: string;
  dataType: "NUMBER" | "STRING" | "BOOLEAN";
  datasetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewCalculatedFieldRequest {
  name: string;
  expression: string;
  limit?: number;
}

export interface PreviewCalculatedFieldResult {
  name: string;
  expression: string;
  dataType: "NUMBER" | "STRING" | "BOOLEAN";
  referencedColumns: string[];
  previewRowCount: number;
  rows: Record<string, unknown>[];
}

export interface CreateCalculatedFieldRequest {
  name: string;
  expression: string;
}

export interface UpdateCalculatedFieldRequest {
  name?: string;
  expression?: string;
}

export async function apiPreviewCalculatedField(
  datasetId: string,
  input: PreviewCalculatedFieldRequest
): Promise<PreviewCalculatedFieldResult> {
  return apiFetch<PreviewCalculatedFieldResult>(
    `/api/v1/datasets/${datasetId}/calculated-fields/preview`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiCreateCalculatedField(
  datasetId: string,
  input: CreateCalculatedFieldRequest
): Promise<{ field: CalculatedFieldConfig; dataset: DatasetData }> {
  return apiFetch<{ field: CalculatedFieldConfig; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function apiListCalculatedFields(
  datasetId: string
): Promise<CalculatedFieldConfig[]> {
  return apiFetch<CalculatedFieldConfig[]>(
    `/api/v1/datasets/${datasetId}/calculated-fields`
  );
}

export async function apiUpdateCalculatedField(
  datasetId: string,
  fieldId: string,
  input: UpdateCalculatedFieldRequest
): Promise<{ field: CalculatedFieldConfig; dataset: DatasetData }> {
  return apiFetch<{ field: CalculatedFieldConfig; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields/${fieldId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function apiDeleteCalculatedField(
  datasetId: string,
  fieldId: string
): Promise<{ message: string; dataset: DatasetData }> {
  return apiFetch<{ message: string; dataset: DatasetData }>(
    `/api/v1/datasets/${datasetId}/calculated-fields/${fieldId}`,
    {
      method: "DELETE",
    }
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
  | "isNotNull"
  | "in";

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
  sort?: {
    column: string;
    direction: "asc" | "desc" | "ASC" | "DESC";
  };
  sorting?:
    | {
        column: string;
        direction: "asc" | "desc" | "ASC" | "DESC";
      }
    | Array<{
        column: string;
        direction: "asc" | "desc" | "ASC" | "DESC";
      }>;
  filters?: DatasetQueryFilter[];
  filterLogic?: "AND" | "OR";
  logic?: "AND" | "OR";
  dimensions?: string[];
  groupBy?: string[];
  measures?: DatasetQueryMeasure[];
  aggregations?: Array<{
    column: string;
    function?: string;
    aggregation?: AggregationFunction | string;
    alias?: string;
  }>;
}

export interface QueryResultColumn {
  name: string;
  type: string;
}

export interface DatasetQueryResult {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  processedColumns?: QueryResultColumn[];
  processedRows?: Record<string, unknown>[];
  rowCount: number;
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
  metadata?: {
    rowCount: number;
    total: number;
    limit: number;
    offset: number;
    executionTimeMs: number;
    queryMode: "RAW" | "AGGREGATE" | string;
  };
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
  shareToken?: string | null;
  shareTokenActive?: boolean;
  sharedAt?: string | null;
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

export const apiGetDashboards = apiListDashboards;
export type DashboardItem = DashboardData;

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

// ============================================================
// Dashboard Sharing API
// ============================================================

export interface SharedDashboardChart {
  id: string;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: ChartConfig;
  position: ChartPosition;
  sortOrder: number;
  datasetId: string | null;
  datasetName: string | null;
  datasetColumns?: DatasetColumn[];
}

export interface SharedDashboardData {
  id: string;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  charts: SharedDashboardChart[];
}

export interface ShareLinkStatusResponse {
  shareToken: string | null;
  shareTokenActive: boolean;
  sharedAt: string | null;
  active?: boolean;
  token?: string | null;
  shareUrl?: string | null;
}

export async function apiCreateShareLink(dashboardId: string): Promise<ShareLinkStatusResponse> {
  return apiFetch<ShareLinkStatusResponse>(`/api/v1/dashboards/${dashboardId}/share`, {
    method: "POST",
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

// ============================================================
// Chart Configuration Types & API
// ============================================================

export type ChartType =
  | "BAR"
  | "LINE"
  | "AREA"
  | "PIE"
  | "DONUT"
  | "SCATTER"
  | "TABLE"
  | "KPI"
  | "RADAR"
  | "FUNNEL"
  | "HEATMAP"
  | "GAUGE"
  | "BUBBLE"
  | "TREEMAP";

export interface ChartPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartMeasure {
  column: string;
  aggregation: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "DISTINCT_COUNT";
  alias?: string;
}

export interface ChartFilter {
  column: string;
  operator: string;
  value?: unknown;
}

export interface ChartSort {
  column: string;
  direction: "asc" | "desc" | "ASC" | "DESC";
}

export interface ChartConfig {
  dimensions?: string[];
  measures?: ChartMeasure[];
  xAxis?: string;
  category?: string;
  yAxis?: string | string[];
  value?: string | string[];
  secondaryValueCol?: string;
  groupCol?: string;
  aggregation?: string;
  filters?: ChartFilter[];
  sort?: ChartSort;
  columns?: string[];
  colorPalette?: string;
  customColors?: string[];
  legend?: {
    show?: boolean;
    position?: "top" | "bottom" | "left" | "right";
  };
  xAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    labelRotation?: number;
    showLabels?: boolean;
  };
  yAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    min?: number | null;
    max?: number | null;
    format?: string;
  };
  dataLabels?: {
    show?: boolean;
    position?: "inside" | "outside" | "top";
  };
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    compact?: boolean;
    formatType?: "number" | "currency" | "percentage";
  };
  chartOptions?: {
    stacked?: boolean;
    smooth?: boolean;
    fillOpacity?: number;
    donutHoleSize?: number;
    showTotal?: boolean;
  };
  options?: Record<string, unknown>;
}

export interface ChartData {
  id: string;
  dashboardId: string;
  datasetId: string | null;
  datasetName: string | null;
  datasetType: string | null;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: ChartConfig;
  position: ChartPosition;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChartInput {
  title: string;
  description?: string | null;
  chartType: ChartType;
  datasetId?: string | null;
  config?: ChartConfig;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

export interface UpdateChartInput {
  title?: string;
  description?: string | null;
  chartType?: ChartType;
  datasetId?: string | null;
  config?: ChartConfig;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

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

// ============================================================
// STANDALONE VISUALIZATION API METHODS
// ============================================================

export interface VisualizationData {
  id: string;
  dashboardId: string;
  datasetId: string | null;
  datasetName: string | null;
  datasetType: string | null;
  workspaceId: string | null;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: ChartConfig & {
    xAxis?: string;
    category?: string;
    yAxis?: string | string[];
    value?: string | string[];
    aggregation?: string;
    series?: string;
    group?: string;
    groupBy?: string[];
    aggregations?: Array<{ column: string; function?: string; aggregation?: string; alias?: string }>;
    columns?: string[];
  };
  position: ChartPosition;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  data?: Record<string, unknown>[];
  columns?: QueryResultColumn[];
  rowCount?: number;
  total?: number;
}

export interface CreateVisualizationInput {
  title: string;
  description?: string | null;
  chartType: ChartType;
  datasetId?: string | null;
  dashboardId?: string | null;
  config?: ChartConfig & Record<string, unknown>;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

export interface UpdateVisualizationInput {
  title?: string;
  description?: string | null;
  chartType?: ChartType;
  datasetId?: string | null;
  config?: ChartConfig & Record<string, unknown>;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

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

// ============================================================
// DASHBOARD REPORT SCHEDULE & SNAPSHOT
// ============================================================

export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type ReportFormat = "PDF" | "CSV" | "PNG" | "EXCEL";

export interface DashboardScheduleData {
  id: string;
  dashboardId: string;
  frequency: ReportFrequency;
  format?: ReportFormat;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  recipients?: string[];
  webhookUrl?: string | null;
  deliveryType?: "EMAIL" | "WEBHOOK" | "BOTH";
  lastDeliveryStatus?: "SUCCESS" | "FAILED" | null;
  lastDeliveryAt?: string | null;
  lastDeliveryError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportExecutionData {
  id: string;
  reportId: string;
  dashboardId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  executedAt: string;
  durationMs: number;
  chartCount: number;
  totalRecords: number;
  summary: Record<string, unknown>;
  errorMessage?: string | null;
  format?: string;
  triggeredBy?: string;
  snapshotUrl?: string;
}

export interface DashboardReportSnapshot {
  reportId: string;
  dashboardId: string;
  dashboardName: string;
  generatedAt: string;
  chartCount: number;
  charts: Array<{
    chartId: string;
    title: string;
    chartType: string;
    rowCount: number;
    columns: Array<{ name: string; type: string }>;
    data: Record<string, unknown>[];
  }>;
  summary: {
    totalCharts: number;
    totalRecords: number;
    executionTimeMs: number;
  };
}

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

// ============================================================
// KPI / METRICS LAYER API
// ============================================================

export type MetricAggregation = "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
export type MetricFormat = "NUMBER" | "CURRENCY" | "PERCENT";

export interface MetricData {
  id: string;
  organizationId: string;
  workspaceId: string;
  datasetId: string;
  name: string;
  description: string | null;
  calculation: MetricAggregation;
  aggregation?: MetricAggregation;
  field: string;
  column?: string;
  format: MetricFormat;
  targetValue: number | null;
  createdAt: string;
  updatedAt: string;
  dataset?: {
    id: string;
    name: string;
    rowCount?: number;
    columns?: DatasetColumn[];
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    alerts: number;
  };
}

export interface CreateMetricPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  datasetId: string;
  calculation?: MetricAggregation;
  aggregation?: MetricAggregation;
  field?: string;
  column?: string;
  format?: MetricFormat;
  targetValue?: number | null;
}

export interface CalculatedMetricResult {
  metricId: string;
  name: string;
  calculation: MetricAggregation;
  field: string;
  format: MetricFormat;
  rawValue: number;
  formattedValue: string;
  targetValue: number | null;
  targetDelta: number | null;
  targetPercentage: number | null;
  progressPercent?: number | null;
  targetMet: boolean | null;
  executionTimeMs: number;
  calculatedAt: string;
}

export type MetricCalculationResult = CalculatedMetricResult;

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

export async function apiCalculateMetric(
  id: string,
  options?: {
    filters?: DatasetQueryFilter[];
    filterLogic?: "AND" | "OR";
    timeRange?: { column: string; start?: string; end?: string };
    dimensions?: string[];
  }
): Promise<CalculatedMetricResult> {
  return apiFetch<CalculatedMetricResult>(`/api/v1/metrics/${id}/calculate`, {
    method: "POST",
    body: options ? JSON.stringify(options) : undefined,
  });
}

// ============================================================
// SMART DATA ALERTS API
// ============================================================

export type AlertCondition =
  | "GREATER_THAN"
  | "LESS_THAN"
  | "EQUALS"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "INCREASE_PERCENT"
  | "DECREASE_PERCENT"
  | "INCREASE_PCT"
  | "DECREASE_PCT";

export type AlertStatus = "OK" | "TRIGGERED" | "PENDING";

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  value: number;
  metricValue?: number;
  threshold: number;
  condition: string;
  status: "TRIGGERED" | "OK";
  message: string;
  triggeredAt: string;
  evaluatedAt?: string;
  triggered?: boolean;
  notified?: boolean;
}

export type AlertHistoryData = AlertHistoryEntry;

export interface AlertData {
  id: string;
  organizationId: string;
  workspaceId: string;
  metricId: string;
  name: string;
  description: string | null;
  condition: AlertCondition;
  threshold: number;
  enabled: boolean;
  isEnabled?: boolean;
  status: AlertStatus;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastValue: number | null;
  createdAt: string;
  updatedAt: string;
  metric?: {
    id: string;
    name: string;
    format: MetricFormat;
    calculation: MetricAggregation;
    aggregation?: MetricAggregation;
    field: string;
    column?: string;
    dataset?: { id: string; name: string };
  };
  history?: AlertHistoryEntry[];
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateAlertPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  metricId: string;
  condition: AlertCondition;
  threshold: number;
  enabled?: boolean;
  isEnabled?: boolean;
}

export interface AlertEvaluationResult {
  alertId: string;
  alertName: string;
  metricName: string;
  condition: AlertCondition;
  conditionSymbol: string;
  threshold: number;
  formattedThreshold: string;
  currentValue: number;
  formattedCurrent: string;
  isTriggered: boolean;
  triggered?: boolean;
  status: AlertStatus;
  lastEvaluatedAt: string;
  historyId: string;
  message: string;
  notificationDelivery: string;
  alert?: AlertData;
}

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

export async function apiEvaluateAllWorkspaceAlerts(
  workspaceId: string
): Promise<{ totalEvaluated: number; triggeredCount: number; results: unknown[] }> {
  return apiFetch(`/api/v1/alerts/workspace/${workspaceId}/evaluate-all`, {
    method: "POST",
  });
}

// ============================================================
// FEATURE 6: DATA QUALITY & PROFILING
// ============================================================

export interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  sampleValues: unknown[];
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  median?: number | null;
  stdDev?: number | null;
  outliersCount?: number;
  outlierPercentage?: number;
  minDate?: string | null;
  maxDate?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  blankCount?: number;
  invalidCount?: number;
  invalidPercentage?: number;
}

export interface DataQualityWarning {
  column?: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  rule: string;
  message: string;
}

export interface DatasetQualitySummary {
  dataQualityScore: number;
  missingDataCount: number;
  missingDataPercentage: number;
  duplicateRowsCount: number;
  duplicateRowsPercentage: number;
  typeIssuesCount: number;
  potentialOutliersCount: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
}

export interface DatasetProfileResult {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  qualityScore: number;
  summary?: DatasetQualitySummary;
  columns: ColumnProfile[];
  warnings: DataQualityWarning[];
  evaluatedAt: string;
}

export async function apiProfileDataset(
  datasetId: string,
  refresh = false
): Promise<DatasetProfileResult> {
  return apiFetch<DatasetProfileResult>(
    `/api/v1/datasets/${datasetId}/profile${refresh ? "?refresh=true" : ""}`
  );
}

export async function apiTestRawConnection(payload: {
  type: string;
  connection: Record<string, unknown>;
}): Promise<{ success: boolean; status: string; message: string; details?: Record<string, unknown> }> {
  return apiFetch("/api/v1/data-sources/test-connection", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================================
// FEATURE 7: ADVANCED EXPORT CENTER
// ============================================================

export type ExportResourceType = "DATASET" | "VISUALIZATION" | "DASHBOARD";
export type ExportFormat = "CSV" | "EXCEL" | "PDF" | "PNG";

export interface ExportRequestPayload {
  resourceType: ExportResourceType;
  resourceId: string;
  format: ExportFormat;
  workspaceId?: string;
  options?: {
    includeHeaders?: boolean;
    rowLimit?: number;
    title?: string;
  };
}

export interface ExportResult {
  jobId: string;
  resourceType: ExportResourceType;
  resourceId: string;
  resourceName: string;
  format: ExportFormat;
  contentType: string;
  filename: string;
  dataBase64?: string;
  textContent?: string;
  rowCount: number;
  fileSizeBytes: number;
  metadata?: Record<string, unknown>;
}

export interface ExportJobData {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  resourceType: ExportResourceType;
  resourceId: string;
  resourceName: string;
  format: ExportFormat;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  rowCount?: number;
  fileSize?: number;
  downloadUrl?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  user?: { id: string; name: string; email: string };
}

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

// ============================================================
// FEATURE 8: DASHBOARD TEMPLATES
// ============================================================

export interface TemplateChartDef {
  title: string;
  chartType: string;
  description?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface DashboardTemplateData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  layoutConfig: Record<string, unknown>;
  chartsConfig: TemplateChartDef[];
  isSystem: boolean;
  organizationId: string | null;
  workspaceId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateFromDashboardPayload {
  dashboardId: string;
  name: string;
  description?: string;
  category: string;
  workspaceId?: string;
}

export interface InstantiateDashboardPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  targetDatasetId?: string;
}

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

// ============================================================
// FEATURE 10: AUDIT LOGS
// ============================================================

export interface AuditLogItem {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: { id: string; name: string; email: string; avatarUrl: string | null };
  workspace?: { id: string; name: string; slug: string } | null;
}

export interface QueryAuditLogsParams {
  workspaceId?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QueryAuditLogsResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditLogItem[];
}

export interface AuditLogStatsResponse {
  total: number;
  successCount: number;
  failureCount: number;
  recentLogs: AuditLogItem[];
}

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

// ============================================================
// FEATURE 11: ADVANCED VISUALIZATION CUSTOMIZATION
// ============================================================

export interface AdvancedCustomizationConfig {
  colorPalette?: string;
  customColors?: string[];
  legend?: {
    show: boolean;
    position: "top" | "bottom" | "left" | "right";
  };
  xAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    labelRotation?: number;
    showLabels?: boolean;
  };
  yAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    min?: number | null;
    max?: number | null;
    format?: string;
  };
  dataLabels?: {
    show?: boolean;
    position?: "inside" | "outside" | "top";
  };
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    compact?: boolean;
    formatType?: "number" | "currency" | "percentage";
  };
  chartOptions?: {
    stacked?: boolean;
    smooth?: boolean;
    fillOpacity?: number;
    donutHoleSize?: number;
    showTotal?: boolean;
  };
}

// ============================================================
// FEATURE 13: DATA TRANSFORMATION & CLEANING PIPELINE
// ============================================================

export type TransformationStep =
  | {
      type: "FILTER_ROWS";
      column: string;
      operator: "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS" | "IS_NULL" | "IS_NOT_NULL";
      value?: unknown;
    }
  | {
      type: "RENAME_COLUMN";
      oldName: string;
      newName: string;
    }
  | {
      type: "TYPE_CONVERSION";
      column: string;
      targetType: "TEXT" | "STRING" | "NUMBER" | "DATE" | "BOOLEAN";
    }
  | {
      type: "FILL_MISSING" | "HANDLE_MISSING";
      column: string;
      strategy: "STATIC_VALUE" | "MEAN" | "MEDIAN" | "MODE" | "DROP_ROW" | "FILL_ZERO" | "FILL_MEAN" | "FILL_VALUE";
      staticValue?: unknown;
      fillValue?: unknown;
    }
  | {
      type: "REMOVE_DUPLICATES";
      columns?: string[];
    }
  | {
      type: "DERIVED_COLUMN";
      name: string;
      expression: string;
    }
  | {
      type: "DROP_COLUMN";
      column: string;
    }
  | {
      type: "TRIM_WHITESPACE";
      column: string;
    }
  | {
      type: "CHANGE_CASE" | "CASE_CONVERT";
      column: string;
      casing?: "UPPER" | "LOWER";
      mode?: "UPPER" | "LOWER";
    };

export interface TransformationPreviewResponse {
  previewRows: Array<Record<string, unknown>>;
  sampleRows?: Array<Record<string, unknown>>;
  transformedColumns: Array<{ name: string; type: string }>;
  originalRowCount: number;
  transformedRowCount: number;
  sampleSize: number;
}

export interface ApplyTransformationResponse {
  mode: "NEW_VERSION" | "DERIVED_DATASET" | "CREATE_NEW" | "SAVE_VERSION";
  dataset: Record<string, unknown>;
  version?: Record<string, unknown>;
}

export async function apiPreviewTransformations(
  datasetId: string,
  steps: TransformationStep[]
): Promise<TransformationPreviewResponse> {
  return apiFetch<TransformationPreviewResponse>(`/api/v1/datasets/${datasetId}/transform/preview`, {
    method: "POST",
    body: JSON.stringify({ steps }),
  });
}

export async function apiApplyTransformations(
  datasetId: string,
  payload: {
    steps: TransformationStep[];
    mode: "NEW_VERSION" | "DERIVED_DATASET" | "CREATE_NEW" | "SAVE_VERSION";
    newDatasetName?: string;
    changeSummary?: string;
    workspaceId?: string;
  }
): Promise<ApplyTransformationResponse> {
  return apiFetch<ApplyTransformationResponse>(`/api/v1/datasets/${datasetId}/transform/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================================
// FEATURE 14: DATASET VERSIONING & LINEAGE
// ============================================================

export interface DatasetVersionItem {
  id: string;
  datasetId: string;
  versionNumber: number;
  changeSummary: string | null;
  rowCount: number;
  columnCount: number;
  schemaSnapshot: { columns: Array<{ name: string; type: string }> };
  transformationConfig: TransformationStep[] | null;
  createdAt: string;
  createdById: string;
  creator?: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface DatasetLineageResponse {
  dataset: {
    id: string;
    name: string;
    version: number;
    parentDatasetId: string | null;
  };
  parent: { id: string; name: string } | null;
  derivedDatasets: Array<{ id: string; name: string; currentVersion: number }>;
  linkedVisualizations: Array<{
    id: string;
    title: string;
    type: string;
    dashboardId: string | null;
    dashboardTitle: string | null;
  }>;
  versionsCount: number;
}

export async function apiListDatasetVersions(datasetId: string): Promise<DatasetVersionItem[]> {
  return apiFetch<DatasetVersionItem[]>(`/api/v1/datasets/${datasetId}/versions`);
}

export async function apiGetDatasetVersion(
  datasetId: string,
  versionNumber: number
): Promise<DatasetVersionItem> {
  return apiFetch<DatasetVersionItem>(`/api/v1/datasets/${datasetId}/versions/${versionNumber}`);
}

export async function apiRestoreDatasetVersion(
  datasetId: string,
  versionNumber: number
): Promise<{ message: string; dataset: Record<string, unknown>; restoredVersion: number; newVersion: number }> {
  return apiFetch<{ message: string; dataset: Record<string, unknown>; restoredVersion: number; newVersion: number }>(
    `/api/v1/datasets/${datasetId}/versions/${versionNumber}/restore`,
    {
      method: "POST",
    }
  );
}

export async function apiGetDatasetLineage(datasetId: string): Promise<DatasetLineageResponse> {
  return apiFetch<DatasetLineageResponse>(`/api/v1/datasets/${datasetId}/lineage`);
}

// ============================================================
// FEATURE 15: COLLABORATION & SHARING
// ============================================================

export interface DashboardCollaboratorData {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  accessLevel: "VIEW" | "EDIT" | "ADMIN";
  grantedAt: string;
  user?: { id: string; name: string; email: string; avatarUrl: string | null };
}

export interface DashboardCollaboratorsResponse {
  dashboardId?: string;
  dashboardTitle?: string;
  isOwner?: boolean;
  owner: { id: string; name: string; email: string };
  collaborators: DashboardCollaboratorData[];
  workspaceMembers: Array<{
    userId: string;
    roleName: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
}

export async function apiListDashboardCollaborators(
  dashboardId: string
): Promise<DashboardCollaboratorsResponse> {
  return apiFetch<DashboardCollaboratorsResponse>(`/api/v1/dashboards/${dashboardId}/collaborators`);
}

export async function apiGrantDashboardCollaborator(
  dashboardId: string,
  data: { targetUserId: string; accessLevel: "VIEW" | "EDIT" | "ADMIN" }
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

// ============================================================
// PHASE 2: AI ANALYTICS API
// ============================================================

export interface AnalystQueryResponse {
  answer: string;
  question: string;
  queryExecuted: DatasetQueryParams;
  resultSummary: {
    rowCount: number;
    primaryMetric?: { name: string; value: number; formatted: string };
    topEntity?: { dimension: string; value: string; metricValue: number };
  };
  data: Array<Record<string, unknown>>;
  chartSuggestion?: {
    title: string;
    chartType: string;
    dimension: string;
    measure: string;
    aggregation: string;
  };
  groundingVerification: {
    isGrounded: boolean;
    datasetName: string;
    datasetId: string;
    executionTimeMs: number;
  };
}

export interface NlToChartResponse {
  title: string;
  chartType: string;
  explanation: string;
  config: {
    dimensions: string[];
    measures: Array<{ column: string; aggregation: string; alias?: string }>;
    sort?: { column: string; direction: "asc" | "desc" };
    limit?: number;
    filters?: DatasetQueryFilter[];
  };
  data: Array<Record<string, unknown>>;
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
}

export interface AutoInsight {
  id: string;
  type: "PERFORMER_TOP" | "PERFORMER_BOTTOM" | "DOMINANCE" | "TREND" | "ANOMALY";
  title: string;
  description: string;
  metric: string;
  value?: number;
  formattedValue?: string;
  dimensionValue?: string;
  isAnomaly: boolean;
  detectionMethod?: "Z_SCORE" | "IQR" | "PERCENTAGE_CHANGE" | "DISTRIBUTION";
  score?: number;
}

export interface DashboardSummaryResponse {
  dashboardId: string;
  dashboardName: string;
  summaryBullets: string[];
  keyMetrics: Array<{ label: string; value: string | number; change?: string }>;
  filterContextText: string;
  comparisonNote: string;
  generatedAt: string;
}

export async function apiAskDataAnalyst(params: {
  datasetId: string;
  question: string;
  filters?: DatasetQueryFilter[];
  dashboardId?: string;
}): Promise<AnalystQueryResponse> {
  return apiFetch<AnalystQueryResponse>("/api/v1/ai/ask", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiNlToChart(params: {
  datasetId: string;
  prompt: string;
  filters?: DatasetQueryFilter[];
}): Promise<NlToChartResponse> {
  return apiFetch<NlToChartResponse>("/api/v1/ai/nl-to-chart", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function apiGetInsights(params: {
  datasetId: string;
  dimension?: string;
  measure?: string;
  filters?: DatasetQueryFilter[];
  data?: Array<Record<string, unknown>>;
}): Promise<{ insights: AutoInsight[]; summary: string; analyzedRows: number }> {
  return apiFetch<{ insights: AutoInsight[]; summary: string; analyzedRows: number }>(
    "/api/v1/ai/insights",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

export async function apiGetDashboardSummary(params: {
  dashboardId: string;
  activeFilters?: DatasetQueryFilter[];
}): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>("/api/v1/ai/dashboard-summary", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ============================================================
// PHASE 5: ROW-LEVEL SECURITY (RLS) API
// ============================================================

export type RlsOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IN"
  | "NOT_IN"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "CONTAINS";

export interface RowLevelSecurityRule {
  id: string;
  name: string;
  description?: string | null;
  datasetId: string;
  organizationId: string;
  columnName: string;
  operator: RlsOperator;
  ruleValue: unknown;
  roleName?: string | null;
  userId?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiListDatasetRlsRules(
  datasetId: string
): Promise<RowLevelSecurityRule[]> {
  return apiFetch<RowLevelSecurityRule[]>(`/api/v1/datasets/${datasetId}/rls`);
}

export async function apiCreateRlsRule(
  datasetId: string,
  rule: {
    name: string;
    description?: string;
    columnName: string;
    operator: RlsOperator;
    ruleValue: unknown;
    roleName?: string;
    userId?: string;
    isEnabled?: boolean;
  }
): Promise<RowLevelSecurityRule> {
  return apiFetch<RowLevelSecurityRule>(`/api/v1/datasets/${datasetId}/rls`, {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export async function apiUpdateRlsRule(
  datasetId: string,
  ruleId: string,
  rule: Partial<{
    name: string;
    description: string;
    columnName: string;
    operator: RlsOperator;
    ruleValue: unknown;
    roleName: string;
    userId: string;
    isEnabled: boolean;
  }>
): Promise<RowLevelSecurityRule> {
  return apiFetch<RowLevelSecurityRule>(`/api/v1/datasets/${datasetId}/rls/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(rule),
  });
}

export async function apiDeleteRlsRule(
  datasetId: string,
  ruleId: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/datasets/${datasetId}/rls/${ruleId}`, {
    method: "DELETE",
  });
}

// ============================================================
// PHASE 5: DASHBOARD VERSION HISTORY API
// ============================================================

export interface DashboardChartSnapshot {
  id: string;
  title: string;
  description?: string | null;
  chartType: string;
  config: unknown;
  position: unknown;
  sortOrder?: number;
  datasetId?: string | null;
}

export interface DashboardVersionRecord {
  id: string;
  dashboardId: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  layoutConfig: Record<string, unknown>;
  chartsSnapshot: DashboardChartSnapshot[];
  changeSummary?: string | null;
  createdById: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface VersionComparisonResult {
  dashboardId: string;
  baseVersion: number;
  targetVersion: number;
  nameChanged: boolean;
  baseName: string;
  targetName: string;
  descriptionChanged: boolean;
  baseDescription: string | null;
  targetDescription: string | null;
  layoutChanged: boolean;
  addedCharts: DashboardChartSnapshot[];
  removedCharts: DashboardChartSnapshot[];
  modifiedCharts: Array<{
    id: string;
    title: string;
    changes: string[];
  }>;
  totalChanges: number;
}

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

// ============================================================
// PHASE 5: WORKSPACE MEMBER ROLE API
// ============================================================

export async function apiUpdateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: "OWNER" | "ADMIN" | "MEMBER" | "EDITOR" | "VIEWER"
): Promise<{
  id: string;
  workspaceId: string;
  role: string;
  user: { id: string; name: string; email: string };
}> {
  return apiFetch<{
    id: string;
    workspaceId: string;
    role: string;
    user: { id: string; name: string; email: string };
  }>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}










