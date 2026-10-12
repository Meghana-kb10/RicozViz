'use client';

import * as React from 'react';
import { useHomeState } from '../hooks/useHomeState';

type HomeContextType = ReturnType<typeof useHomeState>;

const HomeContext = React.createContext<HomeContextType | null>(null);

export function HomeProvider({ children }: { children: React.ReactNode }) {
  const state = useHomeState();
  return <HomeContext.Provider value={state}>{children}</HomeContext.Provider>;
}

export function useHome() {
  const context = React.useContext(HomeContext);
  if (!context) {
    throw new Error('useHome must be used within a HomeProvider');
  }
  return context;
}
