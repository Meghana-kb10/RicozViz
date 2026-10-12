import * as React from 'react';
import { Link } from 'react-router';
import { APP_CONFIG } from '@/config/app.config';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { LogoIcon } from '@/assets/icons';
import { LoginNavbar } from './components/navbar/navbar';

export function LoginHeader() {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to={PAGE_ROUTES.HOME} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <LogoIcon className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-100">{APP_CONFIG.name}</span>
        </Link>
        <LoginNavbar />
      </div>
    </header>
  );
}
