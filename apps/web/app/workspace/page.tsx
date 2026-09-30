"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";

export default function WorkspacePage() {
  const { auth, isLoading, logout } = useAuth();
  const router = useRouter();

  // ---- Redirect unauthenticated users ----
  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin text-indigo-600"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  // ---- Not authenticated (redirect in progress) ----
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
      // Force redirect even on error
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---- Top navigation bar ---- */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <span className="text-sm font-bold text-white">R</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">RicozViz</span>
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-sm font-medium text-gray-700">Workspace</span>
          </div>

          {/* ---- User menu ---- */}
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

      <div className="flex flex-1">
        {/* ---- Sidebar ---- */}
        <aside className="w-60 flex-none border-r border-gray-200 bg-gray-50 p-4">
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

        {/* ---- Main content ---- */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">My Workspace</h1>
              <p className="mt-1 text-sm text-gray-500">
                {auth.organization.name} · {auth.role}
              </p>
            </div>

            {/* ---- User info card ---- */}
            <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-indigo-900">
                    {auth.user.name}
                  </h2>
                  <p className="text-sm text-indigo-700">{auth.user.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                      {auth.role}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                      {auth.organization.name}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                      {auth.permissions.length} permissions
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Platform Overview Card ---- */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              <Link
                href="/dashboards"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dashboards</span>
                  <span className="text-indigo-600 font-bold">→</span>
                </div>
                <p className="text-xl font-bold text-gray-900">Visualization Canvases</p>
                <p className="text-xs text-gray-500 mt-1">Multi-chart dashboards & live queries</p>
              </Link>

              <Link
                href="/datasets"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datasets</span>
                  <span className="text-emerald-600 font-bold">→</span>
                </div>
                <p className="text-xl font-bold text-gray-900">Curated Data</p>
                <p className="text-xs text-gray-500 mt-1">Schema discovery & analytical queries</p>
              </Link>

              <Link
                href="/data-sources"
                className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connectors</span>
                  <span className="text-blue-600 font-bold">→</span>
                </div>
                <p className="text-xl font-bold text-gray-900">Data Sources</p>
                <p className="text-xs text-gray-500 mt-1">PostgreSQL, CSV files & REST APIs</p>
              </Link>
            </div>

            {/* ---- Quick actions grid ---- */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                Platform Navigation & Actions
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) =>
                action.href ? (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm transition group"
                  >
                    <div className="mb-3 text-2xl group-hover:scale-105 transition transform">
                      {action.icon}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">{action.description}</p>
                  </Link>
                ) : (
                  <div
                    key={action.title}
                    className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 text-gray-400"
                  >
                    <div className="mb-3 text-2xl opacity-60">{action.icon}</div>
                    <h3 className="text-sm font-semibold text-gray-600">{action.title}</h3>
                    <p className="mt-1 text-xs text-gray-400">{action.description}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { icon: "📊", label: "Dashboards", href: "/dashboards" },
  { icon: "🗃️", label: "Datasets", href: "/datasets" },
  { icon: "🔌", label: "Data Sources", href: "/data-sources" },
  { icon: "👥", label: "Organization", href: "/workspace" },
  { icon: "⚙️", label: "Settings", href: "/workspace" },
];

const QUICK_ACTIONS = [
  {
    icon: "🔌",
    title: "Connect Data Source",
    description: "Link a PostgreSQL database, REST API, or CSV file.",
    href: "/data-sources",
  },
  {
    icon: "➕",
    title: "New Dashboard",
    description: "Create an enterprise canvas and configure visualizations.",
    href: "/dashboards",
  },
  {
    icon: "📋",
    title: "Explore Datasets",
    description: "Inspect schema, filter records, and run analytical queries.",
    href: "/datasets",
  },
  {
    icon: "📈",
    title: "Visualization Studio",
    description: "Build line, bar, area, pie, and metric visualizations.",
    href: "/dashboards",
  },
  {
    icon: "🛡️",
    title: "Governance & RBAC",
    description: "Tenant isolation and role-based access control.",
  },
  {
    icon: "📝",
    title: "Audit Logging",
    description: "Immutable compliance and access trail.",
  },
];
