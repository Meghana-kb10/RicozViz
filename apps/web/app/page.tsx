import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RicozViz — Enterprise Data Visualization Platform",
  description:
    "Connect data sources, build interactive dashboards, and share insights across your organization.",
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* ---- Navigation ---- */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">RicozViz</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-indigo-50 px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Platform Foundation — Day 1, Step 5 Complete
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900">
            Enterprise Data
            <span className="text-indigo-600"> Visualization</span>
            <br />
            Made Simple
          </h1>

          <p className="mb-10 text-xl text-gray-600">
            Connect multiple data sources, build interactive dashboards,
            and share governed insights across your entire organization.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Features grid ---- */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            Everything Your Team Needs
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-xl">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
                {!feature.available && (
                  <span className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-gray-500">
          <span>© 2026 RicozViz. Enterprise Data Visualization Platform.</span>
          <span>v0.1.0 · Foundation</span>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: "🔌",
    title: "Multi-Source Connections",
    description: "Connect to PostgreSQL, MySQL, MongoDB, REST APIs, and more from a unified interface.",
    available: false,
  },
  {
    icon: "📊",
    title: "Interactive Dashboards",
    description: "Drag-and-drop dashboard builder with real-time data and responsive layouts.",
    available: false,
  },
  {
    icon: "🔍",
    title: "Self-Service Exploration",
    description: "Non-technical users can explore data, apply filters, and drill into details.",
    available: false,
  },
  {
    icon: "🔐",
    title: "Role-Based Access Control",
    description: "Fine-grained permissions for users, teams, and organizations.",
    available: false,
  },
  {
    icon: "📤",
    title: "Publishing & Sharing",
    description: "Publish dashboards with governed access and shareable links.",
    available: false,
  },
  {
    icon: "📅",
    title: "Scheduled Reports",
    description: "Automate report delivery via email or webhook on a recurring schedule.",
    available: false,
  },
];
