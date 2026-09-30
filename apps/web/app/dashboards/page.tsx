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
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </span>
              <span>RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-900">
              Workspace
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900">Dashboards</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{auth.user.name}</p>
              <p className="text-xs text-gray-500">
                {auth.role} · {auth.organization.name}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
              <span className="text-xs font-semibold text-indigo-700">{userInitials}</span>
            </div>
            <button
              onClick={() => {
                void logout();
                router.replace("/login");
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* Page Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
            <p className="mt-1 text-xs text-gray-500">
              Create, organize, and explore executive dashboards and real-time visualization views.
            </p>
          </div>

          {canCreate && (
            <button
              onClick={() => {
                setModalError(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <span>➕</span>
              <span>New Dashboard</span>
            </button>
          )}
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-lg bg-green-50 p-4 text-xs font-medium text-green-700 border border-green-200 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search dashboards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
            {["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s === "ALL" ? "All Statuses" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading dashboards...</div>
        ) : dashboards.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center bg-white shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
              📊
            </div>
            <h3 className="mt-4 text-sm font-bold text-gray-900">No dashboards created yet</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
              Dashboards allow you to combine multiple charts, KPI widgets, and metrics into a unified presentation.
            </p>
            {canCreate && (
              <button
                onClick={() => {
                  setModalError(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <span>➕</span>
                <span>Create Your First Dashboard</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.map((dash) => (
              <div
                key={dash.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-gray-900 line-clamp-1">
                      {dash.name}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        dash.status === "PUBLISHED"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : dash.status === "ARCHIVED"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {dash.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-4 min-h-[32px]">
                    {dash.description || "No description provided."}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mb-4">
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-gray-700 font-medium">
                      📈 {dash.chartCount} {dash.chartCount === 1 ? "chart" : "charts"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-gray-700 font-medium">
                      🔒 {dash.visibility}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span>{new Date(dash.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
                  <Link
                    href={`/dashboards/${dash.id}`}
                    className="font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Open Canvas →
                  </Link>

                  <div className="flex items-center gap-2">
                    {canCreate && (
                      <button
                        onClick={() => openEditModal(dash)}
                        className="text-gray-500 hover:text-gray-800 font-medium text-xs px-2 py-1"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => confirmDelete(dash)}
                        className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-gray-900">Create New Dashboard</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Executive Q3 Sales Performance"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Summary of what this dashboard tracks..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-gray-900">Edit Dashboard</h3>
                <button
                  onClick={() => setEditingDashboard(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Dashboard Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as DashboardVisibility)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private (Only Me)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingDashboard(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-base font-bold text-gray-900 mb-2">Delete Dashboard</h3>
              <p className="text-xs text-gray-500 mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{dashboardToDelete.name}&rdquo;</span>? This action will permanently remove the dashboard and all its configured views.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setDashboardToDelete(null);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingId !== null}
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deletingId ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
