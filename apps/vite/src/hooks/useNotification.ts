import * as React from 'react';

export interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

export function useNotification() {
  const [notification, setNotification] = React.useState<NotificationState | null>(null);

  const showNotification = React.useCallback((type: 'success' | 'error' | 'info', message: string, duration = 4000) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, duration);
  }, []);

  const clearNotification = React.useCallback(() => {
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    clearNotification
  };
}
