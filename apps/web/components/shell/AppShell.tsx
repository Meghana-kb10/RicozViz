"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import {
  LayoutDashboard,
  BarChart3,
  Database,
  TrendingUp,
  Bell,
  Layers,
  ShieldCheck,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Server,
  FileDown,
  Sparkles,
  Command,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
}

export function AppShell({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: AppShellProps) {
  const { auth, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const userInitials = auth?.user?.name
    ? auth.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "RV";

  const navGroups = [
    {
      group: "Analytics & Views",
      items: [
        { label: "Dashboards", href: "/dashboards", icon: LayoutDashboard, badge: null },
        { label: "Visualizations", href: "/visualizations", icon: BarChart3, badge: null },
        { label: "Metrics & KPIs", href: "/metrics", icon: TrendingUp, badge: null },
        { label: "Alerts & Triggers", href: "/alerts", icon: Bell, badge: null },
      ],
    },
    {
      group: "Data Studio",
      items: [
        { label: "Datasets", href: "/datasets", icon: Layers, badge: null },
        { label: "Data Sources", href: "/data-sources", icon: Database, badge: null },
        { label: "Data Quality", href: "/data-quality", icon: SlidersHorizontal, badge: null },
        { label: "Demo Catalog", href: "/datasets/demo", icon: Sparkles, badge: "New" },
      ],
    },
    {
      group: "Governance & Operations",
      items: [
        { label: "Workspaces", href: "/workspace", icon: Server, badge: null },
        { label: "Audit Logs", href: "/audit", icon: ShieldCheck, badge: null },
        { label: "Exports", href: "/exports", icon: FileDown, badge: null },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* ============================================================ */}
      {/* 1. TOPBAR: Frosted Glass, Command Search, Realtime Status */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--surface-border))] bg-[hsl(var(--background))]/85 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left: Brand Identity & Mobile Collapse */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandLogo size={32} priority className="group-hover:scale-105" />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-tight text-[hsl(var(--foreground))]">
                  Ricoz<span className="text-indigo-600 dark:text-indigo-400">Viz</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-[hsl(var(--muted-foreground))]">
                  Intelligence OS
                </span>
              </div>
            </Link>

            {/* Workspace Identifier Pill */}
            {currentWorkspace && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(var(--surface-subtle))] border border-[hsl(var(--surface-border))] text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-[hsl(var(--foreground))]">{currentWorkspace.name}</span>
                <span className="font-mono text-[10px] opacity-60">({currentWorkspace.role})</span>
              </div>
            )}
          </div>

          {/* Center: Command Palette Trigger */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div
              className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                searchFocused
                  ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-[hsl(var(--surface))]"
                  : "border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-subtle))]/60 hover:bg-[hsl(var(--surface))]"
              }`}
            >
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                placeholder="Search charts, dashboards, pipelines..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-transparent text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
              />
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] px-1.5 py-0.5 text-[10px] font-mono text-[hsl(var(--muted-foreground))] select-none">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </div>
          </div>

          {/* Right: Realtime Indicators & User Profile */}
          <div className="flex items-center gap-3">
            {/* Live Engine Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>DuckDB v1.1 Active</span>
            </div>

            {/* User Profile */}
            {auth?.user && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-[hsl(var(--surface-border))]">
                <div className="hidden sm:block text-right leading-tight">
                  <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{auth.user.name}</p>
                  <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
                    {auth.role} · {auth.organization.name}
                  </p>
                </div>
                <div
                  title={`${auth.user.name} (${auth.role})`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white text-xs font-bold ring-2 ring-white dark:ring-zinc-900 shadow-xs"
                >
                  {userInitials}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                    router.replace("/login");
                  }}
                  title="Sign out"
                  className="btn-tactile btn-ghost p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. BODY LAYOUT: Sleek Godly Sidebar + Main Content Bar */}
      {/* ============================================================ */}
      <div className="flex flex-1 relative">
        {/* ---- Sidebar Navigation ---- */}
        <aside
          className={`flex-none border-r border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] transition-all duration-200 z-30 ${
            isSidebarCollapsed ? "w-16" : "w-64"
          } hidden md:flex flex-col justify-between p-3 select-none`}
        >
          {/* Nav Items */}
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.group}>
                {!isSidebarCollapsed && (
                  <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    {group.group}
                  </p>
                )}
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={isSidebarCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 relative ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold"
                            : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-subtle))]"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600" />
                        )}
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                        {!isSidebarCollapsed && (
                          <div className="flex flex-1 items-center justify-between">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Bottom Sidebar Collapse Toggle */}
          <div className="pt-3 border-t border-[hsl(var(--surface-border))] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="btn-tactile btn-ghost w-full py-1.5 px-2 flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-[11px] font-mono">Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ---- Main Content Container ---- */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Main Bar Header (if breadcrumbs, title, or actions provided) */}
          {(title || breadcrumbs || actions) && (
            <div className="border-b border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))]/40 px-6 py-5 sm:px-8">
              {/* Breadcrumb Path */}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] mb-2 font-mono">
                  {breadcrumbs.map((bc, idx) => (
                    <div key={bc.label} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="opacity-40">/</span>}
                      {bc.href ? (
                        <Link href={bc.href} className="hover:text-[hsl(var(--foreground))] transition">
                          {bc.label}
                        </Link>
                      ) : (
                        <span className="font-semibold text-[hsl(var(--foreground))]">{bc.label}</span>
                      )}
                    </div>
                  ))}
                </nav>
              )}

              {/* Title & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  {title && (
                    <h1 className="text-2xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] max-w-2xl leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>

                {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
              </div>
            </div>
          )}

          {/* Children Viewport */}
          <div className="flex-1 p-6 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
