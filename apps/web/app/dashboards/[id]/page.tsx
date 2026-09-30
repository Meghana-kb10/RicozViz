"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  ApiError,
} from "../../../lib/api";

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { auth, isLoading, logout } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<DashboardStatus>("DRAFT");
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  useEffect(() => {
    if (!auth || !id) return;
    let ignore = false;

    apiGetDashboard(id)
      .then((data) => {
        if (!ignore) {
          setDashboard(data);
          setEditName(data.name);
          setEditDescription(data.description || "");
          setEditStatus(data.status);
          setEditVisibility(data.visibility);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard details");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, id]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard) return;
    setSavingEdit(true);
    setErrorMsg(null);

    try {
      const updated = await apiUpdateDashboard(dashboard.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      });

      setDashboard(updated);
      setIsEditing(false);
      setSuccessMsg("Dashboard updated successfully.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update dashboard");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!dashboard) return;
    setIsDeleting(true);

    try {
      await apiDeleteDashboard(dashboard.id);
      router.push("/dashboards");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900">Dashboard not found</p>
          <Link
            href="/dashboards"
            className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            ← Back to Dashboards
          </Link>
        </div>
      </div>
    );
  }

  const userInitials = auth?.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canEdit = auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const canDelete = auth?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
            <Link href="/dashboards" className="text-sm text-gray-500 hover:text-gray-900">
              Dashboards
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900 line-clamp-1">{dashboard.name}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{auth?.user.name}</p>
              <p className="text-xs text-gray-500">
                {auth?.role} · {auth?.organization.name}
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

      {/* Main Canvas Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* Navigation Breadcrumb Back */}
        <div className="mb-4">
          <Link
            href="/dashboards"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 inline-flex items-center gap-1"
          >
            ← Back to all Dashboards
          </Link>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-xs font-medium text-green-700 border border-green-200 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
          </div>
        )}

        {/* Dashboard Header Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="flex-1">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 max-w-md">
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base font-bold text-gray-900"
                  />
                  <input
                    type="text"
                    maxLength={500}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as DashboardVisibility)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        dashboard.status === "PUBLISHED"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : dashboard.status === "ARCHIVED"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {dashboard.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {dashboard.description || "No description provided."}
                  </p>
                </>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 self-start">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ✏️ Edit Details
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Visibility</span>
              <span className="font-semibold text-gray-900">
                🔒 {dashboard.visibility}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Visualizations</span>
              <span className="font-semibold text-gray-900">
                {dashboard.chartCount} {dashboard.chartCount === 1 ? "chart" : "charts"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Owner</span>
              <span className="font-semibold text-gray-900">
                {dashboard.ownerName || "Organization Member"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Created</span>
              <span className="font-semibold text-gray-900">
                {new Date(dashboard.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Canvas Area */}
        {dashboard.charts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center bg-white shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
              📈
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900">No visualizations added yet.</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
              This dashboard canvas is ready for charts. You will be able to construct and place visualizations using the Visualization Studio in the next step.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboard.charts.map((chart) => (
              <div
                key={chart.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-gray-900">{chart.title}</h4>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase">
                    {chart.chartType}
                  </span>
                </div>
                {chart.description && (
                  <p className="text-xs text-gray-500 mb-3">{chart.description}</p>
                )}
                <div className="h-44 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xs text-gray-400 font-mono">
                  [Visualization Placeholder]
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-base font-bold text-gray-900 mb-2">Delete Dashboard</h3>
              <p className="text-xs text-gray-500 mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{dashboard.name}&rdquo;</span>? This will permanently delete this dashboard canvas.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
