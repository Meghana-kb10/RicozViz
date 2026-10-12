import * as React from 'react';
import { AuthProvider as RepoAuthProvider, useAuth as useRepoAuth, type AuthContextType } from '@repo/components';

export interface AuthContextProps {
  children: React.ReactNode;
  apiUrl?: string;
}

export function AuthProvider({ children, apiUrl }: AuthContextProps) {
  const resolvedApiUrl =
    apiUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    'http://localhost:4000';

  return <RepoAuthProvider apiUrl={resolvedApiUrl}>{children}</RepoAuthProvider>;
}

export { useRepoAuth as useAuth, type AuthContextType };
