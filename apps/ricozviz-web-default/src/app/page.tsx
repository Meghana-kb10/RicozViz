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
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ConnectorGridLogoCloud } from "@/components/shell/ConnectorGridLogoCloud";
import { SecurityGovernanceBadges } from "@/components/shell/SecurityGovernanceBadges";
import { DedicatedRlsGovernanceBlock } from "@/components/shell/DedicatedRlsGovernanceBlock";

export const metadata: Metadata = {
  title: "RicozViz — Enterprise Intelligence & In-Memory Analytics",
  description:
    "Connect your data, explore insights, build high-performance dashboards, and share governed analytics across your organization — all from one intelligent workspace.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F4F1EA] dark:bg-[#111827] text-[#172B3A] dark:text-[#E5E7EB] selection:bg-[#147D78] selection:text-white antialiased relative overflow-x-hidden font-sans transition-colors duration-200">
      {/* ============================================================ */}
      {/* 1. TOPBAR: Precision Navigation & Actions                    */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-50 border-b border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/90 dark:bg-[#111827]/90 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <BrandLogo size={30} priority />
              <div className="flex flex-col leading-none">
                <span className="text-base font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
                  Ricoz<span className="text-[#147D78] dark:text-[#4F9D8E]">Viz</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#596775] dark:text-[#9CA3AF]">
                  Intelligence OS
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#596775] dark:text-[#9CA3AF]">
              <a href="#capabilities" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Platform
              </a>
              <a href="#connectors" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Connectors
              </a>
              <a href="#governance" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Security & Trust
              </a>
              <a href="#workflow" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Pipeline
              </a>
              <a href="#topology" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Topology
              </a>
              <Link href="/docs" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Docs
              </Link>
              <Link href="/benchmarks" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Benchmarks
              </Link>
              <Link href="/status" className="hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition">
                Status
              </Link>
            </nav>
          </div>

          {/* Right Actions with Theme Toggle */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:bg-[#F4F1EA] dark:hover:bg-[#283548] text-[#172B3A] dark:text-[#E5E7EB] transition font-medium shadow-xs"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-xs rounded-lg bg-[#147D78] hover:bg-[#106963] dark:bg-[#4F9D8E] dark:hover:bg-[#43887B] text-white font-medium transition flex items-center gap-1.5 shadow-xs"
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
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-24">
        <Hero3DCanvas />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Confident, High-Contrast Typography */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB] leading-[1.16]">
              Turn enterprise data into{" "}
              <span className="text-[#147D78] dark:text-[#4F9D8E]">decisions</span>.
            </h1>

            {/* Clear, Professional Subtext */}
            <p className="mt-4 text-base sm:text-lg text-[#596775] dark:text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
              Connect relational databases, stream in-memory columnar datasets,
              and explore sub-12ms analytics with cryptographic row-level
              security.
            </p>

            {/* Restrained CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="bg-[#147D78] hover:bg-[#106963] dark:bg-[#4F9D8E] dark:hover:bg-[#43887B] text-white px-5 py-2.5 text-xs rounded-lg font-medium flex items-center gap-2 shadow-xs transition"
              >
                <span>Launch Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/benchmarks"
                className="bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/40 hover:bg-[#F4F1EA] dark:hover:bg-[#283548] text-[#172B3A] dark:text-[#E5E7EB] px-5 py-2.5 text-xs rounded-lg flex items-center gap-2 transition shadow-xs"
              >
                <Database className="h-3.5 w-3.5 text-[#147D78] dark:text-[#4F9D8E]" />
                <span>View DuckDB Benchmarks</span>
              </Link>
            </div>

            {/* Technical Sub-Caption */}
            <p className="mt-4 text-[11px] font-mono text-[#596775] dark:text-[#9CA3AF]">
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
        className="py-20 bg-white dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] relative transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
              Architectural Capabilities
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
              Engineered for speed, isolation, and craft.
            </h2>
            <p className="mt-3 text-sm text-[#596775] dark:text-[#9CA3AF] leading-relaxed">
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
              <div className="mt-4">
                <QueryIdeWindow />
              </div>
            </BentoCard>

            {/* Bento Card 2: 1x1 Dedicated Cryptographic Row-Level Security & RBAC */}
            <BentoCard
              span="1x1"
              variant="technical"
              badge="Security & Governance"
              title="Row-Level Security (RLS) & RBAC"
              subtitle="Granular row filters and cryptographic token policies dynamically isolate tenants and mask columns without database rebuilds."
            >
              <div className="mt-3 flex-1 flex flex-col justify-between">
                <DedicatedRlsGovernanceBlock compact />
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
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-[#DADFD9] dark:border-[#374151]">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <span className="h-6 w-6 rounded-full bg-[#147D78] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937]">
                    AL
                  </span>
                  <span className="h-6 w-6 rounded-full bg-[#2E5B70] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937]">
                    BO
                  </span>
                  <span className="h-6 w-6 rounded-full bg-[#106963] text-white flex items-center justify-center text-[10px] font-bold border border-white dark:border-[#1F2937]">
                    CH
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#147D78] dark:text-[#4F9D8E] font-medium bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] px-2 py-0.5 rounded">
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
                <code className="text-xs font-mono bg-[#F4F1EA] dark:bg-[#111827] px-3 py-2 rounded-lg border border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] flex-1 truncate">
                  &lt;iframe src=&quot;https://ricozviz.app/embed/tok_48char&quot; ... /&gt;
                </code>
                <Link
                  href="/docs"
                  className="bg-[#147D78] hover:bg-[#106963] dark:bg-[#4F9D8E] dark:hover:bg-[#43887B] text-white px-3.5 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition"
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
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-[#596775] dark:text-[#9CA3AF]">
                <span>Anomaly Threshold: &gt; 95%</span>
                <span className="text-[#D9A441] font-semibold bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] px-2 py-0.5 rounded text-[10px]">
                  CRON ACTIVE
                </span>
              </div>
            </BentoCard>
          </BentoGrid>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. ENTERPRISE DATA CONNECTOR GRID & LOGO CLOUD               */}
      {/* ============================================================ */}
      <section
        id="connectors"
        className="py-20 bg-white dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] relative transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
              Enterprise Integrations
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
              Native connectors for modern data warehouses & lakehouses
            </h2>
            <p className="mt-3 text-sm text-[#596775] dark:text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
              Direct pushdown execution and zero-copy streaming across Snowflake, ClickHouse, BigQuery, Databricks, Redshift, and S3 Parquet with cryptographic access tokens.
            </p>
          </div>

          <ConnectorGridLogoCloud />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. ENTERPRISE SECURITY & GOVERNANCE BADGES                   */}
      {/* ============================================================ */}
      <section
        id="governance"
        className="py-20 bg-[#F4F1EA] dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] relative transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
              Enterprise Trust & Governance
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
              Cryptographically verified security and compliance
            </h2>
            <p className="mt-3 text-sm text-[#596775] dark:text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
              Audited SOC 2 Type II controls, HIPAA ready data boundaries, ISO 27001 certification, and hardware-grade cryptographic row-level security.
            </p>
          </div>

          <SecurityGovernanceBadges />
        </div>
      </section>

      {/* ============================================================ */}
      {/* 6. DATA WORKFLOW PIPELINE                                   */}
      {/* ============================================================ */}
      <section
        id="workflow"
        className="py-20 bg-white dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] relative transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
              End-to-End Pipeline
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
              From raw data to actionable insight
            </h2>
            <p className="mt-3 text-sm text-[#596775] dark:text-[#9CA3AF]">
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
        className="py-20 bg-white dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] relative overflow-hidden transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
              Connected Infrastructure
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB] tracking-tight">
              Trace every metric to its source.
            </h2>
            <p className="mt-3 text-sm text-[#596775] dark:text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
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
      <section className="py-20 bg-[#F4F1EA] dark:bg-[#111827] border-t border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] relative transition-colors duration-200">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[#172B3A] dark:text-[#E5E7EB]">
            Bring your enterprise data into focus.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#596775] dark:text-[#9CA3AF] max-w-xl mx-auto leading-relaxed">
            Connect data sources, build responsive charts, collaborate in real
            time, and share governed analytics with confidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="bg-[#147D78] hover:bg-[#106963] dark:bg-[#4F9D8E] dark:hover:bg-[#43887B] text-white font-medium px-5 py-2.5 text-xs rounded-lg shadow-xs transition"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:bg-[#F4F1EA] dark:hover:bg-[#283548] text-[#172B3A] dark:text-[#E5E7EB] font-medium px-5 py-2.5 text-xs rounded-lg transition shadow-xs"
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
