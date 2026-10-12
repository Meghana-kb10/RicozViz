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
import { AppShell } from "../../components/shell/AppShell";

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
    <AppShell
      title="Workspaces & Teams"
      subtitle="Manage your analytics spaces, team permissions, and cross-project governance."
      breadcrumbs={[
        { label: "App", href: "/" },
        { label: "Workspaces" },
      ]}
      actions={
        <div className="flex items-center gap-2.5">
          {/* Workspace Switcher Selector */}
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
            className="rounded-lg border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))] shadow-2xs outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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

          {/* New Workspace Tactile Button */}
          <button
            id="create-workspace-btn"
            onClick={() => {
              setCreateError(null);
              setCreateName("");
              setCreateDescription("");
              setIsCreateModalOpen(true);
            }}
            className="btn-tactile btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5"
          >
            <span>+</span>
            <span>New Workspace</span>
          </button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ---- Notification Banner ---- */}
        {successBanner && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {successBanner}
          </div>
        )}

          {/* Active Workspace Highlight Card */}
          {currentWorkspace ? (
            <div className="bento-card border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                      Active Workspace
                    </span>
                    <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--surface-subtle))] px-2 py-0.5 rounded border border-[hsl(var(--surface-border))]">
                      /{currentWorkspace.slug}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      Role: <strong className="text-[hsl(var(--foreground))]">{currentWorkspace.role}</strong>
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">{currentWorkspace.name}</h2>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-2xl leading-relaxed">
                    {currentWorkspace.description || "No description provided."}
                  </p>
                  <p className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] mt-2 opacity-75">
                    {currentWorkspace.memberCount} member{currentWorkspace.memberCount === 1 ? "" : "s"} · Created on {new Date(currentWorkspace.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void openMembersModal(currentWorkspace)}
                    className="btn-tactile btn-secondary text-xs py-1.5 px-3"
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
                      className="btn-tactile btn-secondary text-xs py-1.5 px-3"
                    >
                      Edit Workspace
                    </button>
                  )}
                  {(currentWorkspace.role === "OWNER" || auth.role === "ADMIN") && workspaces.length > 1 && (
                    <button
                      onClick={() => setDeletingWorkspace(currentWorkspace)}
                      className="btn-tactile text-xs py-1.5 px-3 border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bento-card border-dashed p-8 text-center">
              <p className="text-sm font-bold text-[hsl(var(--foreground))]">No workspace selected</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Create your first workspace to start organizing your dashboards and datasets.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-tactile btn-primary mt-4 text-xs py-2 px-4"
              >
                Create Workspace
              </button>
            </div>
          )}

          {/* All Available Workspaces Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              All Available Workspaces ({workspaces.length})
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((ws) => {
                const isActive = currentWorkspace?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`bento-card p-5 flex flex-col justify-between transition-all ${
                      isActive
                        ? "border-indigo-500 ring-2 ring-indigo-500/20"
                        : "hover:border-[hsl(var(--foreground))]/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] truncate max-w-[150px]">
                          /{ws.slug}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                            ws.role === "OWNER"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                              : ws.role === "ADMIN"
                              ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300"
                              : "bg-[hsl(var(--surface-subtle))] text-[hsl(var(--muted-foreground))]"
                          }`}
                        >
                          {ws.role}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-[hsl(var(--foreground))] mb-1">{ws.name}</h4>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 min-h-[32px]">
                        {ws.description || "No description."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[hsl(var(--surface-border))] flex items-center justify-between">
                      <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                        {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
                      </span>
                      {isActive ? (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => selectWorkspace(ws.id)}
                          className="btn-tactile btn-ghost text-xs py-1 px-2.5 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
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
          <div className="border-t border-[hsl(var(--surface-border))] pt-8 space-y-4">
            <h3 className="text-xs font-mono font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Platform Features in this Workspace
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {[
                { href: "/dashboards", icon: "📊", title: "Dashboards", desc: "Build & share interactive canvases" },
                { href: "/visualizations", icon: "📈", title: "Visualizations", desc: "14+ chart studios with AI recommender" },
                { href: "/datasets", icon: "🗃️", title: "Datasets", desc: "Explore curated tables & schemas" },
                { href: "/data-sources", icon: "🔌", title: "Data Sources", desc: "PostgreSQL, DuckDB, REST & CSV" },
                { href: "/metrics", icon: "💎", title: "Metrics & KPIs", desc: "Define calculated analytics targets" },
                { href: "/alerts", icon: "🔔", title: "Smart Alerts", desc: "Threshold monitoring & webhook logs" },
                { href: "/data-quality", icon: "🛡️", title: "Data Quality", desc: "Profiling, outliers & health scores" },
                { href: "/exports", icon: "📥", title: "Export Center", desc: "CSV, Excel (.xlsx), PDF, PNG" },
                { href: "/templates", icon: "📑", title: "Templates", desc: "Sales, marketing & finance suites" },
                { href: "/audit", icon: "📜", title: "Audit Trail", desc: "Immutable security & RBAC audit" },
              ].map((feat) => (
                <Link
                  key={feat.href}
                  href={feat.href}
                  className="bento-card p-4 transition-all hover:border-indigo-500/60 hover:-translate-y-0.5 group"
                >
                  <span className="text-xl mb-2 block group-hover:scale-110 transition-transform duration-150">
                    {feat.icon}
                  </span>
                  <p className="font-bold text-xs text-[hsl(var(--foreground))]">{feat.title}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{feat.desc}</p>
                </Link>
              ))}
            </div>
          </div>
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

            <div className="mt-4 pt-3 border-t border-[hsl(var(--surface-border))] text-right">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="btn-tactile btn-secondary text-xs py-1.5 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
