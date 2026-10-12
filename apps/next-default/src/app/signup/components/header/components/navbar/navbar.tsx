'use client';

import * as React from 'react';
import Link from 'next/link';
import { PAGE_ROUTES } from '@/config/page-route.config';

export function SignupNavbar() {
  return (
    <nav className="flex items-center gap-3">
      <Link
        href={PAGE_ROUTES.HOME}
        className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        Back to Home
      </Link>
      <Link
        href={PAGE_ROUTES.LOGIN}
        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Sign In
      </Link>
    </nav>
  );
}
