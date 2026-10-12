'use client';

import * as React from 'react';
import { useSignupForm } from '../hooks/useSignupForm';

type SignupContextType = ReturnType<typeof useSignupForm>;

const SignupContext = React.createContext<SignupContextType | null>(null);

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const state = useSignupForm();
  return <SignupContext.Provider value={state}>{children}</SignupContext.Provider>;
}

export function useSignup() {
  const context = React.useContext(SignupContext);
  if (!context) {
    throw new Error('useSignup must be used within a SignupProvider');
  }
  return context;
}
