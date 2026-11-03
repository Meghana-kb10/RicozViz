'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminHeader } from '../../components/AdminHeader';
import { AdminSidebar } from '../../components/AdminSidebar';
import { ImpersonationBanner } from '@repo/components';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [impersonatingUser, setImpersonatingUser] = useState<{
    targetEmail: string;
    targetTenantName?: string;
    expiresInMinutes?: number;
  } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-gray-400">Verifying Platform Authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col text-gray-100">
      {impersonatingUser && (
        <ImpersonationBanner
          targetEmail={impersonatingUser.targetEmail}
          targetTenantName={impersonatingUser.targetTenantName}
          expiresInMinutes={impersonatingUser.expiresInMinutes || 15}
          onExit={() => setImpersonatingUser(null)}
        />
      )}

      <AdminHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex w-full">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
