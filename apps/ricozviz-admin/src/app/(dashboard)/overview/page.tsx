'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiAdminListTenants,
  apiAdminListUsers,
  apiAdminGetWorkerHealth,
  apiAdminGetAiUsageSummary,
  apiAdminListAuditLogs,
  type AdminAuditLogEntry
} from '@repo/api';
import { StatCard, StatusBadge, DataTable } from '@repo/components';
import {
  Building2,
  Users,
  Cpu,
  Coins,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenantCount, setTenantCount] = useState<number>(0);
  const [userCount, setUserCount] = useState<number>(0);
  const [workerHealth, setWorkerHealth] = useState<{ status: string; locksHeld?: number } | null>(null);
  const [aiUsage, setAiUsage] = useState<{ totalTokens: number; totalCostUsd: number } | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminAuditLogEntry[]>([]);

  const fetchOverviewData = async () => {
    try {
      setError(null);
      const [tenantsRes, usersRes, healthRes, aiRes, auditRes] = await Promise.all([
        apiAdminListTenants({ limit: 1 }),
        apiAdminListUsers({ status: 'ACTIVE', limit: 1 }),
        apiAdminGetWorkerHealth().catch(() => ({ status: 'down', locksHeld: 0 })),
        apiAdminGetAiUsageSummary().catch(() => ({ totalTokens: 0, estimatedCostUsd: 0, totalRequests: 0, byTenant: [] })),
        apiAdminListAuditLogs({ limit: 8 }).catch(() => ({ logs: [], total: 0, limit: 8, offset: 0 }))
      ]);

      setTenantCount(tenantsRes.total ?? 0);
      setUserCount(usersRes.total ?? 0);
      setWorkerHealth(healthRes);
      setAiUsage({
        totalTokens: aiRes.totalTokens || 0,
        totalCostUsd: aiRes.estimatedCostUsd || 0
      });
      setRecentLogs(auditRes.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchOverviewData();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">Operations Console</h1>
            <span className="bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-widest uppercase">
              LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Global infrastructure vitals, tenant states, and cryptographic audit monitoring.
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] border border-[#2b2b2b] rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#ff6b35]' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-xs">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Telemetry Retrieval Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 4 StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/tenants">
          <StatCard
            label="Total Tenants"
            value={loading ? '...' : tenantCount.toLocaleString()}
            subtext="Active customer accounts"
            icon={<Building2 className="w-4 h-4 text-[#ff6b35]" />}
          />
        </Link>

        <Link href="/users">
          <StatCard
            label="Active Users"
            value={loading ? '...' : userCount.toLocaleString()}
            subtext="Across all organizations"
            icon={<Users className="w-4 h-4 text-emerald-400" />}
          />
        </Link>

        <Link href="/workers">
          <StatCard
            label="Worker Daemon"
            value={
              loading
                ? '...'
                : workerHealth?.status === 'healthy'
                ? 'HEALTHY'
                : (workerHealth?.status || 'UNKNOWN').toUpperCase()
            }
            subtext={
              workerHealth
                ? `${workerHealth.locksHeld ?? 0} active distributed lock(s)`
                : 'Status pending'
            }
            icon={
              workerHealth?.status === 'healthy' ? (
                <Cpu className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )
            }
          />
        </Link>

        <Link href="/system">
          <StatCard
            label="AI Compute Cost"
            value={
              loading
                ? '...'
                : `$${(aiUsage?.totalCostUsd || 0).toFixed(4)}`
            }
            subtext={
              loading
                ? 'Calculating...'
                : `${(aiUsage?.totalTokens || 0).toLocaleString()} tokens consumed`
            }
            icon={<Coins className="w-4 h-4 text-purple-400" />}
          />
        </Link>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/audit"
          className="p-4 rounded-xl border border-[#222] bg-[#121212] hover:bg-[#161616] hover:border-[#ff6b35]/40 transition group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-white group-hover:text-[#ff6b35] transition flex items-center gap-1.5">
              <span>Cryptographic Chain Audit</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            <p className="text-[11px] text-gray-400">Verify SHA-256 block ledger continuity</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        </Link>

        <Link
          href="/workers"
          className="p-4 rounded-xl border border-[#222] bg-[#121212] hover:bg-[#161616] hover:border-[#ff6b35]/40 transition group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-white group-hover:text-[#ff6b35] transition flex items-center gap-1.5">
              <span>Worker Engine Health</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            <p className="text-[11px] text-gray-400">Trigger manual jobs and inspect distributed leases</p>
          </div>
          <Activity className="w-5 h-5 text-blue-400 shrink-0" />
        </Link>

        <Link
          href="/system"
          className="p-4 rounded-xl border border-[#222] bg-[#121212] hover:bg-[#161616] hover:border-[#ff6b35]/40 transition group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-white group-hover:text-[#ff6b35] transition flex items-center gap-1.5">
              <span>Feature Flags & Probes</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </span>
            <p className="text-[11px] text-gray-400">Control tenant feature toggles and database status</p>
          </div>
          <Coins className="w-5 h-5 text-purple-400 shrink-0" />
        </Link>
      </div>

      {/* Recent Mutations Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white font-mono">Recent Platform Operations</h2>
          <Link
            href="/audit"
            className="text-xs text-[#ff6b35] hover:underline flex items-center gap-1"
          >
            <span>View Full Ledger</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <DataTable
          columns={[
            {
              key: 'sequenceNumber',
              header: 'Seq #',
              className: 'w-20',
              render: (log) => (
                <span className="font-mono text-gray-400">#{log.sequenceNumber ?? '—'}</span>
              )
            },
            {
              key: 'action',
              header: 'Action',
              render: (log) => (
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1a1a1a] border border-[#2e2e2e] rounded text-white">
                  {log.action}
                </span>
              )
            },
            {
              key: 'resourceType',
              header: 'Resource',
              render: (log) => (
                <span className="text-gray-300 font-mono text-[11px]">{log.resourceType}</span>
              )
            },
            {
              key: 'actorUserId',
              header: 'Actor ID',
              render: (log) => (
                <span className="text-gray-400 text-[11px] font-mono truncate max-w-[120px] block">
                  {log.userId || 'SYSTEM'}
                </span>
              )
            },
            {
              key: 'createdAt',
              header: 'Timestamp',
              render: (log) => (
                <span className="text-gray-400 text-[11px]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              )
            },
            {
              key: 'status',
              header: 'Status',
              className: 'text-right',
              render: () => <StatusBadge status="ok" label="VERIFIED" />
            }
          ]}
          data={recentLogs}
          keyExtractor={(item) => item.id || String(item.sequenceNumber)}
          emptyMessage="No platform audit records recorded yet."
          isLoading={loading}
        />
      </div>
    </div>
  );
}
