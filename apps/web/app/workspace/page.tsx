import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Your RicozViz workspace — dashboards, data sources, and charts.",
};

export default function WorkspacePage() {
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
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-indigo-700">U</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ---- Sidebar ---- */}
        <aside className="w-60 flex-none border-r border-gray-200 bg-gray-50 p-4">
          <nav className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 opacity-60 cursor-not-allowed select-none"
                title="Coming soon"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  Soon
                </span>
              </div>
            ))}
          </nav>
        </aside>

        {/* ---- Main content ---- */}
        <main className="flex-1 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">My Workspace</h1>
              <p className="mt-1 text-sm text-gray-500">
                Your personal space for dashboards, data sources, and analytics.
              </p>
            </div>

            {/* ---- Status banner ---- */}
            <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-indigo-100">
                  <span className="text-xl">🏗️</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-indigo-900">
                    Platform Foundation In Progress
                  </h2>
                  <p className="mt-1 text-sm text-indigo-700">
                    The RicozViz workspace is being built. This is the project scaffold
                    from Day 1, Step 2. Authentication, dashboards, and data connections
                    are coming in subsequent steps.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {BUILD_STATUS.map((item) => (
                      <span
                        key={item.label}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                          item.done
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span>{item.done ? "✓" : "○"}</span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Quick actions placeholder grid ---- */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_ACTIONS.map((action) => (
                <div
                  key={action.title}
                  className="rounded-xl border border-gray-200 bg-white p-5 opacity-50 cursor-not-allowed"
                >
                  <div className="mb-3 text-2xl">{action.icon}</div>
                  <h3 className="text-sm font-semibold text-gray-900">{action.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const SIDEBAR_ITEMS = [
  { icon: "📊", label: "Dashboards" },
  { icon: "📈", label: "Charts" },
  { icon: "🔌", label: "Data Sources" },
  { icon: "🗃️", label: "Datasets" },
  { icon: "📤", label: "Reports" },
  { icon: "👥", label: "Team" },
  { icon: "⚙️", label: "Settings" },
];

const BUILD_STATUS = [
  { label: "Git + Monorepo", done: true },
  { label: "Next.js Frontend", done: true },
  { label: "Express API", done: true },
  { label: "PostgreSQL", done: true },
  { label: "Authentication", done: false },
  { label: "RBAC", done: false },
  { label: "Dashboards", done: false },
  { label: "Charts", done: false },
];

const QUICK_ACTIONS = [
  {
    icon: "➕",
    title: "New Dashboard",
    description: "Create a blank dashboard and add charts.",
  },
  {
    icon: "🔌",
    title: "Connect Data Source",
    description: "Link a database, API, or file.",
  },
  {
    icon: "📋",
    title: "Explore Dataset",
    description: "Browse and query your existing datasets.",
  },
  {
    icon: "📤",
    title: "Schedule Report",
    description: "Automate dashboard delivery via email.",
  },
  {
    icon: "👥",
    title: "Invite Team Member",
    description: "Share the workspace with your team.",
  },
  {
    icon: "🔍",
    title: "Audit Log",
    description: "Review all actions taken in this workspace.",
  },
];
