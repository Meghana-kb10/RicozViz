'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    setIsLoading(true);

    try {
      const res = await forgotPassword({ email });
      setStatusMessage(res?.message || 'If an account exists, a reset link has been dispatched to your email.');
    } catch (err: any) {
      setError(err?.message || 'Unable to process password reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    statusMessage,
    error,
    isLoading,
    handleSubmit
  };
}
