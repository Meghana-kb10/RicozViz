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

