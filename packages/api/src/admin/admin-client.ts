/**
 * Platform Admin HTTP Transport & Client
 *
 * Dedicated transport for the platform operator admin portal. Uses
 * `rv_admin_session` cookie name, isolated `rv_admin_at` session storage,
 * and automatic 401 refresh via `/admin/auth/refresh`.
 */

import type {
  AdminLoginInput,
  AdminTotpVerifyInput,
  AdminChangePasswordInput
} from '@repo/validation';

const DEFAULT_BASE_URL = 'http://localhost:4000';
const ADMIN_SESSION_COOKIE = 'rv_admin_session';

let configuredAdminBaseUrl: string | null = null;
let inMemoryAdminAccessToken: string | null = null;

export function configureAdminApi(options: { baseUrl?: string }): void {
  configuredAdminBaseUrl = options.baseUrl ? stripTrailingSlash(options.baseUrl) : null;
}

export function getAdminApiBaseUrl(): string {
  if (configuredAdminBaseUrl) {
    if (configuredAdminBaseUrl === '/' || configuredAdminBaseUrl.toLowerCase() === 'same-origin') {
      return '';
    }
    return stripTrailingSlash(configuredAdminBaseUrl);
  }
  if (typeof process !== 'undefined' && process.env) {
    const envUrl = (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_ADMIN_API_URL'] ||
      (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_API_URL'];
    if (envUrl && (envUrl === '/' || envUrl.toLowerCase() === 'same-origin')) {
      return '';
    }
    if (envUrl && envUrl.startsWith('http')) {
      return stripTrailingSlash(envUrl);
    }
  }
  return DEFAULT_BASE_URL;
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function getAdminAccessToken(): string | null {
  return inMemoryAdminAccessToken;
}

export function setAdminAccessToken(token: string | null): void {
  inMemoryAdminAccessToken = token;
}

export function clearAdminAccessToken(): void {
  setAdminAccessToken(null);
}

// Concurrency queue for admin 401 refresh
let adminRefreshPromise: Promise<string | null> | null = null;
let customAdminRefreshHandler: (() => Promise<string | null>) | null = null;
let customAdminUnauthorizedHandler: (() => void) | null = null;

export function setAdminRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  customAdminRefreshHandler = handler;
}

export function setAdminUnauthorizedHandler(handler: (() => void) | null): void {
  customAdminUnauthorizedHandler = handler;
}

async function executeAdminRefresh(): Promise<string | null> {
  if (customAdminRefreshHandler) {
    try {
      const token = await customAdminRefreshHandler();
      if (token) {
        setAdminAccessToken(token);
        return token;
      }
      clearAdminAccessToken();
      return null;
    } catch {
      clearAdminAccessToken();
      return null;
    }
  }

  const url = `${getAdminApiBaseUrl()}/admin/auth/refresh`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) {
      clearAdminAccessToken();
      return null;
    }
    const json = (await res.json()) as { success?: boolean; data?: { accessToken?: string } };
    const newAccessToken = json.data?.accessToken;
    if (newAccessToken) {
      setAdminAccessToken(newAccessToken);
      return newAccessToken;
    }
    clearAdminAccessToken();
    return null;
  } catch {
    clearAdminAccessToken();
    return null;
  }
}

export async function adminApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getAdminApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAdminAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials ?? 'include'
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkError) {
    throw new AdminApiError(0, 'NETWORK_ERROR', (networkError as Error).message || 'Network error');
  }

  // Handle 401 with automatic refresh if not already calling auth endpoints
  if (response.status === 401 && !path.startsWith('/admin/auth/')) {
    if (!adminRefreshPromise) {
      adminRefreshPromise = executeAdminRefresh().finally(() => {
        adminRefreshPromise = null;
      });
    }

    const newAccessToken = await adminRefreshPromise;
    if (newAccessToken) {
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      response = await fetch(url, { ...fetchOptions, headers });
    } else {
      if (customAdminUnauthorizedHandler) {
        try {
          customAdminUnauthorizedHandler();
        } catch {
          // Ignore handler callback errors
        }
      }
      throw new AdminApiError(401, 'UNAUTHORIZED', 'Admin session expired');
    }
  }

  const contentType = response.headers.get('content-type') || '';
  let payload: any = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const code = payload?.error?.code || payload?.code || 'ADMIN_API_ERROR';
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const details = payload?.error?.details || payload?.details;
    throw new AdminApiError(response.status, code, message, details);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

// ---- Admin Auth Endpoints ----------------------------------------------------

export interface AdminAuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  twoFactorEnabled: boolean;
}

export interface AdminAuthResult {
  requires2Fa?: boolean;
  pendingToken?: string;
  accessToken?: string;
  user?: AdminAuthUser;
}

export async function apiAdminLogin(input: AdminLoginInput): Promise<AdminAuthResult> {
  const result = await adminApiFetch<AdminAuthResult>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (result.accessToken) {
    setAdminAccessToken(result.accessToken);
  }
  return result;
}

export async function apiAdminRefresh(): Promise<{ accessToken: string }> {
  const result = await adminApiFetch<{ accessToken: string }>('/admin/auth/refresh', {
    method: 'POST'
  });
  if (result.accessToken) {
    setAdminAccessToken(result.accessToken);
  }
  return result;
}

export async function apiAdminLogout(): Promise<void> {
  try {
    await adminApiFetch<void>('/admin/auth/logout', { method: 'POST' });
  } finally {
    clearAdminAccessToken();
  }
}

export async function apiAdminEnrollTotp(options?: {
  pendingToken?: string;
  currentTotpCode?: string;
}): Promise<{ secret: string; otpauthUri: string }> {
  const headers: Record<string, string> = {};
  if (options?.pendingToken) {
    headers['Authorization'] = `Bearer ${options.pendingToken}`;
  }
  return adminApiFetch<{ secret: string; otpauthUri: string }>('/admin/auth/totp/enroll', {
    method: 'POST',
    headers,
    body: options?.currentTotpCode ? JSON.stringify({ currentTotpCode: options.currentTotpCode }) : undefined
  });
}

export interface AdminVerifyTotpResult {
  accessToken: string;
  user: AdminAuthUser;
  backupCodes?: string[];
}

export async function apiAdminVerifyTotp(
  input: AdminTotpVerifyInput,
  pendingToken?: string
): Promise<AdminVerifyTotpResult> {
  const headers: Record<string, string> = {};
  if (pendingToken) {
    headers['Authorization'] = `Bearer ${pendingToken}`;
  }
  const result = await adminApiFetch<AdminVerifyTotpResult>('/admin/auth/totp/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify(input)
  });
  if (result.accessToken) {
    setAdminAccessToken(result.accessToken);
  }
  return result;
}

export async function apiAdminChangePassword(input: AdminChangePasswordInput): Promise<{ message: string }> {
  return adminApiFetch<{ message: string }>('/admin/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export interface AdminSessionItem {
  id: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export async function apiAdminRegenerateBackupCodes(input: { totpCode: string }): Promise<{ backupCodes: string[] }> {
  return adminApiFetch<{ backupCodes: string[] }>('/admin/auth/totp/regenerate-backup-codes', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiAdminListSessions(): Promise<{ sessions: AdminSessionItem[] }> {
  return adminApiFetch<{ sessions: AdminSessionItem[] }>('/admin/auth/sessions', {
    method: 'GET'
  });
}

export async function apiAdminRevokeSession(sessionId: string): Promise<{ message: string }> {
  return adminApiFetch<{ message: string }>(`/admin/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}

