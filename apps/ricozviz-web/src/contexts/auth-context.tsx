"use client";

// ========================================
// Auth Context
// ========================================
// Provides authentication state to the entire application.
// Handles login, logout, register, and token refresh.
// ========================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  apiLogin,
  apiRegister,
  apiMe,
  apiLogout,
  apiRefresh,
  setAccessToken,
  clearAccessToken,
  getAccessToken,
  type UserData,
  type OrganizationData,
} from "../lib/api";

// ---- Types ----

export interface AuthUser {
  user: UserData;
  organization: OrganizationData;
  role: string;
  permissions: string[];
}

interface AuthContextValue {
  auth: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

// ---- Context ----

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Restore session on mount ----
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      apiMe()
        .then((data) => {
          setAuth(data);
        })
        .catch(() => {
          // Access token may be expired — try refresh
          apiRefresh()
            .then((refreshData) => {
              setAccessToken(refreshData.accessToken);
              return apiMe();
            })
            .then((data) => {
              setAuth(data);
            })
            .catch(() => {
              clearAccessToken();
              setAuth(null);
            })
            .finally(() => setIsLoading(false));
        })
        .finally(() => setIsLoading(false));
    } else {
      // Try silent refresh in case refresh cookie is still valid
      apiRefresh()
        .then((refreshData) => {
          setAccessToken(refreshData.accessToken);
          return apiMe();
        })
        .then((data) => {
          setAuth(data);
        })
        .catch(() => {
          setAuth(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin({ email, password });
    setAccessToken(data.accessToken);
    setAuth({
      user: data.user,
      organization: data.organization,
      role: data.role,
      permissions: data.permissions,
    });
  }, []);

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      organizationName: string;
    }) => {
      const data = await apiRegister(input);
      setAccessToken(data.accessToken);
      setAuth({
        user: data.user,
        organization: data.organization,
        role: data.role,
        permissions: data.permissions,
      });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearAccessToken();
      setAuth(null);
    }
  }, []);

  const hasPermission = useCallback(
    (key: string) => {
      return auth?.permissions.includes(key) ?? false;
    },
    [auth]
  );

  return (
    <AuthContext.Provider
      value={{ auth, isLoading, login, register, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
