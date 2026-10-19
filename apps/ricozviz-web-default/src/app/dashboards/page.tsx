"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import {
  apiListDashboards,
  apiCreateDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  ApiError,
} from "../../lib/api";
import { AppShell } from "../../components/shell/AppShell";
import {
  Plus,
  Search,
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Clock,
  Lock,
  Globe,
  SlidersHorizontal,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

export default function DashboardsPage() {
  const { auth, isLoading } = useAuth();
  const router = useRouter();

  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<DashboardStatus>("DRAFT");
  const [visibility, setVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Modal
  const [editingDashboard, setEditingDashboard] = useState<DashboardData | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<DashboardStatus>("DRAFT");
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete Confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<DashboardData | null>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // Load Dashboards
  useEffect(() => {
    if (!auth) return;
    let ignore = false;

    apiListDashboards({
      search: searchTerm.trim() || undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
    })
      .then((res) => {
        if (!ignore) {
          setDashboards(res.dashboards);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboards");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, searchTerm, statusFilter]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const created = await apiCreateDashboard({
        name: name.trim(),
        description: description.trim() || null,
        status,
        visibility,
      });

      setDashboards((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setName("");
      setDescription("");
      setStatus("DRAFT");
      setVisibility("ORGANIZATION");
      setSuccessMsg(`Dashboard "${created.name}" created successfully.`);

      router.push(`/dashboards/${created.id}`);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to create dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(d: DashboardData) {
    setEditingDashboard(d);
    setEditName(d.name);
    setEditDescription(d.description || "");
    setEditStatus(d.status);
    setEditVisibility(d.visibility);
    setModalError(null);
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingDashboard) return;
    setEditSubmitting(true);
    setModalError(null);

    try {
      const updated = await apiUpdateDashboard(editingDashboard.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      });

      setDashboards((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      setEditingDashboard(null);
      setSuccessMsg(`Dashboard "${updated.name}" updated successfully.`);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Failed to update dashboard");
    } finally {
      setEditSubmitting(false);
    }
  }

  function confirmDelete(d: DashboardData) {
    setDashboardToDelete(d);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!dashboardToDelete) return;
    setDeletingId(dashboardToDelete.id);

    try {
      await apiDeleteDashboard(dashboardToDelete.id);
      setDashboards((prev) => prev.filter((d) => d.id !== dashboardToDelete.id));
      setDeleteConfirmOpen(false);
      setDashboardToDelete(null);
      setSuccessMsg(`Dashboard deleted successfully.`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212] gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[#ff6b35] border-t-transparent animate-spin" />
        <p className="text-xs font-mono text-[#898989]">Loading workspace dashboards...</p>
      </div>
    );
  }

  const canCreate = auth.role === "ADMIN" || auth.role === "ANALYST";
  const canDelete = auth.role === "ADMIN";

  const totalCharts = dashboards.reduce((acc, d) => acc + (d.chartCount || 0), 0);
  const publishedCount = dashboards.filter((d) => d.status === "PUBLISHED").length;

  return (
    <AppShell
      title="Executive Dashboards"
      subtitle="Assemble, monitor, and distribute interactive Recharts canvases with multi-source query pushdown."
      breadcrumbs={[
        { label: "App", href: "/" },
        { label: "Workspace", href: "/workspace" },
        { label: "Dashboards" },
      ]}
      actions={
        canCreate ? (
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setIsCreateModalOpen(true);
            }}
            className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] transition-all hover:border-[#ff6b35] hover:bg-[#c2410c] shadow-[0_0_20px_rgba(255,107,53,0.18)] cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Dashboard</span>
          </button>
        ) : null
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alerts & Notifications */}
        {errorMsg && (
          <div className="rounded-[12px] bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-400 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300 text-sm cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-400 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-300 text-sm cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* 4-KPI Metric Ribbon (High-Craft Industrial Overview) */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4 transition-all hover:border-[#333333]">
            <div className="flex items-center justify-between text-[#898989] text-[11px] font-mono">
              <span>TOTAL CANVASES</span>
              <LayoutDashboard className="h-3.5 w-3.5 text-[#ff6b35]" />
            </div>
            <div className="mt-2 text-2xl font-normal tracking-tight text-[#fafafa] font-mono">
              {dashboards.length}
            </div>
            <div className="mt-1 text-[11px] text-[#898989]">
              Configured workspace views
            </div>
          </div>

          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4 transition-all hover:border-[#333333]">
            <div className="flex items-center justify-between text-[#898989] text-[11px] font-mono">
              <span>PUBLISHED VIEWS</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="mt-2 text-2xl font-normal tracking-tight text-emerald-400 font-mono">
              {publishedCount}
            </div>
            <div className="mt-1 text-[11px] text-[#898989]">
              Live production dashboards
            </div>
          </div>

          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4 transition-all hover:border-[#333333]">
            <div className="flex items-center justify-between text-[#898989] text-[11px] font-mono">
              <span>VISUAL WIDGETS</span>
              <BarChart3 className="h-3.5 w-3.5 text-[#3b82f6]" />
            </div>
            <div className="mt-2 text-2xl font-normal tracking-tight text-[#fafafa] font-mono">
              {totalCharts}
            </div>
            <div className="mt-1 text-[11px] text-[#898989]">
              Active Recharts components
            </div>
          </div>

          <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-4 transition-all hover:border-[#333333]">
            <div className="flex items-center justify-between text-[#898989] text-[11px] font-mono">
              <span>QUERY PUSHDOWN</span>
              <span className="text-[10px] text-emerald-400">0 ETL</span>
            </div>
            <div className="mt-2 text-2xl font-normal tracking-tight text-[#ff6b35] font-mono">
              &lt; 12 ms
            </div>
            <div className="mt-1 text-[11px] text-[#898989]">
              Zero data movement pipeline
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Status Filter Pills */}
        <div className="rounded-[16px] border border-[#262626] bg-[#141414] p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-84">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" />
            <input
              type="text"
              placeholder="Search dashboards by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-[#2e2e2e] bg-[#121212] py-2 pl-9 pr-4 text-xs text-[#fafafa] placeholder-[#555555] focus:border-[#ff6b35] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
            {["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => {
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-normal transition-colors cursor-pointer ${
                    active
                      ? "border-[#fafafa] bg-[#1c1c1c] text-[#fafafa] font-medium"
                      : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                  }`}
                >
                  {s === "ALL" ? "All Statuses" : s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#898989] flex flex-col items-center gap-2">
            <div className="h-6 w-6 rounded-full border-2 border-[#ff6b35] border-t-transparent animate-spin" />
            <span>Loading dashboards...</span>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[#2e2e2e] bg-[#141414] p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2e2e2e] bg-[#191919] text-[#ff6b35]">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-medium text-[#fafafa]">No dashboards found</h3>
            <p className="mt-1.5 text-xs text-[#898989] max-w-sm mx-auto leading-relaxed">
              Create your first dashboard to combine interactive Recharts visuals, SQL metrics, and automated alerts on a unified canvas.
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-6 rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-2 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(255,107,53,0.18)]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Launch Your First Dashboard</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((dash) => (
              <div
                key={dash.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#262626] bg-[#141414] p-5 transition-all duration-300 hover:border-[#3d3d3d] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-base font-medium text-[#fafafa] group-hover:text-[#ff6b35] transition-colors line-clamp-1">
                      {dash.name}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold shrink-0 border ${
                        dash.status === "PUBLISHED"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : dash.status === "ARCHIVED"
                            ? "border-[#333333] bg-[#1c1c1c] text-[#898989]"
                            : "border-[#ff6b35]/30 bg-[#ff6b35]/10 text-[#ff6b35]"
                      }`}
                    >
                      {dash.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#898989] line-clamp-2 mb-4 min-h-[34px] leading-relaxed">
                    {dash.description || "No description provided for this analytics view."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#898989] mb-5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#181818] px-2 py-0.5 border border-[#262626]">
                      <BarChart3 className="h-3 w-3 text-[#ff6b35]" />
                      <span>{dash.chartCount || 0} {(dash.chartCount || 0) === 1 ? "widget" : "widgets"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#181818] px-2 py-0.5 border border-[#262626]">
                      {dash.visibility === "PRIVATE" ? (
                        <Lock className="h-3 w-3 text-amber-400" />
                      ) : (
                        <Globe className="h-3 w-3 text-emerald-400" />
                      )}
                      <span>{dash.visibility}</span>
                    </span>
                    <span className="text-[#393939]">·</span>
                    <span className="text-[10px] text-[#666666]">
                      {new Date(dash.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#222222] pt-3.5 text-xs">
                  <Link
                    href={`/dashboards/${dash.id}`}
                    className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-3.5 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Canvas</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => openEditModal(dash)}
                        className="rounded-full border border-[#262626] bg-[#1a1a1a] px-2.5 py-1 text-xs text-[#b4b4b4] hover:text-[#fafafa] hover:border-[#383838] transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => confirmDelete(dash)}
                        className="rounded-full border border-red-500/20 bg-transparent px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Dashboard Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-[20px] border border-[#2e2e2e] bg-[#141414] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#242424] pb-3 mb-4">
                <h3 className="text-base font-medium text-[#fafafa]">Create New Dashboard</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/30">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-normal text-[#898989] mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Executive Revenue Operations"
                    className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3.5 py-2 text-xs text-[#fafafa] placeholder-[#555] focus:border-[#ff6b35] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#898989] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summary of metrics and charts tracked on this canvas..."
                    className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3.5 py-2 text-xs text-[#fafafa] placeholder-[#555] focus:border-[#ff6b35] focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-normal text-[#898989] mb-1">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-normal text-[#898989] mb-1">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[#242424]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-1.5 text-xs text-[#b4b4b4] hover:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Canvas"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Dashboard Modal */}
        {editingDashboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-[20px] border border-[#2e2e2e] bg-[#141414] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#242424] pb-3 mb-4">
                <h3 className="text-base font-medium text-[#fafafa]">Edit Dashboard</h3>
                <button
                  type="button"
                  onClick={() => setEditingDashboard(null)}
                  className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400 border border-red-500/30">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-normal text-[#898989] mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3.5 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-normal text-[#898989] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3.5 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-normal text-[#898989] mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-normal text-[#898989] mb-1">
                      Visibility
                    </label>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] px-3 py-2 text-xs text-[#fafafa] focus:border-[#ff6b35] focus:outline-none transition-colors"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[#242424]">
                  <button
                    type="button"
                    onClick={() => setEditingDashboard(null)}
                    className="rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-1.5 text-xs text-[#b4b4b4] hover:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-4 py-1.5 text-xs font-medium text-[#fafafa] hover:border-[#ff6b35] hover:bg-[#c2410c] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmOpen && dashboardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-[20px] border border-red-500/30 bg-[#141414] p-6 shadow-2xl">
              <h3 className="text-base font-medium text-red-400 mb-2">Delete Dashboard</h3>
              <p className="text-xs text-[#898989] mb-4 leading-relaxed">
                Are you sure you want to permanently delete <span className="font-medium text-[#fafafa]">&ldquo;{dashboardToDelete.name}&rdquo;</span>? This action removes all widgets and custom views permanently.
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDashboardToDelete(null);
                  }}
                  className="rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-3.5 py-1.5 text-xs text-[#b4b4b4] hover:text-[#fafafa] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={handleDelete}
                  className="rounded-full border border-red-500/50 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs px-3.5 py-1.5 transition-colors cursor-pointer"
                >
                  {deletingId ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
