'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthCard, type AuthMode } from '@repo/components';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden px-4 py-8">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top navigation */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between z-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
            R
          </div>
          <span>Ricoz Core Monorepo</span>
        </Link>
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← Home
        </Link>
      </div>

      {/* Main card container */}
      <div className="my-auto py-8 z-10">
        <AuthCard
          initialMode={initialMode}
          onSuccess={() => router.push('/')}
          onBackToHome={() => router.push('/')}
        />
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 z-10">
        &copy; {new Date().getFullYear()} Ricoz Monorepo Architecture. Powered by Fastify 5 & Next.js 15.
      </footer>
    </main>
  );
}

export default function AuthPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>}>
      <AuthPageContent />
    </React.Suspense>
  );
}
