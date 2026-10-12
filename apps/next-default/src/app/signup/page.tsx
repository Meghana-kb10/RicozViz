'use client';

import * as React from 'react';
import { SignupHeader } from './components/header/header';
import { SignupForm } from './components/signup-form/signup-form';
import { SignupProvider } from './context/signup.context';
import { Footer } from '@/components/layout/footer/footer';

export default function SignupPage() {
  return (
    <SignupProvider>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        <SignupHeader />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
          <SignupForm />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
