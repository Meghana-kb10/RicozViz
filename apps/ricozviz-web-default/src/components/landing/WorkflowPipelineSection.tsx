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
  visualType: "connectors" | "vector" | "compute" | "security" | "canvas";
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "sources",
    stepNumber: "01",
    name: "Enterprise Ingest",
    tagline: "Connect warehouses, lakehouses & live streams in one click",
    metricBadge: "9+ Zero-Config Connectors",
    icon: Database,
    features: [
      {
        title: "Direct Warehouse Pushdown",
        desc: "Executes natively inside Snowflake, BigQuery, Databricks, and ClickHouse without data movement.",
        icon: Zap,
      },
      {
        title: "Real-Time Event Streaming",
        desc: "Live ingestion from Apache Kafka, Amazon Kinesis, and Postgres CDC with sub-second lag.",
        icon: Radio,
      },
      {
        title: "TLS 1.3 Hardware Handshake",
        desc: "End-to-end encrypted pipelines with automated 90-day credential rotation and zero key leakage.",
        icon: Lock,
      },
    ],
    visualStats: [
      { label: "Supported Warehouses", value: "9 Enterprise", change: "+ Snowflake & Kafka" },
      { label: "Connection Latency", value: "1.4 ms", change: "Warm pool cached" },
      { label: "Data Egress Cost", value: "$0.00", change: "100% zero-egress pushdown" },
    ],
    visualType: "connectors",
  },
  {
    id: "vectorize",
    stepNumber: "02",
    name: "Zero-Copy Vectorize",
    tagline: "Transform datasets into ultra-fast Apache Arrow memory buffers",
    metricBadge: "Apache Arrow SIMD-128",
    icon: Layers,
    features: [
      {
        title: "Columnar Memory Layout",
        desc: "Arrow IPC formats eliminate serialization overhead, slicing across 10M rows in milliseconds.",
        icon: Layers,
      },
      {
        title: "Hardware SIMD Registers",
        desc: "Leverages modern CPU vector instructions (AVX-512 & NEON) directly inside the browser and edge.",
        icon: Cpu,
      },
      {
        title: "Automatic Schema Inference",
        desc: "Instant type detection and schema drift protection across heterogenous Parquet and JSON files.",
        icon: Sparkles,
      },
    ],
    visualStats: [
      { label: "Vector Scan Rate", value: "240k rows/s", change: "SIMD hardware accelerated" },
      { label: "Memory Footprint", value: "0 B Spill", change: "Snappy compressed in-RAM" },
      { label: "Serialization Delay", value: "0.0 ms", change: "Zero copy transfer" },
    ],
    visualType: "vector",
  },
  {
    id: "compute",
    stepNumber: "03",
    name: "DuckDB Wasm OLAP",
    tagline: "Blazing fast in-memory analytics engine with sub-12ms queries",
    metricBadge: "< 12ms P95 Execution",
    icon: Cpu,
    features: [
      {
        title: "Compiled Analytical Speed",
        desc: "Runs compiled C++ vector kernels directly inside WebAssembly, eliminating warehouse roundtrips.",
        icon: Zap,
      },
      {
        title: "Full SQL-2016 Analytical Power",
        desc: "Complex joins, window functions, and time-series aggregation without writing custom code.",
        icon: Activity,
      },
      {
        title: "80% Cloud Warehouse Cost Savings",
        desc: "Offloads repetitive exploratory queries from costly cloud compute nodes to local client cores.",
        icon: TrendingUp,
      },
    ],
    visualStats: [
      { label: "P95 Query Latency", value: "8.4 ms", change: "Sub-12ms verified across 1M rows" },
      { label: "Query Throughput", value: "119,048 rps", change: "> 100k+ rps sustained" },
      { label: "Warehouse Offload", value: "84.2%", change: "Local in-memory cached" },
    ],
    visualType: "compute",
  },
  {
    id: "security",
    stepNumber: "04",
    name: "Cryptographic Guard",
    tagline: "Kernel Row-Level Security, PII masking & immutable audit trails",
    metricBadge: "RFC 6962 SHA-256 Ledger",
    icon: ShieldCheck,
    features: [
      {
        title: "Deterministic Tenant Isolation",
        desc: "Cryptographic AST filters guarantee zero cross-tenant leakage, even on custom user SQL.",
        icon: Lock,
      },
      {
        title: "Real-Time PII Masking",
        desc: "Automatically obscures emails, financial accounts, and health identifiers for non-admin roles.",
        icon: Eye,
      },
      {
        title: "Hardware Kill-Switch",
        desc: "Instantly revoke compromised session tokens and terminate active queries across all tenants.",
        icon: ShieldCheck,
      },
    ],
    visualStats: [
      { label: "Tenant Isolation", value: "100% Strict", change: "Kernel AST parsed" },
      { label: "Audit Hash Chain", value: "SHA-256", change: "Tamper-evident Merkle tree" },
      { label: "Compliance Standards", value: "SOC 2 & HIPAA", change: "Audited & BAA certified" },
    ],
    visualType: "security",
  },
  {
    id: "canvas",
    stepNumber: "05",
    name: "Executive Canvases",
    tagline: "Assemble interactive dashboards with live multiplayer collaboration",
    metricBadge: "60 FPS Visual Studio",
    icon: LayoutDashboard,
    features: [
      {
        title: "Multi-Canvas Studio",
        desc: "Drag, drop, and link 18+ visual charts with sub-frame point-and-click data filtering.",
        icon: BarChart3,
      },
      {
        title: "Live Multiplayer Presence",
        desc: "See teammates' live cursors, active bookmarks, and shared exploration sessions in real time.",
        icon: Users,
      },
      {
        title: "Secure Expiring Embeds",
        desc: "Embed governed canvases into your own customer-facing apps with HMAC-signed expiring tokens.",
        icon: Sparkles,
      },
    ],
    visualStats: [
      { label: "Visual Chart Types", value: "18+ Built-in", change: "Area, Sankey, Geo, Treemap" },
      { label: "Sync Protocol", value: "WebSockets", change: "Sub-5ms cursor presence" },
      { label: "Frame Rate", value: "60 FPS", change: "GPU accelerated canvas" },
    ],
    visualType: "canvas",
  },
];

