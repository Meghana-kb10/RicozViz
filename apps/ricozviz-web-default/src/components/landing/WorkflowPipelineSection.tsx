"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Cpu,
  ShieldCheck,
  LayoutDashboard,
  Zap,
  ArrowRight,
  Play,
  Activity,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  BarChart3,
  Users,
  Lock,
  Radio,
  Eye,
  Bell,
  Code2,
  FileSpreadsheet,
  Share2,
} from "lucide-react";

interface PipelineStep {
  id: string;
  stepNumber: string;
  name: string;
  tagline: string;
  metricBadge: string;
  icon: React.ComponentType<{ className?: string }>;
  features: { title: string; desc: string; icon: React.ComponentType<{ className?: string }> }[];
  visualStats: { label: string; value: string; change: string }[];
  visualType: "connectors" | "quality" | "analytics" | "canvas" | "embeds";
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "sources",
    stepNumber: "01",
    name: "Universal Ingest",
    tagline: "Connect cloud warehouses, relational DBs, REST APIs & spreadsheets",
    metricBadge: "9+ Production Connectors",
    icon: Database,
    features: [
      {
        title: "Relational DBs & Warehouses",
        desc: "Native query pushdown for PostgreSQL, MySQL, SQLite, Snowflake, BigQuery, ClickHouse, and Redshift.",
        icon: Database,
      },
      {
        title: "REST Endpoints & Spreadsheets",
        desc: "Ingest third-party JSON REST APIs or upload CSV and Excel workbooks directly into queryable datasets.",
        icon: FileSpreadsheet,
      },
      {
        title: "Encrypted Credential Security",
        desc: "AES-256 encrypted connection strings with proactive health probes and connection pool caching.",
        icon: Lock,
      },
    ],
    visualStats: [
      { label: "Supported Sources", value: "9 Enterprise", change: "+ Snowflake, BigQuery & REST" },
      { label: "Connection Handshake", value: "2.4 ms", change: "Connection pool warm" },
      { label: "Data Egress Cost", value: "$0.00", change: "100% direct query pushdown" },
    ],
    visualType: "connectors",
  },
  {
    id: "quality",
    stepNumber: "02",
    name: "Schema & Quality",
    tagline: "Automated schema profiling, null checks & data health scoring",
    metricBadge: "Autonomous Profiling",
    icon: Layers,
    features: [
      {
        title: "Instant Schema Discovery",
        desc: "Automatic column type inference, primary key indexing, and table relationship mapping across datasets.",
        icon: Sparkles,
      },
      {
        title: "Data Quality Profiling",
        desc: "Calculates null percentages, value distributions, distinct counts, and format validity in real time.",
        icon: Activity,
      },
      {
        title: "Anomaly & Drift Detection",
        desc: "Flags unexpected column alterations, missing fields, or data skew before it impacts dashboards.",
        icon: ShieldCheck,
      },
    ],
    visualStats: [
      { label: "Data Completeness", value: "99.8%", change: "Zero critical null fields" },
      { label: "Schema Introspection", value: "38 ms", change: "Instant cataloging" },
      { label: "Health Score", value: "98.4 / 100", change: "Production ready" },
    ],
    visualType: "quality",
  },
  {
    id: "analytics",
    stepNumber: "03",
    name: "SQL & AI Studio",
    tagline: "Ask questions in plain English or write SQL with instant visual feedback",
    metricBadge: "NL-to-Chart AI Engine",
    icon: Cpu,
    features: [
      {
        title: "Natural Language to Chart",
        desc: "Say 'Show monthly revenue by tier as an area chart' — AI synthesizes SQL and configures Recharts instantly.",
        icon: Sparkles,
      },
      {
        title: "High-Performance SQL Runner",
        desc: "Write parameterized SQL queries with instant tabular previews, row-level stats, and JSON exports.",
        icon: Zap,
      },
      {
        title: "Dataset Result Caching",
        desc: "Cache query results to power multi-widget dashboards without running duplicate warehouse queries.",
        icon: TrendingUp,
      },
    ],
    visualStats: [
      { label: "AI Synthesis Speed", value: "< 420 ms", change: "Schema-aware prompt pipeline" },
      { label: "Query Execution", value: "11.2 ms", change: "Pushdown optimized" },
      { label: "Warehouse Offload", value: "85.4%", change: "Smart dataset caching" },
    ],
    visualType: "analytics",
  },
  {
    id: "canvas",
    stepNumber: "04",
    name: "Dashboard Studio",
    tagline: "Assemble multi-widget interactive dashboards with Recharts",
    metricBadge: "10+ Visual Chart Types",
    icon: LayoutDashboard,
    features: [
      {
        title: "10+ Visual Chart Types",
        desc: "Area, Bar, Line, Pie, Radar, Scatter, Composed, and KPI Single-Value Cards with sleek animations.",
        icon: BarChart3,
      },
      {
        title: "Fluid 12-Column Responsive Grid",
        desc: "Freely resize, arrange, and stack widgets to build executive summaries and operational dashboards.",
        icon: LayoutDashboard,
      },
      {
        title: "Global Time & Filter Sync",
        desc: "Synchronize date ranges and dimension filters across every widget on the canvas simultaneously.",
        icon: Layers,
      },
    ],
    visualStats: [
      { label: "Visual Chart Types", value: "10+ Built-in", change: "Area, Bar, Line, Radar, Cards" },
      { label: "Render Framerate", value: "60 FPS", change: "Hardware-accelerated DOM" },
      { label: "Canvas Layout", value: "12-Col Fluid", change: "Responsive desktop & mobile" },
    ],
    visualType: "canvas",
  },
  {
    id: "embeds",
    stepNumber: "05",
    name: "Alerts & Signed Embeds",
    tagline: "Automate threshold webhooks & embed secure dashboards in your product",
    metricBadge: "HMAC Signed Embeds",
    icon: ShieldCheck,
    features: [
      {
        title: "Automated Metric Alerts",
        desc: "Set threshold alerts on revenue or error spikes with automated Webhook and Email triggers.",
        icon: Bell,
      },
      {
        title: "Expiring Signed Iframe Embeds",
        desc: "Embed governed canvases into your own customer portals with HMAC-signed expiring tokens.",
        icon: Share2,
      },
      {
        title: "Workspace RBAC & Audit Trails",
        desc: "Strict Admin and Member role permissions with complete immutable audit logs for all query actions.",
        icon: Lock,
      },
    ],
    visualStats: [
      { label: "Embed Token Security", value: "HMAC SHA-256", change: "Time-limited expiring tokens" },
      { label: "Alert Latency", value: "< 120 ms", change: "Webhooks & Email dispatch" },
      { label: "Audit Traceability", value: "100% Logged", change: "Every query & export recorded" },
    ],
    visualType: "embeds",
  },
];

