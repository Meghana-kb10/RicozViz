import type { ApiResponse, AuthResponse, AuthTokens, User } from '@repo/types';
import type { RegisterRequestInput, LoginRequestInput, ForgotPasswordRequestInput } from '@repo/validation';
import type { HttpClient } from '../http';

export class AuthClient {
  constructor(private http: HttpClient) {}

  /**
   * Register a new user account.
   */
  async register(input: RegisterRequestInput): Promise<ApiResponse<AuthResponse>> {
    const res = await this.http.post<AuthResponse>('/api/auth/register', input, { skipAuth: true });
    if (res.success && res.data?.tokens?.accessToken) {
      this.http.setToken(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    }
    return res;
  }

  /**
   * Log into an existing account.
   */
  async login(input: LoginRequestInput): Promise<ApiResponse<AuthResponse>> {
    const res = await this.http.post<AuthResponse>('/api/auth/login', input, { skipAuth: true });
    if (res.success && res.data?.tokens?.accessToken) {
      this.http.setToken(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    }
    return res;
  }

  /**
   * Request password reset instructions.
   */
  async forgotPassword(input: ForgotPasswordRequestInput): Promise<ApiResponse<{ message: string }>> {
    return this.http.post<{ message: string }>('/api/auth/forgot-password', input, { skipAuth: true });
  }

  /**
   * Refresh access token using a refresh token.
   */
  async refreshToken(refreshToken?: string): Promise<ApiResponse<AuthTokens>> {
    const token = refreshToken || this.http.getRefreshToken();
    if (!token) {
      throw new Error('No refresh token available');
    }

    const res = await this.http.post<AuthTokens>(
      '/api/auth/refresh',
      { refreshToken: token },
      { skipAuth: true }
    );

    if (res.success && res.data?.accessToken) {
      this.http.setToken(res.data.accessToken, res.data.refreshToken);
    }
    return res;
  }

  /**
   * Fetch current authenticated user's profile (/api/auth/me).
   */
  async getProfile(): Promise<ApiResponse<User>> {
    return this.http.get<User>('/api/auth/me');
  }

  /**
   * Logout and revoke session.
   */
  async logout(): Promise<ApiResponse<{ loggedOut: boolean }>> {
    const res = await this.http.post<{ loggedOut: boolean }>('/api/auth/logout');
    this.http.clearTokens();
    return res;
  }
}
