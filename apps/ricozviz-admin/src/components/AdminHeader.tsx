'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@repo/components';
import { useAdminAuth } from '../context/AdminAuthContext';
import { LogOut, ShieldAlert, UserCheck } from 'lucide-react';

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
}

export function AdminHeader({ onToggleSidebar }: AdminHeaderProps) {
  const { user, logout } = useAdminAuth();

  return (
    <header className="h-16 border-b border-[#262626] bg-[#0f0f0f]/95 backdrop-blur sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 text-gray-400 hover:text-white rounded hover:bg-[#1a1a1a]"
            aria-label="Toggle Navigation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <Link href="/overview" className="flex items-center gap-2.5">
          <BrandLogo size={28} showText />
          <span className="bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase">
            ADMIN
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="hidden sm:flex items-center gap-3 text-right">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white">{user.name || user.email}</span>
              <span className="text-[10px] font-mono text-gray-400">{user.email}</span>
            </div>
            <span className="inline-flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded">
              <UserCheck className="w-3 h-3" />
              {user.role}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-[#181818] hover:bg-[#222222] border border-[#2e2e2e] rounded-lg transition cursor-pointer"
          title="Sign out of platform operator session"
        >
          <LogOut className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
