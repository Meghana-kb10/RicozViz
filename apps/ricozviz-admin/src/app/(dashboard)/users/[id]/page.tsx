'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  apiAdminGetUser,
  apiAdminDisableUser,
  apiAdminEnableUser,
  apiAdminForceLogoutUser,
  apiAdminImpersonateUser,
  type AdminUserItem
} from '@repo/api';
import { StatusBadge, ConfirmDialog, useToast } from '@repo/components';
import {
  Users,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Eye,
  Calendar,
  Building2,
  Mail,
  UserCheck
} from 'lucide-react';

export default function AdminUserDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const { showToast } = useToast();

  const [user, setUser] = useState<AdminUserItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog action state
  const [dialogAction, setDialogAction] = useState<'DISABLE' | 'ENABLE' | 'FORCE_LOGOUT' | 'IMPERSONATE' | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchUser = async () => {
    try {
      setError(null);
      const data = await apiAdminGetUser(userId);
      setUser(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const handleConfirmAction = async (reason?: string) => {
    if (!user || !dialogAction) return;
    setDialogLoading(true);
    try {
      if (dialogAction === 'DISABLE') {
        await apiAdminDisableUser(user.id, { reason });
        showToast({ type: 'warning', message: `${user.email} disabled.` });
      } else if (dialogAction === 'ENABLE') {
        await apiAdminEnableUser(user.id, { reason });
        showToast({ type: 'success', message: `${user.email} enabled.` });
      } else if (dialogAction === 'FORCE_LOGOUT') {
        await apiAdminForceLogoutUser(user.id);
        showToast({ type: 'info', message: `Active sessions terminated for ${user.email}.` });
      } else if (dialogAction === 'IMPERSONATE') {
        await apiAdminImpersonateUser(user.id, { reason });
        showToast({ type: 'warning', message: `Read-only impersonation active for ${user.email}.` });
      }

      setDialogAction(null);
      fetchUser();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Action failed' });
    } finally {
      setDialogLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-gray-400">Loading user profile...</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Users</span>
        </Link>
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs">
          {error || 'User not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Users</span>
        </Link>
      </div>

      {/* Profile Card */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1c1c] border border-[#2c2c2c] flex items-center justify-center text-emerald-400">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white font-mono">{user.name || 'Unnamed User'}</h1>
              <StatusBadge
                status={user.status === 'ACTIVE' ? 'ok' : 'failed'}
                label={user.status}
              />
              <span
                className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                  user.role === 'PLATFORM_ADMIN'
                    ? 'bg-[#ff6b35]/15 text-[#ff6b35] border-[#ff6b35]/30'
                    : 'bg-[#181818] text-gray-400 border-[#2a2a2a]'
                }`}
              >
                {user.role}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono">
              <span className="flex items-center gap-1 text-white">
                <Mail className="w-3 h-3 text-gray-500" />
                {user.email}
              </span>
              <span>•</span>
              <span>ID: {user.id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                Enrolled: {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setDialogAction('IMPERSONATE')}
            className="px-3 py-1.5 text-xs font-mono font-medium text-gray-200 bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#ff6b35]" />
            <span>Impersonate</span>
          </button>

          <button
            type="button"
            onClick={() => setDialogAction('FORCE_LOGOUT')}
            className="px-3 py-1.5 text-xs font-mono font-medium text-amber-400 hover:text-amber-300 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-800/40 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Revoke Sessions</span>
          </button>

          {user.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => setDialogAction('DISABLE')}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-800/50 rounded-xl transition cursor-pointer"
            >
              Disable Account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDialogAction('ENABLE')}
              className="px-3.5 py-1.5 text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 rounded-xl transition cursor-pointer"
            >
              Enable Account
            </button>
          )}
        </div>
      </div>

      {/* Security & Organization Memberships */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Security Vitals */}
        <div className="p-5 bg-[#141414] border border-[#242424] rounded-xl space-y-4">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
            Security Telemetry
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Two-Factor Authentication:</span>
              {user.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ENABLED
                </span>
              ) : (
                <span className="font-mono text-gray-500">DISABLED</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Account Status:</span>
              <span className="font-mono text-white">{user.status}</span>
            </div>
          </div>
        </div>

        {/* Tenant Memberships */}
        <div className="md:col-span-2 p-5 bg-[#141414] border border-[#242424] rounded-xl space-y-4">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
            Organization Memberships ({user.memberships?.length || 0})
          </h2>
          {user.memberships && user.memberships.length > 0 ? (
            <div className="space-y-2">
              {user.memberships.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[#0f0f0f] border border-[#222] rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-200">Tenant ID: {m.organizationId}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">{m.roleId || 'MEMBER'}</span>
                    <StatusBadge status={m.status === 'ACTIVE' ? 'ok' : 'skipped'} label={m.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500 font-mono py-4 text-center">
              No organization memberships found.
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {dialogAction && (
        <ConfirmDialog
          isOpen={true}
          title={
            dialogAction === 'FORCE_LOGOUT'
              ? `Revoke Sessions: ${user.email}`
              : dialogAction === 'IMPERSONATE'
              ? `Read-Only Impersonation: ${user.email}`
              : dialogAction === 'DISABLE'
              ? `Disable User: ${user.email}`
              : `Enable User: ${user.email}`
          }
          description={
            dialogAction === 'FORCE_LOGOUT'
              ? `Terminates all active sessions for ${user.email} by bumping tokenVersion.`
              : dialogAction === 'IMPERSONATE'
              ? `Generates a 15-minute read-only impersonation token.`
              : `Disables this user's account.`
          }
          confirmTextMatch={dialogAction === 'DISABLE' ? user.email : undefined}
          reasonRequired={
            dialogAction === 'IMPERSONATE' ||
            dialogAction === 'DISABLE' ||
            dialogAction === 'ENABLE'
          }
          reasonPlaceholder="Audit explanation for immutable ledger (required)..."
          confirmLabel={
            dialogAction === 'FORCE_LOGOUT'
              ? 'Revoke Sessions'
              : dialogAction === 'IMPERSONATE'
              ? 'Start Impersonation'
              : dialogAction === 'DISABLE'
              ? 'Disable User'
              : 'Enable User'
          }
          variant={dialogAction === 'DISABLE' ? 'danger' : 'warning'}
          isLoading={dialogLoading}
          onConfirm={handleConfirmAction}
          onCancel={() => setDialogAction(null)}
        />
      )}
    </div>
  );
}