export default function WorkflowPipelineSection() {
  const [activeStepId, setActiveStepId] = useState<string>("compute");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [metricPulse, setMetricPulse] = useState<number>(8.4);
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
          <span className="flex items-center gap-[6px] rounded-full border border-[#2e2e2e] bg-[#171717] px-[14px] py-[6px] text-[12px] font-mono-code text-[#b4b4b4]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35] animate-pulse" />
            Zero Data Movement
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
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[14px]">
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

              <div className="flex items-center gap-[6px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-[10px] py-[2px] font-mono-code text-[11px] text-emerald-400">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Active</span>
              </div>
            </div>

            {/* DYNAMIC VISUAL REPRESENTATION BASED ON STEP */}
            <div className="my-[20px] flex min-h-[220px] flex-col justify-center">
              {currentStep.visualType === "connectors" && (
                /* Step 1 Visual: Connectors Grid with Live Status */
                <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3">
                  {[
                    { name: "Snowflake", proto: "Flight SQL", status: "Sub-12ms", active: true },
                    { name: "ClickHouse", proto: "Native TCP", status: "Sub-10ms", active: true },
                    { name: "Apache Kafka", proto: "Wire Event", status: "Sub-1ms", active: true },
                    { name: "BigQuery", proto: "Storage API", status: "Direct", active: true },
                    { name: "S3 Parquet", proto: "Snappy Arrow", status: "Zero-Copy", active: true },
                    { name: "PostgreSQL", proto: "CDC Replication", status: "Real-Time", active: true },
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

              {currentStep.visualType === "vector" && (
                /* Step 2 Visual: Arrow Columnar Memory Projection */
                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
                    <span>SIMD-128 Column Buffers</span>
                    <span className="text-[#ff6b35]">Zero Intermediate Copy</span>
                  </div>
                  <div className="flex flex-col gap-[8px]">
                    {[
                      { col: "tenant_id", type: "Utf8 Dictionary", fill: "95%", bytes: "4.2 MB" },
                      { col: "event_timestamp", type: "TimestampMicrosecond", fill: "80%", bytes: "8.4 MB" },
                      { col: "revenue_metric", type: "Decimal128(18,2)", fill: "100%", bytes: "16.8 MB" },
                      { col: "region_code", type: "FixedSizeBinary(2)", fill: "60%", bytes: "2.1 MB" },
                    ].map((col, idx) => (
                      <div
                        key={idx}
                        className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px] transition-all hover:border-[#ff6b35]/50"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono-code mb-[6px]">
                          <span className="text-[#fafafa] font-semibold">{col.col}</span>
                          <span className="text-[#898989]">{col.type}</span>
                          <span className="text-[#ff6b35]">{col.bytes}</span>
                        </div>
                        <div className="h-[4px] w-full rounded-full bg-[#242424] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-[#9a3412] to-[#ff6b35]"
                            style={{ width: col.fill }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep.visualType === "compute" && (
                /* Step 3 Visual: Real-Time Vector Speed Gauge & Offload */
                <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-[14px] border border-[#2e2e2e] bg-[#171717] p-[16px] text-center hover:border-[#ff6b35]/50 transition-colors">
                    <span className="text-[11px] font-mono-code uppercase text-[#898989]">
                      Measured Execution Latency
                    </span>
                    <div className="my-[12px]">
                      <span className="text-[40px] font-bold font-mono-code text-emerald-400">
                        {metricPulse}
                      </span>
                      <span className="text-[18px] font-mono-code text-emerald-400 ml-1">
                        ms
                      </span>
                    </div>
                    <span className="text-[11px] text-[#898989]">
                      Sub-12ms SLA Guarantee (1,000,000 Rows)
                    </span>
                  </div>

                  <div className="flex flex-col justify-between rounded-[14px] border border-[#2e2e2e] bg-[#171717] p-[16px] hover:border-[#ff6b35]/50 transition-colors">
                    <span className="text-[11px] font-mono-code uppercase text-[#898989]">
                      Warehouse Query Offload
                    </span>
                    <div className="my-[10px] flex items-center justify-between">
                      <span className="text-[32px] font-bold font-mono-code text-[#fafafa]">
                        84.2%
                      </span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-[10px] py-[3px] font-mono-code text-[11px] text-emerald-400">
                        -$14.8k / mo
                      </span>
                    </div>
                    <div className="h-[6px] w-full rounded-full bg-[#242424] overflow-hidden">
                      <div className="h-full rounded-full bg-linear-to-r from-emerald-600 to-emerald-400 w-[84%]" />
                    </div>
                  </div>
                </div>
              )}

              {currentStep.visualType === "security" && (
                /* Step 4 Visual: Cryptographic Shield & Dynamic Masking */
                <div className="flex flex-col gap-[10px]">
                  <div className="rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[14px] flex items-center justify-between">
                    <div className="flex items-center gap-[10px]">
                      <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-[18px] w-[18px]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[#fafafa]">
                          Tenant Boundary Enforced
                        </div>
                        <div className="text-[11px] text-[#898989]">
                          AST rewritten: WHERE tenant_id = &apos;org_enterprise&apos;
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-code text-[10px] rounded border border-emerald-500/30 bg-emerald-500/10 px-[8px] py-[2px] text-emerald-400">
                      Zero Leakage
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-[10px]">
                    <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px]">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989] block">
                        Dynamic PII Obfuscation
                      </span>
                      <span className="text-[12px] font-mono-code text-[#ff6b35] block mt-1">
                        j***@company.com
                      </span>
                    </div>
                    <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[10px]">
                      <span className="text-[10px] font-mono-code uppercase text-[#898989] block">
                        SHA-256 Ledger Block
                      </span>
                      <span className="text-[12px] font-mono-code text-[#fafafa] block mt-1 truncate">
                        0x7a89fbc00192ea44…
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
            <div className="grid grid-cols-3 gap-[10px] border-t border-[#2e2e2e] pt-[14px]">
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
