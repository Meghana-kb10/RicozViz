'use client';

import * as React from 'react';
import Link from 'next/link';
import { APP_CONFIG } from '@/config/app.config';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { LogoIcon } from '@/assets/icons';
import { HomeNavbar } from './components/navbar/navbar';
import { TouchRipple } from '@/components/ui/ripple';

export function HomeHeader() {
  return (
    <header className="w-full mui-elevation-2 bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          href={PAGE_ROUTES.HOME}
          className="relative group flex items-center gap-3 p-1.5 -ml-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
        >
          <TouchRipple color="rgba(99, 102, 241, 0.2)" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center mui-elevation-2">
            <LogoIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-slate-100 tracking-tight leading-none">
              {APP_CONFIG.name}
            </h1>
            <span className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase">
              Next.js Material UI
            </span>
          </div>
        </Link>
        <HomeNavbar />
      </div>
    </header>
  );
}
