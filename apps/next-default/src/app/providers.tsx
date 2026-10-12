'use client';

import * as React from 'react';
import { AuthProvider } from '@/context/auth.context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
