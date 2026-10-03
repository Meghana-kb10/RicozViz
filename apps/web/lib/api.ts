 // ========================================
// API Client — typed fetch wrapper
// ========================================
// Communicates with the RicozViz backend API.
// Attaches the Authorization header automatically.
// Handles refresh token flow on 401.
// ========================================
export function getApiBaseUrl(): string {
  if (process.env["NEXT_PUBLIC_API_URL"] && !process.env["NEXT_PUBLIC_API_URL"].includes("localhost:4000")) {
    return process.env["NEXT_PUBLIC_API_URL"];
  }
  if (typeof window !== "undefined") {
    if (window.location.origin.includes("-web.onrender.com")) {
      return window.location.origin.replace("-web.onrender.com", "-api.onrender.com");
    }
  }
  return process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";
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

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

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

export type DataSourceType = "POSTGRESQL" | "CSV" | "REST_API" | "XLSX" | "JSON";
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
  | "HEATMAP";

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
  yAxis?: string | string[];
  filters?: ChartFilter[];
  sort?: ChartSort;
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

export type ReportFrequency = "DAILY" | "WEEKLY";

export interface DashboardScheduleData {
  id: string;
  dashboardId: string;
  frequency: ReportFrequency;
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






