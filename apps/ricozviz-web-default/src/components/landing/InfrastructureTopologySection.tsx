"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Cpu,
  LayoutDashboard,
  Server,
  Zap,
  Activity,
  ShieldCheck,
  Radio,
  ArrowRight,
  RefreshCw,
  Lock,
  Globe,
  CheckCircle2,
} from "lucide-react";

interface TopologyNode {
  id: string;
  name: string;
  tier: "sources" | "gateway" | "engine" | "surfaces";
  description: string;
  protocol: string;
  latency: string;
  throughput: string;
  egress: string;
  status: "HEALTHY" | "STREAMING" | "STANDBY";
  encryption: string;
  memory: string;
  highlightMetric: string;
}

const TOPOLOGY_TIERS = [
  { id: "sources", label: "01 Ingestion", desc: "Warehouses & Streams" },
  { id: "gateway", label: "02 Zero-Copy Gateway", desc: "Arrow IPC & Buffers" },
  { id: "engine", label: "03 In-Memory OLAP", desc: "DuckDB Wasm Engine" },
  { id: "surfaces", label: "04 Governed Surfaces", desc: "Canvases & Embeds" },
] as const;

const TOPOLOGY_NODES: TopologyNode[] = [
  // TIER 1: SOURCES
  {
    id: "src-snowflake",
    name: "Snowflake Warehouse",
    tier: "sources",
    description: "Enterprise Cloud Lakehouse & Snowpipe Pushdown",
    protocol: "Flight SQL / TLS 1.3",
    latency: "2.1 ms",
    throughput: "45.2 MB/s",
    egress: "0 B Direct Pushdown",
    status: "HEALTHY",
    encryption: "mTLS + AES-256",
    memory: "64 MB Buffer",
    highlightMetric: "Sub-12ms Pushdown",
  },
  {
    id: "src-clickhouse",
    name: "ClickHouse OLAP",
    tier: "sources",
    description: "Real-Time Columnar Vector Store",
    protocol: "Native TCP / TCP_NODELAY",
    latency: "1.4 ms",
    throughput: "88.6 MB/s",
    egress: "Snappy Vector",
    status: "STREAMING",
    encryption: "TLS 1.3 ChaCha20",
    memory: "128 MB Buffer",
    highlightMetric: "Sub-10ms Columnar",
  },
  {
    id: "src-kafka",
    name: "Apache Kafka Cluster",
    tier: "sources",
    description: "Live Event Broker for Order & Telemetry Topics",
    protocol: "Kafka Wire Protocol",
    latency: "0.8 ms",
    throughput: "120k msgs/s",
    egress: "Zero Spill",
    status: "STREAMING",
    encryption: "SASL_SSL / SCRAM-512",
    memory: "96 MB Window",
    highlightMetric: "Sub-1ms Streaming",
  },
  {
    id: "src-s3",
    name: "S3 Parquet Lake",
    tier: "sources",
    description: "Object Storage with Zero-Copy Range Requests",
    protocol: "HTTPS / HTTP/2",
    latency: "1.9 ms",
    throughput: "72.4 MB/s",
    egress: "Snappy Parquet",
    status: "HEALTHY",
    encryption: "SSE-KMS / TLS 1.3",
    memory: "48 MB Chunks",
    highlightMetric: "Range Pushdown",
  },

  // TIER 2: GATEWAY
  {
    id: "gw-arrow",
    name: "Arrow IPC Buffer Pool",
    tier: "gateway",
    description: "Zero-Copy Columnar Ingress & Type Projection",
    protocol: "Apache Arrow IPC Stream",
    latency: "0.4 ms",
    throughput: "240k rows/s",
    egress: "Zero Intermediate Copies",
    status: "HEALTHY",
    encryption: "Internal SharedMemory",
    memory: "512 MB Pool",
    highlightMetric: "SIMD-128 Column Projection",
  },
  {
    id: "gw-schema",
    name: "Schema Catalog & CDC",
    tier: "gateway",
    description: "Continuous Type Coercion & Schema Drift Guard",
    protocol: "Internal Metadata Bus",
    latency: "0.2 ms",
    throughput: "Instant Sync",
    egress: "0 B Egress",
    status: "HEALTHY",
    encryption: "SHA-256 Catalog Key",
    memory: "16 MB State",
    highlightMetric: "Auto-Inferred Schemas",
  },

  // TIER 3: ENGINE
  {
    id: "eng-duckdb",
    name: "DuckDB Wasm OLAP",
    tier: "engine",
    description: "Compiled Vectorized Analytics Kernel",
    protocol: "WebAssembly SIMD-128",
    latency: "8.4 ms P95",
    throughput: "119,048 rps",
    egress: "0 B Browser Compute",
    status: "HEALTHY",
    encryption: "Hardware Enclave Sandboxed",
    memory: "256 MB Wasm Heap",
    highlightMetric: "1,000,000 In-Memory Rows",
  },
  {
    id: "eng-rls",
    name: "Cryptographic RLS Guard",
    tier: "engine",
    description: "AST-Level SQL Rewriter & PII Masking Engine",
    protocol: "Kernel Query Filter",
    latency: "0.3 ms",
    throughput: "100% Query Intercept",
    egress: "Tamper Proof",
    status: "HEALTHY",
    encryption: "RFC 6962 SHA-256 Ledger",
    memory: "32 MB Rule Cache",
    highlightMetric: "Zero Cross-Tenant Leakage",
  },

  // TIER 4: SURFACES
  {
    id: "srf-dashboards",
    name: "Executive Canvases",
    tier: "surfaces",
    description: "Multi-Canvas Analytics with Sub-Frame Slicing",
    protocol: "React 19 Canvas Pipeline",
    latency: "60 FPS Render",
    throughput: "Interactive",
    egress: "Local GPU Accelerated",
    status: "HEALTHY",
    encryption: "TLS 1.3 Client Session",
    memory: "60 MB DOM Heap",
    highlightMetric: "18+ Built-in Visualizers",
  },
  {
    id: "srf-multiplayer",
    name: "Multiplayer Engine",
    tier: "surfaces",
    description: "Collaborative Presence, Cursors & State Sync",
    protocol: "Secure WebSockets (WSS)",
    latency: "4.2 ms",
    throughput: "Live Sync",
    egress: "Delta Compression",
    status: "STREAMING",
    encryption: "mTLS + Token Claims",
    memory: "12 MB Channel State",
    highlightMetric: "Sub-5ms Cursor Presence",
  },
  {
    id: "srf-embed",
    name: "Signed Expiring Embeds",
    tier: "surfaces",
    description: "Sandboxed Customer-Facing iFrame Portals",
    protocol: "HMAC-SHA256 Token",
    latency: "1.1 ms",
    throughput: "Multi-Tenant",
    egress: "Isolated Scope",
    status: "HEALTHY",
    encryption: "Ephemeral JWT Claims",
    memory: "Stateless",
    highlightMetric: "Safe Third-Party Embedding",
  },
];

