"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Lock,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Database,
  ExternalLink,
  Search,
  Activity,
  Check,
  RotateCcw,
} from "lucide-react";

// ============================================================================
// AUTHENTIC BRAND SVG ICONS
// ============================================================================

export function SnowflakeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M12 2.5V21.5M4.5 7.5L19.5 16.5M4.5 16.5L19.5 7.5"
        stroke="#29B5E8"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="#29B5E8" />
      <path
        d="M12 2.5L10 5M12 2.5L14 5M12 21.5L10 19M12 21.5L14 19M4.5 7.5L7 7M4.5 7.5L5 9.5M19.5 16.5L17 17M19.5 16.5L19 14.5M4.5 16.5L7 17M4.5 16.5L5 14.5M19.5 7.5L17 7M19.5 7.5L19 9.5"
        stroke="#29B5E8"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ClickHouseIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="3" width="2" height="18" rx="0.5" fill="#FA8C16" />
      <rect x="6" y="5" width="2" height="14" rx="0.5" fill="#FFCC00" />
      <rect x="10" y="2" width="2" height="20" rx="0.5" fill="#FA8C16" />
      <rect x="14" y="6" width="2" height="12" rx="0.5" fill="#FFCC00" />
      <rect x="18" y="4" width="2" height="16" rx="0.5" fill="#FA8C16" />
    </svg>
  );
}

export function BigQueryIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L3.5 8V16L12 21L20.5 16V8L12 3Z"
        stroke="#4285F4"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" fill="#4285F4" />
      <path d="M14.5 14.5L18 18" stroke="#34A853" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function DatabricksIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L2 8L12 14L22 8L12 2Z"
        fill="#FF3621"
        fillOpacity="0.9"
      />
      <path
        d="M2 12L12 18L22 12"
        stroke="#FF3621"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 16L12 22L22 16"
        stroke="#FF3621"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RedshiftIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#CC292B" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#E24A4A" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#E24A4A" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#CC292B" />
      <path d="M10 6.5H14M6.5 10V14M17.5 10V14M10 17.5H14" stroke="#CC292B" strokeWidth="2" />
    </svg>
  );
}

export function S3ParquetIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6C4 4.5 7.5 3 12 3C16.5 3 20 4.5 20 6V18C20 19.5 16.5 21 12 21C7.5 21 4 19.5 4 18V6Z"
        stroke="#569A31"
        strokeWidth="2"
      />
      <path
        d="M4 10C4 11.5 7.5 13 12 13C16.5 13 20 11.5 20 10"
        stroke="#569A31"
        strokeWidth="1.8"
      />
      <path
        d="M4 14C4 15.5 7.5 17 12 17C16.5 17 20 15.5 20 14"
        stroke="#569A31"
        strokeWidth="1.8"
      />
      <rect x="9" y="8" width="6" height="8" rx="1" fill="#569A31" fillOpacity="0.2" />
      <path d="M10.5 10H13.5M10.5 12H13.5M10.5 14H12.5" stroke="#569A31" strokeWidth="1.5" />
    </svg>
  );
}

export function PostgreSQLIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C7 3 4 6 4 10C4 13 6 15 8 16V20C8 20.5 8.5 21 9 21H10C10.5 21 11 20.5 11 20V17C11.5 17 12 17 12.5 17C14.5 17 17 16 18.5 14C19.5 12.5 20 11 20 9C20 5.5 16.5 3 12 3Z"
        stroke="#336791"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="1.5" fill="#336791" />
      <path d="M12 11C13.5 11 15 11.5 16 12.5" stroke="#336791" strokeWidth="1.8" />
    </svg>
  );
}

export function MySQLIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 13C4 10 7 7 11 7C14 7 16 8.5 18 11C20 13.5 21.5 14 22 14"
        stroke="#00758F"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 16C9 18 12 19 15 18C18 17 20 15 21 13"
        stroke="#F29111"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11" r="1.2" fill="#00758F" />
    </svg>
  );
}

export function DuckDBIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="4" fill="#FFF000" fillOpacity="0.2" stroke="#D9A441" strokeWidth="1.8" />
      <circle cx="8" cy="9" r="2" fill="#D9A441" />
      <path d="M10 10H16C18 10 19 12 19 14C19 16.5 17 18 14 18H8C6 18 5 16 5 14C5 12 6.5 10 10 10Z" fill="#D9A441" />
    </svg>
  );
}

