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
import {
  Server,
  Plus,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  ShieldCheck,
  LayoutDashboard,
  BarChart3,
  Database,
  TrendingUp,
  Bell,
  FileDown,
  LayoutTemplate,
  SlidersHorizontal,
  ArrowRight,
} from "lucide-react";

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

  useEffect(() => {
    if (!isAuthLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isAuthLoading, router]);

  if (isAuthLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Loading workspace environment...</p>
        </div>
      </div>
    );
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
      await createWorkspace({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setSuccessBanner(`Workspace "${createName.trim()}" created successfully.`);
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
      setMemberError("Please enter a valid User ID");
      return;
    }

    try {
      setIsAddingMember(true);
      setMemberError(null);
      const newMember = await apiAddWorkspaceMember(currentWorkspace.id, {
        userId: memberUserId.trim(),
        role: memberRole,
      });
      setMembers((prev) => [...prev, newMember]);
      setMemberUserId("");
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Failed to add member to workspace");
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
        { label: "Governance", href: "/workspace" },
        { label: "Workspaces" },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
            className="flex-1 sm:flex-initial max-w-[200px] truncate rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs font-mono-code font-semibold text-[#fafafa] outline-none transition focus:border-[#ff6b35]"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff6b35] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Workspace</span>
          </button>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ---- Notification Banner ---- */}
        {successBanner && (
          <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 px-4 py-2.5 text-center text-xs font-mono-code font-semibold text-emerald-300">
            {successBanner}
          </div>
        )}

        {/* Active Workspace Highlight Card */}
        {currentWorkspace ? (
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#ff6b35] via-[#ea580c] to-[#ff6b35]" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-mono-code font-bold uppercase tracking-wider bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30">
                    Active Workspace
                  </span>
                  <span className="text-xs font-mono-code text-[#898989] bg-[#181818] px-2 py-0.5 rounded border border-[#2e2e2e]">
                    /{currentWorkspace.slug}
                  </span>
                  <span className="text-xs font-mono-code text-[#898989]">
                    Role: <strong className="text-[#fafafa]">{currentWorkspace.role}</strong>
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[#fafafa]">{currentWorkspace.name}</h2>
                <p className="text-xs text-[#898989] mt-1 max-w-2xl leading-relaxed">
                  {currentWorkspace.description || "No description provided."}
                </p>
                <p className="text-[11px] font-mono-code text-[#666666] mt-2">
                  {currentWorkspace.memberCount} member{currentWorkspace.memberCount === 1 ? "" : "s"} · Created on {new Date(currentWorkspace.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void openMembersModal(currentWorkspace)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-1.5 text-xs font-mono-code text-[#fafafa] hover:bg-[#222222] transition cursor-pointer"
                >
                  <Users className="h-3.5 w-3.5 text-[#ff6b35]" />
                  <span>Team Members ({currentWorkspace.memberCount})</span>
                </button>
                {(currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN" || auth.role === "ADMIN") && (
                  <button
                    onClick={() => {
                      setEditingWorkspace(currentWorkspace);
                      setEditName(currentWorkspace.name);
                      setEditDescription(currentWorkspace.description || "");
                      setUpdateError(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-1.5 text-xs font-mono-code text-[#fafafa] hover:bg-[#222222] transition cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-[#898989]" />
                    <span>Edit</span>
                  </button>
                )}
                {(currentWorkspace.role === "OWNER" || auth.role === "ADMIN") && workspaces.length > 1 && (
                  <button
                    onClick={() => setDeletingWorkspace(currentWorkspace)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-xs font-mono-code text-rose-300 hover:bg-rose-900/40 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#2e2e2e] bg-[#141414]/50 p-8 text-center">
            <p className="text-sm font-bold text-[#fafafa]">No workspace selected</p>
            <p className="text-xs text-[#898989] mt-1 font-mono-code">
              Create your first workspace to start organizing your dashboards and datasets.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#c2410c] transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        )}

        {/* All Available Workspaces Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono-code font-bold text-[#898989] uppercase tracking-wider">
            All Available Workspaces ({workspaces.length})
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => {
              const isActive = currentWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                    isActive
                      ? "border-[#ff6b35] bg-[#141414] ring-1 ring-[#ff6b35]/30 shadow-lg shadow-[#ff6b35]/5"
                      : "border-[#242424] bg-[#141414] hover:border-[#ff6b35]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono-code text-[#898989] truncate max-w-[150px]">
                        /{ws.slug}
                      </span>
                      <span
                        className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                          ws.role === "OWNER"
                            ? "bg-amber-950/60 border border-amber-500/30 text-amber-300"
                            : ws.role === "ADMIN"
                            ? "bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35]"
                            : "bg-[#181818] border border-[#2e2e2e] text-[#898989]"
                        }`}
                      >
                        {ws.role}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-[#fafafa] mb-1">{ws.name}</h4>
                    <p className="text-xs text-[#898989] line-clamp-2 min-h-[32px]">
                      {ws.description || "No description."}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#242424] flex items-center justify-between">
                    <span className="text-xs font-mono-code text-[#666666]">
                      {ws.memberCount} member{ws.memberCount === 1 ? "" : "s"}
                    </span>
                    {isActive ? (
                      <span className="text-xs font-mono-code font-semibold text-[#ff6b35] bg-[#ff6b35]/10 border border-[#ff6b35]/30 px-2.5 py-0.5 rounded-md">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => selectWorkspace(ws.id)}
                        className="text-xs font-mono-code font-semibold text-[#ff6b35] hover:text-[#c2410c] transition cursor-pointer flex items-center gap-1"
                      >
                        <span>Switch</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Platform Exploration Links */}
        <div className="border-t border-[#242424] pt-8 space-y-4">
          <h3 className="text-xs font-mono-code font-bold text-[#898989] uppercase tracking-wider">
            Platform Capabilities in this Workspace
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {[
              { href: "/dashboards", icon: LayoutDashboard, title: "Dashboards", desc: "Build & share interactive canvases" },
              { href: "/visualizations", icon: BarChart3, title: "Visualizations", desc: "14+ chart studios with AI recommender" },
              { href: "/datasets", icon: Layers, title: "Datasets", desc: "Explore curated tables & schemas" },
              { href: "/data-sources", icon: Database, title: "Data Sources", desc: "PostgreSQL, DuckDB, REST & CSV" },
              { href: "/metrics", icon: TrendingUp, title: "Metrics & KPIs", desc: "Define calculated analytics targets" },
              { href: "/alerts", icon: Bell, title: "Smart Alerts", desc: "Threshold monitoring & webhook logs" },
              { href: "/data-quality", icon: SlidersHorizontal, title: "Data Quality", desc: "Profiling, outliers & health scores" },
              { href: "/exports", icon: FileDown, title: "Export Center", desc: "CSV, Excel (.xlsx), PDF, PNG" },
              { href: "/templates", icon: LayoutTemplate, title: "Templates", desc: "Sales, marketing & finance suites" },
              { href: "/audit", icon: ShieldCheck, title: "Audit Trail", desc: "Immutable security & RBAC audit" },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <Link
                  key={feat.href}
                  href={feat.href}
                  className="rounded-xl border border-[#242424] bg-[#141414] p-4 transition-all hover:border-[#ff6b35]/50 hover:-translate-y-0.5 group"
                >
                  <Icon className="h-5 w-5 text-[#ff6b35] mb-2 group-hover:scale-110 transition-transform duration-150" />
                  <p className="font-semibold text-xs text-[#fafafa]">{feat.title}</p>
                  <p className="text-[11px] text-[#898989] mt-0.5 line-clamp-2 leading-relaxed">{feat.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* CREATE WORKSPACE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl text-[#fafafa]">
            <h3 className="text-lg font-bold text-[#fafafa] mb-1">Create New Workspace</h3>
            <p className="text-xs text-[#898989] font-mono-code mb-4">
              Set up a shared workspace under <strong>{auth.organization.name}</strong>.
            </p>

            {createError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-xs font-mono-code text-red-300">
                {createError}
              </div>
            )}

            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Workspace Name *
                </label>
                <input
                  id="create-ws-name"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Sales Analytics"
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] outline-none focus:border-[#ff6b35] font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  id="create-ws-desc"
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Brief summary of what this workspace is for..."
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] placeholder-[#666666] outline-none focus:border-[#ff6b35] font-mono-code"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="create-ws-submit"
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c2410c] disabled:opacity-50 transition cursor-pointer"
                >
                  {isCreating ? "Creating…" : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WORKSPACE MODAL */}
      {editingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl text-[#fafafa]">
            <h3 className="text-lg font-bold text-[#fafafa] mb-1">Edit Workspace</h3>
            <p className="text-xs text-[#898989] font-mono-code mb-4">Update workspace title and description.</p>

            {updateError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-xs font-mono-code text-red-300">
                {updateError}
              </div>
            )}

            <form onSubmit={(e) => void handleUpdateSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] outline-none focus:border-[#ff6b35] font-mono-code"
                />
              </div>

              <div>
                <label className="block text-xs font-mono-code uppercase tracking-wider text-[#898989] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2e2e] bg-[#181818] px-3 py-2 text-xs text-[#fafafa] outline-none focus:border-[#ff6b35] font-mono-code"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={() => setEditingWorkspace(null)}
                  className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c2410c] disabled:opacity-50 transition cursor-pointer"
                >
                  {isUpdating ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl text-[#fafafa]">
            <h3 className="text-lg font-bold text-rose-400 mb-2">Delete Workspace?</h3>
            <p className="text-xs text-[#898989] font-mono-code mb-4 leading-relaxed">
              Are you sure you want to delete <strong>{deletingWorkspace.name}</strong>?
              This action safely deletes the workspace. Your organization and users will remain intact.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingWorkspace(null)}
                className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-2 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteConfirm()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isDeleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS MANAGEMENT MODAL */}
      {isMembersModalOpen && currentWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-6 shadow-2xl max-h-[90vh] flex flex-col text-[#fafafa]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242424] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#fafafa]">
                  {currentWorkspace.name} — Members
                </h3>
                <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                  Manage users and governance roles assigned to this workspace.
                </p>
              </div>
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="text-[#898989] hover:text-[#fafafa] text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {memberError && (
              <div className="mb-4 rounded-lg bg-red-950/40 border border-red-500/30 p-3 text-xs font-mono-code text-red-300">
                {memberError}
              </div>
            )}

            {/* Add Member Form (Only for OWNER / ADMIN) */}
            {(currentWorkspace.role === "OWNER" || currentWorkspace.role === "ADMIN" || auth.role === "ADMIN") && (
              <form onSubmit={(e) => void handleAddMember(e)} className="mb-6 bg-[#181818] p-4 rounded-xl border border-[#262626]">
                <h4 className="text-xs font-mono-code font-bold text-[#898989] uppercase tracking-wider mb-2">
                  Add Member from Organization
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    placeholder="User ID (UUID)"
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    className="flex-1 rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] placeholder-[#666666] outline-none focus:border-[#ff6b35] font-mono-code"
                  />
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as "ADMIN" | "MEMBER")}
                    className="rounded-lg border border-[#2e2e2e] bg-[#141414] px-3 py-1.5 text-xs text-[#fafafa] outline-none focus:border-[#ff6b35] font-mono-code"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="rounded-lg bg-[#ff6b35] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#c2410c] disabled:opacity-50 transition cursor-pointer"
                  >
                    {isAddingMember ? "Adding…" : "Add"}
                  </button>
                </div>
              </form>
            )}

            {/* Members List */}
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {loadingMembers ? (
                <p className="text-xs text-[#898989] font-mono-code py-4 text-center">Loading members…</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-[#898989] font-mono-code py-4 text-center">No members found.</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#242424] bg-[#181818] hover:bg-[#202020] transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#ff6b35]/15 border border-[#ff6b35]/30 flex items-center justify-center font-mono-code font-bold text-xs text-[#ff6b35]">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#fafafa]">{m.user.name}</p>
                        <p className="text-[11px] font-mono-code text-[#898989]">{m.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-[#141414] border border-[#262626] text-[#898989]">
                        {m.role}
                      </span>
                      {(currentWorkspace.role === "OWNER" || auth.role === "ADMIN") && m.role !== "OWNER" && (
                        <button
                          onClick={() => void handleRemoveMember(m.user.id)}
                          className="text-xs font-mono-code text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#242424] text-right">
              <button
                onClick={() => setIsMembersModalOpen(false)}
                className="rounded-lg border border-[#2e2e2e] bg-[#181818] px-4 py-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] hover:bg-[#202020] transition cursor-pointer"
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
