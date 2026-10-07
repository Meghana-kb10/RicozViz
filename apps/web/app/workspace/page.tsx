"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import {
  apiListWorkspaceMembers,
  apiAddWorkspaceMember,
  apiRemoveWorkspaceMember,
  type WorkspaceData,
  type WorkspaceMemberData,
  ApiError,
} from "../../lib/api";

export default function WorkspacePage() {
  const { auth, isLoading: isAuthLoading, logout } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    isLoading: isWsLoading,
    selectWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspace();
  const router = useRouter();

  // Create Workspace Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Workspace Modal
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceData | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete Workspace Confirmation
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Members Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberData[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Global notification banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // ---- Redirect unauthenticated users ----
  useEffect(() => {
    if (!isAuthLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isAuthLoading, router]);

  // Loading state
  if (isAuthLoading || (isWsLoading && workspaces.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading your workspaces…</p>
        </div>
      </div>
    );
  }

  if (!auth) return null;

  const userInitials = auth.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    try {
      await logout();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      setCreateError("Workspace name is required");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      const created = await createWorkspace({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateDescription("");
      setSuccessBanner(`Workspace "${created.name}" created and set as active.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingWorkspace) return;
    if (!editName.trim()) {
      setUpdateError("Workspace name cannot be empty");
      return;
    }

    try {
      setIsUpdating(true);
      setUpdateError(null);
      await updateWorkspace(editingWorkspace.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      setEditingWorkspace(null);
      setSuccessBanner("Workspace details updated successfully.");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setUpdateError(err instanceof ApiError ? err.message : "Failed to update workspace");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingWorkspace) return;
    try {
      setIsDeleting(true);
      await deleteWorkspace(deletingWorkspace.id);
      setDeletingWorkspace(null);
      setSuccessBanner(`Workspace "${deletingWorkspace.name}" deleted.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete workspace");
    } finally {
      setIsDeleting(false);
    }
  }

  async function openMembersModal(ws: WorkspaceData) {
    setIsMembersModalOpen(true);
    setMemberError(null);
    setLoadingMembers(true);
    try {
      const list = await apiListWorkspaceMembers(ws.id);
      setMembers(list);
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!currentWorkspace) return;
    if (!memberUserId.trim()) {
      setMemberError("Please enter a user ID");
      return;
    }

    try {
      setIsAddingMember(true);
      setMemberError(null);
      const added = await apiAddWorkspaceMember(currentWorkspace.id, {
        userId: memberUserId.trim(),
        role: memberRole,
      });
      setMembers((prev) => [...prev, added]);
      setMemberUserId("");
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!currentWorkspace) return;
    try {
      await apiRemoveWorkspaceMember(currentWorkspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Failed to remove member");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ---- Top navigation bar ---- */}
      <header className="border-b border-gray-200 bg-white px-6 py-3.5 sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>

            {/* ---- Workspace Selector Dropdown ---- */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:inline">
                Workspace:
              </span>
              <select
                id="workspace-switcher"
                value={currentWorkspace?.id ?? ""}
                onChange={(e) => {
                  if (e.target.value === "CREATE_NEW") {
                    setIsCreateModalOpen(true);
                  } else {
                    selectWorkspace(e.target.value);
                  }
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.role})
                  </option>
                ))}
                {workspaces.length === 0 && (
                  <option value="" disabled>
                    No workspaces found
                  </option>
                )}
                <option value="CREATE_NEW">+ Create new workspace…</option>
              </select>
            </div>
          </div>

          {/* ---- User Menu & Actions ---- */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{auth.user.name}</p>
              <p className="text-xs text-gray-500">
                {auth.role} · {auth.organization.name}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
              <span className="text-xs font-semibold text-indigo-700">
                {userInitials}
              </span>
            </div>
            <button
              id="workspace-logout"
              onClick={() => { void handleLogout(); }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ---- Notification Banner ---- */}
      {successBanner && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-center text-xs font-medium text-emerald-800">
          {successBanner}
        </div>
      )}

      <div className="flex flex-1">
        {/* ---- Sidebar ---- */}
        <aside className="w-60 flex-none border-r border-gray-200 bg-white p-4 hidden md:block">
          <nav className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* ---- Main Content Area ---- */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
          {/* Header Action Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Workspaces & Teams</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your workspaces, team access, and analytics environments.
              </p>
            </div>
            <button
              id="create-workspace-btn"
              onClick={() => {
                setCreateError(null);
                setCreateName("");
                setCreateDescription("");
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <span>+</span>
              <span>New Workspace</span>
            </button>
          </div>

          {/* Active Workspace Highlight Card */}
          {currentWorkspace ? (
            <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-white p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-600 text-white">
                      Active Workspace
                    </span>
                    <span className="text-xs font-mono text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                      /{currentWorkspace.slug}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      Role: <strong className="text-gray-700">{currentWorkspace.role}</strong>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{currentWorkspace.name}</h2>
                  <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                    {currentWorkspace.description || "No description provided."}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {currentWorkspace.memberCount} member{currentWorkspace.memberCount === 1 ? "" : "s"} · Created on {new Date(currentWorkspace.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => void openMembersModal(currentWorkspace)}
                    className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
                  >
                    Team Members ({currentWorkspace.memberCount})
                  </button>
                  {(currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN" || auth.role === "ADMIN") && (
                    <button
                      onClick={() => {
                        setEditingWorkspace(currentWorkspace);
                        setEditName(currentWorkspace.name);
                        setEditDescription(currentWorkspace.description || "");
                        setUpdateError(null);
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
                    >
                      Edit Workspace
                    </button>
                  )}
                  {(currentWorkspace.role === "OWNER" || auth.role === "ADMIN") && workspaces.length > 1 && (
                    <button
                      onClick={() => setDeletingWorkspace(currentWorkspace)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm font-medium text-gray-700">No workspace selected</p>
              <p className="text-xs text-gray-500 mt-1">
                Create your first workspace to start organizing your dashboards and datasets.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition"
              >
                Create Workspace
              </button>
            </div>
          )}

          {/* All Available Workspaces Grid */}
          <div className="mb-10">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              All Available Workspaces ({workspaces.length})
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`rounded-xl border bg-white p-5 transition flex flex-col justify-between ${
                      isActive
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-gray-500 truncate max-w-[150px]">
                          /{ws.slug}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            ws.role === "OWNER"
                              ? "bg-amber-100 text-amber-800"
                              : ws.role === "ADMIN"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {ws.role}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 mb-1">{ws.name}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px]">
                        {ws.description || "No description."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
                      </span>
                      {isActive ? (
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          Selected
                        </span>
                      ) : (
                        <button
                          onClick={() => selectWorkspace(ws.id)}
                          className="text-xs font-medium text-gray-700 hover:text-indigo-600 px-2.5 py-1 rounded-md hover:bg-gray-50 transition"
                        >
                          Switch →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Platform Exploration Links */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              Platform Features in this Workspace
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              <Link
                href="/dashboards"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">📊</span>
                <p className="font-semibold text-sm text-gray-900">Dashboards</p>
                <p className="text-xs text-gray-500 mt-1">Build and share interactive canvases</p>
              </Link>
              <Link
                href="/datasets"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">🗃️</span>
                <p className="font-semibold text-sm text-gray-900">Datasets</p>
                <p className="text-xs text-gray-500 mt-1">Explore curated tables & schemas</p>
              </Link>
              <Link
                href="/data-sources"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">🔌</span>
                <p className="font-semibold text-sm text-gray-900">Data Sources</p>
                <p className="text-xs text-gray-500 mt-1">Connect PostgreSQL, CSV, and REST APIs</p>
              </Link>
              <Link
                href="/metrics"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">📈</span>
                <p className="font-semibold text-sm text-gray-900">Metrics & KPIs</p>
                <p className="text-xs text-gray-500 mt-1">Define reusable calculations & targets</p>
              </Link>
              <Link
                href="/alerts"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">🔔</span>
                <p className="font-semibold text-sm text-gray-900">Smart Alerts</p>
                <p className="text-xs text-gray-500 mt-1">Monitor metric thresholds and logs</p>
              </Link>
              <Link
                href="/data-quality"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">🛡️</span>
                <p className="font-semibold text-sm text-gray-900">Data Quality & Profiling</p>
                <p className="text-xs text-gray-500 mt-1">Outliers, distributions, nulls & health scores</p>
              </Link>
              <Link
                href="/exports"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">📥</span>
                <p className="font-semibold text-sm text-gray-900">Export Center</p>
                <p className="text-xs text-gray-500 mt-1">Export CSV, Excel (.xlsx), PDF, and PNG</p>
              </Link>
              <Link
                href="/templates"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">📑</span>
                <p className="font-semibold text-sm text-gray-900">Dashboard Templates</p>
                <p className="text-xs text-gray-500 mt-1">Sales, Marketing, Finance & Executive templates</p>
              </Link>
              <Link
                href="/audit"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <span className="text-xl mb-2 block">📜</span>
                <p className="font-semibold text-sm text-gray-900">Audit Logs & Governance</p>
                <p className="text-xs text-gray-500 mt-1">Immutable security & compliance audit trail</p>
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* CREATE WORKSPACE MODAL */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Create New Workspace</h3>
            <p className="text-xs text-gray-500 mb-4">
              Set up a shared workspace under <strong>{auth.organization.name}</strong>.
            </p>

            {createError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {createError}
              </div>
            )}

            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Workspace Name *
                </label>
                <input
                  id="create-ws-name"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Sales Analytics"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="create-ws-desc"
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Brief summary of what this workspace is for..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  id="create-ws-submit"
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {isCreating ? "Creating…" : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EDIT WORKSPACE MODAL */}
      {/* ============================================================ */}
      {editingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Edit Workspace</h3>
            <p className="text-xs text-gray-500 mb-4">Update workspace title and description.</p>

            {updateError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {updateError}
              </div>
            )}

            <form onSubmit={(e) => void handleUpdateSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {isUpdating ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {deletingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-red-600 mb-2">Delete Workspace?</h3>
            <p className="text-xs text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deletingWorkspace.name}</strong>?
              This action safely deletes the workspace. Your organization and users will remain intact.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingWorkspace(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirm()}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isDeleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MEMBERS MANAGEMENT MODAL */}
      {/* ============================================================ */}
      {isMembersModalOpen && currentWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {currentWorkspace.name} — Members
                </h3>
                <p className="text-xs text-gray-500">
                  Manage users assigned to this workspace.
                </p>
              </div>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {memberError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {memberError}
              </div>
            )}

            {/* Add Member Form (Only for OWNER / ADMIN) */}
            {(currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN" || auth.role === "ADMIN") && (
              <form onSubmit={(e) => void handleAddMember(e)} className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Add Member from Organization
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    placeholder="User ID (UUID)"
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as "ADMIN" | "MEMBER")}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 outline-none"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {isAddingMember ? "Adding…" : "Add"}
                  </button>
                </div>
              </form>
            )}

            {/* Members List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingMembers ? (
                <p className="text-xs text-gray-500 py-4 text-center">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-gray-500 py-4 text-center">No members found.</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{m.user.name}</p>
                        <p className="text-[11px] text-gray-500">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {m.role}
                      </span>
                      {(currentWorkspace.role === "OWNER" || auth.role === "ADMIN") && m.role !== "OWNER" && (
                        <button
                          onClick={() => void handleRemoveMember(m.user.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 text-right">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { icon: "📁", label: "Workspaces", href: "/workspace" },
  { icon: "📊", label: "Dashboards", href: "/dashboards" },
  { icon: "🗃️", label: "Datasets", href: "/datasets" },
  { icon: "🔌", label: "Data Sources", href: "/data-sources" },
  { icon: "⚙️", label: "Settings", href: "/settings" },
];
