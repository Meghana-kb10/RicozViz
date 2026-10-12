'use client';

import * as React from 'react';
import { ForgotPasswordHeader } from './components/header/header';
import { ForgotPasswordForm } from './components/forgot-password-form/forgot-password-form';
import { ForgotPasswordProvider } from './context/forgot-password.context';
import { Footer } from '@/components/layout/footer/footer';

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordProvider>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <ForgotPasswordHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <ForgotPasswordForm />
        </main>
        <Footer />
      </div>
    </ForgotPasswordProvider>
  );
}
