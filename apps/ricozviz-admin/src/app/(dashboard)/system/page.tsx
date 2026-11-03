'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  apiAdminGetSystemHealth,
  apiAdminGetAiUsageSummary,
  apiAdminListFeatureFlags,
  apiAdminUpsertFeatureFlag,
  apiAdminDeleteFeatureFlag,
  type AdminSystemHealth,
  type AdminAiUsageSummary,
  type AdminFeatureFlag
} from '@repo/api';
import { StatusBadge, DataTable, ConfirmDialog, useToast } from '@repo/components';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  Activity,
  Database,
  Cpu,
  Coins,
  Flag,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Server,
  Layers
} from 'lucide-react';

export default function AdminSystemPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [aiUsage, setAiUsage] = useState<AdminAiUsageSummary | null>(null);
  const [flags, setFlags] = useState<AdminFeatureFlag[]>([]);

  // Feature Flag Modal State
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [editingFlagKey, setEditingFlagKey] = useState<string | null>(null);
  const [flagKey, setFlagKey] = useState('');
  const [flagDescription, setFlagDescription] = useState('');
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [flagTenantOverrides, setFlagTenantOverrides] = useState<Array<{ tenantId: string; enabled: boolean }>>([]);
  const [newOverrideTenantId, setNewOverrideTenantId] = useState('');
  const [newOverrideEnabled, setNewOverrideEnabled] = useState(true);
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  // Delete Flag Dialog State
  const [flagToDelete, setFlagToDelete] = useState<string | null>(null);

  const fetchSystemData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthData, aiData, flagsData] = await Promise.all([
        apiAdminGetSystemHealth().catch(() => null),
        apiAdminGetAiUsageSummary().catch(() => null),
        apiAdminListFeatureFlags().catch(() => [])
      ]);

      setHealth(healthData);
      setAiUsage(aiData);
      setFlags(flagsData);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to fetch system data' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  const handleToggleGlobalFlag = async (flag: AdminFeatureFlag) => {
    try {
      await apiAdminUpsertFeatureFlag({
        key: flag.key,
        description: flag.description,
        enabled: !flag.enabled,
        tenantOverrides: flag.tenantOverrides
      });
      showToast({
        type: 'success',
        message: `Feature flag "${flag.key}" is now ${!flag.enabled ? 'ENABLED' : 'DISABLED'}.`
      });
      fetchSystemData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to update feature flag' });
    }
  };

  const handleSaveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagKey.trim()) return;

    setFlagSubmitting(true);
    try {
      await apiAdminUpsertFeatureFlag({
        key: flagKey.trim(),
        description: flagDescription.trim() || undefined,
        enabled: flagEnabled,
        tenantOverrides: flagTenantOverrides
      });
      showToast({
        type: 'success',
        message: `Feature flag "${flagKey}" saved successfully.`
      });
      setIsFlagModalOpen(false);
      resetFlagForm();
      fetchSystemData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to save feature flag' });
    } finally {
      setFlagSubmitting(false);
    }
  };

  const handleDeleteFlag = async () => {
    if (!flagToDelete) return;
    try {
      await apiAdminDeleteFeatureFlag(flagToDelete);
      showToast({ type: 'success', message: `Feature flag "${flagToDelete}" removed.` });
      setFlagToDelete(null);
      fetchSystemData();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to delete feature flag' });
    }
  };

  const resetFlagForm = () => {
    setEditingFlagKey(null);
    setFlagKey('');
    setFlagDescription('');
    setFlagEnabled(false);
    setFlagTenantOverrides([]);
    setNewOverrideTenantId('');
  };

  const openEditFlag = (flag: AdminFeatureFlag) => {
    setEditingFlagKey(flag.key);
    setFlagKey(flag.key);
    setFlagDescription(flag.description || '');
    setFlagEnabled(flag.enabled);
    setFlagTenantOverrides(flag.tenantOverrides || []);
    setIsFlagModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              System Health & Governance
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Subsystem probes, LLM token economics, and runtime feature toggles.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSystemData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] border border-[#2b2b2b] rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh All</span>
        </button>
      </div>

      {/* 1. Subsystem Probes */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
          Core Subsystem Vitals
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* API Server */}
          <div className="p-5 bg-[#141414] border border-[#242424] rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                API Server (Fastify)
              </span>
              <StatusBadge
                status={health?.status === 'healthy' ? 'ok' : 'failed'}
                label={health?.status || 'UNKNOWN'}
              />
            </div>
            <div className="space-y-1 text-xs font-mono text-gray-400">
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="text-white">
                  {health ? `${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Port:</span>
                <span className="text-white">4000</span>
              </div>
            </div>
          </div>

          {/* Database */}
          <div className="p-5 bg-[#141414] border border-[#242424] rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                MongoDB Primary
              </span>
              <StatusBadge
                status={health?.database.readyState === 1 ? 'ok' : 'failed'}
                label={health?.database.status || 'UNKNOWN'}
              />
            </div>
            <div className="space-y-1 text-xs font-mono text-gray-400">
              <div className="flex justify-between">
                <span>Connection State:</span>
                <span className="text-white">
                  {health?.database.readyState === 1 ? 'Connected (State 1)' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Host:</span>
                <span className="text-white">127.0.0.1:27017</span>
              </div>
            </div>
          </div>

          {/* Background Worker */}
          <div className="p-5 bg-[#141414] border border-[#242424] rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#ff6b35]" />
                Worker Daemon
              </span>
              <StatusBadge
                status={health?.worker.status === 'healthy' ? 'ok' : 'failed'}
                label={health?.worker.status || 'UNKNOWN'}
              />
            </div>
            <div className="space-y-1 text-xs font-mono text-gray-400">
              <div className="flex justify-between">
                <span>Distributed Leases:</span>
                <span className="text-white">{health?.worker.locksHeld ?? 0} active</span>
              </div>
              <div className="flex justify-between">
                <span>Worker Process:</span>
                <span className="text-white">Standalone (`worker.ts`)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AI Usage Telemetry & Chart */}
      <div className="space-y-4 pt-4 border-t border-[#222]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
              AI Compute & Token Economics
            </h2>
          </div>

          <div className="text-xs font-mono text-gray-400">
            Estimated Spend:{' '}
            <span className="text-emerald-400 font-bold">
              ${(aiUsage?.estimatedCostUsd || 0).toFixed(4)} USD
            </span>
          </div>
        </div>

        {/* AI Usage Chart */}
        {aiUsage && aiUsage.byTenant && aiUsage.byTenant.length > 0 ? (
          <div className="p-5 bg-[#141414] border border-[#242424] rounded-2xl space-y-4">
            <span className="text-xs font-mono text-gray-400 block">
              Token Consumption per Tenant Organization
            </span>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiUsage.byTenant}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="tenantId" stroke="#666" fontSize={11} tickLine={false} />
                  <YAxis stroke="#666" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161616',
                      borderColor: '#2e2e2e',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="totalTokens" fill="#ff6b35" radius={[4, 4, 0, 0]} name="Total Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl text-center text-xs font-mono text-gray-500">
            No LLM generation requests logged this cycle.
          </div>
        )}
      </div>

      {/* 3. Feature Flags Governance */}
      <div className="space-y-4 pt-4 border-t border-[#222]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-[#ff6b35]" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-400">
              Platform Feature Flags ({flags.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              resetFlagForm();
              setIsFlagModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-white bg-[#ff6b35] hover:bg-[#ff7d4d] rounded-lg transition shadow-md shadow-[#ff6b35]/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Feature Flag</span>
          </button>
        </div>

        <DataTable
          columns={[
            {
              key: 'key',
              header: 'Flag Key',
              render: (flag) => (
                <div>
                  <span className="font-mono text-xs font-semibold text-white block">
                    {flag.key}
                  </span>
                  {flag.description && (
                    <span className="text-[11px] text-gray-400 block">{flag.description}</span>
                  )}
                </div>
              )
            },
            {
              key: 'enabled',
              header: 'Global State',
              render: (flag) => (
                <button
                  type="button"
                  onClick={() => handleToggleGlobalFlag(flag)}
                  className={`px-3 py-1 text-[11px] font-mono font-semibold rounded-full border transition cursor-pointer ${
                    flag.enabled
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                      : 'bg-red-950/30 text-red-400 border-red-800/40'
                  }`}
                >
                  {flag.enabled ? 'GLOBAL ON' : 'GLOBAL OFF'}
                </button>
              )
            },
            {
              key: 'overrides',
              header: 'Tenant Overrides',
              render: (flag) => (
                <div className="text-[11px] font-mono text-gray-400">
                  {flag.tenantOverrides && flag.tenantOverrides.length > 0 ? (
                    <span className="px-2 py-0.5 bg-[#1e1e1e] border border-[#2e2e2e] rounded text-white">
                      {flag.tenantOverrides.length} override(s) configured
                    </span>
                  ) : (
                    <span className="text-gray-600">None</span>
                  )}
                </div>
              )
            },
            {
              key: 'actions',
              header: 'Actions',
              className: 'text-right',
              render: (flag) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditFlag(flag)}
                    className="px-2.5 py-1 text-[11px] font-mono text-gray-300 hover:text-white bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] rounded transition cursor-pointer"
                  >
                    Configure
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlagToDelete(flag.key)}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-[#1a1a1a] transition cursor-pointer"
                    title="Delete feature flag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            }
          ]}
          data={flags}
          keyExtractor={(flag) => flag.id || flag.key}
          emptyMessage="No feature flags configured."
          isLoading={loading}
        />
      </div>

      {/* Flag Create/Edit Modal */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <h3 className="text-sm font-bold text-white font-mono">
                {editingFlagKey ? `Configure Flag: ${editingFlagKey}` : 'Create Platform Feature Flag'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFlagModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveFlag} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="flag-key">
                  Flag Key Identifier (snake_case or kebab-case)
                </label>
                <input
                  id="flag-key"
                  type="text"
                  required
                  disabled={!!editingFlagKey}
                  placeholder="e.g. enable_realtime_collaboration"
                  value={flagKey}
                  onChange={(e) => setFlagKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="flag-desc">
                  Description
                </label>
                <input
                  id="flag-desc"
                  type="text"
                  placeholder="Describes feature functionality..."
                  value={flagDescription}
                  onChange={(e) => setFlagDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#0d0d0d] border border-[#222] rounded-xl">
                <input
                  id="global-enabled"
                  type="checkbox"
                  checked={flagEnabled}
                  onChange={(e) => setFlagEnabled(e.target.checked)}
                  className="rounded border-gray-600 text-[#ff6b35] focus:ring-[#ff6b35]"
                />
                <label htmlFor="global-enabled" className="text-xs font-medium text-gray-200 cursor-pointer">
                  Default Global State: {flagEnabled ? 'Enabled for all tenants' : 'Disabled for all tenants'}
                </label>
              </div>

              {/* Per-tenant overrides */}
              <div className="space-y-2 pt-2 border-t border-[#222]">
                <span className="text-xs font-mono font-semibold text-gray-400 block">
                  Tenant-Specific Overrides
                </span>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tenant ID..."
                    value={newOverrideTenantId}
                    onChange={(e) => setNewOverrideTenantId(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-lg text-white"
                  />
                  <select
                    value={newOverrideEnabled ? 'true' : 'false'}
                    onChange={(e) => setNewOverrideEnabled(e.target.value === 'true')}
                    className="px-2 py-1.5 text-xs font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-lg text-gray-200"
                  >
                    <option value="true">Force ON</option>
                    <option value="false">Force OFF</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newOverrideTenantId.trim()) return;
                      setFlagTenantOverrides([
                        ...flagTenantOverrides.filter((o) => o.tenantId !== newOverrideTenantId.trim()),
                        { tenantId: newOverrideTenantId.trim(), enabled: newOverrideEnabled }
                      ]);
                      setNewOverrideTenantId('');
                    }}
                    className="px-3 py-1.5 text-xs font-mono bg-[#222] hover:bg-[#333] text-white rounded-lg transition"
                  >
                    Add
                  </button>
                </div>

                {flagTenantOverrides.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2">
                    {flagTenantOverrides.map((override) => (
                      <div
                        key={override.tenantId}
                        className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#1e1e1e] rounded text-xs font-mono"
                      >
                        <span className="text-gray-300">Tenant: {override.tenantId}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={override.enabled ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}
                          >
                            {override.enabled ? 'FORCED ON' : 'FORCED OFF'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFlagTenantOverrides(
                                flagTenantOverrides.filter((o) => o.tenantId !== override.tenantId)
                              )
                            }
                            className="text-gray-500 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#222]">
                <button
                  type="button"
                  onClick={() => setIsFlagModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={flagSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#ff6b35] hover:bg-[#ff7d4d] text-white rounded-xl transition"
                >
                  {flagSubmitting ? 'Saving...' : 'Save Feature Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {flagToDelete && (
        <ConfirmDialog
          isOpen={true}
          title={`Delete Feature Flag: ${flagToDelete}`}
          description={`Removing this feature flag deletes all global defaults and tenant override rules.`}
          confirmLabel="Delete Flag"
          variant="danger"
          onConfirm={handleDeleteFlag}
          onCancel={() => setFlagToDelete(null)}
        />
      )}
    </div>
  );
}