export default function InfrastructureTopologySection() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("eng-duckdb");
  const [simulatingPulse, setSimulatingPulse] = useState<boolean>(false);

  const selectedNode =
    TOPOLOGY_NODES.find((n) => n.id === selectedNodeId) || TOPOLOGY_NODES[6];

  const handleTriggerPulse = () => {
    setSimulatingPulse(true);
    setTimeout(() => setSimulatingPulse(false), 900);
  };

  return (
    <section id="topology" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[32px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <span className="text-[12px] font-mono-code uppercase tracking-wider text-[#ff6b35] block mb-[6px]">
            Connected Infrastructure
          </span>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Trace every metric to its source,
            </span>
            <span className="block text-[#fafafa]">
              across distributed warehouse topologies
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={handleTriggerPulse}
            disabled={simulatingPulse}
            className="flex items-center gap-[6px] rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer"
          >
            <Zap className={`h-[12px] w-[12px] ${simulatingPulse ? "animate-bounce" : ""}`} />
            <span>{simulatingPulse ? "Tracing Topologies…" : "Ping All Nodes"}</span>
          </button>
        </div>
      </div>

      {/* MAIN TOPOLOGY CONTAINER */}
      <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] lg:p-[32px]">
        {/* TOPOLOGY GRID: 4 TIERS */}
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-4">
          {TOPOLOGY_TIERS.map((tier) => {
            const tierNodes = TOPOLOGY_NODES.filter((n) => n.tier === tier.id);
            return (
              <div
                key={tier.id}
                className="flex flex-col gap-[12px] rounded-[14px] border border-[#2e2e2e] bg-[#121212] p-[16px]"
              >
                {/* Tier Title */}
                <div className="border-b border-[#2e2e2e] pb-[10px]">
                  <span className="font-mono-code text-[11px] font-medium text-[#ff6b35]">
                    {tier.label}
                  </span>
                  <div className="text-[12px] text-[#898989]">{tier.desc}</div>
                </div>

                {/* Nodes inside Tier */}
                <div className="flex flex-col gap-[8px]">
                  {tierNodes.map((node) => {
                    const isSelected = node.id === selectedNodeId;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`group flex flex-col items-start rounded-[10px] border p-[12px] text-left transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_0_16px_rgba(255,107,53,0.15)]"
                            : "border-[#2e2e2e] bg-[#171717] hover:border-[#393939] hover:bg-[#191919]"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span
                            className={`text-[13px] font-medium transition-colors ${
                              isSelected
                                ? "text-[#fafafa]"
                                : "text-[#b4b4b4] group-hover:text-[#fafafa]"
                            }`}
                          >
                            {node.name}
                          </span>
                          <span
                            className={`flex h-[6px] w-[6px] rounded-full ${
                              node.status === "STREAMING"
                                ? "bg-[#ff6b35] animate-pulse"
                                : "bg-emerald-400"
                            }`}
                          />
                        </div>

                        <div className="mt-[6px] flex w-full items-center justify-between text-[11px] font-mono-code text-[#898989]">
                          <span className="truncate max-w-[120px]">{node.protocol}</span>
                          <span
                            className={`font-semibold ${
                              isSelected ? "text-[#ff6b35]" : "text-[#fafafa]"
                            }`}
                          >
                            {node.latency}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* SELECTED NODE TELEMETRY & ARCHITECTURE INSPECTOR */}
        <div className="mt-[24px] rounded-[14px] border border-[#2e2e2e] bg-[#121212] p-[20px] sm:p-[24px]">
          <div className="flex flex-col gap-[16px] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-[10px]">
                <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[2px] font-mono-code text-[11px] text-[#ff6b35]">
                  NODE_INSPECTOR // {selectedNode.id.toUpperCase()}
                </span>
                <span className="flex items-center gap-[5px] text-[11px] font-mono-code text-emerald-400">
                  <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                  STATUS: {selectedNode.status}
                </span>
              </div>

              <h4 className="mt-[8px] text-[20px] font-medium text-[#fafafa]">
                {selectedNode.name}
              </h4>
              <p className="mt-[4px] text-[13px] text-[#898989]">
                {selectedNode.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-[10px]">
              <div className="rounded-[8px] border border-[#2e2e2e] bg-[#171717] px-[12px] py-[6px] font-mono-code text-[11px] text-[#b4b4b4]">
                Protocol: <span className="text-[#fafafa]">{selectedNode.protocol}</span>
              </div>
              <div className="rounded-[8px] border border-[#2e2e2e] bg-[#171717] px-[12px] py-[6px] font-mono-code text-[11px] text-[#b4b4b4]">
                Security: <span className="text-[#ff6b35]">{selectedNode.encryption}</span>
              </div>
            </div>
          </div>

          {/* TELEMETRY STRIP */}
          <div className="mt-[20px] grid grid-cols-2 gap-[10px] border-t border-[#2e2e2e] pt-[16px] sm:grid-cols-4">
            <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
              <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                Round-Trip Latency
              </span>
              <span className="mt-[4px] block text-[16px] font-mono-code font-semibold text-emerald-400">
                {selectedNode.latency}
              </span>
              <span className="mt-[2px] block text-[10px] text-[#898989]">
                Sub-12ms SLA Guarantee
              </span>
            </div>

            <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
              <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                Vector Throughput
              </span>
              <span className="mt-[4px] block text-[16px] font-mono-code font-semibold text-[#fafafa]">
                {selectedNode.throughput}
              </span>
              <span className="mt-[2px] block text-[10px] text-[#898989]">
                Vectorized SIMD Stream
              </span>
            </div>

            <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
              <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                Network Egress
              </span>
              <span className="mt-[4px] block text-[16px] font-mono-code font-semibold text-[#ff6b35]">
                {selectedNode.egress}
              </span>
              <span className="mt-[2px] block text-[10px] text-[#898989]">
                Zero warehouse penalty
              </span>
            </div>

            <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
              <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                Memory Footprint
              </span>
              <span className="mt-[4px] block text-[16px] font-mono-code font-semibold text-[#fafafa]">
                {selectedNode.memory}
              </span>
              <span className="mt-[2px] block text-[10px] text-[#898989]">
                Arrow Zero-Copy Buffer
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
