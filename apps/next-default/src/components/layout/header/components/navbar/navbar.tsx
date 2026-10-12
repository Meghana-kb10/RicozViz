'use client';

import * as React from 'react';
import Link from 'next/link';
import { PAGE_ROUTES } from '@/config/page-route.config';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="flex items-center gap-3">
      <Link
        href={PAGE_ROUTES.HOME}
        className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
      >
        Home
      </Link>
      {isAuthenticated ? (
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
          <button
            onClick={() => logout()}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <Link
            href={PAGE_ROUTES.LOGIN}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href={PAGE_ROUTES.SIGNUP}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Register
          </Link>
        </div>
      )}
    </nav>
  );
}
