'use client';

import * as React from 'react';
import { useLoginForm } from '../hooks/useLoginForm';

type LoginContextType = ReturnType<typeof useLoginForm>;

const LoginContext = React.createContext<LoginContextType | null>(null);

export function LoginProvider({ children }: { children: React.ReactNode }) {
  const state = useLoginForm();
  return <LoginContext.Provider value={state}>{children}</LoginContext.Provider>;
}

export function useLogin() {
  const context = React.useContext(LoginContext);
  if (!context) {
    throw new Error('useLogin must be used within a LoginProvider');
  }
  return context;
}