export function KafkaIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.5 10.5L15.5 7.5M8.5 13.5L15.5 16.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ============================================================================
// DATA CONNECTOR DEFINITIONS
// ============================================================================

export interface ConnectorItem {
  id: string;
  name: string;
  category: "warehouse" | "lakehouse" | "database" | "streaming";
  categoryLabel: string;
  protocol: string;
  latencyBadge: string;
  description: string;
  authMethod: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  sampleEndpoint: string;
}

export const ENTERPRISE_CONNECTORS: ConnectorItem[] = [
  {
    id: "snowflake",
    name: "Snowflake",
    category: "warehouse",
    categoryLabel: "Cloud Data Warehouse",
    protocol: "Snowpipe & Flight SQL",
    latencyBadge: "< 12ms Pushdown",
    description: "Vectorized query pushdown with zero-copy Snowpipe streaming and auto-scaling virtual warehouses.",
    authMethod: "Key-Pair / OAuth JWT",
    icon: SnowflakeIcon,
    accentColor: "#29B5E8",
    sampleEndpoint: "account.region.snowflakecomputing.com",
  },
  {
    id: "clickhouse",
    name: "ClickHouse",
    category: "warehouse",
    categoryLabel: "Columnar Analytical Engine",
    protocol: "Native Columnar TCP / HTTP",
    latencyBadge: "Sub-10ms Columnar",
    description: "Real-time high-throughput OLAP aggregation with vectorized execution and native Arrow blocks.",
    authMethod: "Native SHA-256 / SSL",
    icon: ClickHouseIcon,
    accentColor: "#FA8C16",
    sampleEndpoint: "clickhouse-cluster.internal:9000",
  },
  {
    id: "bigquery",
    name: "Google BigQuery",
    category: "warehouse",
    categoryLabel: "Serverless Data Warehouse",
    protocol: "BigQuery Storage Read API",
    latencyBadge: "Zero-Copy Arrow Stream",
    description: "Federated queries across petabyte datasets via gRPC Arrow streaming without query serialization lag.",
    authMethod: "Google Cloud Service Account JSON",
    icon: BigQueryIcon,
    accentColor: "#4285F4",
    sampleEndpoint: "bigquery.googleapis.com/v1",
  },
  {
    id: "databricks",
    name: "Databricks",
    category: "lakehouse",
    categoryLabel: "Delta Lakehouse",
    protocol: "Delta Lake Direct & SQL Warehouse",
    latencyBadge: "Parquet Columnar Pushdown",
    description: "Serverless SQL endpoints querying Delta Lake tables with ACID isolation and liquid clustering.",
    authMethod: "Personal Access Token / OAuth",
    icon: DatabricksIcon,
    accentColor: "#FF3621",
    sampleEndpoint: "dbc-99887766.cloud.databricks.com",
  },
  {
    id: "redshift",
    name: "Amazon Redshift",
    category: "warehouse",
    categoryLabel: "Managed Cloud Warehouse",
    protocol: "Redshift Data API & Serverless",
    latencyBadge: "Cluster Accelerated",
    description: "High-performance columnar storage with automated workload management (WLM) and direct S3 spectrum queries.",
    authMethod: "AWS IAM Role / Secret ARN",
    icon: RedshiftIcon,
    accentColor: "#CC292B",
    sampleEndpoint: "cluster.redshift.amazonaws.com:5439",
  },
  {
    id: "s3-parquet",
    name: "Amazon S3 Parquet",
    category: "lakehouse",
    categoryLabel: "Object Store & Delta Files",
    protocol: "Apache Arrow IPC / S3 Multi-Part",
    latencyBadge: "Direct Vector Read",
    description: "Zero-copy ingestion directly from Amazon S3 Parquet partitions straight into DuckDB WASM memory.",
    authMethod: "AWS IAM AssumeRole / SigV4",
    icon: S3ParquetIcon,
    accentColor: "#569A31",
    sampleEndpoint: "s3://prod-analytics-lakehouse/parquet/",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    categoryLabel: "Relational OLTP",
    protocol: "TLSv1.3 Encrypted Pool",
    latencyBadge: "< 2ms Pooled Latency",
    description: "Connection-pooled transactional queries with row-level security policy extraction and logical replication.",
    authMethod: "SCRAM-SHA-256 / SSL Verify",
    icon: PostgreSQLIcon,
    accentColor: "#336791",
    sampleEndpoint: "db-primary.internal:5432/core_prod",
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    categoryLabel: "Transactional Database",
    protocol: "MySQL Binary Protocol",
    latencyBadge: "Direct Streaming",
    description: "High-performance binlog CDC and indexed dimension queries with automated schema discovery.",
    authMethod: "Caching SHA2 / SSL Cert",
    icon: MySQLIcon,
    accentColor: "#00758F",
    sampleEndpoint: "mysql-replica.internal:3306/sales",
  },
  {
    id: "duckdb",
    name: "DuckDB (In-Memory)",
    category: "database",
    categoryLabel: "Embedded WASM OLAP",
    protocol: "In-Browser WASM Vector Engine",
    latencyBadge: "Sub-15ms In-Memory",
    description: "Ultra-fast client-side columnar analytical execution engine powering RicozViz Studio without server roundtrips.",
    authMethod: "Local WASM Sandbox",
    icon: DuckDBIcon,
    accentColor: "#D9A441",
    sampleEndpoint: "duckdb://wasm-memory/vector_buffer",
  },
  {
    id: "kafka",
    name: "Apache Kafka",
    category: "streaming",
    categoryLabel: "Real-Time Event Stream",
    protocol: "Kafka Protocol / Schema Registry",
    latencyBadge: "Real-Time Streaming",
    description: "Continuous event ingestion from distributed topic partitions with Avro & Protobuf schema validation.",
    authMethod: "SASL_SSL / SCRAM-512",
    icon: KafkaIcon,
    accentColor: "#172B3A",
    sampleEndpoint: "kafka-broker.internal:9092",
  },
];

