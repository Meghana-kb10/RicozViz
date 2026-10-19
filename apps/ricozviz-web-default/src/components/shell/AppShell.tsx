"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { useWorkspace } from "../../contexts/workspace-context";
import { useTheme } from "../../contexts/theme-context";
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
  Sun,
  Moon,
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
  const { theme, resolvedTheme, toggleTheme } = useTheme();
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
    <div className="flex min-h-screen flex-col bg-[#121212] text-[#fafafa] antialiased">
      {/* ============================================================ */}
      {/* 1. TOPBAR: Frosted Dark Glass, Command Search, Live Engine   */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 border-b border-[#242424] bg-[#121212]/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left: Brand Identity & Mobile Collapse */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandLogo size={28} priority className="group-hover:scale-105 transition-transform" />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-medium tracking-tight text-[#fafafa]">
                  ricoz<span className="text-[#ff6b35]">viz</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#898989]">
                  Intelligence OS
                </span>
              </div>
            </Link>

            {/* Workspace Identifier Pill */}
            {currentWorkspace && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c1c1c] border border-[#2e2e2e] text-[11px] font-medium text-[#898989]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-[#fafafa]">{currentWorkspace.name}</span>
                <span className="font-mono text-[10px] text-[#898989]">({currentWorkspace.role})</span>
              </div>
            )}
          </div>

          {/* Center: Command Palette Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <div
              className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-full border transition-all duration-150 ${
                searchFocused
                  ? "border-[#ff6b35] ring-2 ring-[#ff6b35]/20 bg-[#171717]"
                  : "border-[#262626] bg-[#171717] hover:border-[#383838]"
              }`}
            >
              <Search className="h-3.5 w-3.5 text-[#898989]" />
              <input
                type="text"
                placeholder="Search charts, dashboards, datasets..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full bg-transparent text-xs text-[#fafafa] placeholder-[#666666] focus:outline-none"
              />
              <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-[#2e2e2e] bg-[#121212] px-1.5 py-0.5 text-[10px] font-mono text-[#898989] select-none">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </div>
          </div>

          {/* Right: Live Engine Indicator & User Profile */}
          <div className="flex items-center gap-3">
            {/* Live Engine Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Query Pushdown Active</span>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch theme (Current: ${theme})`}
              aria-label={`Toggle theme (Current: ${theme})`}
              className="p-1.5 rounded-lg border border-[#242424] bg-[#171717] text-[#898989] hover:text-[#fafafa] hover:border-[#333333] transition cursor-pointer"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-[#ff6b35] transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* User Profile */}
            {auth?.user && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#242424]">
                <div className="hidden sm:block text-right leading-tight">
                  <p className="text-xs font-medium text-[#fafafa]">{auth.user.name}</p>
                  <p className="text-[10px] font-mono text-[#898989]">
                    {auth.role} · {auth.organization.name}
                  </p>
                </div>
                <div
                  title={`${auth.user.name} (${auth.role})`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ff6b35]/60 bg-[#9a3412] text-[#fafafa] text-xs font-semibold shadow-xs"
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
                  className="p-1.5 rounded-lg border border-transparent text-[#898989] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. BODY LAYOUT: Sleek Sidebar + Main Content Bar             */}
      {/* ============================================================ */}
      <div className="flex flex-1 relative bg-[#121212]">
        {/* ---- Sidebar Navigation ---- */}
        <aside
          className={`flex-none border-r border-[#242424] bg-[#141414] transition-all duration-200 z-30 ${
            isSidebarCollapsed ? "w-16" : "w-64"
          } hidden md:flex flex-col justify-between p-3 select-none`}
        >
          {/* Nav Items */}
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.group}>
                {!isSidebarCollapsed && (
                  <p className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-[#666666]">
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
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#ff6b35]/12 border border-[#ff6b35]/35 text-[#fafafa] font-medium shadow-[0_0_16px_rgba(255,107,53,0.14)]"
                            : "text-[#898989] hover:text-[#fafafa] hover:bg-[#1a1a1a] font-normal"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#ff6b35]" />
                        )}
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#ff6b35]" : "text-[#898989]"}`} />
                        {!isSidebarCollapsed && (
                          <div className="flex flex-1 items-center justify-between">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.2 rounded bg-[#ff6b35]/20 text-[#ff6b35] border border-[#ff6b35]/30">
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
          <div className="pt-3 border-t border-[#242424] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="w-full py-1.5 px-2 flex items-center justify-center gap-2 text-xs text-[#898989] hover:text-[#fafafa] hover:bg-[#1a1a1a] rounded-lg transition cursor-pointer"
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
        <main className="flex-1 flex flex-col min-w-0 bg-[#121212]">
          {/* Main Bar Header (breadcrumbs, title, actions) */}
          {(title || breadcrumbs || actions) && (
            <div className="border-b border-[#242424] bg-[#121212] px-6 py-5 sm:px-8">
              {/* Breadcrumb Path */}
              {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-1.5 text-xs text-[#898989] mb-2 font-mono">
                  {breadcrumbs.map((bc, idx) => (
                    <div key={bc.label} className="flex items-center gap-1.5">
                      {idx > 0 && <span className="text-[#393939]">/</span>}
                      {bc.href ? (
                        <Link href={bc.href} className="hover:text-[#fafafa] transition">
                          {bc.label}
                        </Link>
                      ) : (
                        <span className="font-medium text-[#fafafa]">{bc.label}</span>
                      )}
                    </div>
                  ))}
                </nav>
              )}

              {/* Title & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  {title && (
                    <h1 className="text-2xl font-normal tracking-[-0.02em] text-[#fafafa]">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-xs text-[#898989] max-w-2xl leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>

                {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
              </div>
            </div>
          )}

          {/* Children Viewport */}
          <div className="flex-1 p-6 sm:p-8 bg-[#121212]">{children}</div>
        </main>
      </div>
    </div>
  );
}
