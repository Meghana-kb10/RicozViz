import * as React from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useHomeState() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'overview' | 'details'>('overview');

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    activeTab,
    setActiveTab,
    greeting
  };
}
