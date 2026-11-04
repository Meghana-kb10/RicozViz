'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  apiAdminListAuditLogs,
  apiAdminVerifyAuditChain,
  type AdminAuditLogEntry,
  type AdminAuditVerifyResponse
} from '@repo/api';
import { downloadAuditCsv } from '../../../lib/csv-exporter';
import { StatusBadge, DataTable, useToast } from '@repo/components';
import {
  ScrollText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ShieldAlert,
  Hash,
  RotateCw,
  CheckCircle2,
  XCircle,
  Calendar,
  Lock
} from 'lucide-react';

export default function AdminAuditPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  // Verification Modal State
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<AdminAuditVerifyResponse | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiAdminListAuditLogs({
        search: search.trim() || undefined,
        action: actionFilter.trim() || undefined,
        resourceType: resourceFilter.trim() || undefined,
        tenantId: tenantFilter.trim() || undefined,
        limit,
        offset
      });
      setLogs(res.logs || (res as any).data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to fetch audit ledger' });
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, resourceFilter, tenantFilter, offset, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = () => {
    if (logs.length === 0) {
      showToast({ type: 'warning', message: 'No records available to export.' });
      return;
    }

    downloadAuditCsv(
      logs.map((l) => ({
        sequenceNumber: l.sequenceNumber,
        timestamp: l.createdAt,
        tenantId: l.organizationId,
        actorUserId: l.userId,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        ipAddress: l.ipAddress,
        status: 'VERIFIED',
        details: l.metadata
      }))
    );

    showToast({ type: 'success', message: `Exported ${logs.length} audit records to CSV.` });
  };

  const handleVerifyChain = async (tenantId?: string) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await apiAdminVerifyAuditChain(tenantId);
      setVerifyResult(result);
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              Global Cryptographic Audit Trail
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Write-Once-Read-Many cryptographic SHA-256 hash-chained compliance ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 hover:text-white bg-[#141414] hover:bg-[#1f1f1f] border border-[#2b2b2b] rounded-lg transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsVerifyModalOpen(true);
              handleVerifyChain();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-semibold text-white bg-[#ff6b35] hover:bg-[#ff7d4d] rounded-lg transition shadow-md shadow-[#ff6b35]/20 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Hash Chain</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, resource, or actor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#121212] border border-[#262626] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] transition"
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Filter by Tenant ID..."
            value={tenantFilter}
            onChange={(e) => {
              setTenantFilter(e.target.value);
              setOffset(0);
            }}
            className="w-full px-3 py-2 text-xs bg-[#121212] border border-[#262626] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] transition"
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Filter by Action (e.g. UPDATE)..."
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
            className="w-full px-3 py-2 text-xs bg-[#121212] border border-[#262626] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] transition"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <DataTable
        columns={[
          {
            key: 'sequenceNumber',
            header: 'Seq #',
            className: 'w-24',
            render: (entry) => (
              <span className="font-mono text-xs font-semibold text-[#ff6b35]">
                #{entry.sequenceNumber}
              </span>
            )
          },
          {
            key: 'action',
            header: 'Action / Justification',
            render: (entry) => (
              <div className="space-y-1">
                <span className="px-2 py-0.5 text-[10px] font-mono bg-[#1c1c1c] border border-[#2c2c2c] rounded text-white font-medium">
                  {entry.action}
                </span>
                {typeof entry.metadata?.reason === 'string' && (
                  <p className="text-[11px] text-gray-300 italic max-w-[260px] truncate" title={entry.metadata.reason}>
                    {entry.metadata.reason}
                  </p>
                )}
              </div>
            )
          },
          {
            key: 'resourceType',
            header: 'Resource',
            render: (entry) => (
              <span className="font-mono text-[11px] text-gray-300">
                {entry.resourceType}
                {entry.resourceId && (
                  <span className="text-gray-500 text-[10px] block truncate max-w-[120px]">
                    id: {entry.resourceId}
                  </span>
                )}
              </span>
            )
          },
          {
            key: 'organizationId',
            header: 'Tenant',
            render: (entry) => (
              <span className="font-mono text-[11px] text-gray-400">
                {entry.organizationId || 'GLOBAL'}
              </span>
            )
          },
          {
            key: 'userId',
            header: 'Actor',
            render: (entry) => (
              <span className="font-mono text-[11px] text-gray-400 truncate max-w-[120px] block">
                {entry.userId || 'SYSTEM'}
              </span>
            )
          },
          {
            key: 'hashes',
            header: 'Chain Hash (SHA-256)',
            render: (entry) => (
              <div className="font-mono text-[9px] text-gray-500 space-y-0.5">
                <div className="truncate max-w-[140px]" title={`Current: ${entry.currentHash || ''}`}>
                  c: {entry.currentHash ? `${entry.currentHash.substring(0, 14)}...` : '—'}
                </div>
                <div className="truncate max-w-[140px]" title={`Previous: ${entry.previousHash || ''}`}>
                  p: {entry.previousHash ? `${entry.previousHash.substring(0, 14)}...` : '—'}
                </div>
              </div>
            )
          },
          {
            key: 'createdAt',
            header: 'Timestamp',
            render: (entry) => (
              <span className="font-mono text-[11px] text-gray-400">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            )
          }
        ]}
        data={logs}
        keyExtractor={(entry) => entry.id || String(entry.sequenceNumber)}
        emptyMessage="No audit records match the specified query."
        isLoading={loading}
      />

      {/* Chain Verification Modal */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#ff6b35]" />
                <h3 className="text-sm font-bold text-white font-mono">
                  Cryptographic Chain Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(false)}
                className="text-gray-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            {verifying ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-gray-400">
                  Verifying SHA-256 block hash pointers across ledger...
                </span>
              </div>
            ) : verifyResult ? (
              <div className="space-y-4">
                {verifyResult.valid ? (
                  <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-start gap-3 text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-xs font-mono block">
                        CHAIN INTEGRITY CONFIRMED
                      </span>
                      <p className="text-xs text-emerald-300">
                        All {verifyResult.totalChecked.toLocaleString()} blocks verified sequentially.
                        Hash continuity is unbroken. No tampering detected.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-xs font-mono block">
                        INTEGRITY COMPROMISED
                      </span>
                      <p className="text-xs text-red-300">
                        {verifyResult.reason || 'Cryptographic hash mismatch discovered.'}
                      </p>
                      {verifyResult.brokenAtId && (
                        <div className="text-[11px] font-mono text-red-400 pt-1">
                          First altered record ID: {verifyResult.brokenAtId}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-[#0d0d0d] border border-[#222] rounded-xl text-xs font-mono space-y-1.5 text-gray-400">
                  <div className="flex justify-between">
                    <span>Algorithm:</span>
                    <span className="text-white">HMAC SHA-256 (WORM Ledger)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Blocks Inspected:</span>
                    <span className="text-white">{verifyResult.totalChecked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={verifyResult.valid ? 'text-emerald-400' : 'text-red-400'}>
                      {verifyResult.valid ? 'VERIFIED' : 'FAILED'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#222]">
              <button
                type="button"
                onClick={() => handleVerifyChain()}
                disabled={verifying}
                className="px-4 py-2 text-xs font-mono font-medium bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] text-gray-200 rounded-xl transition cursor-pointer"
              >
                Re-verify Global
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
