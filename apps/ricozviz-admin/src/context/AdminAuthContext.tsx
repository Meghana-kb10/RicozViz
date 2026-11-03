'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  setAdminAccessToken,
  clearAdminAccessToken,
  apiAdminEnrollTotp,
  apiAdminVerifyTotp,
  type AdminAuthUser
} from '@repo/api';

export interface AdminAuthContextType {
  user: AdminAuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requires2Fa: boolean;
  pendingEmail: string | null;
  login: (credentials: {
    email: string;
    password: string;
    totpCode?: string;
    backupCode?: string;
  }) => Promise<{ requires2Fa?: boolean; success?: boolean; error?: string }>;
  logout: () => Promise<void>;
  enroll2Fa: () => Promise<{ secret: string; otpauthUri: string }>;
  verify2Fa: (totpCode: string) => Promise<{ backupCodes: string[] }>;
  refreshSession: () => Promise<boolean>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminAuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requires2Fa, setRequires2Fa] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const applyAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    setAdminAccessToken(token);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      if (!res.ok) {
        applyAccessToken(null);
        setUser(null);
        return false;
      }

      const data = await res.json();
      if (data.accessToken) {
        applyAccessToken(data.accessToken);

        // Attempt to parse user claims from access token payload
        try {
          const parts = data.accessToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            setUser({
              id: payload.sub,
              email: payload.email,
              name: payload.name || payload.email.split('@')[0],
              role: payload.role || 'PLATFORM_ADMIN',
              twoFactorEnabled: payload.twoFactorVerified ?? true
            });
          }
        } catch {
          // Payload parsing fallback
        }
        return true;
      }

      applyAccessToken(null);
      setUser(null);
      return false;
    } catch {
      applyAccessToken(null);
      setUser(null);
      return false;
    }
  }, [applyAccessToken]);

  // Initial session hydration
  useEffect(() => {
    let mounted = true;
    refreshSession().finally(() => {
      if (mounted) setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  const login = async (credentials: {
    email: string;
    password: string;
    totpCode?: string;
    backupCode?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(credentials)
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error?.message || data.message || `Login failed (HTTP ${res.status})`;
        return { success: false, error: errorMsg };
      }

      if (data.requires2Fa) {
        setRequires2Fa(true);
        setPendingEmail(credentials.email);
        setUser(data.user || null);
        return { requires2Fa: true, success: true };
      }

      if (data.accessToken) {
        applyAccessToken(data.accessToken);
        setUser(data.user || null);
        setRequires2Fa(false);
        setPendingEmail(null);
        return { success: true };
      }

      return { success: false, error: 'Malformed authentication response' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during login' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
    } finally {
      applyAccessToken(null);
      clearAdminAccessToken();
      setUser(null);
      setRequires2Fa(false);
      setPendingEmail(null);
      setIsLoading(false);
      router.push('/login');
    }
  };

  const enroll2Fa = async () => {
    return apiAdminEnrollTotp();
  };

  const verify2Fa = async (totpCode: string) => {
    const result = await apiAdminVerifyTotp({ totpCode });
    if (user) {
      setUser({ ...user, twoFactorEnabled: true });
    }
    return result;
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        requires2Fa,
        pendingEmail,
        login,
        logout,
        enroll2Fa,
        verify2Fa,
        refreshSession
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextType {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
