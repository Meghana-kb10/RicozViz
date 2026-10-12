import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Database,
  ShieldCheck,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  Activity,
  FileSpreadsheet,
  LayoutDashboard,
  Compass,
  TrendingUp,
  Sparkles,
  Zap,
  Globe2,
  Terminal,
  Share2,
} from "lucide-react";
import { Hero3DCanvas } from "@/components/3d/Hero3DCanvas";
import { IsometricPipeline } from "@/components/3d/IsometricPipeline";
import { DataNetworkGraph } from "@/components/3d/DataNetworkGraph";
import { BentoGrid, BentoCard } from "@/components/shell/BentoGrid";
import { HaikeiBackground } from "@/components/shell/HaikeiBackground";
import { BrandLogo } from "@/components/shell/BrandLogo";

export const metadata: Metadata = {
  title: "RicozViz — Enterprise Intelligence & Governed Analytics",
  description:
    "Connect your data, explore insights, build high-performance dashboards, and share governed analytics across your organization — all from one intelligent workspace.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#090D16] text-slate-100 selection:bg-indigo-600 selection:text-white antialiased relative overflow-x-hidden">
      {/* Precision Dark Technical Grid Texture */}
      <HaikeiBackground variant="tech-grid" className="opacity-80" />

      {/* Ambient Neon-Indigo & Emerald Glowing Flares */}
      <div className="absolute -top-32 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] left-1/4 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* ============================================================ */}
      {/* 1. TOPBAR: Frosted Glass, Live Status, Tactile Navigation    */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090D16]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandLogo size={32} priority className="group-hover:scale-105" />
              <div className="flex flex-col leading-none">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Ricoz<span className="text-indigo-400">Viz</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400">
                  Intelligence OS
                </span>
              </div>
            </Link>

            {/* Center Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-400">
              <a href="#capabilities" className="hover:text-white transition">
                Platform
              </a>
              <a href="#workflow" className="hover:text-white transition">
                Pipeline
              </a>
              <a href="#topology" className="hover:text-white transition">
                Connected Data
              </a>
              <a href="#showcase" className="hover:text-white transition">
                Studio
              </a>
              <a href="#governance" className="hover:text-white transition">
                Governance
              </a>
            </nav>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Engine v6 Live</span>
            </div>
            <Link
              href="/login"
              className="btn-tactile px-3.5 py-2 text-xs rounded-lg border border-white/10 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-tactile px-4 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 font-semibold transition flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION WITH 3D CANVAS & EDITORIAL HEADLINE         */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-32">
        <HaikeiBackground variant="waves" className="top-0 opacity-15" />
        <Hero3DCanvas />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/50 px-3.5 py-1 text-xs font-semibold text-indigo-300 mb-6 shadow-xs backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>Phase 6 · Collaboration & Embedded Analytics Active</span>
            </div>

            {/* Hero Heading (Typographic Drama) */}
            <h1 className="text-4xl font-extrabold tracking-[-0.035em] text-white sm:text-6xl sm:leading-[1.1]">
              Turn Enterprise Data <br className="hidden sm:inline" />
              Into <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">Decisions</span>
            </h1>

            {/* Supporting Text */}
            <p className="mt-6 text-base text-slate-400 sm:text-lg sm:leading-relaxed max-w-2xl mx-auto">
              Connect your data, explore insights, build high-performance dashboards, and share governed analytics across your organization — all from one intelligent workspace.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href="/register"
                className="btn-tactile bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 px-6 py-3 text-sm rounded-lg font-semibold flex items-center gap-2"
              >
                <span>Launch Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#topology"
                className="btn-tactile bg-slate-900/90 border border-white/10 hover:border-indigo-500/40 text-slate-200 hover:bg-slate-800/90 px-6 py-3 text-sm rounded-lg flex items-center gap-2"
              >
                <Database className="h-4 w-4 text-indigo-400" />
                <span>Explore Topology</span>
              </a>
            </div>

            <p className="mt-4 text-xs font-mono text-slate-500">
              Zero Raw SQL Exposure · DuckDB OLAP In-Memory · Real-Time Collaboration
            </p>
          </div>

          {/* ============================================================ */}
          {/* REALISTIC PRODUCT DASHBOARD PREVIEW WITH TACTILE BENTO SHELL  */}
          {/* ============================================================ */}
          <div className="mt-14 relative mx-auto max-w-6xl group">
            {/* Ambient Backlight Glow */}
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-indigo-500/15 via-emerald-500/10 to-cyan-500/15 blur-2xl opacity-75 group-hover:opacity-100 transition duration-700 -z-10" />

            {/* Floating Telemetry Badges */}
            <div className="hidden lg:flex items-center gap-2 absolute -top-5 -left-4 z-20 rounded-xl border border-white/[0.08] bg-slate-900/95 px-3.5 py-2 shadow-xl backdrop-blur-md text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">PostgreSQL Pool</span>
              <span className="font-mono text-indigo-300 bg-indigo-950/70 border border-indigo-500/30 px-1.5 py-0.5 rounded text-[10px]">42ms ping</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 absolute -bottom-5 -right-4 z-20 rounded-xl border border-white/[0.08] bg-slate-900/95 px-3.5 py-2 shadow-xl backdrop-blur-md text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="font-semibold text-white">Collaborative Stream</span>
              <span className="font-mono text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px]">SSE Connected</span>
            </div>

            {/* Elevated Dashboard Shell */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A]/95 backdrop-blur-md shadow-2xl p-2 sm:p-5 overflow-hidden transition-all duration-300">
              {/* Mock Window Top Bar */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 px-2 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-white/20 ml-2">|</span>
                  <span className="font-semibold text-white">Executive Revenue & Data Intelligence</span>
                  <span className="rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                    LIVE CANVAS
                  </span>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                  <span className="hidden sm:inline">Organization: Acme Corp</span>
                  <span className="rounded bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 text-indigo-300 font-semibold text-[10px]">
                    ANALYST
                  </span>
                </div>
              </div>

              {/* KPI Cards Row with Bento Elevation */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="rounded-xl border border-white/[0.07] border-t-indigo-500/50 bg-[#131B2E] p-4 shadow-sm group/kpi hover:border-indigo-500/30 transition">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Revenue
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">$4,850,240</div>
                  <span className="text-[11px] font-semibold text-emerald-400 mt-1 inline-flex items-center gap-1">
                    ↑ +18.4% <span className="text-slate-400 font-normal">vs last quarter</span>
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.07] border-t-cyan-500/50 bg-[#131B2E] p-4 shadow-sm group/kpi hover:border-cyan-500/30 transition">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Active Accounts
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">1,428</div>
                  <span className="text-[11px] font-semibold text-emerald-400 mt-1 inline-flex items-center gap-1">
                    ↑ +12.2% <span className="text-slate-400 font-normal">new clients</span>
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.07] border-t-emerald-500/50 bg-[#131B2E] p-4 shadow-sm group/kpi hover:border-emerald-500/30 transition">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Query Throughput
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">42.8k / day</div>
                  <span className="text-[11px] font-semibold text-indigo-400 mt-1 inline-flex items-center gap-1">
                    ⚡ 8ms <span className="text-slate-400 font-normal">avg response</span>
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.07] border-t-amber-500/50 bg-[#131B2E] p-4 shadow-sm group/kpi hover:border-amber-500/30 transition">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Gross Margin
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">76.2%</div>
                  <span className="text-[11px] font-semibold text-emerald-400 mt-1 inline-flex items-center gap-1">
                    ↑ +2.1% <span className="text-slate-400 font-normal">efficiency</span>
                  </span>
                </div>
              </div>

              {/* Charts Mock Layout with Layered Depth */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Monthly Revenue Area Trend */}
                <div className="md:col-span-2 rounded-xl border border-white/[0.07] bg-[#131B2E] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-xs text-white">Monthly Revenue Trajectory</h4>
                      <p className="text-[10px] text-slate-400">Aggregate SUM(revenue) by Month</p>
                    </div>
                    <span className="rounded bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 font-mono">
                      AREA CHART
                    </span>
                  </div>

                  {/* SVG Chart Preview */}
                  <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 bg-[#090D16]/90 border border-white/[0.05] rounded-lg">
                    <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,130 C80,110 120,70 180,85 C240,100 280,40 360,50 C420,60 460,20 500,25 L500,150 L0,150 Z"
                        fill="url(#areaGradient)"
                      />
                      <path
                        d="M0,130 C80,110 120,70 180,85 C240,100 280,40 360,50 C420,60 460,20 500,25"
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="180" cy="85" r="4" fill="#38bdf8" />
                      <circle cx="360" cy="50" r="4" fill="#818cf8" />
                      <circle cx="500" cy="25" r="4" fill="#10b981" />
                    </svg>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1 font-mono">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                  </div>
                </div>

                {/* 2. Regional Breakdown Bar Chart */}
                <div className="rounded-xl border border-white/[0.07] bg-[#131B2E] p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-xs text-white">Regional Revenue</h4>
                      <p className="text-[10px] text-slate-400">SUM(sales) by Region</p>
                    </div>
                    <span className="rounded bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 font-mono">
                      BAR CHART
                    </span>
                  </div>

                  <div className="h-44 flex items-end justify-around gap-2 px-3 pt-4 pb-2 bg-[#090D16]/90 border border-white/[0.05] rounded-lg">
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-indigo-500 shadow-md shadow-indigo-500/30 rounded-t-md h-32" />
                      <span className="text-[9px] text-slate-400 font-mono">NA</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-cyan-400 shadow-md shadow-cyan-400/30 rounded-t-md h-24" />
                      <span className="text-[9px] text-slate-400 font-mono">EMEA</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-emerald-400 shadow-md shadow-emerald-400/30 rounded-t-md h-28" />
                      <span className="text-[9px] text-slate-400 font-mono">APAC</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-1/4">
                      <div className="w-full bg-amber-400 shadow-md shadow-amber-400/30 rounded-t-md h-16" />
                      <span className="text-[9px] text-slate-400 font-mono">LATAM</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-1">
                    <span>Target: 100%</span>
                    <span className="font-semibold text-white font-mono">Total: $4.85M</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. GODLY GAPLESS BENTO GRID: REVOLUTIONIZING CAPABILITIES    */}
      {/* ============================================================ */}
      <section id="capabilities" className="py-24 bg-[#0B1120] border-t border-white/[0.08] relative">
        <HaikeiBackground variant="emerald-grid" className="opacity-35" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
              Architectural Capabilities
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl">
              Engineered for speed, isolation, and craft.
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              No generic templates. Built with dedicated OLAP speed, cryptographic RLS security, and real-time multiplayer editing.
            </p>
          </div>

          {/* Asymmetric Godly Bento Grid */}
          <BentoGrid>
            {/* Bento Card 1: 2x2 Massive Studio Feature */}
            <BentoCard
              span="2x2"
              glow
              glowColor="indigo"
              variant="technical"
              badge="Core Engine"
              title="Self-Service Visualization Studio & DuckDB Engine"
              subtitle="Parameterized SQL-injection safe analytics with sub-12ms in-memory aggregation across relational and tabular datasets."
            >
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#090D16] p-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 mb-3 text-xs">
                  <span className="font-mono text-indigo-300 font-bold">SELECT date_trunc(&apos;month&apos;, timestamp), sum(val)</span>
                  <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">6.2ms execution</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">Throughput</span>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">100k+ rps</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">Memory Footprint</span>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">Zero-Copy</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">Chart Types</span>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">8 Native</p>
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Bento Card 2: 1x1 Row-Level Security */}
            <BentoCard
              span="1x1"
              glow
              glowColor="emerald"
              variant="technical"
              badge="Phase 5 · Governance"
              title="Row-Level Security (RLS) & RBAC"
              subtitle="Granular row filters and cryptographic token policies enforce tenant boundaries without query bypass."
            >
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#090D16] border border-white/[0.06] text-[11px] font-mono">
                  <span className="text-slate-300">tenant_id = auth.org</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">ENFORCED</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#090D16] border border-white/[0.06] text-[11px] font-mono">
                  <span className="text-slate-300">region = user.region</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">ISOLATED</span>
                </div>
              </div>
            </BentoCard>

            {/* Bento Card 3: 1x1 Real-Time Collaboration */}
            <BentoCard
              span="1x1"
              glow
              glowColor="indigo"
              variant="technical"
              badge="Phase 6 · Multiplayer"
              title="Real-Time Collaboration"
              subtitle="Multi-user live presence, cursor/widget focus, and conflict-safe optimistic concurrency control."
            >
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <span className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">AL</span>
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">BO</span>
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">CH</span>
                </div>
                <span className="text-xs font-mono text-indigo-400 font-semibold bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">SSE Multiplexed</span>
              </div>
            </BentoCard>

            {/* Bento Card 4: 2x1 Public & Embedded Analytics */}
            <BentoCard
              span="2x1"
              glow
              glowColor="cyan"
              variant="technical"
              badge="Phase 6 · Sharing"
              title="Public & Embedded Analytics Engine"
              subtitle="Secure iframe embedding with origin policy restrictions, auto-expiring cryptographic tokens, and zero credential leakage."
            >
              <div className="mt-3 flex items-center gap-3">
                <code className="text-xs font-mono bg-[#090D16] px-3 py-2 rounded-lg border border-white/[0.06] text-indigo-300 flex-1 truncate">
                  &lt;iframe src=&quot;https://ricozviz.app/embed/tok_48char&quot; ... /&gt;
                </code>
                <span className="btn-tactile bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs rounded-lg font-semibold whitespace-nowrap">
                  Generate Token
                </span>
              </div>
            </BentoCard>

            {/* Bento Card 5: 1x1 Automated Alerts */}
            <BentoCard
              span="1x1"
              glow
              glowColor="indigo"
              variant="technical"
              badge="Phase 4 · Intelligence"
              title="Alerts & Scheduled Reports"
              subtitle="Metric anomaly detection and cron-driven delivery across email and webhooks."
            >
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Threshold: &gt; 95%</span>
                <span className="text-amber-400 font-bold bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">CRON ACTIVE</span>
              </div>
            </BentoCard>
          </BentoGrid>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. DATA WORKFLOW PIPELINE (ISOMETRIC / 3D)                  */}
      {/* ============================================================ */}
      <section id="workflow" className="py-24 bg-[#090D16] border-t border-white/[0.08] relative">
        <HaikeiBackground variant="tech-grid" className="opacity-50" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-indigo-400">
              End-to-End Pipeline
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl">
              From raw data to actionable insight
            </h2>
            <p className="mt-4 text-sm text-slate-400">
              An architectural pipeline that transforms fragmented tables into governed decision assets.
            </p>
          </div>

          <IsometricPipeline />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. DISTINCTIVE 3D TOPOLOGY: "YOUR DATA, CONNECTED."          */}
      {/* ============================================================ */}
      <section id="topology" className="py-24 bg-[#0B1120] border-t border-white/[0.08] text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none -z-10" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
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

          <DataNetworkGraph />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. CALL TO ACTION & FOOTER                                  */}
      {/* ============================================================ */}
      <section className="py-24 bg-gradient-to-b from-[#0B1120] via-[#0F172A] to-[#090D16] border-t border-white/[0.08] text-white relative overflow-hidden">
        <HaikeiBackground variant="waves" className="opacity-20" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <h2 className="text-3xl font-extrabold sm:text-5xl tracking-[-0.03em] text-white">
            Bring your enterprise data into focus.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            Connect data sources, build responsive charts, collaborate in real time, and share governed analytics with confidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="btn-tactile bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/30 rounded-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="btn-tactile border border-white/15 bg-slate-900/80 hover:bg-slate-800 text-white font-bold px-6 py-3 text-xs backdrop-blur-sm rounded-lg"
            >
              Sign In to Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer className="border-t border-white/[0.08] bg-[#06090E] py-12 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BrandLogo size={24} />
              <span className="text-sm font-bold text-white">RicozViz</span>
              <span className="text-[10px] font-mono text-slate-500 ml-2">© 2026 Enterprise Intelligence OS</span>
            </div>
            <div className="flex items-center gap-6 font-mono text-[11px]">
              <Link href="/dashboards" className="hover:text-white transition">Dashboards</Link>
              <Link href="/visualizations" className="hover:text-white transition">Visualizations</Link>
              <Link href="/datasets" className="hover:text-white transition">Datasets</Link>
              <Link href="/workspace" className="hover:text-white transition">Workspace</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
