"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Cpu,
  ShieldCheck,
  LayoutDashboard,
  Copy,
  Check,
  Zap,
  ArrowRight,
  Code2,
  Table as TableIcon,
  Play,
  Terminal,
  Activity,
  Lock,
} from "lucide-react";

interface PipelineStage {
  step: string;
  id: string;
  name: string;
  tagline: string;
  summary: string;
  badge: string;
  metrics: { label: string; value: string; detail: string }[];
  bulletPoints: string[];
  icon: React.ComponentType<{ className?: string }>;
  codeSnippet: {
    language: string;
    filename: string;
    code: string;
  };
  sampleOutput: {
    type: "table" | "json";
    headers?: string[];
    rows?: string[][];
    json?: string;
  };
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    step: "01",
    id: "sources",
    name: "Data Sources",
    tagline: "Enterprise Ingestion & Lakehouse Connectors",
    summary:
      "Direct pushdown execution and continuous streaming across enterprise warehouses (Snowflake, ClickHouse, BigQuery, Databricks, Redshift), object storage (S3 Parquet), and relational pools with TLS 1.3 encryption and automated credential rotation.",
    badge: "Pushdown Connectors",
    metrics: [
      { label: "Connectors", value: "9+ Native", detail: "Snowflake, DuckDB, Kafka, S3" },
      { label: "Handshake", value: "TLS 1.3", detail: "Hardware-grade key rotation" },
      { label: "Latency", value: "1.4 ms", detail: "Connection pool warm state" },
    ],
    bulletPoints: [
      "Native pushdown adapters for Snowflake, ClickHouse, BigQuery, Databricks, Redshift",
      "Streaming columnar object storage: S3 Parquet, GCS, Azure Blob with Snappy compression",
      "Real-time event streaming via Apache Kafka topics and Postgres CDC logical replication",
    ],
    icon: Database,
    codeSnippet: {
      language: "sql",
      filename: "warehouse_connectors.sql",
      code: `-- Establish TLS 1.3 encrypted warehouse & lakehouse connection
CONNECT 'snowflake://prod_account.us-east-1.snowflakecomputing.com/analytics_wh'
WITH (
  driver = 'Flight SQL & Snowpipe',
  pushdown_mode = 'vectorized',
  tls_version = 'TLSv1.3',
  credential_ref = 'vault://secret/prod/snowflake_key'
);

-- Attach columnar ClickHouse cluster & S3 Parquet lake
ATTACH 'clickhouse://ch-node.internal:9000/telemetry' AS ch_events;
ATTACH 's3://analytics-lake-prod/parquets/*.parquet' AS lake_parquet;`,
    },
    sampleOutput: {
      type: "json",
      json: JSON.stringify(
        {
          active_warehouses: [
            { type: "SNOWFLAKE", status: "CONNECTED", latency_ms: 2.1, pushdown: "ENABLED" },
            { type: "CLICKHOUSE", status: "CONNECTED", latency_ms: 1.4, mode: "COLUMNAR_TCP" },
            { type: "BIGQUERY", status: "CONNECTED", latency_ms: 3.2, stream: "ARROW_STORAGE_API" },
            { type: "S3_PARQUET", status: "CONNECTED", latency_ms: 1.9, compression: "SNAPPY" },
            { type: "KAFKA", status: "CONNECTED", latency_ms: 0.8, topic: "orders_realtime" },
          ],
          tls_version: "TLSv1.3",
          audit_ledger: "VERIFIED",
        },
        null,
        2
      ),
    },
  },
  {
    step: "02",
    id: "vectorize",
    name: "Vectorize",
    tagline: "Apache Arrow SIMD Zero-Copy Buffers",
    summary:
      "Transforming heterogenous warehouse partitions and stream payloads into standardized, high-performance Apache Arrow columnar record batches with zero serialization overhead and SIMD-128 vector instruction acceleration.",
    badge: "Zero-Copy Arrow",
    metrics: [
      { label: "Memory Layout", value: "Arrow IPC", detail: "Column-oriented zero serialization" },
      { label: "Vector Scan", value: "SIMD-128", detail: "Hardware vectorized registers" },
      { label: "Egress", value: "0 B Spill", detail: "Zero intermediate network transfer" },
    ],
    bulletPoints: [
      "Zero-copy columnar projection directly into browser/edge WebAssembly memory space",
      "Dynamic schema discovery and type coercion across Parquet, Avro, JSON, and Arrow IPC",
      "SIMD vectorized filtering executing across 25,000,000 rows in sub-2 milliseconds",
    ],
    icon: Layers,
    codeSnippet: {
      language: "typescript",
      filename: "arrow_vectorize.ts",
      code: `import { tableFromIPC, RecordBatchReader } from "apache-arrow";

// Stream zero-copy IPC record batches into shared WebAssembly buffer
const reader = await RecordBatchReader.fromUrl("/api/v1/stream/orders.arrow");
const wasmTable = await tableFromIPC(reader);

// Vectorized SIMD register projection across 10M rows
const projectedSchema = wasmTable.select(["tenant_id", "timestamp", "revenue_usd"]);
console.log("Vectorized Arrow Schema:", projectedSchema.schema.fields.map(f => f.name));`,
    },
    sampleOutput: {
      type: "table",
      headers: ["batch_id", "column_name", "arrow_type", "null_count", "memory_bytes"],
      rows: [
        ["batch_001", "tenant_id", "Utf8 (Dictionary)", "0", "4,194,304 B"],
        ["batch_001", "timestamp", "TimestampMicrosecond", "0", "8,388,608 B"],
        ["batch_001", "revenue_usd", "Decimal128(18,2)", "0", "16,777,216 B"],
        ["batch_001", "region_code", "FixedSizeBinary(2)", "0", "2,097,152 B"],
      ],
    },
  },
  {
    step: "03",
    id: "compute",
    name: "DuckDB OLAP",
    tagline: "In-Memory Columnar Vector Execution",
    summary:
      "Execute ad-hoc analytical SQL directly in-memory at compiled C++ speeds. DuckDB WebAssembly executes aggregations, window functions, and joins across millions of records in sub-12 milliseconds without round-tripping to cloud warehouses.",
    badge: "< 12ms In-Memory",
    metrics: [
      { label: "P95 Latency", value: "8.4 ms", detail: "Across 1,000,000 in-memory rows" },
      { label: "Throughput", value: "119k rps", detail: "Vectorized pipelined operators" },
      { label: "Concurrency", value: "Multi-Core", detail: "Wasm SharedArrayBuffer workers" },
    ],
    bulletPoints: [
      "Full SQL-2016 compatibility including complex CTEs, window functions, and geo joins",
      "Eliminates 80% of cloud data warehouse query costs and round-trip network delays",
      "Parallel multi-threaded execution utilizing WebAssembly SIMD-128 and web workers",
    ],
    icon: Cpu,
    codeSnippet: {
      language: "sql",
      filename: "duckdb_aggregation.sql",
      code: `-- Sub-12ms in-memory aggregation via DuckDB WASM across 1,000,000 rows
SELECT 
  date_trunc('month', ts) AS event_month,
  region,
  sum(revenue_usd) AS total_revenue,
  count(DISTINCT account_id) AS active_accounts,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency
FROM sales_lakehouse
WHERE tenant_id = current_tenant_id()
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;`,
    },
    sampleOutput: {
      type: "table",
      headers: ["event_month", "region", "total_revenue", "active_accounts", "p95_latency"],
      rows: [
        ["2026-10", "North America", "$2,481,950.00", "1,842", "7.8 ms"],
        ["2026-10", "Europe", "$1,692,400.00", "1,210", "8.2 ms"],
        ["2026-10", "Asia-Pacific", "$984,300.00", "890", "8.6 ms"],
        ["2026-09", "North America", "$2,190,800.00", "1,750", "7.6 ms"],
      ],
    },
  },
  {
    step: "04",
    id: "guard",
    name: "RLS & Governance",
    tagline: "Cryptographic AST Row-Level Security",
    summary:
      "Every query is parsed into a syntax tree and injected with cryptographic tenant boundary predicates, role-based column access controls, and dynamic PII masking before execution. The query and cryptographic hash are appended to the tamper-proof ledger.",
    badge: "Cryptographic AST",
    metrics: [
      { label: "Enforcement", value: "Kernel AST", detail: "Zero query bypass capability" },
      { label: "Audit Hash", value: "SHA-256", detail: "RFC 6962 chained block ledger" },
      { label: "Compliance", value: "SOC2 & HIPAA", detail: "BAA and ePHI audit validated" },
    ],
    bulletPoints: [
      "AST-level SQL rewrite guarantees zero cross-tenant leakage even on unrestricted user input",
      "Dynamic PII masking obfuscates emails, IP addresses, and account numbers on-the-fly",
      "Every query creates a SHA-256 Merkle root entry in the immutable multi-tenant audit ledger",
    ],
    icon: ShieldCheck,
    codeSnippet: {
      language: "sql",
      filename: "rls_guard_policy.sql",
      code: `-- Kernel AST Policy injected transparently before DuckDB execution
CREATE POLICY tenant_isolation_guard ON enterprise_lake
FOR ALL TO authenticated_role
USING (
  tenant_id = current_setting('request.jwt.claim.tenant_id', true)
  AND (
    user_role IN ('DATA_ARCHITECT', 'ADMIN') 
    OR pii_classified = false
  )
);

-- Cryptographic signature emitted for SHA-256 audit ledger
SELECT rfc6962_ledger_append(
  hash_chain(current_query(), current_user, current_timestamp)
);`,
    },
    sampleOutput: {
      type: "json",
      json: JSON.stringify(
        {
          policy_name: "tenant_isolation_guard",
          ast_validation: "PASSED_STRICT",
          tenant_injected: "org_acme_enterprise",
          pii_masking: {
            email: "j***@company.com",
            ip_address: "192.168.***.***",
            iban: "DE89****************21",
          },
          merkle_block_height: 1045,
          sha256_block_hash: "9f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201e4d2",
          status: "SUCCESS_VERIFIED",
        },
        null,
        2
      ),
    },
  },
  {
    step: "05",
    id: "publish",
    name: "Canvases & API",
    tagline: "Multi-Canvas Dashboards & Signed Embedding",
    summary:
      "Assemble live interactive charts, multi-tab executive layouts, and streaming widgets. Share securely via short-lived HMAC-signed embed tokens or synchronize cursors in real-time with multiplayer data teammates.",
    badge: "Live Multiplayer",
    metrics: [
      { label: "Sync Protocol", value: "WebSockets", detail: "Sub-5ms cursor presence" },
      { label: "Embedding", value: "HMAC Signed", detail: "Expiring sandboxed iframe tokens" },
      { label: "Visualizers", value: "18+ Charts", detail: "Area, Sankey, Geo, Treemap" },
    ],
    bulletPoints: [
      "Real-time collaborative editing with teammate cursor presence, live comments, and bookmarks",
      "Embed governed dashboards directly into external SaaS products with tenant-scoped tokens",
      "Scheduled webhook dispatch for automated Slack alerts, threshold breaches, and anomaly spikes",
    ],
    icon: LayoutDashboard,
    codeSnippet: {
      language: "typescript",
      filename: "embed_signed_canvas.ts",
      code: `import { createSignedCanvasToken } from "@ricoz/viz-sdk";

// Generate cryptographic expiring iframe token for customer tenant
const sessionToken = await createSignedCanvasToken({
  tenantId: "client_retail_pro",
  dashboardId: "dash_executive_q4",
  allowedRoles: ["VIEWER"],
  expiresInSeconds: 3600,
  rlsConstraints: { region: "EMEA", minRevenue: 50000 },
});

// Embed URL: https://analytics.ricoz.in/embed/dash_executive_q4?token={sessionToken}`,
    },
    sampleOutput: {
      type: "json",
      json: JSON.stringify(
        {
          canvas_id: "dash_executive_q4",
          rendered_charts: 6,
          streaming_widgets: 2,
          multiplayer_peers: [
            { user: "@sarah_lin", role: "Analyst", cursor: { x: 420, y: 180 } },
            { user: "@david_chen", role: "Engineer", cursor: { x: 890, y: 340 } },
          ],
          render_latency: "3.4 ms",
          status: "ACTIVE_STREAMING",
        },
        null,
        2
      ),
    },
  },
];

