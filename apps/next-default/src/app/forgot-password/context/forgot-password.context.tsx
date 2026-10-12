'use client';

import * as React from 'react';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';

type ForgotPasswordContextType = ReturnType<typeof useForgotPasswordForm>;

const ForgotPasswordContext = React.createContext<ForgotPasswordContextType | null>(null);

export function ForgotPasswordProvider({ children }: { children: React.ReactNode }) {
  const state = useForgotPasswordForm();
  return <ForgotPasswordContext.Provider value={state}>{children}</ForgotPasswordContext.Provider>;
}

export function useForgotPassword() {
  const context = React.useContext(ForgotPasswordContext);
  if (!context) {
    throw new Error('useForgotPassword must be used within a ForgotPasswordProvider');
  }
  return context;
}
