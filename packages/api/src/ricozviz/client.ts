/**
 * RicozViz HTTP transport.
 *
 * The legacy web app wrapped `fetch` in a local `apiFetch` helper inside
 * `lib/api.ts`. That helper is preserved byte-for-byte in behaviour (token
 * storage, base-URL resolution, `ApiError` shape) but now lives in the shared
 * package with enterprise automatic 401 refresh, concurrency request queuing,
 * and seamless return URL redirection.
 */

/** Base URL used when nothing has been configured. */
const DEFAULT_BASE_URL = 'http://localhost:4000';

let configuredBaseUrl: string | null = null;

/**
 * Resolve the API origin.
 *
 * Order of precedence:
 *  1. Explicit `configureRicozVizApi({ baseUrl })` call (the Next app passes
 *     `process.env.NEXT_PUBLIC_API_URL` from `src/config/app.config.ts`).
 *  2. `NEXT_PUBLIC_API_URL` when it is a fully-qualified URL.
 *  3. Render split-origin inference: `*-web.onrender.com` -> `*-api.onrender.com`.
 *  4. `NEXT_PUBLIC_API_URL` as-is, then the local development default.
 */
export function getApiBaseUrl(): string {
  const envUrl = readPublicEnvUrl();

  if (configuredBaseUrl) {
    return stripTrailingSlash(configuredBaseUrl);
  }

  // 1. Valid absolute URL with a domain or port.
  if (envUrl && envUrl.startsWith('http') && (envUrl.includes('.') || envUrl.includes(':4000'))) {
    return stripTrailingSlash(envUrl);
  }

  // 2. Render: route a `*-web` host straight at its `*-api` sibling.
  if (typeof window !== 'undefined') {
    if (window.location.origin.includes('-web.onrender.com')) {
      return window.location.origin.replace('-web.onrender.com', '-api.onrender.com');
    }
  }

  // 3. Fall back to the env value, then local development.
  if (envUrl && envUrl.startsWith('http')) {
    return stripTrailingSlash(envUrl);
  }

  return DEFAULT_BASE_URL;
}

function readPublicEnvUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const value =
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env as Record<string, string | undefined>)['NEXT_PUBLIC_API_URL'];
    return value?.trim();
  }
  return undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

let activeSessionCookieName = 'rv_customer_session';

/** Point the client at a specific origin (used by the Next app at module load). */
export function configureRicozVizApi(options: { baseUrl?: string; sessionCookieName?: string }): void {
  configuredBaseUrl = options.baseUrl ? stripTrailingSlash(options.baseUrl) : null;
  if (options.sessionCookieName) {
    activeSessionCookieName = options.sessionCookieName;
  }
}

export function getSessionCookieName(): string {
  return activeSessionCookieName;
}

/** Error thrown for any non-2xx RicozViz response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- Token storage (sessionStorage in browser, in-memory fallback for SSR/tests) ----

const ACCESS_TOKEN_KEY = 'ricozviz_at';
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(ACCESS_TOKEN_KEY);
      if (stored) return stored;
    } catch {
      // ignore
    }
  }
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
        document.cookie = `${activeSessionCookieName}=true; path=/; max-age=86400; SameSite=Lax`;
      } else {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        document.cookie = `${activeSessionCookieName}=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch {
      // ignore
    }
  }
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

// ---- Auth Failure & Return URL Handling ----

export type AuthFailureHandler = (returnUrl: string) => void;
let authFailureHandler: AuthFailureHandler | null = null;

export function setOnAuthFailure(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

export function triggerAuthFailure(returnUrl?: string): void {
  clearAccessToken();

  let targetUrl = returnUrl;
  if (!targetUrl && typeof window !== 'undefined') {
    targetUrl = window.location.pathname + window.location.search;
  }
  if (!targetUrl) {
    targetUrl = '/dashboards';
  }

  if (authFailureHandler) {
    authFailureHandler(targetUrl);
    return;
  }

  if (typeof window !== 'undefined') {
    if (
      !window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')
    ) {
      const encodedReturn = encodeURIComponent(targetUrl);
      window.location.href = `/login?returnUrl=${encodedReturn}`;
    }
  }
}

// ---- Automatic 401 Refresh Mutex & Queue ----

let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Executes a single token refresh against `/api/v1/auth/refresh`.
 * Deduplicates concurrent refresh attempts by returning the in-flight Promise.
 */
export async function executeRicozVizRefresh(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: '{}',
        credentials: 'include' // Transmits HttpOnly refresh cookie
      });

      if (!res.ok) {
        throw new Error(`Refresh failed with HTTP ${res.status}`);
      }

      const body = (await res.json()) as RawEnvelope<{ accessToken: string }>;
      if (!body.success || !body.data?.accessToken) {
        throw new Error(body.error?.message || 'Refresh failed: missing access token');
      }

      const newToken = body.data.accessToken;
      setAccessToken(newToken);
      return newToken;
    } catch (err) {
      triggerAuthFailure();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

// ---- Core request helper ----

export interface ApiFetchOptions extends RequestInit {
  _isRetry?: boolean;
}

interface RawEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

/**
 * Perform an authenticated request and unwrap the `{ success, data }` envelope.
 * On HTTP 401, automatically calls /api/v1/auth/refresh once, queues concurrent requests,
 * retries the original request with the new access token, or redirects to /login with return URL.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  skipAuthHeader = false
): Promise<T> {
  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuthHeader) {
    const token = getAccessToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials: 'include' // Send the HttpOnly refresh cookie automatically
  });

  // Handle automatic 401 refresh with concurrency queuing
  if (res.status === 401) {
    const isAuthRoute =
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/refresh');

    if (!skipAuthHeader && !options._isRetry && !isAuthRoute) {
      const newToken = await executeRicozVizRefresh();
      if (newToken) {
        // Retry the original request once with the fresh access token
        return apiFetch<T>(
          path,
          {
            ...options,
            _isRetry: true
          },
          false
        );
      }
    }
  }

  let body: RawEnvelope<T>;
  try {
    body = (await res.json()) as RawEnvelope<T>;
  } catch {
    body = {
      success: false,
      error: { code: 'HTTP_ERROR', message: `Request failed with status ${res.status}` }
    };
  }

  if (!body.success) {
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'An error occurred',
      body.error?.details
    );
  }

  return body.data as T;
}

/** Build a query string, skipping empty/undefined values. */
export function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}
