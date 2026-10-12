import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  Layers,
  Terminal,
  Shield,
  Zap,
} from "lucide-react";
import { Hero3DCanvas } from "@/components/3d/Hero3DCanvas";
import { IsometricPipeline } from "@/components/3d/IsometricPipeline";
import { DataNetworkGraph } from "@/components/3d/DataNetworkGraph";
import { BentoGrid, BentoCard } from "@/components/shell/BentoGrid";
import { HaikeiBackground } from "@/components/shell/HaikeiBackground";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { TechnicalFooter } from "@/components/shell/TechnicalFooter";
import { HeroDashboardPreview } from "@/components/dashboard/HeroDashboardPreview";
import { QueryIdeWindow } from "@/components/shell/QueryIdeWindow";

export const metadata: Metadata = {
  title: "RicozViz — Enterprise Intelligence & In-Memory Analytics",
  description:
    "Connect your data, explore insights, build high-performance dashboards, and share governed analytics across your organization — all from one intelligent workspace.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#090D16] text-slate-100 selection:bg-indigo-600 selection:text-white antialiased relative overflow-x-hidden">
      {/* Precision Dark Technical Grid Texture */}
      <HaikeiBackground variant="tech-grid" className="opacity-80" />

      {/* ============================================================ */}
      {/* 1. TOPBAR: Precision Navigation & Actions                    */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandLogo size={30} priority />
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold tracking-tight text-white">
                  Ricoz<span className="text-indigo-400">Viz</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400">
                  Intelligence OS
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
              <a href="#capabilities" className="hover:text-white transition">
                Platform
              </a>
              <a href="#workflow" className="hover:text-white transition">
                Pipeline
              </a>
              <a href="#topology" className="hover:text-white transition">
                Topology
              </a>
              <Link href="/docs" className="hover:text-white transition">
                Docs
              </Link>
              <Link href="/benchmarks" className="hover:text-white transition">
                Benchmarks
              </Link>
              <Link href="/status" className="hover:text-white transition">
                Status
              </Link>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs rounded-lg border border-white/10 bg-slate-900/80 hover:bg-slate-800 text-slate-200 transition font-medium"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. HERO SECTION: Editorial Hierarchy & Dashboard Focus      */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden pt-14 pb-20 lg:pt-20 lg:pb-28">
        <Hero3DCanvas />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Confident, High-Contrast Typography */}
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]">
              Turn enterprise data into{" "}
              <span className="text-indigo-400">decisions</span>.
            </h1>

            {/* Clear, Professional Subtext */}
            <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Connect relational databases, stream in-memory columnar datasets,
              and explore sub-12ms analytics with cryptographic row-level
              security.
            </p>

            {/* Restrained CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 text-xs rounded-lg font-semibold flex items-center gap-2 shadow-xs transition"
              >
                <span>Launch Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/benchmarks"
                className="bg-slate-900/90 border border-white/10 hover:border-white/20 text-slate-200 px-5 py-2.5 text-xs rounded-lg flex items-center gap-2 transition"
              >
                <Database className="h-3.5 w-3.5 text-indigo-400" />
                <span>View DuckDB Benchmarks</span>
              </Link>
            </div>

            {/* Technical Sub-Caption */}
            <p className="mt-4 text-[11px] font-mono text-slate-500">
              In-Memory DuckDB OLAP · Zero-Copy Arrow Buffers · Cryptographic RLS
            </p>
          </div>

          {/* ============================================================ */}
          {/* REALISTIC RICOZVIZ DASHBOARD PREVIEW (THE VISUAL FOCUS)     */}
          {/* ============================================================ */}
          <div className="mt-12">
            <HeroDashboardPreview />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. ARCHITECTURAL CAPABILITIES (TECHNICAL BENTO GRID)         */}
      {/* ============================================================ */}
      <section
        id="capabilities"
        className="py-20 bg-[#0B1120] border-t border-white/[0.08] relative"
      >
        <HaikeiBackground variant="emerald-grid" className="opacity-25" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
              Architectural Capabilities
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Engineered for speed, isolation, and craft.
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Built with dedicated in-memory OLAP acceleration, cryptographic
              row-level security, and real-time multiplayer state synchronization.
            </p>
          </div>

          {/* Technical Bento Grid */}
          <BentoGrid>
            {/* Bento Card 1: 2x2 Core Engine */}
            <BentoCard
              span="2x2"
              variant="technical"
              badge="Core Engine"
              title="Self-Service Visualization Studio & DuckDB Engine"
              subtitle="Parameterized SQL-injection safe analytics with sub-12ms in-memory aggregation across relational and tabular datasets."
            >
              <div className="mt-4 space-y-4">
                <QueryIdeWindow />

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">
                      Throughput
                    </span>
                    <p className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      100k+ rps
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">
                      Memory Footprint
                    </span>
                    <p className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      Zero-Copy
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                    <span className="text-[10px] font-mono text-slate-400">
                      Chart Types
                    </span>
                    <p className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                      8 Native
                    </p>
                  </div>
                </div>
              </div>
            </BentoCard>

            {/* Bento Card 2: 1x1 Row-Level Security */}
            <BentoCard
              span="1x1"
              variant="technical"
              badge="Security & Governance"
              title="Row-Level Security (RLS) & RBAC"
              subtitle="Granular row filters and cryptographic token policies enforce tenant boundaries without query bypass."
            >
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#090D16] border border-white/[0.06] text-[11px] font-mono">
                  <span className="text-slate-300">tenant_id = auth.org</span>
                  <span className="text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">
                    ENFORCED
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#090D16] border border-white/[0.06] text-[11px] font-mono">
                  <span className="text-slate-300">region = user.region</span>
                  <span className="text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">
                    ISOLATED
                  </span>
                </div>
              </div>
            </BentoCard>

            {/* Bento Card 3: 1x1 Real-Time Collaboration */}
            <BentoCard
              span="1x1"
              variant="technical"
              badge="Real-Time Collaboration"
              title="Live Multiplayer Analytics"
              subtitle="Multi-user live presence, cursor and widget focus locks, and conflict-safe optimistic concurrency control."
            >
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/[0.08]">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <span className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">
                    AL
                  </span>
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">
                    BO
                  </span>
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold border border-[#0F172A]">
                    CH
                  </span>
                </div>
                <span className="text-[11px] font-mono text-indigo-400 font-medium bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">
                  SSE Multiplexed
                </span>
              </div>
            </BentoCard>

            {/* Bento Card 4: 2x1 Public & Embedded Analytics */}
            <BentoCard
              span="2x1"
              variant="technical"
              badge="Embedded Analytics"
              title="Public & Embedded Analytics Engine"
              subtitle="Secure iframe embedding with origin policy restrictions, auto-expiring cryptographic tokens, and zero credential leakage."
            >
              <div className="mt-3 flex items-center gap-3">
                <code className="text-xs font-mono bg-[#090D16] px-3 py-2 rounded-lg border border-white/[0.06] text-indigo-300 flex-1 truncate">
                  &lt;iframe src=&quot;https://ricozviz.app/embed/tok_48char&quot; ... /&gt;
                </code>
                <Link
                  href="/docs"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 text-xs rounded-lg font-semibold whitespace-nowrap transition"
                >
                  View Embed Specs
                </Link>
              </div>
            </BentoCard>

            {/* Bento Card 5: 1x1 Automated Alerts */}
            <BentoCard
              span="1x1"
              variant="technical"
              badge="Automated Alerts"
              title="Alerts & Scheduled Reports"
              subtitle="Metric anomaly detection and cron-driven delivery across email, webhooks, and workspace notifications."
            >
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Anomaly Threshold: &gt; 95%</span>
                <span className="text-amber-400 font-semibold bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded text-[10px]">
                  CRON ACTIVE
                </span>
              </div>
            </BentoCard>
          </BentoGrid>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. DATA WORKFLOW PIPELINE                                   */}
      {/* ============================================================ */}
      <section
        id="workflow"
        className="py-20 bg-[#090D16] border-t border-white/[0.08] relative"
      >
        <HaikeiBackground variant="tech-grid" className="opacity-40" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
              End-to-End Pipeline
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              From raw data to actionable insight
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              An architectural pipeline transforming raw tabular data into
              governed decision assets.
            </p>
          </div>

          <IsometricPipeline />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. DATA TOPOLOGY                                            */}
      {/* ============================================================ */}
      <section
        id="topology"
        className="py-20 bg-[#0B1120] border-t border-white/[0.08] text-white relative overflow-hidden"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400">
              Connected Infrastructure
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Trace every metric to its source.
            </h2>
            <p className="mt-3 text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              From relational connection pools and CSV streams through schema
              discovery and parameterized query execution into live executive canvases.
            </p>
          </div>

          <DataNetworkGraph />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. CALL TO ACTION                                           */}
      {/* ============================================================ */}
      <section className="py-20 bg-[#0A0F1D] border-t border-white/[0.08] text-white relative">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Bring your enterprise data into focus.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Connect data sources, build responsive charts, collaborate in real
            time, and share governed analytics with confidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 text-xs rounded-lg shadow-xs transition"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="border border-white/10 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-semibold px-5 py-2.5 text-xs rounded-lg transition"
            >
              Sign In to Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 7. COMPREHENSIVE TECHNICAL FOOTER                           */}
      {/* ============================================================ */}
      <TechnicalFooter />
    </div>
  );
}
