'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  apiAdminGetTenant,
  apiAdminSuspendTenant,
  apiAdminUnsuspendTenant,
  apiAdminUpdateTenantPlan,
  type AdminTenantItem
} from '@repo/api';
import { StatusBadge, ConfirmDialog, useToast } from '@repo/components';
import {
  Building2,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Users,
  Layers,
  Database,
  BarChart3,
  Calendar,
  Check
} from 'lucide-react';

export default function AdminTenantDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const tenantId = resolvedParams.id;
  const router = useRouter();
  const { showToast } = useToast();

  const [tenant, setTenant] = useState<AdminTenantItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suspend/Unsuspend confirm dialog
  const [isSuspendDialogOpen, setIsSuspendDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Plan modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('STARTER');
  const [planUpdating, setPlanUpdating] = useState(false);

  const fetchTenant = async () => {
    try {
      setError(null);
      const data = await apiAdminGetTenant(tenantId);
      setTenant(data);
      setSelectedPlan(data.plan);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch organization details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [tenantId]);

  const handleToggleSuspend = async (reason: string) => {
    if (!tenant) return;
    setDialogLoading(true);
    try {
      if (tenant.status === 'ACTIVE') {
        await apiAdminSuspendTenant(tenant.id, { reason });
        showToast({
          type: 'warning',
          title: 'Organization Suspended',
          message: `${tenant.name} has been suspended. Users cannot log in.`
        });
      } else {
        await apiAdminUnsuspendTenant(tenant.id, { reason: reason || 'Restored by platform operator' });
        showToast({
          type: 'success',
          title: 'Organization Reinstated',
          message: `${tenant.name} is now active.`
        });
      }
      setIsSuspendDialogOpen(false);
      fetchTenant();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Operation failed' });
    } finally {
      setDialogLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!tenant) return;
    setPlanUpdating(true);
    try {
      await apiAdminUpdateTenantPlan(tenant.id, {
        plan: selectedPlan as 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE'
      });
      showToast({
        type: 'success',
        title: 'Plan Updated',
        message: `${tenant.name} subscription changed to ${selectedPlan}.`
      });
      setIsPlanModalOpen(false);
      fetchTenant();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to update plan' });
    } finally {
      setPlanUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-gray-400">Loading organization details...</span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-4">
        <Link href="/tenants" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organizations</span>
        </Link>
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs">
          {error || 'Organization not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/tenants"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organizations</span>
        </Link>
      </div>

      {/* Header Profile */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1c1c] border border-[#2c2c2c] flex items-center justify-center text-[#ff6b35]">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white font-mono">{tenant.name}</h1>
              <StatusBadge
                status={tenant.status === 'ACTIVE' ? 'ok' : 'failed'}
                label={tenant.status}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-mono">
              <span>slug: {tenant.slug}</span>
              <span>•</span>
              <span>ID: {tenant.id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-500" />
                Created: {new Date(tenant.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsPlanModalOpen(true)}
            className="px-3.5 py-2 text-xs font-mono font-medium text-gray-200 bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#ff6b35]" />
            <span>Plan: {tenant.plan}</span>
          </button>

          {tenant.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => setIsSuspendDialogOpen(true)}
              className="px-3.5 py-2 text-xs font-mono font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-800/50 rounded-xl transition cursor-pointer"
            >
              Suspend Organization
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSuspendDialogOpen(true)}
              className="px-3.5 py-2 text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 rounded-xl transition cursor-pointer"
            >
              Unsuspend Organization
            </button>
          )}
        </div>
      </div>

      {/* Usage Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-[#141414] border border-[#242424] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs uppercase font-mono tracking-wider">Members</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{tenant.memberCount ?? 0}</div>
        </div>

        <div className="p-4 bg-[#141414] border border-[#242424] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs uppercase font-mono tracking-wider">Workspaces</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{tenant.workspaceCount ?? 0}</div>
        </div>

        <div className="p-4 bg-[#141414] border border-[#242424] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs uppercase font-mono tracking-wider">Datasets</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{tenant.datasetCount ?? 0}</div>
        </div>

        <div className="p-4 bg-[#141414] border border-[#242424] rounded-xl space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs uppercase font-mono tracking-wider">Dashboards</span>
            <BarChart3 className="w-4 h-4 text-[#ff6b35]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{tenant.dashboardCount ?? 0}</div>
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSuspendDialogOpen}
        title={
          tenant.status === 'ACTIVE'
            ? `Suspend Organization: ${tenant.name}`
            : `Unsuspend Organization: ${tenant.name}`
        }
        description={
          tenant.status === 'ACTIVE'
            ? `Suspending this organization immediately blocks all associated users from logging into the customer web app. Requires typing the organization name to confirm.`
            : `Reinstates this organization. Customer access will be immediately restored.`
        }
        confirmTextMatch={tenant.status === 'ACTIVE' ? tenant.name : undefined}
        reasonRequired={true}
        reasonPlaceholder="Mandatory audit explanation for ledger..."
        confirmLabel={tenant.status === 'ACTIVE' ? 'Suspend Organization' : 'Restore Access'}
        variant={tenant.status === 'ACTIVE' ? 'danger' : 'warning'}
        isLoading={dialogLoading}
        onConfirm={handleToggleSuspend}
        onCancel={() => setIsSuspendDialogOpen(false)}
      />

      {/* Plan Switcher Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white font-mono">Change Subscription Tier</h3>
              <p className="text-xs text-gray-400 mt-1">
                Select the platform tier for <span className="text-white font-semibold">{tenant.name}</span>.
              </p>
            </div>

            <div className="space-y-2">
              {(['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const).map((planOption) => (
                <label
                  key={planOption}
                  onClick={() => setSelectedPlan(planOption)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono cursor-pointer transition ${
                    selectedPlan === planOption
                      ? 'border-[#ff6b35] bg-[#ff6b35]/10 text-white font-semibold'
                      : 'border-[#222] bg-[#0f0f0f] text-gray-300 hover:border-[#333]'
                  }`}
                >
                  <span className="tracking-wide">{planOption}</span>
                  {selectedPlan === planOption && <Check className="w-4 h-4 text-[#ff6b35]" />}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={planUpdating || selectedPlan === tenant.plan}
                className="px-4 py-2 text-xs font-semibold bg-[#ff6b35] hover:bg-[#ff7d4d] text-white rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {planUpdating ? 'Updating Plan...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