export default function WorkflowPipelineSection() {
  const [activeStepId, setActiveStepId] = useState<string>("analytics");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [metricPulse, setMetricPulse] = useState<number>(11.2);
  const [selectedChartType, setSelectedChartType] = useState<"area" | "bar" | "donut">("area");

  const currentStep =
    PIPELINE_STEPS.find((s) => s.id === activeStepId) || PIPELINE_STEPS[2];

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setMetricPulse(Number((6.5 + Math.random() * 3.5).toFixed(1)));
      setIsSimulating(false);
    }, 400);
  };

  return (
    <section id="workflow" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35] mb-[10px]">
            <Sparkles className="h-[12px] w-[12px]" />
            <span>CUSTOMER-FRIENDLY PIPELINE</span>
          </div>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              From raw warehouse data,
            </span>
            <span className="block text-[#fafafa]">
              to executive canvases in sub-12 milliseconds
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-[8px]">
          <span className="flex items-center gap-[6px] rounded-full border border-[#2e2e2e] bg-[#171717] px-[14px] py-[6px] text-[12px] font-mono-code text-[#b4b4b4] shrink-0 whitespace-nowrap">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35] animate-pulse shrink-0" />
            <span>Zero Data Movement</span>
          </span>
        </div>
      </div>

      {/* 5-STEP HORIZONTAL VISUAL STEPPER */}
      <div className="mb-[28px] grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-5">
        {PIPELINE_STEPS.map((step) => {
          const isActive = step.id === activeStepId;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setActiveStepId(step.id);
                setMetricPulse(Number((6.5 + Math.random() * 3.5).toFixed(1)));
              }}
              className={`group relative flex flex-col items-start rounded-[16px] border p-[18px] text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                step.id === PIPELINE_STEPS[PIPELINE_STEPS.length - 1].id ? "col-span-2 sm:col-span-1" : ""
              } ${
                isActive
                  ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_8px_30px_rgba(255,107,53,0.16)] -translate-y-1"
                  : "border-[#2e2e2e] bg-[#171717] hover:border-[#393939] hover:bg-[#1a1a1a] hover:-translate-y-0.5"
              }`}
            >
              {/* Subtle top indicator bar */}
              <div
                className={`absolute inset-x-0 top-0 h-[2px] transition-colors ${
                  isActive ? "bg-[#ff6b35]" : "bg-transparent group-hover:bg-[#ff6b35]/40"
                }`}
              />

              <div className="flex w-full items-center justify-between">
                <span
                  className={`text-[11px] font-mono-code ${
                    isActive ? "text-[#ff6b35] font-semibold" : "text-[#898989]"
                  }`}
                >
                  {step.stepNumber}
                </span>
                <div
                  className={`flex h-[28px] w-[28px] items-center justify-center rounded-[8px] transition-colors ${
                    isActive
                      ? "bg-[#ff6b35]/20 text-[#ff6b35]"
                      : "bg-[#242424] text-[#898989] group-hover:text-[#fafafa]"
                  }`}
                >
                  <Icon className="h-[14px] w-[14px]" />
                </div>
              </div>

              <div
                className={`mt-[12px] text-[14px] font-medium transition-colors ${
                  isActive ? "text-[#fafafa]" : "text-[#b4b4b4] group-hover:text-[#fafafa]"
                }`}
              >
                {step.name}
              </div>

              <div className="mt-[4px] text-[11px] text-[#898989] truncate w-full">
                {step.metricBadge}
              </div>
            </button>
          );
        })}
      </div>

      {/* ACTIVE STEP VISUAL WORKBENCH */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#2e2e2e] bg-[#171717] p-[24px] sm:p-[32px] shadow-2xl">
        {/* Subtle Ambient Background Faded Artwork */}
        <div
          className="pointer-events-none absolute -right-20 -bottom-20 w-[420px] h-[420px] rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff6b35 0%, transparent 70%)" }}
        />

        <div className="relative z-10 grid grid-cols-1 gap-[36px] lg:grid-cols-12 items-center">
          {/* LEFT 5 COLS: Customer-Friendly Features & Benefits */}
          <div className="flex flex-col justify-between gap-[24px] lg:col-span-5">
            <div>
              <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35]">
                <span>STAGE {currentStep.stepNumber} //</span>
                <span className="font-semibold">{currentStep.metricBadge}</span>
              </div>

              <h3 className="mt-[14px] text-[24px] font-normal leading-[1.2] text-[#fafafa] sm:text-[26px]">
                {currentStep.tagline}
              </h3>

              {/* Feature Benefit List */}
              <div className="mt-[24px] flex flex-col gap-[14px]">
                {currentStep.features.map((feat, idx) => {
                  const FeatIcon = feat.icon;
                  return (
                    <div
                      key={idx}
                      className="group flex items-start gap-[12px] rounded-[12px] border border-transparent p-[10px] transition-all duration-200 hover:border-[#2e2e2e] hover:bg-[#121212]"
                    >
                      <div className="mt-[2px] flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] border border-[#2e2e2e] bg-[#121212] text-[#ff6b35] group-hover:border-[#ff6b35]/50 group-hover:bg-[#ff6b35]/10 transition-colors">
                        <FeatIcon className="h-[14px] w-[14px]" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-medium text-[#fafafa]">
                          {feat.title}
                        </h4>
                        <p className="mt-[2px] text-[12px] leading-[1.5] text-[#898989]">
                          {feat.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Interactive Trigger */}
            <div className="flex flex-wrap items-center gap-[12px] pt-[8px]">
              <button
                type="button"
                onClick={handleSimulate}
                disabled={isSimulating}
                className="flex items-center gap-[6px] rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-[16px] py-[8px] text-[12px] font-medium text-[#fafafa] transition-all hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer shadow-[0_0_20px_rgba(255,107,53,0.18)]"
              >
                <Play className={`h-[12px] w-[12px] ${isSimulating ? "animate-spin" : ""}`} />
                <span>{isSimulating ? "Measuring Throughput…" : "Simulate Pipeline Run"}</span>
              </button>

              <a
                href="#piece-workbench"
                className="flex items-center gap-[5px] rounded-full border border-[#393939] bg-[#1c1c1c] px-[14px] py-[8px] text-[12px] text-[#b4b4b4] hover:text-[#fafafa] hover:border-[#4d4d4d] transition-colors"
              >
                <span>Explore Workbench</span>
                <ArrowRight className="h-[12px] w-[12px]" />
              </a>
            </div>
          </div>

          {/* RIGHT 7 COLS: Rich Visual Canvas (Zero Code Clutter) */}
          <div className="flex flex-col rounded-[16px] border border-[#2e2e2e] bg-[#121212] p-[20px] sm:p-[24px] lg:col-span-7 shadow-inner">
            {/* Visual Canvas Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2e2e] pb-[14px]">
              <div className="flex items-center gap-[10px]">
                <div className="flex gap-[5px]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#393939]" />
                  <span className="h-[7px] w-[7px] rounded-full bg-[#393939]" />
                  <span className="h-[7px] w-[7px] rounded-full bg-[#393939]" />
                </div>
                <span className="text-[12px] font-mono-code text-[#fafafa]">
                  Interactive Telemetry Studio
                </span>
              </div>

              <div className="flex items-center gap-[6px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-[10px] py-[2px] font-mono-code text-[11px] text-emerald-400 shrink-0 whitespace-nowrap">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Live Active</span>
              </div>
            </div>

            {/* DYNAMIC VISUAL REPRESENTATION BASED ON STEP */}
            <div className="my-[20px] flex min-h-[220px] flex-col justify-center">
              {currentStep.visualType === "connectors" && (
                /* Step 1 Visual: Connectors Grid with Live Status */
                <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3">
                  {[
                    { name: "PostgreSQL", proto: "Direct Pool", status: "Sub-5ms", active: true },
                    { name: "Snowflake", proto: "Cloud SQL", status: "Sub-12ms", active: true },
                    { name: "ClickHouse", proto: "Native TCP", status: "Sub-8ms", active: true },
                    { name: "BigQuery", proto: "Storage API", status: "Direct", active: true },
                    { name: "REST API", proto: "JSON Ingest", status: "Live Feed", active: true },
                    { name: "Excel / CSV", proto: "Workbook Ingest", status: "Instant", active: true },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="group rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[12px] transition-all hover:border-[#ff6b35]/60 hover:bg-[#1c1c1c] hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[#fafafa]">
                          {item.name}
                        </span>
                        <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                      </div>
                      <div className="mt-[6px] flex items-center justify-between text-[10px] font-mono-code">
                        <span className="text-[#898989]">{item.proto}</span>
                        <span className="text-[#ff6b35] font-semibold">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {currentStep.visualType === "quality" && (
                /* Step 2 Visual: Automated Data Quality Profiling & Schema Health */
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
                    <span>Automated Column Health Profiling</span>
                    <span className="text-emerald-400 font-semibold">98.4% Quality Score</span>
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    {[
                      { col: "customer_id", type: "UUID Primary Key", validity: "100% Unique", fill: "100%", nulls: "0% Null" },
                      { col: "total_amount", type: "DECIMAL(12,2)", validity: "Valid Range", fill: "99.8%", nulls: "0.2% Null" },
                      { col: "fulfillment_status", type: "VARCHAR Enum", validity: "4 Cardinalities", fill: "95%", nulls: "0% Null" },
                      { col: "created_at", type: "TIMESTAMPTZ", validity: "ISO 8601", fill: "100%", nulls: "0% Null" },
                    ].map((col, idx) => (
                      <div
                        key={idx}
                        className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px] transition-all hover:border-[#ff6b35]/50"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-code mb-[6px]">
                          <span className="text-[#fafafa] font-semibold truncate min-w-0">{col.col}</span>
                          <span className="text-[#898989] truncate">{col.type}</span>
                          <span className="text-emerald-400 shrink-0 whitespace-nowrap">{col.nulls}</span>
                        </div>
                        <div className="h-[4px] w-full rounded-full bg-[#242424] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-[#9a3412] to-emerald-400"
                            style={{ width: col.fill }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep.visualType === "analytics" && (
                /* Step 3 Visual: Natural Language to Chart AI & SQL Runner */
                <div className="flex flex-col gap-[12px]">
                  {/* NL Prompt Bubble */}
                  <div className="rounded-[12px] border border-[#ff6b35]/30 bg-[#ff6b35]/5 p-[12px]">
                    <div className="flex items-center justify-between text-[10px] font-mono-code text-[#ff6b35] mb-[4px]">
                      <span className="flex items-center gap-[4px]">
                        <Sparkles className="h-[10px] w-[10px]" />
                        NL-TO-CHART AI QUERY
                      </span>
                      <span>Confidence 99.1%</span>
                    </div>
                    <div className="text-[12px] text-[#fafafa] font-sans">
                      &quot;Show quarterly revenue growth by subscription tier as a stacked area chart&quot;
                    </div>
                  </div>

                  {/* Generated SQL & Speed */}
                  <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                    <div className="flex flex-col justify-between rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989]">
                        Synthesized SQL Query
                      </span>
                      <pre className="my-[6px] text-[10px] font-mono-code text-amber-300 overflow-x-auto whitespace-pre">
                        SELECT DATE_TRUNC(&apos;quarter&apos;, created_at), tier, SUM(amount) FROM subscriptions GROUP BY 1, 2
                      </pre>
                      <span className="text-[10px] text-emerald-400 font-mono-code">
                        Auto-assigned to Recharts Area
                      </span>
                    </div>

                    <div className="flex flex-col justify-between rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[12px] text-center">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989]">
                        Pushdown Execution Speed
                      </span>
                      <div className="my-[4px]">
                        <span className="text-[32px] font-bold font-mono-code text-emerald-400">
                          {metricPulse}
                        </span>
                        <span className="text-[14px] font-mono-code text-emerald-400 ml-1">
                          ms
                        </span>
                      </div>
                      <span className="text-[10px] text-[#898989]">
                        Zero warehouse roundtrip penalty
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {currentStep.visualType === "embeds" && (
                /* Step 5 Visual: Signed Expiring Embeds & Automated Webhook Alerts */
                <div className="flex flex-col gap-[10px]">
                  <div className="rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[14px] flex items-center justify-between">
                    <div className="flex items-center gap-[10px]">
                      <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-[18px] w-[18px]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[#fafafa]">
                          Signed Embed Token Active
                        </div>
                        <div className="text-[11px] font-mono-code text-[#898989] truncate max-w-[280px]">
                          /dashboards/embed/exp_9f82ab4c...
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-code text-[10px] rounded border border-emerald-500/30 bg-emerald-500/10 px-[8px] py-[2px] text-emerald-400">
                      HMAC Valid
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px]">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989] block">
                        Metric Alert Triggered
                      </span>
                      <span className="text-[12px] font-mono-code text-[#ff6b35] block mt-1">
                        Revenue &gt; $50k &#8594; Webhook dispatched
                      </span>
                    </div>
                    <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px]">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989] block">
                        Workspace RBAC Policy
                      </span>
                      <span className="text-[12px] font-mono-code text-emerald-400 block mt-1 truncate">
                        Role: ADMIN (Full Control)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {currentStep.visualType === "canvas" && (
                /* Step 5 Visual: Interactive Canvas Visualizer with Multiplayer Avatars */
                <div className="flex flex-col gap-[12px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[8px]">
                      {(["area", "bar", "donut"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedChartType(type)}
                          className={`rounded-[8px] border px-[10px] py-[4px] text-[11px] font-mono-code uppercase transition-colors cursor-pointer ${
                            selectedChartType === type
                              ? "border-[#ff6b35] bg-[#ff6b35]/15 text-[#ff6b35] font-semibold"
                              : "border-[#2e2e2e] bg-[#171717] text-[#898989] hover:text-[#fafafa]"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-[6px]">
                      <div className="flex -space-x-1">
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#ff6b35] text-[9px] font-bold text-white ring-2 ring-[#121212]">
                          S
                        </span>
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-purple-500 text-[9px] font-bold text-white ring-2 ring-[#121212]">
                          D
                        </span>
                      </div>
                      <span className="text-[11px] font-mono-code text-[#898989]">
                        2 Peers Live
                      </span>
                    </div>
                  </div>

                  {/* Micro Visual Chart Representation */}
                  <div className="h-[120px] w-full rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[12px] flex items-end gap-[6px]">
                    {[45, 60, 52, 78, 65, 88, 92, 105, 98, 124, 115, 142].map(
                      (val, idx) => (
                        <div key={idx} className="flex-1 flex flex-col justify-end h-full">
                          <div
                            className="w-full rounded-t-[3px] bg-linear-to-t from-[#9a3412] to-[#ff6b35] transition-all duration-300 hover:brightness-125"
                            style={{ height: `${(val / 150) * 100}%` }}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom 3-Column Visual Metrics Strip */}
            <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-[10px] border-t border-[#2e2e2e] pt-[14px]">
              {currentStep.visualStats.map((st, idx) => (
                <div key={idx} className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px]">
                  <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                    {st.label}
                  </span>
                  <span className="mt-[2px] block text-[15px] font-mono-code font-semibold text-[#fafafa]">
                    {st.value}
                  </span>
                  <span className="mt-[2px] block text-[10px] text-emerald-400 truncate">
                    {st.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
