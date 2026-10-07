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

export default function DashboardsPage() {
  const { auth, isLoading, logout } = useAuth();
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

      // Navigate to the newly created dashboard detail page
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dashboards...</p>
      </div>
    );
  }

  const userInitials = auth.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canCreate = auth.role === "ADMIN" || auth.role === "ANALYST";
  const canDelete = auth.role === "ADMIN";

  return (
    <AppShell
      title="Dashboards"
      subtitle="Create, organize, and explore executive dashboards and real-time visualization views."
      breadcrumbs={[
        { label: "App", href: "/" },
        { label: "Workspace", href: "/workspace" },
        { label: "Dashboards" },
      ]}
      actions={
        canCreate ? (
          <button
            onClick={() => {
              setModalError(null);
              setIsCreateModalOpen(true);
            }}
            className="btn-tactile btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Dashboard</span>
          </button>
        ) : null
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs font-semibold text-red-600 dark:text-red-400 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-500">×</button>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="bento-card p-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] py-1.5 px-3 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
            {["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`btn-tactile rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === s
                    ? "btn-primary"
                    : "btn-secondary text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {s === "ALL" ? "All Statuses" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="p-16 text-center text-xs font-mono text-[hsl(var(--muted-foreground))]">
            Loading dashboards...
          </div>
        ) : dashboards.length === 0 ? (
          <div className="bento-card border-dashed p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-2xl">
              📊
            </div>
            <h3 className="mt-4 text-sm font-bold text-[hsl(var(--foreground))]">No dashboards created yet</h3>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
              Dashboards allow you to combine multiple charts, KPI widgets, and metrics into a unified presentation.
            </p>
            {canCreate && (
              <button
                onClick={() => {
                  setModalError(null);
                  setIsCreateModalOpen(true);
                }}
                className="btn-tactile btn-primary mt-6 text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Create Your First Dashboard</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((dash) => (
              <div
                key={dash.id}
                className="bento-card p-5 transition-all hover:border-indigo-500/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-[hsl(var(--foreground))] line-clamp-1">
                      {dash.name}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono ${
                        dash.status === "PUBLISHED"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : dash.status === "ARCHIVED"
                            ? "bg-[hsl(var(--surface-subtle))] text-[hsl(var(--muted-foreground))]"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {dash.status}
                    </span>
                  </div>

                  <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-4 min-h-[32px]">
                    {dash.description || "No description provided."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[hsl(var(--muted-foreground))] mb-4">
                    <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--surface-subtle))] px-2 py-0.5 border border-[hsl(var(--surface-border))]">
                      📈 {dash.chartCount} {dash.chartCount === 1 ? "chart" : "charts"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--surface-subtle))] px-2 py-0.5 border border-[hsl(var(--surface-border))]">
                      🔒 {dash.visibility}
                    </span>
                    <span className="opacity-40">·</span>
                    <span>{new Date(dash.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[hsl(var(--surface-border))] pt-3 text-xs">
                  <Link
                    href={`/dashboards/${dash.id}`}
                    className="btn-tactile btn-primary text-xs py-1 px-3 inline-flex items-center gap-1 font-semibold"
                  >
                    Open Canvas →
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {canCreate && (
                      <button
                        onClick={() => openEditModal(dash)}
                        className="btn-tactile btn-ghost text-xs py-1 px-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => confirmDelete(dash)}
                        className="btn-tactile btn-ghost text-xs py-1 px-2.5 text-red-500 hover:text-red-700"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="w-full max-w-md bento-card border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] pb-3 mb-4">
                <h3 className="text-base font-extrabold text-[hsl(var(--foreground))]">Create New Dashboard</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/30">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Executive Q3 Sales Performance"
                    className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summary of what this dashboard tracks..."
                    className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[hsl(var(--surface-border))]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="btn-tactile btn-secondary text-xs px-3.5 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-tactile btn-primary text-xs px-3.5 py-1.5"
                  >
                    {submitting ? "Creating..." : "Create Dashboard"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Dashboard Modal */}
        {editingDashboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="w-full max-w-md bento-card border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] pb-3 mb-4">
                <h3 className="text-base font-extrabold text-[hsl(var(--foreground))]">Edit Dashboard</h3>
                <button
                  onClick={() => setEditingDashboard(null)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/30">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[hsl(var(--foreground))] mb-1">
                      Visibility
                    </label>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))] px-3 py-2 text-xs text-[hsl(var(--foreground))] focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[hsl(var(--surface-border))]">
                  <button
                    type="button"
                    onClick={() => setEditingDashboard(null)}
                    className="btn-tactile btn-secondary text-xs px-3.5 py-1.5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="btn-tactile btn-primary text-xs px-3.5 py-1.5"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="w-full max-w-sm bento-card border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-2xl">
              <h3 className="text-base font-extrabold text-red-600 dark:text-red-400 mb-2">Delete Dashboard</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-[hsl(var(--foreground))]">&ldquo;{dashboardToDelete.name}&rdquo;</span>? This action will permanently remove the dashboard and all its configured views.
              </p>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDashboardToDelete(null);
                  }}
                  className="btn-tactile btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={handleDelete}
                  className="btn-tactile text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingId ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
