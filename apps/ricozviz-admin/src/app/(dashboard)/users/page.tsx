'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  apiAdminListUsers,
  apiAdminDisableUser,
  apiAdminEnableUser,
  apiAdminForceLogoutUser,
  apiAdminImpersonateUser,
  type AdminUserItem
} from '@repo/api';
import { StatusBadge, DataTable, ConfirmDialog, useToast } from '@repo/components';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Eye,
  ChevronRight,
  UserCheck,
  Lock
} from 'lucide-react';

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [dialogAction, setDialogAction] = useState<'DISABLE' | 'ENABLE' | 'FORCE_LOGOUT' | 'IMPERSONATE' | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiAdminListUsers({
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit,
        offset
      });
      setUsers(res.users || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to fetch users' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, offset, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleConfirmAction = async (reason?: string) => {
    if (!selectedUser || !dialogAction) return;
    setDialogLoading(true);
    try {
      if (dialogAction === 'DISABLE') {
        await apiAdminDisableUser(selectedUser.id, { reason });
        showToast({
          type: 'warning',
          title: 'User Disabled',
          message: `${selectedUser.email} has been deactivated.`
        });
      } else if (dialogAction === 'ENABLE') {
        await apiAdminEnableUser(selectedUser.id, { reason });
        showToast({
          type: 'success',
          title: 'User Enabled',
          message: `${selectedUser.email} account has been restored.`
        });
      } else if (dialogAction === 'FORCE_LOGOUT') {
        await apiAdminForceLogoutUser(selectedUser.id);
        showToast({
          type: 'info',
          title: 'Active Sessions Revoked',
          message: `All refresh tokens and sessions for ${selectedUser.email} were terminated.`
        });
      } else if (dialogAction === 'IMPERSONATE') {
        const result = await apiAdminImpersonateUser(selectedUser.id, { reason });
        showToast({
          type: 'warning',
          title: 'Impersonation Session Active',
          message: `Generated 15-minute read-only token for ${result.targetUser.email}.`
        });
      }

      setSelectedUser(null);
      setDialogAction(null);
      fetchUsers();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Action failed' });
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">User Governance</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Global identity administration, 2FA enforcement, and session revocation.
          </p>
        </div>

        <div className="text-xs font-mono text-gray-400 bg-[#141414] px-3 py-1.5 rounded-lg border border-[#242424]">
          Registered Accounts: <span className="font-semibold text-white">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by user name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#121212] border border-[#262626] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setOffset(0);
            }}
            className="px-3 py-2 text-xs bg-[#121212] border border-[#262626] rounded-xl text-gray-300 focus:outline-none focus:border-[#ff6b35] transition cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        columns={[
          {
            key: 'name',
            header: 'User Identity',
            render: (u) => (
              <div>
                <Link
                  href={`/users/${u.id}`}
                  className="font-semibold text-white hover:text-[#ff6b35] transition flex items-center gap-1.5"
                >
                  <span>{u.name || 'Unnamed User'}</span>
                </Link>
                <span className="text-[10px] text-gray-400 font-mono">{u.email}</span>
              </div>
            )
          },
          {
            key: 'role',
            header: 'Role',
            render: (u) => (
              <span
                className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                  u.role === 'PLATFORM_ADMIN'
                    ? 'bg-[#ff6b35]/10 text-[#ff6b35] border-[#ff6b35]/30 font-semibold'
                    : 'bg-[#181818] text-gray-300 border-[#2a2a2a]'
                }`}
              >
                {u.role}
              </span>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (u) => (
              <StatusBadge
                status={u.status === 'ACTIVE' ? 'ok' : 'failed'}
                label={u.status}
              />
            )
          },
          {
            key: 'twoFactor',
            header: '2FA',
            render: (u) =>
              u.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ENABLED</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono text-gray-500">OFF</span>
              )
          },
          {
            key: 'organizations',
            header: 'Tenants',
            render: (u) => (
              <span className="text-[11px] font-mono text-gray-400">
                {u.organizationCount ?? u.memberships?.length ?? 0} orgs
              </span>
            )
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'text-right',
            render: (u) => (
              <div className="flex items-center justify-end gap-1.5">
                {/* Force Logout */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setDialogAction('FORCE_LOGOUT');
                  }}
                  className="p-1.5 text-gray-400 hover:text-amber-400 rounded hover:bg-[#1a1a1a] transition cursor-pointer"
                  title="Force terminate all active sessions"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>

                {/* Impersonate */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setDialogAction('IMPERSONATE');
                  }}
                  className="p-1.5 text-gray-400 hover:text-[#ff6b35] rounded hover:bg-[#1a1a1a] transition cursor-pointer"
                  title="Start read-only impersonation session"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {/* Status Toggle */}
                {u.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setDialogAction('DISABLE');
                    }}
                    className="px-2 py-0.5 text-[10px] font-mono font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/50 border border-red-800/40 rounded transition cursor-pointer"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setDialogAction('ENABLE');
                    }}
                    className="px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/50 border border-emerald-800/40 rounded transition cursor-pointer"
                  >
                    Enable
                  </button>
                )}

                <Link
                  href={`/users/${u.id}`}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1f1f1f]"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )
          }
        ]}
        data={users}
        keyExtractor={(u) => u.id}
        emptyMessage="No users found matching query."
        isLoading={loading}
      />

      {/* Safety Confirmation Dialog */}
      {selectedUser && dialogAction && (
        <ConfirmDialog
          isOpen={true}
          title={
            dialogAction === 'FORCE_LOGOUT'
              ? `Force Logout: ${selectedUser.email}`
              : dialogAction === 'IMPERSONATE'
              ? `Read-Only Impersonation: ${selectedUser.email}`
              : dialogAction === 'DISABLE'
              ? `Disable User: ${selectedUser.email}`
              : `Enable User: ${selectedUser.email}`
          }
          description={
            dialogAction === 'FORCE_LOGOUT'
              ? `This will immediately invalidate all refresh tokens, increment the user's tokenVersion, and revoke all active customer web sessions.`
              : dialogAction === 'IMPERSONATE'
              ? `Creates a temporary 15-minute read-only access token with imp: true. All mutation routes will be strictly rejected by the backend guard.`
              : dialogAction === 'DISABLE'
              ? `Disabling this user account prevents them from logging into any workspace.`
              : `Restores this user account to active status.`
          }
          confirmTextMatch={dialogAction === 'DISABLE' ? selectedUser.email : undefined}
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
              ? 'Start Read-Only Session'
              : dialogAction === 'DISABLE'
              ? 'Disable User'
              : 'Enable User'
          }
          variant={dialogAction === 'DISABLE' || dialogAction === 'FORCE_LOGOUT' ? 'danger' : 'warning'}
          isLoading={dialogLoading}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setSelectedUser(null);
            setDialogAction(null);
          }}
        />
      )}
    </div>
  );
}
