/**
 * Platform Admin HTTP Transport & Client
 *
 * Dedicated transport for the platform operator admin portal. Uses
 * `rv_admin_session` cookie name, isolated `rv_admin_at` session storage,
 * and automatic 401 refresh via `/admin/auth/refresh`.
 */

import type { AdminLoginInput, AdminTotpVerifyInput } from '@repo/validation';

const DEFAULT_BASE_URL = 'http://localhost:4000';
const ADMIN_ACCESS_TOKEN_KEY = 'rv_admin_at';
const ADMIN_SESSION_COOKIE = 'rv_admin_session';

let configuredAdminBaseUrl: string | null = null;
let inMemoryAdminAccessToken: string | null = null;

export function configureAdminApi(options: { baseUrl?: string }): void {
  configuredAdminBaseUrl = options.baseUrl ? stripTrailingSlash(options.baseUrl) : null;
}

export function getAdminApiBaseUrl(): string {
  if (configuredAdminBaseUrl) {
    return stripTrailingSlash(configuredAdminBaseUrl);
  }
  if (typeof process !== 'undefined' && process.env) {
    const envUrl = (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_ADMIN_API_URL'] ||
      (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_API_URL'];
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
  if (typeof window !== 'undefined') {
    try {
      return window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
    } catch {
      return inMemoryAdminAccessToken;
    }
  }
  return inMemoryAdminAccessToken;
}

export function setAdminAccessToken(token: string | null): void {
  inMemoryAdminAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token);
      } else {
        window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
      }
    } catch {
      // sessionStorage unavailable
    }
  }
}

export function clearAdminAccessToken(): void {
  setAdminAccessToken(null);
}

// Concurrency queue for admin 401 refresh
let adminRefreshPromise: Promise<string | null> | null = null;

async function executeAdminRefresh(): Promise<string | null> {
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

export async function apiAdminEnrollTotp(): Promise<{ secret: string; otpauthUri: string }> {
  return adminApiFetch<{ secret: string; otpauthUri: string }>('/admin/auth/totp/enroll', {
    method: 'POST'
  });
}

export async function apiAdminVerifyTotp(input: AdminTotpVerifyInput): Promise<{ backupCodes: string[] }> {
  return adminApiFetch<{ backupCodes: string[] }>('/admin/auth/totp/verify', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