export function ConnectorGridLogoCloud() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeConnector, setActiveConnector] = useState<ConnectorItem>(ENTERPRISE_CONNECTORS[0]);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testSuccess, setTestSuccess] = useState<boolean>(true);
  const [testLatency, setTestLatency] = useState<number>(2.4);

  const filteredConnectors =
    selectedCategory === "all"
      ? ENTERPRISE_CONNECTORS
      : ENTERPRISE_CONNECTORS.filter((c) => c.category === selectedCategory);

  function handleTestConnection(connector: ConnectorItem) {
    setActiveConnector(connector);
    setIsTesting(true);
    setTestSuccess(false);

    setTimeout(() => {
      // Simulate real ping duration between 1.8ms and 4.2ms
      const lat = +(1.8 + Math.random() * 2.4).toFixed(1);
      setTestLatency(lat);
      setTestSuccess(true);
      setIsTesting(false);
    }, 400);
  }

  const ActiveIcon = activeConnector.icon;

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------- */}
      {/* 1. ENTERPRISE LOGO CLOUD HEADER STRIP                          */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#DADFD9] dark:border-[#374151] bg-white/80 dark:bg-[#1F2937]/80 backdrop-blur-md p-6 shadow-xs">
        <div className="text-center max-w-xl mx-auto mb-6">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#147D78] dark:text-[#4F9D8E]">
            Native Enterprise Connectivity
          </span>
          <h3 className="mt-1.5 text-lg sm:text-xl font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
            Connect any warehouse, lakehouse, or database in seconds
          </h3>
          <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-1">
            Zero-copy Apache Arrow buffers stream directly into DuckDB WASM without middleware bottlenecks.
          </p>
        </div>

        {/* Marquee / Grid of Authentic Brand Logos */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {ENTERPRISE_CONNECTORS.map((connector) => {
            const Icon = connector.icon;
            const isCurrent = activeConnector.id === connector.id;

            return (
              <button
                key={connector.id}
                onClick={() => handleTestConnection(connector)}
                type="button"
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group ${
                  isCurrent
                    ? "bg-[#F4F1EA] dark:bg-[#111827] border-[#147D78] dark:border-[#4F9D8E] shadow-sm -translate-y-0.5"
                    : "bg-white dark:bg-[#1F2937] border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/50 dark:hover:border-[#4F9D8E]/50 hover:-translate-y-0.5"
                }`}
                title={`Inspect ${connector.name} connector specifications`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] shadow-2xs group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10.5px] font-semibold text-[#172B3A] dark:text-[#E5E7EB] truncate w-full text-center">
                  {connector.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CATEGORY FILTER TABS & CONNECTOR GRID                      */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#147D78] dark:text-[#4F9D8E]" />
            <h4 className="text-base font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
              Connector Architecture Grid
            </h4>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] p-1 font-mono text-xs">
            {[
              { id: "all", label: "All Connectors" },
              { id: "warehouse", label: "Cloud Warehouses" },
              { id: "lakehouse", label: "Lakehouse & S3" },
              { id: "database", label: "Relational OLTP" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                type="button"
                className={`px-3 py-1 rounded-md transition cursor-pointer font-medium ${
                  selectedCategory === cat.id
                    ? "bg-[#147D78] dark:bg-[#4F9D8E] text-white shadow-xs"
                    : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* Connector Cards Grid                                        */}
        {/* ----------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConnectors.map((connector) => {
            const Icon = connector.icon;
            const isSelected = activeConnector.id === connector.id;

            return (
              <div
                key={connector.id}
                onClick={() => handleTestConnection(connector)}
                className={`rounded-xl p-5 border transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? "bg-white dark:bg-[#1F2937] border-[#147D78] dark:border-[#4F9D8E] shadow-md ring-1 ring-[#147D78]/20 dark:ring-[#4F9D8E]/30 -translate-y-0.5"
                    : "bg-white dark:bg-[#1F2937] border-[#DADFD9] dark:border-[#374151] hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/40 hover:shadow-xs"
                }`}
              >
                <div>
                  {/* Card Top: Brand Icon + Latency Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] shadow-2xs group-hover:scale-105 transition-transform">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h5 className="font-heading text-sm font-bold text-[#172B3A] dark:text-[#E5E7EB] group-hover:text-[#147D78] dark:group-hover:text-[#4F9D8E] transition-colors">
                          {connector.name}
                        </h5>
                        <span className="font-mono text-[10px] text-[#596775] dark:text-[#9CA3AF]">
                          {connector.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {connector.latencyBadge}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#596775] dark:text-[#9CA3AF] leading-relaxed">
                    {connector.description}
                  </p>
                </div>

                {/* Footer Metadata: Protocol & Auth */}
                <div className="mt-4 pt-3 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-between text-[10.5px] font-mono">
                  <span className="text-[#147D78] dark:text-[#4F9D8E] font-medium truncate max-w-[170px]">
                    {connector.protocol}
                  </span>

                  <span className="text-[#596775] dark:text-[#9CA3AF] flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-500" />
                    <span>TLS 1.3</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ACTIVE CONNECTOR LIVE SIMULATOR DRAWER                     */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/60 dark:bg-[#111827]/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DADFD9] dark:border-[#374151]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] shadow-xs">
              <ActiveIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                  {activeConnector.name} Enterprise Connector
                </h4>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <p className="font-mono text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                Target Endpoint: {activeConnector.sampleEndpoint}
              </p>
            </div>
          </div>

          {/* Test Connection Button */}
          <button
            onClick={() => handleTestConnection(activeConnector)}
            disabled={isTesting}
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#147D78] hover:bg-[#106963] text-white font-sans text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 self-start md:self-auto"
          >
            {isTesting ? (
              <>
                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                <span>Pinging Connector...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 fill-current text-emerald-300" />
                <span>Test Live Connection</span>
              </>
            )}
          </button>
        </div>

        {/* Live Diagnostics Metrics */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Driver Protocol
            </span>
            <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 block truncate">
              {activeConnector.protocol}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Authentication
            </span>
            <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 block truncate">
              {activeConnector.authMethod}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Live Ping Latency
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {testLatency}ms (Sub-10ms)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[10px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Vector Ingestion
            </span>
            <span className="text-xs font-bold text-[#147D78] dark:text-[#4F9D8E] mt-0.5 block">
              Zero-Copy Arrow IPC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
