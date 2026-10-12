"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Filter,
  BarChart3,
  LayoutDashboard,
  TrendingUp,
  Check,
  Code2,
  Table as TableIcon,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Lock,
  RefreshCw,
  Eye,
  Sparkles,
} from "lucide-react";

interface PipelineStage {
  step: string;
  id: string;
  name: string;
  tagline: string;
  summary: string;
  bulletPoints: string[];
  icon: React.ComponentType<{ className?: string }>;
  codeSnippet: {
    language: string;
    filename: string;
    code: string;
  };
  dataSample: {
    type: "table" | "json";
    tableHeaders?: string[];
    tableRows?: string[][];
    jsonText?: string;
  };
  previewBadge: string;
}

const STAGES: PipelineStage[] = [
  {
    step: "01",
    id: "sources",
    name: "Data Sources",
    tagline: "Secure Ingestion & Pooling",
    summary:
      "Direct connection pools and continuous streaming pipelines with TLS 1.3 encryption, connection pooling, and automated credential rotation.",
    bulletPoints: [
      "PostgreSQL SSL connection pool (max 25 pool units)",
      "High-throughput CSV streaming parser",
      "AES-256 credential encryption at rest",
    ],
    icon: Database,
    codeSnippet: {
      language: "SQL (Connection Config)",
      filename: "connection_pool.sql",
      code: `-- Establish TLS 1.3 encrypted connection pool
CONNECT 'postgresql://analytics_ro@db.internal:5432/core_prod'
WITH (
  ssl_mode = 'verify-full',
  max_connections = 25,
  connection_timeout = '3000ms',
  idle_timeout = '10000ms',
  credential_ref = 'vault://secret/prod/db_creds'
);`,
    },
    dataSample: {
      type: "json",
      jsonText: `{
  "source_id": "src_pg_prod_01",
  "driver": "postgresql",
  "endpoint": "db.internal:5432",
  "ssl_enabled": true,
  "tls_version": "TLSv1.3",
  "active_connections": 14,
  "health_status": "OPTIMAL",
  "latency_p50_ms": 1.8
}`,
    },
    previewBadge: "PostgreSQL · CSV · REST APIs",
  },
  {
    step: "02",
    id: "datasets",
    name: "Datasets",
    tagline: "Automated Schema Discovery",
    summary:
      "Type inference, column nullability analysis, and automated layout conversion into zero-copy Apache Arrow memory buffers.",
    bulletPoints: [
      "Zero-copy Apache Arrow columnar memory representation",
      "Automatic nullability & strict type checking",
      "Partition discovery & indexing headers",
    ],
    icon: Layers,
    codeSnippet: {
      language: "TypeScript (Schema Definition)",
      filename: "schema_discovery.ts",
      code: `// Discover and map relational tuples to Arrow columnar buffers
const dataset = await discoverSchema(sourceBuffer, {
  inferTypes: true,
  strictNullability: true,
  arrowZeroCopy: true,
  maxSampleRows: 100_000
});

// Output: 18 discovered columns · 0 copy memory overhead
const table = dataset.toArrowTable();`,
    },
    dataSample: {
      type: "table",
      tableHeaders: ["Column Name", "Type", "Nulls", "Sample Value"],
      tableRows: [
        ["timestamp", "TIMESTAMP_TZ", "0%", "2026-09-30 23:59:00Z"],
        ["account_id", "UUID", "0%", "8f9b2c14-72a1-41fb-992a"],
        ["revenue", "DECIMAL(12,2)", "0%", "$1,428.50"],
        ["region", "VARCHAR(64)", "0.2%", "apac-south"],
      ],
    },
    previewBadge: "Zero-Copy Arrow · 18 Discovered Columns",
  },
  {
    step: "03",
    id: "exploration",
    name: "Exploration",
    tagline: "Safe Analytical Engine",
    summary:
      "Vectorized in-memory SQL execution via DuckDB WASM with parameterization, cryptographic row-level security, and sub-15ms response latency.",
    bulletPoints: [
      "Client-side vectorized in-memory query execution",
      "Cryptographic RLS injection prevention",
      "Sub-15ms execution verified across 1M rows",
    ],
    icon: Filter,
    codeSnippet: {
      language: "SQL (DuckDB WASM)",
      filename: "query_aggregate.sql",
      code: `-- Sub-15ms parameterized in-memory OLAP query
SELECT
  date_trunc('month', timestamp) AS month,
  region,
  sum(revenue)                   AS total_revenue,
  count(DISTINCT account_id)     AS active_users
FROM sales_events
WHERE tenant_id = $tenant_id
GROUP BY 1, 2
ORDER BY total_revenue DESC;`,
    },
    dataSample: {
      type: "table",
      tableHeaders: ["Month", "Region", "Total Revenue", "Active Users"],
      tableRows: [
        ["2026-09", "apac-south", "$684,200.00", "8,420"],
        ["2026-09", "us-east", "$492,100.00", "5,910"],
        ["2026-09", "eu-west", "$252,650.00", "3,180"],
      ],
    },
    previewBadge: "Sub-15ms Execution · 100k+ rps",
  },
  {
    step: "04",
    id: "visualizations",
    name: "Visualizations",
    tagline: "Interactive Studio Studio",
    summary:
      "Binding discovered dimensions and calculated aggregates to 8 responsive, pure React 19 chart components with real-time feedback.",
    bulletPoints: [
      "8 native chart renderers (Area, Bar, Line, KPI, Funnel, etc)",
      "Dimension and measure binding matrix",
      "Fluid responsive SVG with interactive tooltips",
    ],
    icon: BarChart3,
    codeSnippet: {
      language: "TSX (Visualization Component)",
      filename: "MonthlyRevenueChart.tsx",
      code: `import { AreaChartRenderer } from "@/components/visualization/AreaChartRenderer";

export function MonthlyRevenueChart({ dataset }: { dataset: Dataset }) {
  return (
    <AreaChartRenderer
      data={dataset.aggregatedMonthly}
      xKey="month"
      yKeys={["total_revenue"]}
      theme="editorial"
      smoothCurve={true}
      showGradients={true}
    />
  );
}`,
    },
    dataSample: {
      type: "json",
      jsonText: `[
  { "month": "May", "total_revenue": 1120000, "growth": "+12.4%" },
  { "month": "Jun", "total_revenue": 1240000, "growth": "+10.7%" },
  { "month": "Jul", "total_revenue": 1390000, "growth": "+12.1%" },
  { "month": "Aug", "total_revenue": 1520000, "growth": "+9.3%" }
]`,
    },
    previewBadge: "React 19 · 8 Native Renderers",
  },
  {
    step: "05",
    id: "dashboards",
    name: "Dashboards",
    tagline: "Multi-Canvas Assembly",
    summary:
      "Responsive grid layout assembly with live multi-user presence locks, tenant-scoped filters, and conflict-free state synchronization.",
    bulletPoints: [
      "Drag-and-drop responsive grid assembly",
      "CRDT optimistic concurrency state locks",
      "Tenant-isolated filter cascade across widgets",
    ],
    icon: LayoutDashboard,
    codeSnippet: {
      language: "TypeScript (Dashboard Config)",
      filename: "dashboard_layout.ts",
      code: `export const ExecutiveDashboard = defineDashboard({
  id: "dash_exec_live_01",
  title: "Q3 Executive Performance & Revenue",
  layout: "responsive-grid-12col",
  syncEngine: "crdt-optimistic",
  widgets: [
    { type: "kpi", span: 3, title: "ARR", metric: "revenue_arr" },
    { type: "kpi", span: 3, title: "SLA", metric: "uptime_pct" },
    { type: "area-chart", span: 6, source: "query_aggregate" }
  ]
});`,
    },
    dataSample: {
      type: "json",
      jsonText: `{
  "dashboard_id": "dash_exec_live_01",
  "active_widgets": 6,
  "theme": "editorial-enterprise",
  "refresh_interval_sec": 10,
  "active_collaborators": 4,
  "sync_state": "SYNCHRONIZED"
}`,
    },
    previewBadge: "Collaborative Canvases · Live Presence",
  },
  {
    step: "06",
    id: "decisions",
    name: "Decisions",
    tagline: "Governed Intelligence",
    summary:
      "Enterprise governance with cryptographic report signatures, immutable audit logs, scheduled alerts, and zero-bypass tenant isolation.",
    bulletPoints: [
      "Cryptographically signed report exports (Ed25519)",
      "Append-only immutable audit logging",
      "Webhook, Slack, and scheduled PDF report dispatch",
    ],
    icon: TrendingUp,
    codeSnippet: {
      language: "TypeScript (Audit & Signing)",
      filename: "governance_audit.ts",
      code: `// Cryptographically sign decision report for external audit
const signedExport = await securityService.signReportExport({
  reportId: "rep_q3_financials",
  tenantId: "org_enterprise",
  signerKey: "hsm://keys/ed25519_prod",
  expiresIn: "24h"
});

// Returns immutable digest and tamper-evident signature token
console.log(signedExport.signatureToken);`,
    },
    dataSample: {
      type: "json",
      jsonText: `{
  "audit_event": "REPORT_EXPORT_SIGNED",
  "actor": "cfo@enterprise.io",
  "algorithm": "Ed25519",
  "signature_digest": "sha256:7f83b1657ff1fc53b92dc18148a1d65df...",
  "immutable_sequence": 982144,
  "sanitized_payload": true
}`,
    },
    previewBadge: "Cryptographic RLS · Audit Trail",
  },
];

