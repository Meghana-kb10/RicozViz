import type { TokenStorage } from './types';

const ACCESS_TOKEN_KEY = 'ricoz_access_token';
const REFRESH_TOKEN_KEY = 'ricoz_refresh_token';

/**
 * Universal browser token storage with localStorage and memory fallback.
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

  getRefreshToken(): string | null {
    if (this.isBrowser()) {
      try {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
      } catch {
        return this.inMemoryRefresh;
      }
    }
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
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
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
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * In-memory token storage (ideal for SSR or tests).
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
