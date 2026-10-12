'use client';

import * as React from 'react';
import { LoginHeader } from './components/header/header';
import { LoginForm } from './components/login-form/login-form';
import { LoginProvider } from './context/login.context';
import { Footer } from '@/components/layout/footer/footer';

export default function LoginPage() {
  return (
    <LoginProvider>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <LoginHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <LoginForm />
        </main>
        <Footer />
      </div>
    </LoginProvider>
  );
}
