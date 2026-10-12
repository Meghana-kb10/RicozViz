/**
 * RicozViz HTTP transport.
 *
 * The legacy web app wrapped `fetch` in a local `apiFetch` helper inside
 * `lib/api.ts`. That helper is preserved byte-for-byte in behaviour (token
 * storage, base-URL resolution, `ApiError` shape) but now lives in the shared
 * package so the backend contract has a single typed home.
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

/** Point the client at a specific origin (used by the Next app at module load). */
export function configureRicozVizApi(options: { baseUrl?: string }): void {
  configuredBaseUrl = options.baseUrl ? stripTrailingSlash(options.baseUrl) : null;
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

// ---- Token storage (sessionStorage to mitigate XSS) ----

const ACCESS_TOKEN_KEY = 'ricozviz_at';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  // Mirror a non-sensitive presence flag so the Next.js middleware can guard routes.
  document.cookie = 'ricozviz_auth=true; path=/; max-age=86400; SameSite=Lax';
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  document.cookie = 'ricozviz_auth=; path=/; max-age=0; SameSite=Lax';
}

// ---- Core request helper ----

interface RawEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, string[]> };
}

/**
 * Perform an authenticated request and unwrap the `{ success, data }` envelope.
 * Throws `ApiError` for any envelope where `success` is false.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  skipAuthHeader = false
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.method !== 'GET' && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuthHeader) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials: 'include' // Send the refresh cookie automatically
  });

  const body = (await res.json()) as RawEnvelope<T>;

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