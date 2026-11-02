import type { ApiResponse } from '@repo/types';
import type { ApiClientOptions, RequestOptions, TokenStorage } from './types';
import { defaultTokenStorage } from './storage';

export function createApiResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function createApiError(error: string, message?: string): ApiResponse<never> {
  return {
    success: false,
    error,
    message,
    timestamp: new Date().toISOString()
  };
}

export class HttpClient {
  public baseUrl: string;
  private fetchFn: typeof fetch;
  private defaultHeaders: Record<string, string>;
  private tokenStorage: TokenStorage;
  private customGetToken?: () => string | null | Promise<string | null>;
  private onUnauthorized?: () => void | Promise<void>;
  private onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  private onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  private onError?: (error: unknown) => void;
  private autoRefresh: boolean;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:4000').replace(/\/+$/, '');
    this.fetchFn =
      options.fetchFn ||
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : () => {
            throw new Error('fetch is not defined in this environment');
          });

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.defaultHeaders || {})
    };

    this.tokenStorage = options.tokenStorage || defaultTokenStorage;
    if (options.token) {
      this.tokenStorage.setTokens(options.token);
    }

    this.customGetToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
    this.onRequest = options.onRequest;
    this.onResponse = options.onResponse;
    this.onError = options.onError;
    this.autoRefresh = options.autoRefresh ?? true;
  }

  public setToken(token: string | null, refreshToken?: string): void {
    if (token) {
      this.tokenStorage.setTokens(token, refreshToken);
    } else {
      this.tokenStorage.clearTokens();
    }
  }

  public async getToken(): Promise<string | null> {
    if (this.customGetToken) {
      return this.customGetToken();
    }
    return this.tokenStorage.getAccessToken();
  }

  public getRefreshToken(): string | null {
    return this.tokenStorage.getRefreshToken();
  }

  public clearTokens(): void {
    this.tokenStorage.clearTokens();
  }

  private buildUrl(endpoint: string, query?: Record<string, unknown>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Executes a single token refresh against the backend refresh endpoint.
   * Deduplicates concurrent refresh attempts by returning the in-flight Promise.
   */
  private async executeRefresh(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshUrl = `${this.baseUrl}/api/v1/auth/refresh`;
        const res = await this.fetchFn(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: '{}',
          credentials: 'include'
        });

        if (!res.ok) {
          throw new Error(`Refresh failed with status ${res.status}`);
        }

        const data: any = await res.json();
        const newToken = data?.data?.accessToken || data?.accessToken;
        if (!newToken) {
          throw new Error('Refresh response missing access token');
        }

        this.setToken(newToken);
        return newToken;
      } catch {
        this.clearTokens();
        if (this.onUnauthorized) {
          await this.onUnauthorized();
        }
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint, options.query);

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers as Record<string, string> || {})
    };

    // Attach Bearer token if not skipped
    if (!options.skipAuth) {
      const token = await this.getToken();
      if (token && !headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const { body, query, skipAuth, headers: customHeaders, _isRetry, ...fetchOptions } = options;

    let init: RequestInit = {
      ...fetchOptions,
      headers,
      method: options.method || 'GET'
    };

    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    if (this.onRequest) {
      init = await this.onRequest(url, init);
    }

    try {
      const res = await this.fetchFn(url, init);

      // Automatic 401 refresh with concurrency queuing
      if (res.status === 401 && this.autoRefresh && !options.skipAuth && !options._isRetry) {
        const isAuthRoute =
          endpoint.includes('/auth/login') ||
          endpoint.includes('/auth/register') ||
          endpoint.includes('/auth/refresh');

        if (!isAuthRoute) {
          const newToken = await this.executeRefresh();
          if (newToken) {
            return this.request<T>(endpoint, {
              ...options,
              _isRetry: true
            });
          }
        }
      }

      if (res.status === 401 && this.onUnauthorized) {
        await this.onUnauthorized();
      }

      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      let apiResponse: ApiResponse<T>;
      if (!res.ok) {
        const errorMsg = data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
        apiResponse = createApiError(errorMsg, data.message || `Request failed with status ${res.status}`);
      } else {
        // If server already returned ApiResponse format, preserve it, otherwise wrap
        if (data && typeof data === 'object' && 'success' in data) {
          apiResponse = data as ApiResponse<T>;
        } else {
          apiResponse = createApiResponse<T>(data);
        }
      }

      if (this.onResponse) {
        apiResponse = await this.onResponse(apiResponse);
      }

      return apiResponse;
    } catch (err: unknown) {
      if (this.onError) {
        this.onError(err);
      }
      const message = err instanceof Error ? err.message : 'Network request failed';
      return createApiError(message, 'Failed to connect to API server');
    }
  }

  public get<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public patch<T>(endpoint: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  public delete<T>(endpoint: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}
