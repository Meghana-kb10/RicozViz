'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Cpu,
  ScrollText,
  Activity,
  Settings,
  ShieldCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Tenants', href: '/tenants', icon: Building2 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Workers', href: '/workers', icon: Cpu },
  { name: 'Audit Ledger', href: '/audit', icon: ScrollText },
  { name: 'System & Flags', href: '/system', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings }
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 md:top-16 z-50 md:z-30 h-[100dvh] md:h-[calc(100vh-4rem)] w-64 bg-[#0d0d0d] border-r border-[#222222] flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6">
          <div className="md:hidden flex items-center justify-between pb-3 border-b border-[#222]">
            <span className="text-xs font-mono font-semibold text-[#ff6b35]">OPERATIONS MENU</span>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold">
              Management
            </span>
            <nav className="mt-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/overview' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/25 font-semibold'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#161616]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#ff6b35]' : 'text-gray-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="p-4 border-t border-[#1e1e1e] bg-[#0b0b0b]">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#141414] border border-[#222]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col text-[11px]">
              <span className="font-medium text-gray-200">Zero-Trust Active</span>
              <span className="text-[9px] font-mono text-gray-500">Audit Chain Verified</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
