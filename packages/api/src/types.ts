import type { ApiResponse, HealthStatus, Product, User, AuthTokens, AuthResponse } from '@repo/types';
import type {
  RegisterRequestInput,
  LoginRequestInput,
  ForgotPasswordRequestInput,
  CreateUserRequestInput,
  UpdateUserRequestInput,
  UserQueryInput,
  CreateProductRequestInput,
  ProductQueryInput
} from '@repo/validation';

export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken?: string): void;
  clearTokens(): void;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, unknown>;
  skipAuth?: boolean;
  _isRetry?: boolean;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  token?: string | null;
  tokenStorage?: TokenStorage;
  getToken?: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void | Promise<void>;
  onRequest?: (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
  onError?: (error: unknown) => void;
  autoRefresh?: boolean;
}

export type {
  ApiResponse,
  HealthStatus,
  Product,
  User,
  AuthTokens,
  AuthResponse,
  RegisterRequestInput,
  LoginRequestInput,
  ForgotPasswordRequestInput,
  CreateUserRequestInput,
  UpdateUserRequestInput,
  UserQueryInput,
  CreateProductRequestInput,
  ProductQueryInput
};
