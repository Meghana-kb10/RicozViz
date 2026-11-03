'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  apiAdminListTenants,
  apiAdminSuspendTenant,
  apiAdminUnsuspendTenant,
  type AdminTenantItem
} from '@repo/api';
import { StatusBadge, DataTable, ConfirmDialog, useToast } from '@repo/components';
import {
  Building2,
  Search,
  Filter,
  ShieldAlert,
  ChevronRight,
  ShieldCheck,
  Ban,
  RotateCw
} from 'lucide-react';

export default function AdminTenantsPage() {
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Confirm dialog state for suspend/unsuspend
  const [selectedTenant, setSelectedTenant] = useState<AdminTenantItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<'SUSPEND' | 'UNSUSPEND' | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiAdminListTenants({
        search: search.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit,
        offset
      });
      setTenants(res.tenants || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to fetch organizations' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, offset, showToast]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleConfirmAction = async (reason: string) => {
    if (!selectedTenant || !confirmAction) return;
    setDialogLoading(true);
    try {
      if (confirmAction === 'SUSPEND') {
        await apiAdminSuspendTenant(selectedTenant.id, { reason });
        showToast({
          type: 'warning',
          title: 'Tenant Suspended',
          message: `${selectedTenant.name} is now suspended. Customer access is immediately blocked.`
        });
      } else {
        await apiAdminUnsuspendTenant(selectedTenant.id, { reason: reason || 'Restored by platform operator' });
        showToast({
          type: 'success',
          title: 'Tenant Restored',
          message: `${selectedTenant.name} has been reinstated.`
        });
      }
      setSelectedTenant(null);
      setConfirmAction(null);
      fetchTenants();
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
            <Building2 className="w-5 h-5 text-[#ff6b35]" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">Organizations & Tenants</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Manage organization workspaces, subscription tiers, and enforcement states.
          </p>
        </div>

        <div className="text-xs font-mono text-gray-400 bg-[#141414] px-3 py-1.5 rounded-lg border border-[#242424]">
          Total Organizations: <span className="font-semibold text-white">{total}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by organization name or slug..."
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

      {/* Tenants Table */}
      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Organization',
            render: (tenant) => (
              <div>
                <Link
                  href={`/tenants/${tenant.id}`}
                  className="font-semibold text-white hover:text-[#ff6b35] transition flex items-center gap-1"
                >
                  <span>{tenant.name}</span>
                </Link>
                <span className="text-[10px] text-gray-500 font-mono">slug: {tenant.slug}</span>
              </div>
            )
          },
          {
            key: 'plan',
            header: 'Plan Tier',
            render: (tenant) => (
              <span className="px-2 py-0.5 text-[10px] font-mono bg-[#181818] border border-[#2c2c2c] rounded text-gray-200">
                {tenant.plan}
              </span>
            )
          },
          {
            key: 'status',
            header: 'Status',
            render: (tenant) => (
              <StatusBadge
                status={tenant.status === 'ACTIVE' ? 'ok' : 'failed'}
                label={tenant.status}
              />
            )
          },
          {
            key: 'metrics',
            header: 'Usage',
            render: (tenant) => (
              <div className="text-[11px] font-mono text-gray-400 space-x-2">
                <span>{tenant.memberCount ?? 0} mbrs</span>
                <span>•</span>
                <span>{tenant.workspaceCount ?? 0} ws</span>
                <span>•</span>
                <span>{tenant.datasetCount ?? 0} ds</span>
              </div>
            )
          },
          {
            key: 'createdAt',
            header: 'Enrolled',
            render: (tenant) => (
              <span className="text-[11px] text-gray-500 font-mono">
                {new Date(tenant.createdAt).toLocaleDateString()}
              </span>
            )
          },
          {
            key: 'actions',
            header: 'Actions',
            className: 'text-right',
            render: (tenant) => (
              <div className="flex items-center justify-end gap-2">
                {tenant.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setConfirmAction('SUSPEND');
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-800/40 rounded transition cursor-pointer"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setConfirmAction('UNSUSPEND');
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-800/40 rounded transition cursor-pointer"
                  >
                    Unsuspend
                  </button>
                )}

                <Link
                  href={`/tenants/${tenant.id}`}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1f1f1f]"
                  title="View full tenant details"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )
          }
        ]}
        data={tenants}
        keyExtractor={(tenant) => tenant.id}
        emptyMessage="No organizations found matching search criteria."
        isLoading={loading}
      />

      {/* Safety Confirmation Dialog */}
      {selectedTenant && confirmAction && (
        <ConfirmDialog
          isOpen={true}
          title={
            confirmAction === 'SUSPEND'
              ? `Suspend Organization: ${selectedTenant.name}`
              : `Unsuspend Organization: ${selectedTenant.name}`
          }
          description={
            confirmAction === 'SUSPEND'
              ? `Suspending this organization immediately blocks all associated users from logging into the customer workspace. All active sessions will receive HTTP 403 Forbidden.`
              : `Unsuspending this organization restores customer workspace access for all associated users.`
          }
          confirmTextMatch={confirmAction === 'SUSPEND' ? selectedTenant.name : undefined}
          reasonRequired={true}
          reasonPlaceholder="Specify justification for the immutable audit ledger..."
          confirmLabel={confirmAction === 'SUSPEND' ? 'Suspend Organization' : 'Restore Access'}
          variant={confirmAction === 'SUSPEND' ? 'danger' : 'warning'}
          isLoading={dialogLoading}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setSelectedTenant(null);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
}
