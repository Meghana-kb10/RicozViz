"use client";

// ========================================
// Auth Context
// ========================================
// Provides authentication state to the entire application.
// Handles login, logout, register, token refresh, and tenant suspension.
// ========================================

import { useRouter } from "next/navigation";
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
  setOnAuthFailure,
  setOnTenantSuspended,
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
  const router = useRouter();

  // Synchronize React auth state with automatic 401 refresh failures & suspension in @repo/api
  useEffect(() => {
    setOnAuthFailure(() => {
      setAuth(null);
    });
    setOnTenantSuspended(() => {
      setAuth(null);
      router.push("/suspended");
    });
    return () => {
      setOnAuthFailure(null);
      setOnTenantSuspended(null);
    };
  }, [router]);

  // ---- Restore session on mount ----
  useEffect(() => {
    const handleAuthError = (err: any) => {
      if (
        err?.code === "TENANT_SUSPENDED" ||
        err?.message?.toLowerCase().includes("suspended")
      ) {
        setAuth(null);
        clearAccessToken();
        router.push("/suspended");
      } else {
        clearAccessToken();
        setAuth(null);
      }
    };

    const token = getAccessToken();
    if (token) {
      apiMe()
        .then((data) => {
          setAuth(data);
        })
        .catch((err) => {
          // If suspension error, do not retry refresh
          if (
            err?.code === "TENANT_SUSPENDED" ||
            err?.message?.toLowerCase().includes("suspended")
          ) {
            handleAuthError(err);
            return;
          }
          // Access token may be expired — try refresh
          apiRefresh()
            .then((refreshData) => {
              setAccessToken(refreshData.accessToken);
              return apiMe();
            })
            .then((data) => {
              setAuth(data);
            })
            .catch(handleAuthError)
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
        .catch(handleAuthError)
        .finally(() => setIsLoading(false));
    }
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const data = await apiLogin({ email, password });
        setAccessToken(data.accessToken);
        setAuth({
          user: data.user,
          organization: data.organization,
          role: data.role,
          permissions: data.permissions,
        });
      } catch (err: any) {
        if (
          err?.code === "TENANT_SUSPENDED" ||
          err?.message?.toLowerCase().includes("suspended")
        ) {
          setAuth(null);
          clearAccessToken();
          router.push("/suspended");
        }
        throw err;
      }
    },
    [router]
  );

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