export default function WorkflowPipelineSection() {
  const [activeStageId, setActiveStageId] = useState<string>("compute");
  const [activeOutputTab, setActiveOutputTab] = useState<"code" | "output">("code");
  const [copied, setCopied] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedDuration, setSimulatedDuration] = useState<number>(8.4);

  const activeStage =
    PIPELINE_STAGES.find((s) => s.id === activeStageId) || PIPELINE_STAGES[2];

  const handleCopyCode = () => {
    void navigator.clipboard.writeText(activeStage.codeSnippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateExecution = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const randomDuration = Number((6 + Math.random() * 4).toFixed(1));
      setSimulatedDuration(randomDuration);
      setIsSimulating(false);
    }, 450);
  };

  return (
    <section id="workflow" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[32px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <span className="text-[12px] font-mono-code uppercase tracking-wider text-[#ff6b35] block mb-[6px]">
            End-to-End Pipeline
          </span>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              From raw data to actionable insight,
            </span>
            <span className="block text-[#fafafa]">
              accelerated at every pipeline layer
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-[8px] text-[12px] font-mono-code text-[#898989]">
          <span className="flex items-center gap-[6px] rounded-full border border-[#2e2e2e] bg-[#171717] px-[12px] py-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff6b35] animate-pulse" />
            Zero-Copy Architecture
          </span>
        </div>
      </div>

      {/* PIPELINE STAGE SELECTOR TABS */}
      <div className="mb-[24px] grid grid-cols-2 gap-[8px] sm:grid-cols-3 lg:grid-cols-5">
        {PIPELINE_STAGES.map((stage) => {
          const isActive = stage.id === activeStageId;
          const Icon = stage.icon;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                setActiveStageId(stage.id);
                setSimulatedDuration(Number((6 + Math.random() * 4).toFixed(1)));
              }}
              className={`group flex flex-col items-start rounded-[14px] border p-[16px] text-left transition-all duration-150 cursor-pointer ${
                isActive
                  ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_0_24px_rgba(255,107,53,0.12)]"
                  : "border-[#2e2e2e] bg-[#171717] hover:border-[#393939] hover:bg-[#191919]"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={`text-[11px] font-mono-code ${
                    isActive ? "text-[#ff6b35] font-semibold" : "text-[#898989]"
                  }`}
                >
                  {stage.step}
                </span>
                <Icon
                  className={`h-[16px] w-[16px] transition-colors ${
                    isActive ? "text-[#ff6b35]" : "text-[#898989] group-hover:text-[#fafafa]"
                  }`}
                />
              </div>
              <div
                className={`mt-[12px] text-[14px] font-medium transition-colors ${
                  isActive ? "text-[#fafafa]" : "text-[#b4b4b4] group-hover:text-[#fafafa]"
                }`}
              >
                {stage.name}
              </div>
              <div className="mt-[4px] text-[11px] text-[#898989] line-clamp-1">
                {stage.badge}
              </div>
            </button>
          );
        })}
      </div>

      {/* STAGE MAIN WORKBENCH CARD */}
      <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] lg:p-[32px]">
        <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-12">
          {/* LEFT 5 COLS: Stage Description & Architecture Highlights */}
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35]">
                <span className="font-semibold">{activeStage.step} //</span>
                <span>{activeStage.badge}</span>
              </div>

              <h3 className="mt-[16px] text-[22px] font-normal leading-[1.25] text-[#fafafa] sm:text-[24px]">
                {activeStage.tagline}
              </h3>

              <p className="mt-[12px] text-[14px] font-normal leading-[1.6] text-[#898989]">
                {activeStage.summary}
              </p>

              {/* Bullet Points */}
              <div className="mt-[20px] flex flex-col gap-[10px]">
                {activeStage.bulletPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-[10px]">
                    <div className="mt-[4px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full bg-[#ff6b35]/15 text-[#ff6b35]">
                      <Check className="h-[10px] w-[10px] stroke-[3]" />
                    </div>
                    <span className="text-[13px] font-normal leading-[1.5] text-[#b4b4b4]">
                      {point}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics Pills */}
            <div className="mt-[28px] grid grid-cols-3 gap-[10px] border-t border-[#2e2e2e] pt-[20px]">
              {activeStage.metrics.map((m, idx) => (
                <div key={idx} className="rounded-[10px] border border-[#2e2e2e] bg-[#121212] p-[10px]">
                  <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                    {m.label}
                  </span>
                  <span className="mt-[2px] block text-[15px] font-mono-code font-semibold text-[#fafafa]">
                    {m.value}
                  </span>
                  <span className="mt-[2px] block text-[10px] text-[#898989] truncate">
                    {m.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT 7 COLS: Code & Telemetry Window */}
          <div className="flex flex-col rounded-[14px] border border-[#2e2e2e] bg-[#121212] overflow-hidden lg:col-span-7">
            {/* Window Chrome Header */}
            <div className="flex flex-wrap items-center justify-between gap-[12px] border-b border-[#2e2e2e] bg-[#171717] px-[16px] py-[10px]">
              <div className="flex items-center gap-[12px]">
                <div className="flex items-center gap-[6px]">
                  <span className="h-[8px] w-[8px] rounded-full bg-[#393939]" />
                  <span className="h-[8px] w-[8px] rounded-full bg-[#393939]" />
                  <span className="h-[8px] w-[8px] rounded-full bg-[#393939]" />
                </div>
                <div className="h-[14px] w-px bg-[#2e2e2e]" />
                <span className="font-mono-code text-[12px] text-[#fafafa]">
                  {activeStage.codeSnippet.filename}
                </span>
              </div>

              <div className="flex items-center gap-[8px]">
                {/* Switcher Tab */}
                <div className="flex rounded-[8px] border border-[#2e2e2e] bg-[#121212] p-[2px]">
                  <button
                    type="button"
                    onClick={() => setActiveOutputTab("code")}
                    className={`flex items-center gap-[5px] rounded-[6px] px-[9px] py-[3px] text-[11px] font-mono-code transition-colors cursor-pointer ${
                      activeOutputTab === "code"
                        ? "bg-[#242424] text-[#fafafa] font-medium"
                        : "text-[#898989] hover:text-[#fafafa]"
                    }`}
                  >
                    <Code2 className="h-[12px] w-[12px]" />
                    <span>Config</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveOutputTab("output")}
                    className={`flex items-center gap-[5px] rounded-[6px] px-[9px] py-[3px] text-[11px] font-mono-code transition-colors cursor-pointer ${
                      activeOutputTab === "output"
                        ? "bg-[#242424] text-[#fafafa] font-medium"
                        : "text-[#898989] hover:text-[#fafafa]"
                    }`}
                  >
                    <TableIcon className="h-[12px] w-[12px]" />
                    <span>Live Output</span>
                  </button>
                </div>

                {/* Simulate Button */}
                <button
                  type="button"
                  onClick={handleSimulateExecution}
                  disabled={isSimulating}
                  className="flex items-center gap-[6px] rounded-[8px] border border-[#ff6b35]/70 bg-[#9a3412] px-[11px] py-[4px] text-[11px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer"
                >
                  <Play className={`h-[11px] w-[11px] ${isSimulating ? "animate-spin" : ""}`} />
                  <span>{isSimulating ? "Running…" : "Execute"}</span>
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-[5px] rounded-[8px] border border-[#2e2e2e] bg-[#171717] px-[9px] py-[4px] text-[11px] font-mono-code text-[#898989] hover:text-[#fafafa] transition-colors cursor-pointer"
                  title="Copy code snippet"
                >
                  {copied ? (
                    <>
                      <Check className="h-[11px] w-[11px] text-[#ff6b35]" />
                      <span className="text-[#ff6b35]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-[11px] w-[11px]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code / Output Area */}
            <div className="flex-1 p-[16px] font-mono-code text-[12px] leading-[1.65] overflow-x-auto min-h-[260px] max-h-[360px]">
              {activeOutputTab === "code" ? (
                <pre className="text-[#b4b4b4] whitespace-pre selection:bg-[#ff6b35]/30">
                  {activeStage.codeSnippet.code}
                </pre>
              ) : activeStage.sampleOutput.type === "table" ? (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left font-mono-code text-[11px]">
                    <thead>
                      <tr className="border-b border-[#2e2e2e] text-[#898989]">
                        {activeStage.sampleOutput.headers?.map((h, idx) => (
                          <th key={idx} className="pb-[8px] pr-[16px] font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2e2e2e]/60 text-[#fafafa]">
                      {activeStage.sampleOutput.rows?.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#171717]">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-[8px] pr-[16px] ${
                                cIdx === 0
                                  ? "text-[#ff6b35]"
                                  : cIdx === row.length - 1
                                  ? "text-[#ff8252] font-semibold"
                                  : "text-[#b4b4b4]"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="text-[#ff8252] whitespace-pre">
                  {activeStage.sampleOutput.json}
                </pre>
              )}
            </div>

            {/* Footer Telemetry Strip */}
            <div className="flex flex-wrap items-center justify-between gap-[12px] border-t border-[#2e2e2e] bg-[#171717] px-[16px] py-[8px] text-[11px] font-mono-code text-[#898989]">
              <div className="flex items-center gap-[8px]">
                <Activity className="h-[12px] w-[12px] text-[#ff6b35]" />
                <span className="text-[#fafafa]">
                  Execution time:{" "}
                  <strong className="text-[#ff6b35]">{simulatedDuration} ms</strong>
                </span>
                <span className="text-[#393939]">|</span>
                <span>0 B network egress</span>
              </div>
              <div className="flex items-center gap-[6px]">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                <span className="text-emerald-400 font-medium">Vector Engine Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
