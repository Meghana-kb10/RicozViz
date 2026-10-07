"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  User,
  Activity,
  Download,
  Eye,
  X,
  Clock,
  Layers,
} from "lucide-react";
import {
  apiQueryAuditLogs,
  apiGetAuditLogStats,
  type AuditLogItem,
  type AuditLogStatsResponse,
} from "../../lib/api";
import { downloadCsv } from "../../lib/export-csv";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<AuditLogStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  // Inspector modal
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    loadAuditData();
  }, [actionFilter, resourceFilter, statusFilter, startDate, endDate, limit, page]);

  async function loadAuditData() {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * limit;

      const [res, statsRes] = await Promise.all([
        apiQueryAuditLogs({
          search: search.trim() || undefined,
          action: actionFilter || undefined,
          resourceType: resourceFilter || undefined,
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit,
          offset,
        }),
        apiGetAuditLogStats().catch(() => null),
      ]);

      setLogs(res.logs || []);
      setTotal(res.total || 0);
      if (statsRes) setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadAuditData();
  }

  function handleExportCsv() {
    if (logs.length === 0) return;
    const columns = ["Timestamp", "Action", "ResourceType", "ResourceId", "Status", "User", "Workspace"];
    const rows = logs.map((l) => [
      `"${l.createdAt}"`,
      `"${l.action}"`,
      `"${l.resourceType}"`,
      `"${l.resourceId || ""}"`,
      `"${l.status}"`,
      `"${l.user?.name || l.user?.email || l.userId}"`,
      `"${l.workspace?.name || ""}"`,
    ]);
    const csvContent = [columns.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link
                href="/workspace"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Back to Workspace"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <FileText className="w-8 h-8 text-amber-400" />
                Audit Logs & Governance
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Immutable, append-only governance trail of security, authentication, and data modifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={loadAuditData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-medium rounded-lg text-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">TOTAL AUDIT EVENTS</span>
              <div className="text-3xl font-extrabold text-white">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Immutable governance records</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">SUCCESSFUL OPERATIONS</span>
              <div className="text-3xl font-extrabold text-emerald-400">
                {stats.successCount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">Authorized actions executed</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">BLOCKED / FAILED ATTEMPTS</span>
              <div className="text-3xl font-extrabold text-rose-400">
                {stats.failureCount.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">Denied or failed actions</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">SENSITIVE CREDENTIALS REDACTED</span>
              <div className="text-3xl font-extrabold text-indigo-400">100%</div>
              <div className="text-xs text-slate-500">Passwords & tokens never stored</div>
            </div>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by action, resource type, user email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-xs transition-colors"
            >
              Search
            </button>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* Action filter */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="USER_REGISTER">USER_REGISTER</option>
              <option value="USER_LOGOUT">USER_LOGOUT</option>
              <option value="DATASET_CREATED">DATASET_CREATED</option>
              <option value="DATASET_UPDATED">DATASET_UPDATED</option>
              <option value="DATASET_DELETED">DATASET_DELETED</option>
              <option value="DATASET_RLS_RULE_CREATED">DATASET_RLS_RULE_CREATED</option>
              <option value="DATASET_RLS_RULE_UPDATED">DATASET_RLS_RULE_UPDATED</option>
              <option value="DATASET_RLS_RULE_DELETED">DATASET_RLS_RULE_DELETED</option>
              <option value="DASHBOARD_CREATED">DASHBOARD_CREATED</option>
              <option value="DASHBOARD_UPDATED">DASHBOARD_UPDATED</option>
              <option value="DASHBOARD_DELETED">DASHBOARD_DELETED</option>
              <option value="DASHBOARD_VERSION_CREATED">DASHBOARD_VERSION_CREATED</option>
              <option value="DASHBOARD_VERSION_RESTORED">DASHBOARD_VERSION_RESTORED</option>
              <option value="WORKSPACE_MEMBER_ROLE_UPDATED">WORKSPACE_MEMBER_ROLE_UPDATED</option>
              <option value="METRIC_CREATED">METRIC_CREATED</option>
              <option value="ALERT_CREATED">ALERT_CREATED</option>
              <option value="DATA_EXPORTED">DATA_EXPORTED</option>
              <option value="TEMPLATE_APPLIED">TEMPLATE_APPLIED</option>
            </select>

            {/* Resource filter */}
            <select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Resource Types</option>
              <option value="User">User</option>
              <option value="Dataset">Dataset</option>
              <option value="Dashboard">Dashboard</option>
              <option value="DashboardVersion">DashboardVersion</option>
              <option value="RowLevelSecurityRule">RowLevelSecurityRule</option>
              <option value="WORKSPACE">WORKSPACE</option>
              <option value="DataSource">DataSource</option>
              <option value="Metric">Metric</option>
              <option value="Alert">Alert</option>
              <option value="DashboardTemplate">DashboardTemplate</option>
            </select>


            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
              <option value="WARNING">WARNING</option>
            </select>

            {/* Limit selector */}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value={20}>20 records per page</option>
              <option value={50}>50 records per page</option>
              <option value={100}>100 records per page</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Loading audit events...</div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">No audit logs matching this query.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-300">{log.resourceType}</div>
                        {log.resourceId && (
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]" title={log.resourceId}>
                            {log.resourceId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.user ? (
                          <div>
                            <div className="font-medium text-slate-200">{log.user.name}</div>
                            <div className="text-[10px] text-slate-500">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-500">{log.userId}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.workspace?.name || "Global / Org"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Inspect Metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, total)} of {total.toLocaleString()} records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Inspector Modal */}
        {inspectLog && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-500/20 text-amber-300">
                    {inspectLog.action}
                  </span>
                  <span className="text-xs text-slate-400">Audit Detail</span>
                </div>
                <button
                  onClick={() => setInspectLog(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Record ID:</span>
                    <p className="font-mono text-slate-300 mt-0.5">{inspectLog.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Timestamp:</span>
                    <p className="text-slate-300 mt-0.5">{new Date(inspectLog.createdAt).toISOString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Resource:</span>
                    <p className="text-slate-300 mt-0.5">{inspectLog.resourceType} ({inspectLog.resourceId || "N/A"})</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Operator:</span>
                    <p className="text-slate-300 mt-0.5">{inspectLog.user?.name || inspectLog.userId}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 font-semibold">Event Context Metadata (Sanitized):</span>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-60">
                    {JSON.stringify(inspectLog.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={() => setInspectLog(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
