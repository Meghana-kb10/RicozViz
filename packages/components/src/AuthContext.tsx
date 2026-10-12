import * as React from 'react';
import { ApiClient, type LoginRequestInput, type RegisterRequestInput, type ForgotPasswordRequestInput } from '@repo/api';
import type { User } from '@repo/types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  api: ApiClient;
  login: (input: LoginRequestInput) => Promise<{ success: boolean; error?: string }>;
  register: (input: RegisterRequestInput) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (input: ForgotPasswordRequestInput) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  api?: ApiClient;
  apiUrl?: string;
}

export function AuthProvider({ children, api: customApi, apiUrl }: AuthProviderProps) {
  const [api] = React.useState<ApiClient>(() => {
    if (customApi) return customApi;
    return new ApiClient({
      baseUrl: apiUrl || (typeof window !== 'undefined' ? (window as any).__API_URL__ || 'http://localhost:4000' : 'http://localhost:4000')
    });
  });

  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Initialize and check current session on mount
  const refreshProfile = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const activeToken = await api.getToken();
      setToken(activeToken);

      if (activeToken) {
        const res = await api.auth.getProfile();
        if (res.success && res.data) {
          setUser(res.data);
        } else {
          // Token invalid or expired
          api.clearTokens();
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      api.clearTokens();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = React.useCallback(
    async (input: LoginRequestInput): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await api.auth.login(input);
        if (res.success && res.data) {
          setUser(res.data.user);
          setToken(res.data.tokens.accessToken);
          return { success: true };
        }
        return { success: false, error: res.error || 'Login failed' };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Login failed';
        return { success: false, error };
      } finally {
        setIsLoading(false);
      }
    },
    [api]
  );

  const register = React.useCallback(
    async (input: RegisterRequestInput): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await api.auth.register(input);
        if (res.success && res.data) {
          setUser(res.data.user);
          setToken(res.data.tokens.accessToken);
          return { success: true };
        }
        return { success: false, error: res.error || 'Registration failed' };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Registration failed';
        return { success: false, error };
      } finally {
        setIsLoading(false);
      }
    },
    [api]
  );

  const forgotPassword = React.useCallback(
    async (input: ForgotPasswordRequestInput): Promise<{ success: boolean; message?: string; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await api.auth.forgotPassword(input);
        if (res.success) {
          return {
            success: true,
            message: res.data?.message || 'Password reset instructions have been sent.'
          };
        }
        return { success: false, error: res.error || 'Password reset failed' };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Password reset failed';
        return { success: false, error };
      } finally {
        setIsLoading(false);
      }
    },
    [api]
  );

  const logout = React.useCallback(async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout errors
    } finally {
      api.clearTokens();
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  }, [api]);

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      api,
      login,
      register,
      forgotPassword,
      logout,
      refreshProfile
    }),
    [user, token, isLoading, api, login, register, forgotPassword, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