export function IsometricPipeline() {
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(0);
  const [activeInspectorTab, setActiveInspectorTab] = useState<"code" | "data">("code");
  const [copied, setCopied] = useState<boolean>(false);

  const currentStage = STAGES[selectedStageIdx] || STAGES[0];
  const CurrentIcon = currentStage.icon;

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(currentStage.codeSnippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP PIPELINE SELECTOR: 6 Clickable Stage Platforms          */}
      {/* ------------------------------------------------------------- */}
      <div className="relative">
        {/* Horizontal Connecting Conduit for Desktop */}
        <div
          className="hidden lg:block absolute top-[52px] left-[6%] right-[6%] h-0.5 bg-gradient-to-r from-[#147D78]/30 via-[#4F9D8E]/40 to-[#147D78]/30 dark:from-[#4F9D8E]/30 dark:via-[#147D78]/40 dark:to-[#4F9D8E]/30 -z-0"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 relative z-10">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = selectedStageIdx === idx;

            return (
              <button
                key={stage.step}
                onClick={() => setSelectedStageIdx(idx)}
                type="button"
                className={`rounded-xl p-4 transition-all duration-200 text-left border flex flex-col justify-between cursor-pointer group focus:outline-hidden focus:ring-2 focus:ring-[#147D78] ${
                  isSelected
                    ? "bg-white dark:bg-[#1F2937] border-[#147D78] dark:border-[#4F9D8E] shadow-md ring-2 ring-[#147D78]/20 dark:ring-[#4F9D8E]/30 -translate-y-1"
                    : "bg-white/80 dark:bg-[#1F2937]/80 hover:bg-white dark:hover:bg-[#1F2937] border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/40 hover:-translate-y-0.5 shadow-xs"
                }`}
                aria-pressed={isSelected}
                aria-label={`Select pipeline stage ${stage.step} ${stage.name}`}
              >
                <div>
                  {/* Platform Icon & Step Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                        isSelected
                          ? "bg-[#147D78] dark:bg-[#4F9D8E] text-white shadow-xs"
                          : "bg-[#F4F1EA] dark:bg-[#111827] text-[#147D78] dark:text-[#4F9D8E] border border-[#DADFD9] dark:border-[#374151] group-hover:border-[#147D78]/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`font-mono text-xs font-bold transition ${
                        isSelected
                          ? "text-[#147D78] dark:text-[#4F9D8E]"
                          : "text-[#596775] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {stage.step}
                    </span>
                  </div>

                  {/* Stage Title */}
                  <h4 className="text-sm font-heading font-semibold text-[#172B3A] dark:text-[#E5E7EB] leading-tight">
                    {stage.name}
                  </h4>
                  <p className="text-[11px] text-[#596775] dark:text-[#9CA3AF] mt-1 font-normal leading-snug">
                    {stage.tagline}
                  </p>
                </div>

                {/* Selection Indicator Pill */}
                <div className="mt-4 pt-2.5 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-between text-[10.5px]">
                  <span
                    className={`font-mono font-medium ${
                      isSelected
                        ? "text-[#147D78] dark:text-[#4F9D8E]"
                        : "text-[#596775] dark:text-[#9CA3AF]"
                    }`}
                  >
                    {isSelected ? "Active Stage" : "Click to Inspect"}
                  </span>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-[#147D78] dark:bg-[#4F9D8E] animate-pulse" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. INTERACTIVE STAGE INSPECTOR: Code, Data & Visual Preview    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] shadow-xl overflow-hidden transition-all duration-300">
        {/* Inspector Header */}
        <div className="border-b border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/60 dark:bg-[#111827]/80 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#147D78] dark:bg-[#4F9D8E] text-white">
              <CurrentIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#147D78] dark:text-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] px-2 py-0.5 rounded border border-[#DADFD9] dark:border-[#374151]">
                  STAGE {currentStage.step}
                </span>
                <h3 className="text-base font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                  {currentStage.name}: {currentStage.tagline}
                </h3>
              </div>
              <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                {currentStage.summary}
              </p>
            </div>
          </div>

          {/* Right Action: Tab Switcher (Code vs Data) */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center rounded-lg bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] p-1 font-mono text-xs">
              <button
                onClick={() => setActiveInspectorTab("code")}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  activeInspectorTab === "code"
                    ? "bg-white dark:bg-[#1F2937] text-[#147D78] dark:text-[#4F9D8E] shadow-xs"
                    : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Live Code Block</span>
              </button>
              <button
                onClick={() => setActiveInspectorTab("data")}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  activeInspectorTab === "data"
                    ? "bg-white dark:bg-[#1F2937] text-[#147D78] dark:text-[#4F9D8E] shadow-xs"
                    : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Data Sample</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inspector Body: 2-Column Split (Left: Code/Data; Right: Live Visual Preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#DADFD9] dark:divide-[#374151]">
          {/* Left Column: Code Block / Data Sample (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between bg-[#F4F1EA]/20 dark:bg-[#111827]/30">
            {activeInspectorTab === "code" ? (
              <div className="p-5 font-mono text-xs flex flex-col h-full">
                {/* File Header Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-[#DADFD9] dark:border-[#374151] text-[11px] text-[#596775] dark:text-[#9CA3AF]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
                      {currentStage.codeSnippet.filename}
                    </span>
                    <span className="text-[#9CA3AF]">•</span>
                    <span>{currentStage.codeSnippet.language}</span>
                  </div>

                  <button
                    onClick={handleCopyCode}
                    type="button"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] hover:bg-[#F4F1EA] dark:hover:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] transition cursor-pointer"
                    title="Copy code snippet"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-[#147D78] dark:text-[#4F9D8E]" />
                        <span className="text-[#147D78] dark:text-[#4F9D8E] font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Preformatted Code Content */}
                <pre className="mt-4 p-4 rounded-xl bg-[#111827] text-[#E5E7EB] overflow-x-auto text-[11.5px] leading-relaxed border border-[#374151] shadow-inner flex-1 font-mono">
                  <code>{currentStage.codeSnippet.code}</code>
                </pre>
              </div>
            ) : (
              <div className="p-5 font-mono text-xs flex flex-col h-full">
                {/* Data Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#DADFD9] dark:border-[#374151] text-[11px] text-[#596775] dark:text-[#9CA3AF]">
                  <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
                    Active Transformation Output Payload
                  </span>
                  <span className="text-[#147D78] dark:text-[#4F9D8E] font-bold">
                    {currentStage.previewBadge}
                  </span>
                </div>

                <div className="mt-4 flex-1">
                  {currentStage.dataSample.type === "table" ? (
                    <div className="overflow-x-auto rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-[#F4F1EA] dark:bg-[#1F2937] border-b border-[#DADFD9] dark:border-[#374151] text-[#596775] dark:text-[#9CA3AF]">
                          <tr>
                            {currentStage.dataSample.tableHeaders?.map((h, i) => (
                              <th key={i} className="px-3.5 py-2 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DADFD9] dark:divide-[#374151] text-[#172B3A] dark:text-[#E5E7EB]">
                          {currentStage.dataSample.tableRows?.map((row, rI) => (
                            <tr key={rI} className="hover:bg-[#F4F1EA]/50 dark:hover:bg-[#1F2937]/50">
                              {row.map((cell, cI) => (
                                <td key={cI} className="px-3.5 py-2 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <pre className="p-4 rounded-xl bg-[#111827] text-emerald-400 overflow-x-auto text-[11.5px] leading-relaxed border border-[#374151] shadow-inner font-mono">
                      <code>{currentStage.dataSample.jsonText}</code>
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Stage Bullet Details Footer */}
            <div className="p-4 border-t border-[#DADFD9] dark:border-[#374151] bg-white/60 dark:bg-[#1F2937]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {currentStage.bulletPoints.map((bullet, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-[#596775] dark:text-[#9CA3AF] text-[11px]"
                  >
                    <CheckCircle2 className="h-3 w-3 text-[#147D78] dark:text-[#4F9D8E]" />
                    <span>{bullet}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Preview (5 Cols) */}
          <div className="lg:col-span-5 p-5 flex flex-col justify-between bg-white dark:bg-[#1F2937]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#DADFD9] dark:border-[#374151]">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#147D78] dark:text-[#4F9D8E]" />
                  <span className="text-xs font-mono font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                    Live Visual Preview
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] font-semibold border border-[#147D78]/20">
                  {currentStage.id.toUpperCase()}
                </span>
              </div>

              {/* Dynamic Stage Preview Canvas */}
              <div className="mt-5">
                {/* 01. SOURCES VISUAL PREVIEW */}
                {currentStage.id === "sources" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          PostgreSQL 16 Connection Pool
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                          TLSv1.3 Active
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                        <div>Connections: 14 / 25 Active</div>
                        <div>Latency: 1.8ms (p50)</div>
                        <div>SSL Cipher: AES-256-GCM</div>
                        <div>Status: Healthy</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/60 dark:bg-[#111827]/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-[#172B3A] dark:text-[#E5E7EB]">CSV Stream Buffer</span>
                      <span className="text-[#147D78] dark:text-[#4F9D8E] font-semibold">
                        24.8 MB / Ready
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/60 dark:bg-[#111827]/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-[#172B3A] dark:text-[#E5E7EB]">REST Ingestion Webhook</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Listening (Port 4000)
                      </span>
                    </div>
                  </div>
                )}

                {/* 02. DATASETS VISUAL PREVIEW */}
                {currentStage.id === "datasets" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/50 dark:bg-[#111827]/60">
                      <div className="flex items-center justify-between text-xs font-mono mb-2">
                        <span className="font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                          Discovered Arrow Table
                        </span>
                        <span className="text-[#147D78] dark:text-[#4F9D8E] font-semibold">
                          1,000,000 Rows
                        </span>
                      </div>
                      <div className="space-y-1.5 text-[11px] font-mono">
                        <div className="flex justify-between text-[#596775] dark:text-[#9CA3AF]">
                          <span>Columns:</span>
                          <span className="text-[#172B3A] dark:text-[#E5E7EB]">18 Discovered</span>
                        </div>
                        <div className="flex justify-between text-[#596775] dark:text-[#9CA3AF]">
                          <span>Memory Layout:</span>
                          <span className="text-[#147D78] dark:text-[#4F9D8E]">Zero-Copy Arrow</span>
                        </div>
                        <div className="flex justify-between text-[#596775] dark:text-[#9CA3AF]">
                          <span>Nullability Violations:</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            0 (Passed)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-dashed border-[#147D78]/40 dark:border-[#4F9D8E]/40 text-center text-xs font-mono text-[#147D78] dark:text-[#4F9D8E]">
                      Auto-generated schema types mapped into in-memory table
                    </div>
                  </div>
                )}

                {/* 03. EXPLORATION VISUAL PREVIEW */}
                {currentStage.id === "exploration" && (
                  <div className="space-y-3 font-mono">
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-emerald-400" />
                          DuckDB WASM Engine
                        </span>
                        <span className="text-xs font-bold text-emerald-400">8.4ms P95</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>Scanned: 1,000,000 rows</div>
                        <div>Throughput: 119k rps</div>
                        <div>Vector: 2,048 rows/vec</div>
                        <div>SIMD128: Enabled</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/50 dark:bg-[#111827]/60 text-xs">
                      <div className="text-[#596775] dark:text-[#9CA3AF] text-[10px] uppercase">
                        Tenant Row-Level Security
                      </div>
                      <div className="text-[#172B3A] dark:text-[#E5E7EB] font-bold mt-0.5">
                        auth.current_org() = &apos;org_enterprise&apos;
                      </div>
                    </div>
                  </div>
                )}

                {/* 04. VISUALIZATIONS VISUAL PREVIEW */}
                {currentStage.id === "visualizations" && (
                  <div className="space-y-3">
                    {/* Interactive SVG Chart Preview */}
                    <div className="p-4 rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/40 dark:bg-[#111827]/60">
                      <div className="flex items-center justify-between mb-2 text-xs font-mono">
                        <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
                          Revenue Trend (Area Renderer)
                        </span>
                        <span className="text-[#147D78] dark:text-[#4F9D8E] font-bold">$1.52M ARR</span>
                      </div>

                      {/* Mini Area Chart SVG */}
                      <div className="h-28 w-full relative">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100">
                          <defs>
                            <linearGradient id="pipelineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#147D78" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#147D78" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M0,80 Q50,65 100,50 T200,30 T300,10 L300,100 L0,100 Z"
                            fill="url(#pipelineAreaGrad)"
                          />
                          <path
                            d="M0,80 Q50,65 100,50 T200,30 T300,10"
                            fill="none"
                            stroke="#147D78"
                            strokeWidth="2.5"
                          />
                          <circle cx="100" cy="50" r="3.5" fill="#147D78" />
                          <circle cx="200" cy="30" r="3.5" fill="#147D78" />
                          <circle cx="300" cy="10" r="4.5" fill="#10B981" />
                        </svg>
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#DADFD9] dark:border-[#374151] flex justify-between text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                        <span>May: $1.12M</span>
                        <span>Jun: $1.24M</span>
                        <span>Jul: $1.39M</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Aug: $1.52M
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 05. DASHBOARDS VISUAL PREVIEW */}
                {currentStage.id === "dashboards" && (
                  <div className="space-y-3 font-mono">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/50 dark:bg-[#111827]/60">
                        <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block">ARR</span>
                        <span className="text-base font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 block">
                          $1,520,000
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          +14.2% MoM
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/50 dark:bg-[#111827]/60">
                        <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block">
                          Uptime SLA
                        </span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                          99.98%
                        </span>
                        <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF]">
                          Sub-15ms p95
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between text-xs">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Collaborative Presence
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                        4 users in canvas
                      </span>
                    </div>
                  </div>
                )}

                {/* 06. DECISIONS VISUAL PREVIEW */}
                {currentStage.id === "decisions" && (
                  <div className="space-y-3 font-mono">
                    <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          Cryptographically Signed Decision
                        </span>
                        <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Ed25519 Verified
                        </span>
                      </div>

                      <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                        Tamper-proof export digest linked to immutable audit sequence #982,144. Zero
                        credential or internal secret leakage.
                      </p>

                      <div className="pt-2 border-t border-emerald-500/20 text-[10px] text-emerald-400 flex items-center justify-between">
                        <span>Signed by RicozViz HSM</span>
                        <span>Audited: Just now</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/50 dark:bg-[#111827]/60 flex items-center justify-between text-xs">
                      <span className="text-[#172B3A] dark:text-[#E5E7EB]">Automated Deliveries</span>
                      <span className="text-[#147D78] dark:text-[#4F9D8E] font-semibold">
                        Slack · Webhook · PDF
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Navigator */}
            <div className="mt-6 pt-3 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-between text-xs font-mono">
              <button
                onClick={() =>
                  setSelectedStageIdx((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1))
                }
                type="button"
                className="text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB] transition cursor-pointer"
              >
                ← Previous Stage
              </button>

              <span className="text-[#596775] dark:text-[#9CA3AF]">
                {selectedStageIdx + 1} of {STAGES.length}
              </span>

              <button
                onClick={() =>
                  setSelectedStageIdx((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0))
                }
                type="button"
                className="text-[#147D78] dark:text-[#4F9D8E] font-bold hover:underline transition cursor-pointer"
              >
                Next Stage →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
