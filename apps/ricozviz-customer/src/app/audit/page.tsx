"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
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
  Sparkles,
} from "lucide-react";
import { AppShell } from "../../components/shell/AppShell";
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
      const [queryRes, statsRes] = await Promise.all([
        apiQueryAuditLogs({
          limit,
          offset,
          action: actionFilter || undefined,
          resourceType: resourceFilter || undefined,
          status: statusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined,
        }),
        apiGetAuditLogStats(),
      ]);
      setLogs(queryRes.logs || []);
      setTotal(queryRes.total);
      setStats(statsRes);
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
    if (!logs.length) return;
    const headers = ["ID", "Timestamp", "Action", "Resource Type", "Resource ID", "User ID", "User Name", "Status", "IP Address"];
    const rows = logs.map((log) => [
      log.id,
      new Date(log.createdAt).toISOString(),
      log.action,
      log.resourceType,
      log.resourceId || "",
      log.userId || "",
      log.user?.name || "",
      log.status,
      log.ipAddress || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    downloadCsv(`audit_logs_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <AppShell
      title="Audit Logs & Governance"
      subtitle="Immutable, append-only governance trail of security, authentication, and data modifications."
      breadcrumbs={[
        { label: "Governance", href: "/workspace" },
        { label: "Audit Logs" },
      ]}
      actions={
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#141414] hover:bg-[#202020] text-xs font-mono-code text-[#fafafa] disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={loadAuditData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] hover:bg-[#222222] text-xs font-mono-code text-[#fafafa] transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#ff6b35]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-mono-code text-red-300 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Stats Row */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-1">
                  <span className="text-xs text-[#898989] font-mono-code">TOTAL AUDIT EVENTS</span>
                  <div className="text-2xl font-bold font-mono-code text-[#fafafa]">{stats.total.toLocaleString()}</div>
                  <div className="text-[11px] text-[#666666] font-mono-code">Immutable governance records</div>
                </div>

                <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-1">
                  <span className="text-xs text-[#898989] font-mono-code">SUCCESSFUL OPERATIONS</span>
                  <div className="text-2xl font-bold font-mono-code text-emerald-400">
                    {stats.successCount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#666666] font-mono-code">Authorized actions executed</div>
                </div>

                <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-1">
                  <span className="text-xs text-[#898989] font-mono-code">BLOCKED / FAILED ATTEMPTS</span>
                  <div className="text-2xl font-bold font-mono-code text-rose-400">
                    {stats.failureCount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#666666] font-mono-code">Denied or failed actions</div>
                </div>

                <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-1">
                  <span className="text-xs text-[#898989] font-mono-code">CREDENTIALS REDACTED</span>
                  <div className="text-2xl font-bold font-mono-code text-[#ff6b35]">100%</div>
                  <div className="text-[11px] text-[#666666] font-mono-code">Passwords & tokens never stored</div>
                </div>
              </div>
            )}

            {/* Filters and Search Bar */}
            <div className="p-4 rounded-xl border border-[#242424] bg-[#141414] space-y-3">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#898989] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by action, resource type, user email or name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#181818] border border-[#2e2e2e] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#ff6b35] hover:bg-[#c2410c] text-white font-semibold rounded-lg text-xs font-mono-code transition cursor-pointer"
                >
                  Search
                </button>
              </form>

              {/* Filter Selects */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#242424]">
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#181818] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                >
                  <option value="">All Actions</option>
                  <option value="USER_LOGIN">USER_LOGIN</option>
                  <option value="USER_REGISTER">USER_REGISTER</option>
                  <option value="USER_LOGOUT">USER_LOGOUT</option>
                  <option value="CREATE_DASHBOARD">CREATE_DASHBOARD</option>
                  <option value="UPDATE_DASHBOARD">UPDATE_DASHBOARD</option>
                  <option value="DELETE_DASHBOARD">DELETE_DASHBOARD</option>
                  <option value="CREATE_DATASET">CREATE_DATASET</option>
                  <option value="UPLOAD_DATASET">UPLOAD_DATASET</option>
                  <option value="CREATE_WORKSPACE">CREATE_WORKSPACE</option>
                  <option value="TEST_DATASOURCE">TEST_DATASOURCE</option>
                  <option value="ACCESS_DENIED">ACCESS_DENIED</option>
                </select>

                <select
                  value={resourceFilter}
                  onChange={(e) => {
                    setResourceFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#181818] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                >
                  <option value="">All Resources</option>
                  <option value="AUTH">AUTH</option>
                  <option value="WORKSPACE">WORKSPACE</option>
                  <option value="DASHBOARD">DASHBOARD</option>
                  <option value="DATASET">DATASET</option>
                  <option value="DATASOURCE">DATASOURCE</option>
                  <option value="VISUALIZATION">VISUALIZATION</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#181818] border border-[#2e2e2e] rounded-lg px-2.5 py-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                >
                  <option value="">All Statuses</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="FAILURE">Failure Only</option>
                </select>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#181818] border border-[#2e2e2e] rounded-lg px-2 py-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  title="Filter from date"
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[#181818] border border-[#2e2e2e] rounded-lg px-2 py-1 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none font-mono-code"
                  title="Filter to date"
                />

                {(actionFilter || resourceFilter || statusFilter || startDate || endDate || search) && (
                  <button
                    onClick={() => {
                      setActionFilter("");
                      setResourceFilter("");
                      setStatusFilter("");
                      setStartDate("");
                      setEndDate("");
                      setSearch("");
                      setPage(1);
                    }}
                    className="px-2.5 py-1 text-xs font-mono-code text-[#ff6b35] hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Tabular Log Events Table */}
            <div className="rounded-xl border border-[#242424] bg-[#141414] overflow-hidden shadow-xl">
              {loading && logs.length === 0 ? (
                <div className="p-16 text-center text-xs font-mono-code text-[#898989]">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent mb-3" />
                  <p>Querying immutable audit database...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="p-16 text-center text-xs font-mono-code text-[#898989]">
                  No audit logs match the specified filter query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono-code">
                    <thead>
                      <tr className="bg-[#181818] border-b border-[#242424] text-[#898989] uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Action</th>
                        <th className="py-3 px-4 font-semibold">Resource</th>
                        <th className="py-3 px-4 font-semibold">User</th>
                        <th className="py-3 px-4 font-semibold">Workspace</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 text-right font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#242424]">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#181818]/60 transition-colors">
                          <td className="py-3 px-4 text-[#898989] text-[11px] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#fafafa]">{log.resourceType}</div>
                            {log.resourceId && (
                              <div className="text-[10px] text-[#666666] truncate max-w-[140px]" title={log.resourceId}>
                                {log.resourceId}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#fafafa]">
                            {log.user ? (
                              <div>
                                <div className="font-medium text-[#fafafa]">{log.user.name}</div>
                                <div className="text-[10px] text-[#898989]">{log.user.email}</div>
                              </div>
                            ) : (
                              <span className="text-[#666666]">{log.userId}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#898989]">
                            {log.workspace?.name || "Global / Org"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.status === "SUCCESS"
                                  ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                                  : "bg-rose-950/60 border border-rose-500/40 text-rose-300"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setInspectLog(log)}
                              className="p-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] hover:bg-[#222222] text-[#898989] hover:text-[#fafafa] transition-colors cursor-pointer"
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
              <div className="p-3.5 border-t border-[#242424] flex items-center justify-between text-xs font-mono-code text-[#898989]">
                <div>
                  Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
                  {Math.min(page * limit, total)} of {total.toLocaleString()} records
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] hover:bg-[#202020] disabled:opacity-40 text-[#fafafa] transition cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="px-3 py-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] hover:bg-[#202020] disabled:opacity-40 text-[#fafafa] transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Metadata Inspector Modal */}
            {inspectLog && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-[#fafafa]">
                  <div className="flex items-center justify-between border-b border-[#242424] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono-code font-bold text-xs bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35]">
                        {inspectLog.action}
                      </span>
                      <span className="text-xs font-mono-code text-[#898989]">Audit Detail</span>
                    </div>
                    <button
                      onClick={() => setInspectLog(null)}
                      className="p-1 rounded text-[#898989] hover:text-[#fafafa] cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs font-mono-code">
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#181818] border border-[#262626]">
                      <div>
                        <span className="text-[#666666]">Record ID:</span>
                        <p className="text-[#fafafa] mt-0.5 truncate">{inspectLog.id}</p>
                      </div>
                      <div>
                        <span className="text-[#666666]">Timestamp:</span>
                        <p className="text-[#fafafa] mt-0.5">{new Date(inspectLog.createdAt).toISOString()}</p>
                      </div>
                      <div>
                        <span className="text-[#666666]">Resource:</span>
                        <p className="text-[#fafafa] mt-0.5">{inspectLog.resourceType} ({inspectLog.resourceId || "N/A"})</p>
                      </div>
                      <div>
                        <span className="text-[#666666]">Operator:</span>
                        <p className="text-[#fafafa] mt-0.5">{inspectLog.user?.name || inspectLog.userId}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#898989] font-semibold">Event Context Metadata (Sanitized):</span>
                      <pre className="p-3 rounded-xl bg-[#121212] border border-[#242424] text-[#fafafa] text-[11px] overflow-x-auto max-h-60">
                        {JSON.stringify(inspectLog.metadata || {}, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-[#242424]">
                    <button
                      onClick={() => setInspectLog(null)}
                      className="px-4 py-2 bg-[#181818] border border-[#2e2e2e] hover:bg-[#202020] text-[#fafafa] text-xs font-mono-code font-semibold rounded-lg cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
      </div>
    </AppShell>
  );
}
