import type { TokenStorage } from './types';

const ACCESS_TOKEN_KEY = 'ricoz_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'ricoz_refresh_token';

/**
 * Universal browser token storage with localStorage and memory fallback.
 *
 * ============================================================================
 * SECURITY ARCHITECTURE & TOKEN HYGIENE:
 * ============================================================================
 * Tradeoff Analysis:
 * Storing long-lived refresh tokens in client-accessible storage (such as
 * localStorage or sessionStorage) introduces severe vulnerability to Cross-Site
 * Scripting (XSS) attacks. Any rogue third-party script, dependency compromise,
 * or injected HTML snippet can read `localStorage.getItem('ricoz_refresh_token')`
 * and permanently exfiltrate the user's refresh credential.
 *
 * Production Resolution:
 * In RicozViz, refresh tokens are strictly transported via `HttpOnly`, `SameSite=Strict`
 * cookies set by the backend Fastify server on `/api/v1/auth`. The browser's native
 * network stack handles cookie inclusion automatically on calls to `/api/v1/auth/refresh`
 * via `credentials: 'include'`, while preventing JavaScript from accessing the cookie.
 * Client storage is reserved exclusively for the short-lived (15m) access token.
 * ============================================================================
 */
export class BrowserTokenStorage implements TokenStorage {
  private inMemoryAccess: string | null = null;
  private inMemoryRefresh: string | null = null;

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  getAccessToken(): string | null {
    if (this.isBrowser()) {
      try {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
      } catch {
        return this.inMemoryAccess;
      }
    }
    return this.inMemoryAccess;
  }

  /**
   * Returns in-memory refresh token if explicitly configured (for testing or SSR).
   * In browser production environments, refresh tokens are managed via HttpOnly cookies.
   */
  getRefreshToken(): string | null {
    return this.inMemoryRefresh;
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.inMemoryAccess = accessToken;
    if (refreshToken) {
      this.inMemoryRefresh = refreshToken;
    }

    if (this.isBrowser()) {
      try {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        // Clear any legacy client-side refresh tokens to enforce HttpOnly cookie hygiene
        localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
      } catch {
        // LocalStorage quota or permission issue fallback
      }
    }
  }

  clearTokens(): void {
    this.inMemoryAccess = null;
    this.inMemoryRefresh = null;

    if (this.isBrowser()) {
      try {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * In-memory token storage (ideal for SSR, tests, and non-browser runtimes).
 */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export const defaultTokenStorage = new BrowserTokenStorage();
