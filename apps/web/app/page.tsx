import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Database,
  ShieldCheck,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
  Lock,
  Activity,
  FileSpreadsheet,
  LayoutDashboard,
  Compass,
  TrendingUp,
} from "lucide-react";
import { Hero3DCanvas } from "@/components/3d/Hero3DCanvas";
import { IsometricPipeline } from "@/components/3d/IsometricPipeline";
import { DataNetworkGraph } from "@/components/3d/DataNetworkGraph";

export const metadata: Metadata = {
  title: "RicozViz — Enterprise Data Visualization & Analytics",
  description:
    "Connect your data, explore insights, build powerful dashboards, and share governed analytics across your organization — all from one intelligent workspace.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900 selection:bg-indigo-500 selection:text-white antialiased">
      {/* ============================================================ */}
      {/* 1. ENTERPRISE NAVIGATION */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-sm shadow-indigo-200">
                R
              </span>
              <span className="text-lg font-bold tracking-tight text-gray-900">
                Ricoz<span className="text-indigo-600">Viz</span>
              </span>
            </Link>

            {/* Center Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-gray-600">
              <a href="#capabilities" className="hover:text-indigo-600 transition">
                Platform
              </a>
              <a href="#workflow" className="hover:text-indigo-600 transition">
                Pipeline
              </a>
              <a href="#topology" className="hover:text-indigo-600 transition">
                Connected Data
              </a>
              <a href="#showcase" className="hover:text-indigo-600 transition">
                Studio
              </a>
              <a href="#governance" className="hover:text-indigo-600 transition">
                Governance
              </a>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-500 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION WITH 3D COMPOSITION */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32 bg-gradient-to-b from-gray-50/80 via-white to-white">
        {/* Three.js Interactive 3D Canvas Layer */}
        <Hero3DCanvas />

        {/* Subtle grid backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f3f4f6_1px,transparent_1px),linear-gradient(to_bottom,#f3f4f6_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-indigo-700 mb-6 shadow-xs backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
              <span>Enterprise Data Visualization & Analytics</span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl sm:leading-[1.12]">
              Turn Enterprise Data <br className="hidden sm:inline" />
              Into <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700 bg-clip-text text-transparent">Decisions</span>
            </h1>

            {/* Supporting Text */}
            <p className="mt-6 text-base text-gray-600 sm:text-lg sm:leading-relaxed max-w-2xl mx-auto">
              Connect your data, explore insights, build powerful dashboards, and share governed analytics across your organization — all from one intelligent workspace.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-500 transition group"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
              </Link>
              <a
                href="#topology"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white/90 backdrop-blur-sm px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition"
              >
                <span>Explore Topology</span>
              </a>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Role-based governance · Safe analytical querying · Multi-tenant isolation
            </p>
          </div>

          {/* ============================================================ */}
          {/* REALISTIC PRODUCT DASHBOARD PREVIEW WITH 3D DEPTH */}
          {/* ============================================================ */}
          <div className="mt-14 relative mx-auto max-w-6xl group">
            {/* Ambient Backlight Glow */}
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-purple-500/10 blur-2xl opacity-70 group-hover:opacity-100 transition duration-700 -z-10" />

            {/* Floating 3D Telemetry Badges */}
            <div className="hidden lg:flex items-center gap-2 absolute -top-5 -left-4 z-20 rounded-xl border border-indigo-100 bg-white/95 px-3.5 py-2 shadow-lg shadow-indigo-100/50 backdrop-blur-md text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-gray-800">PostgreSQL Pool</span>
              <span className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">42ms ping</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 absolute -bottom-5 -right-4 z-20 rounded-xl border border-cyan-100 bg-white/95 px-3.5 py-2 shadow-lg shadow-cyan-100/50 backdrop-blur-md text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600" />
              <span className="font-semibold text-gray-800">Safe Query Engine</span>
              <span className="font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Zero Raw SQL</span>
            </div>

            {/* Elevated Dashboard Shell with Realistic Shadows */}
            <div className="rounded-2xl border border-gray-200/90 bg-white/95 backdrop-blur-sm shadow-[0_25px_60px_-15px_rgba(30,27,75,0.12)] p-2 sm:p-4 overflow-hidden transition-all duration-300">
              {/* Mock Window Top Bar */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 px-2 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <span className="text-gray-300 ml-2">|</span>
                  <span className="font-semibold text-gray-700">Q3 Global Revenue & Performance</span>
                  <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 border border-green-200">
                    PUBLISHED
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                  <span className="hidden sm:inline">Organization: Acme Corp</span>
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 font-semibold text-[10px]">
                    ANALYST
                  </span>
                </div>
              </div>

              {/* KPI Cards Row with Layered Bevels */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="rounded-xl border border-gray-100/90 bg-gradient-to-br from-indigo-50/50 via-white to-white p-4 shadow-xs hover:shadow-sm transition">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Total Revenue
                  </span>
                  <div className="text-2xl font-bold text-gray-900">$4,850,240</div>
                  <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-flex items-center gap-1">
                    ↑ +18.4% <span className="text-gray-400 font-normal">vs last quarter</span>
                  </span>
                </div>

                <div className="rounded-xl border border-gray-100/90 bg-gradient-to-br from-cyan-50/50 via-white to-white p-4 shadow-xs hover:shadow-sm transition">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Active Accounts
                  </span>
                  <div className="text-2xl font-bold text-gray-900">1,428</div>
                  <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-flex items-center gap-1">
                    ↑ +12.2% <span className="text-gray-400 font-normal">new clients</span>
                  </span>
                </div>

                <div className="rounded-xl border border-gray-100/90 bg-gradient-to-br from-emerald-50/50 via-white to-white p-4 shadow-xs hover:shadow-sm transition">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Query Throughput
                  </span>
                  <div className="text-2xl font-bold text-gray-900">42.8k / day</div>
                  <span className="text-[11px] font-semibold text-indigo-600 mt-1 inline-flex items-center gap-1">
                    ⚡ 8ms <span className="text-gray-400 font-normal">avg response</span>
                  </span>
                </div>

                <div className="rounded-xl border border-gray-100/90 bg-gradient-to-br from-amber-50/50 via-white to-white p-4 shadow-xs hover:shadow-sm transition">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Gross Margin
                  </span>
                  <div className="text-2xl font-bold text-gray-900">76.2%</div>
                  <span className="text-[11px] font-semibold text-emerald-600 mt-1 inline-flex items-center gap-1">
                    ↑ +2.1% <span className="text-gray-400 font-normal">efficiency</span>
                  </span>
                </div>
              </div>

              {/* Charts Mock Layout with Layered Depth */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Monthly Revenue Area Trend */}
                <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">Monthly Revenue Trajectory</h4>
                      <p className="text-[10px] text-gray-400">Aggregate SUM(revenue) by Month</p>
                    </div>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      AREA CHART
                    </span>
                  </div>

                  {/* SVG Chart Preview */}
                  <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 bg-gray-50/60 rounded-lg">
                    <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,130 C80,110 120,70 180,85 C240,100 280,40 360,50 C420,60 460,20 500,25 L500,150 L0,150 Z"
                        fill="url(#areaGradient)"
                      />
                      <path
                        d="M0,130 C80,110 120,70 180,85 C240,100 280,40 360,50 C420,60 460,20 500,25"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="180" cy="85" r="4" fill="#4f46e5" />
                      <circle cx="360" cy="50" r="4" fill="#4f46e5" />
                      <circle cx="500" cy="25" r="4" fill="#4f46e5" />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1 font-mono">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>

                {/* 2. Regional Breakdown Bar Chart */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-xs text-gray-900">Regional Revenue</h4>
                      <p className="text-[10px] text-gray-400">SUM(sales) by Region</p>
                    </div>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                      BAR CHART
                    </span>
                  </div>

                  <div className="h-44 flex items-end justify-around gap-2 px-3 pt-4 pb-2 bg-gray-50/60 rounded-lg">
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-indigo-600 rounded-t-md h-32 shadow-sm" />
                      <span className="text-[9px] text-gray-500 font-mono">NA</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-cyan-500 rounded-t-md h-24 shadow-sm" />
                      <span className="text-[9px] text-gray-500 font-mono">EMEA</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-emerald-500 rounded-t-md h-28 shadow-sm" />
                      <span className="text-[9px] text-gray-500 font-mono">APAC</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-amber-500 rounded-t-md h-16 shadow-sm" />
                      <span className="text-[9px] text-gray-500 font-mono">LATAM</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                    <span>Target: 100%</span>
                    <span className="font-semibold text-gray-700">Total: $4.85M</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. PRODUCT CAPABILITIES WITH 3D DEPTH */}
      {/* ============================================================ */}
      <section id="capabilities" className="py-20 bg-gray-50/70 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Core Platform Capabilities
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to work with enterprise data
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              Built from the ground up for speed, multi-tenant security, and interactive visual exploration across your data stack.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Data Connectivity */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 text-indigo-600 mb-4 shadow-inner border border-indigo-100/80 group-hover:scale-105 transition-transform">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">1. Data Connectivity</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Connect enterprise data sources including PostgreSQL relational databases, REST APIs, and ingested CSV datasets through secure encrypted connectors.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">Encrypted At Rest</span>
                <span className="text-indigo-600 font-semibold text-[10px]">AES-256</span>
              </div>
            </div>

            {/* 2. Data Exploration */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/70 text-cyan-600 mb-4 shadow-inner border border-cyan-100/80 group-hover:scale-105 transition-transform">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-cyan-600 transition-colors">2. Data Exploration</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Inspect auto-discovered schemas, filter records, compute aggregations, and validate column distributions using parameterized, SQL-injection safe queries.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">Engine Latency</span>
                <span className="text-cyan-600 font-semibold text-[10px]">Sub-15ms</span>
              </div>
            </div>

            {/* 3. Visualization Studio */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-emerald-600 mb-4 shadow-inner border border-emerald-100/80 group-hover:scale-105 transition-transform">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">3. Visualization Studio</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Construct responsive visual representations: Bar, Line, Area, Pie, Donut, Scatter, Tabular views, and KPI metric cards with live query preview.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">8 Visual Types</span>
                <span className="text-emerald-600 font-semibold text-[10px]">Live Query Preview</span>
              </div>
            </div>

            {/* 4. Dashboard Builder */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/70 text-amber-600 mb-4 shadow-inner border border-amber-100/80 group-hover:scale-105 transition-transform">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors">4. Dashboard Builder</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Assemble multiple visualizations into unified dashboard canvases with customizable grid layouts, publication statuses, and organizational visibility.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">Multi-Chart Canvas</span>
                <span className="text-amber-600 font-semibold text-[10px]">Grid Positioning</span>
              </div>
            </div>

            {/* 5. Governed Analytics */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/70 text-purple-600 mb-4 shadow-inner border border-purple-100/80 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">5. Governed Analytics</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Enforce strict tenant isolation, role-based authorization (ADMIN, ANALYST, BUSINESS_USER), and comprehensive audit trails for every dashboard action.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">RBAC + Tenancy</span>
                <span className="text-purple-600 font-semibold text-[10px]">Immutable Logs</span>
              </div>
            </div>

            {/* 6. Controlled Reporting */}
            <div className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/5 hover:-translate-y-1 transition-all duration-300">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/70 text-rose-600 mb-4 shadow-inner border border-rose-100/80 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-rose-600 transition-colors">6. Reporting & Distribution</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Organize analytics into controlled viewports and curated canvases designed for consistent review and organizational data alignment.
              </p>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">Lifecycle States</span>
                <span className="text-rose-600 font-semibold text-[10px]">Draft / Published</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. DATA WORKFLOW PIPELINE (ISOMETRIC / 3D) */}
      {/* ============================================================ */}
      <section id="workflow" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              End-to-End Pipeline
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              From raw data to actionable insight
            </h2>
            <p className="mt-4 text-sm text-gray-600">
              An architectural pipeline that transforms fragmented tables into governed decision assets.
            </p>
          </div>

          {/* Interactive Isometric Pipeline */}
          <IsometricPipeline />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. DISTINCTIVE 3D TOPOLOGY: "YOUR DATA, CONNECTED." */}
      {/* ============================================================ */}
      <section id="topology" className="py-20 bg-slate-950 text-white relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3.5 py-1 text-xs font-semibold text-indigo-300 mb-4 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>Full Topology Visibility</span>
            </div>
            <h2 className="text-3xl font-extrabold sm:text-4xl text-white tracking-tight">
              Your data, connected.
            </h2>
            <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Trace every metric back to its source. From raw databases and CSV files through safe query transforms into executive decision canvases.
            </p>
          </div>

          {/* Connected Network Graph Component */}
          <DataNetworkGraph />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. PRODUCT SHOWCASE */}
      {/* ============================================================ */}
      <section id="showcase" className="py-20 bg-gray-50/70 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Interactive Workspace
              </span>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Built for modern data teams
              </h2>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                RicozViz eliminates the complexity between database tables and business stakeholders. Seamlessly move from data source discovery to multi-metric dashboards in minutes.
              </p>

              <div className="mt-8 space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 block font-semibold">Zero Raw SQL Exposure</strong>
                    <span className="text-gray-500">
                      Query execution relies on an allow-listed query engine with parameterized filters and aggregations.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 block font-semibold">Interactive 3-Pane Studio</strong>
                    <span className="text-gray-500">
                      Quick palette, responsive live canvas, and real-time query preview panel.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 block font-semibold">Native Multi-Tenancy</strong>
                    <span className="text-gray-500">
                      Every data source, dataset, chart, and audit log is isolated by organization ID.
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
                >
                  <span>Start Exploring Now</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Showcase Visual Card with 3D Depth */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_20px_50px_-15px_rgba(30,27,75,0.12)]">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Visualization Studio · Live Preview</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">api/v1/datasets/query</span>
                </div>

                {/* Split layout preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-100 p-4 bg-gray-50/50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      Query Parameters
                    </span>
                    <pre className="text-[11px] font-mono text-indigo-900 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto">
{`{
  "dimensions": ["month"],
  "measures": [{
    "column": "revenue",
    "aggregation": "SUM"
  }],
  "filters": [{
    "column": "status",
    "operator": "=",
    "value": "completed"
  }]
}`}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-gray-100 p-4 bg-white flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Execution Metrics
                      </span>
                      <div className="space-y-2 mt-2 text-xs">
                        <div className="flex justify-between border-b border-gray-50 pb-1">
                          <span className="text-gray-500">Latency:</span>
                          <span className="font-mono font-bold text-emerald-600">6.4ms</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-50 pb-1">
                          <span className="text-gray-500">Rows Scanned:</span>
                          <span className="font-mono text-gray-800">12,450</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Aggregation:</span>
                          <span className="font-mono text-gray-800">SUM (Indexed)</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded bg-indigo-50 p-2 text-center text-[11px] font-semibold text-indigo-700">
                      ✓ Ready for Canvas Placement
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. ENTERPRISE GOVERNANCE & SECURITY */}
      {/* ============================================================ */}
      <section id="governance" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Enterprise Trust
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Analytics with governance built in
            </h2>
            <p className="mt-4 text-sm text-gray-600">
              Granular role matrices, tenant boundary enforcement, and immutable audit logs designed for operational integrity.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <Lock className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Organization Isolation</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Strict multi-tenant partitioning ensures datasets, dashboards, and charts are never accessible across tenant boundaries.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <ShieldCheck className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Role-Based Access Control</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Pre-configured roles (ADMIN, ANALYST, BUSINESS_USER) regulate who can configure connections, edit charts, or view insights.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <Activity className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Comprehensive Audit Trails</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Every data source linkage, chart configuration change, and dashboard access event is logged with user, IP, and timestamp.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <Layers className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Safe Query Engine</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Strict allow-lists prevent SQL injection. Queries are constructed safely via parameterization without arbitrary text execution.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <LayoutDashboard className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Controlled Publishing</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Workspaces support DRAFT, PUBLISHED, and ARCHIVED lifecycle statuses with organization and private visibility boundaries.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition">
              <Database className="h-5 w-5 text-indigo-600 mb-3" />
              <h4 className="font-bold text-sm text-gray-900 mb-1">Secure Credential Handling</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Sensitive connection strings and credentials are encrypted at rest and never exposed in client API responses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. FINAL CALL TO ACTION */}
      {/* ============================================================ */}
      <section className="py-20 bg-indigo-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold sm:text-5xl tracking-tight">
            Bring your data into focus.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-indigo-200 max-w-xl mx-auto">
            Connect your data, build visualizations, and create dashboards your organization can act on.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-white px-6 py-3 text-xs font-bold text-indigo-900 shadow-md hover:bg-gray-100 transition"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-indigo-400/50 bg-indigo-800/40 px-6 py-3 text-xs font-bold text-white hover:bg-indigo-800 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 9. ENTERPRISE FOOTER */}
      {/* ============================================================ */}
      <footer className="border-t border-gray-200 bg-white py-12 text-xs text-gray-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-gray-100">
            {/* Brand column */}
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white font-bold text-xs">
                  R
                </span>
                <span className="text-sm font-bold text-gray-900">RicozViz</span>
              </div>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                Enterprise Data Visualization & Analytics. Turning complex data into clear organizational decisions.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h5 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3">
                Product
              </h5>
              <ul className="space-y-2">
                <li><Link href="/dashboards" className="hover:text-indigo-600 transition">Dashboards</Link></li>
                <li><Link href="/dashboards" className="hover:text-indigo-600 transition">Visualizations</Link></li>
                <li><Link href="/datasets" className="hover:text-indigo-600 transition">Datasets</Link></li>
                <li><Link href="/data-sources" className="hover:text-indigo-600 transition">Data Sources</Link></li>
              </ul>
            </div>

            {/* Platform Links */}
            <div>
              <h5 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3">
                Platform
              </h5>
              <ul className="space-y-2">
                <li><Link href="/datasets" className="hover:text-indigo-600 transition">Data Exploration</Link></li>
                <li><Link href="/workspace" className="hover:text-indigo-600 transition">Governance</Link></li>
                <li><Link href="/dashboards" className="hover:text-indigo-600 transition">Reporting</Link></li>
              </ul>
            </div>

            {/* Organization Links */}
            <div>
              <h5 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-3">
                Access
              </h5>
              <ul className="space-y-2">
                <li><Link href="/login" className="hover:text-indigo-600 transition">Sign In</Link></li>
                <li><Link href="/register" className="hover:text-indigo-600 transition">Get Started</Link></li>
                <li><Link href="/workspace" className="hover:text-indigo-600 transition">Workspace</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-2">
            <span>© 2026 RicozViz. Enterprise Data Visualization Platform. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <span>PostgreSQL & Multi-Tenant Architecture</span>
              <span>·</span>
              <span>Next.js 16 + Express</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
