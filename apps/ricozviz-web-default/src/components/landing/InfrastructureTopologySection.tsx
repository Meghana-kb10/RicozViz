"use client";

import React, { useState } from "react";
import {
  Database,
  Layers,
  Cpu,
  LayoutDashboard,
  Zap,
  Activity,
  Radio,
  Lock,
  Globe,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Server,
  ShieldCheck,
  Compass,
} from "lucide-react";

interface TopologyNode {
  id: string;
  name: string;
  category: "Warehouse Lake" | "Zero-Copy Bus" | "In-Memory OLAP" | "Executive Surface";
  tierId: number;
  protocolBadge: string;
  latencyBadge: string;
  speedMultiplier: string;
  egress: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
}

const TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: "snowflake",
    name: "Snowflake Lakehouse",
    category: "Warehouse Lake",
    tierId: 1,
    protocolBadge: "Flight SQL",
    latencyBadge: "1.8 ms",
    speedMultiplier: "10x Direct Pushdown",
    egress: "Zero Egress Spill",
    icon: Database,
    description: "Vectorized query execution directly inside your existing cloud warehouse partitions.",
    features: ["Zero data replication", "Automated TLS 1.3 key exchange", "Snowpipe stream listener"],
  },
  {
    id: "kafka",
    name: "Apache Kafka Streams",
    category: "Warehouse Lake",
    tierId: 1,
    protocolBadge: "Wire Streaming",
    latencyBadge: "0.8 ms",
    speedMultiplier: "Sub-Second Ingest",
    egress: "Delta Stream",
    icon: Radio,
    description: "Continuous real-time event streaming for checkout, order, and telemetry topics.",
    features: ["Sub-5ms consumer lag", "SASL SCRAM authentication", "Auto-rebalancing consumer groups"],
  },
  {
    id: "arrow",
    name: "Apache Arrow IPC",
    category: "Zero-Copy Bus",
    tierId: 2,
    protocolBadge: "Arrow IPC",
    latencyBadge: "0.4 ms",
    speedMultiplier: "240k rows/s",
    egress: "In-Memory Buffer",
    icon: Layers,
    description: "Standardized columnar record batches mapped directly into client CPU vector registers.",
    features: ["SIMD-128 register projection", "No JSON/CSV serialization penalty", "Snappy column compression"],
  },
  {
    id: "duckdb",
    name: "DuckDB Wasm OLAP",
    category: "In-Memory OLAP",
    tierId: 3,
    protocolBadge: "Wasm Kernel",
    latencyBadge: "8.4 ms P95",
    speedMultiplier: "119,048 rps",
    egress: "0 B Cloud Network",
    icon: Cpu,
    description: "Hardware-accelerated C++ vectorized analytical kernel compiled to browser WebAssembly.",
    features: ["Sub-12ms execution on 1M rows", "Full SQL-2016 window functions", "Multi-core Web Worker thread pool"],
  },
  {
    id: "rls",
    name: "Kernel RLS Guard",
    category: "In-Memory OLAP",
    tierId: 3,
    protocolBadge: "SHA-256 Ledger",
    latencyBadge: "0.3 ms",
    speedMultiplier: "100% Intercept",
    egress: "Tamper Proof",
    icon: ShieldCheck,
    description: "Deterministic AST rewrite guarantees zero cross-tenant leakage with dynamic PII masking.",
    features: ["AST-level query rewriting", "Hardware HSM key envelope", "RFC 6962 verifiable audit chain"],
  },
  {
    id: "canvases",
    name: "Executive Canvases",
    category: "Executive Surface",
    tierId: 4,
    protocolBadge: "React 19 Canvas",
    latencyBadge: "60 FPS",
    speedMultiplier: "Instant Slice",
    egress: "GPU Accelerated",
    icon: LayoutDashboard,
    description: "Point-and-click exploratory dashboards with real-time multiplayer cursor synchronization.",
    features: ["Multiplayer presence (<5ms)", "18+ interactive visualizers", "Expiring HMAC iframe embedding"],
  },
];

export default function InfrastructureTopologySection() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("duckdb");
  const [isLivePinging, setIsLivePinging] = useState<boolean>(false);
  const [liveLatency, setLiveLatency] = useState<number>(8.4);

  const activeNode =
    TOPOLOGY_NODES.find((n) => n.id === selectedNodeId) || TOPOLOGY_NODES[3];

  const handlePingNetwork = () => {
    setIsLivePinging(true);
    setTimeout(() => {
      setLiveLatency(Number((6.8 + Math.random() * 2.8).toFixed(1)));
      setIsLivePinging(false);
    }, 500);
  };

  return (
    <section id="topology" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35] mb-[10px]">
            <Globe className="h-[12px] w-[12px]" />
            <span>CONNECTED INFRASTRUCTURE TOPOLOGY</span>
          </div>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Trace every metric to its source,
            </span>
            <span className="block text-[#fafafa]">
              with zero warehouse round-trip latency
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={handlePingNetwork}
          disabled={isLivePinging}
          className="flex items-center gap-[6px] rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[16px] py-[8px] text-[12px] font-medium text-[#fafafa] transition-all hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer shadow-[0_0_20px_rgba(255,107,53,0.18)]"
        >
          <Zap className={`h-[12px] w-[12px] ${isLivePinging ? "animate-bounce" : ""}`} />
          <span>{isLivePinging ? "Measuring Network Signals…" : "Ping Distributed Topologies"}</span>
        </button>
      </div>

      {/* TOPOLOGY VISUAL WORKBENCH */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#2e2e2e] bg-[#171717] p-[24px] sm:p-[32px] shadow-2xl">
        {/* Subtle Faded Dark Imagery Layer */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/stream-globe.jpg')" }}
        />
        <div className="pointer-events-none absolute inset-0 z-0 bg-linear-to-b from-[#171717]/80 via-[#171717]/95 to-[#171717]" />

        <div className="relative z-10 grid grid-cols-1 gap-[32px] lg:grid-cols-12 items-center">
          {/* LEFT 7 COLS: Interactive Visual Topology Nodes Map */}
          <div className="flex flex-col gap-[14px] lg:col-span-7">
            <div className="flex items-center justify-between text-[11px] font-mono-code text-[#898989] border-b border-[#2e2e2e] pb-[10px]">
              <span>ACTIVE TOPOLOGY NODES (CLICK TO INSPECT)</span>
              <span className="text-emerald-400 flex items-center gap-[5px]">
                <span className="h-[6px] w-[6px] rounded-full bg-emerald-400 animate-pulse" />
                6 Nodes Synchronized
              </span>
            </div>

            {/* Visual Node Cards Grid */}
            <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
              {TOPOLOGY_NODES.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const Icon = node.icon;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setLiveLatency(Number((6.8 + Math.random() * 2.8).toFixed(1)));
                    }}
                    className={`group relative flex flex-col items-start rounded-[14px] border p-[16px] text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                      isSelected
                        ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_8px_24px_rgba(255,107,53,0.14)] -translate-y-1"
                        : "border-[#2e2e2e] bg-[#121212]/90 hover:border-[#393939] hover:bg-[#161616] hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={`flex h-[32px] w-[32px] items-center justify-center rounded-[8px] border transition-colors ${
                          isSelected
                            ? "border-[#ff6b35]/40 bg-[#ff6b35]/20 text-[#ff6b35]"
                            : "border-[#2e2e2e] bg-[#1c1c1c] text-[#898989] group-hover:text-[#fafafa]"
                        }`}
                      >
                        <Icon className="h-[16px] w-[16px]" />
                      </div>

                      <div className="flex items-center gap-[6px]">
                        <span className="rounded-full border border-[#2e2e2e] bg-[#171717] px-[8px] py-[2px] font-mono-code text-[10px] text-[#898989]">
                          {node.protocolBadge}
                        </span>
                        <span className="h-[6px] w-[6px] rounded-full bg-emerald-400" />
                      </div>
                    </div>

                    <div className="mt-[12px] text-[14px] font-medium text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                      {node.name}
                    </div>

                    <div className="mt-[6px] flex w-full items-center justify-between text-[11px] font-mono-code">
                      <span className="text-[#898989]">{node.category}</span>
                      <span
                        className={`font-semibold ${
                          isSelected ? "text-[#ff6b35]" : "text-emerald-400"
                        }`}
                      >
                        {node.latencyBadge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT 5 COLS: Selected Node Real-Time Telemetry Inspector */}
          <div className="flex flex-col justify-between rounded-[16px] border border-[#2e2e2e] bg-[#121212]/95 p-[24px] lg:col-span-5 shadow-inner">
            <div>
              <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[14px]">
                <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] font-mono-code text-[11px] text-[#ff6b35]">
                  NODE_INSPECTOR // {activeNode.id.toUpperCase()}
                </span>
                <span className="text-[11px] font-mono-code text-emerald-400">
                  ✓ VERIFIED_ONLINE
                </span>
              </div>

              <div className="mt-[16px]">
                <h3 className="text-[20px] font-normal text-[#fafafa]">
                  {activeNode.name}
                </h3>
                <p className="mt-[4px] text-[13px] leading-[1.5] text-[#898989]">
                  {activeNode.description}
                </p>
              </div>

              {/* Graphical Speed & Latency Meter */}
              <div className="mt-[20px] rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[16px] text-center">
                <span className="text-[10px] font-mono-code uppercase text-[#898989] block">
                  Measured Round-Trip Ping
                </span>
                <div className="my-[8px] flex items-center justify-center gap-[4px]">
                  <span className="text-[36px] font-bold font-mono-code text-emerald-400">
                    {liveLatency}
                  </span>
                  <span className="text-[16px] font-mono-code text-emerald-400">ms</span>
                </div>
                <div className="flex items-center justify-center gap-[8px] text-[11px] text-[#898989]">
                  <span className="text-[#ff6b35] font-semibold">{activeNode.speedMultiplier}</span>
                  <span>·</span>
                  <span>{activeNode.egress}</span>
                </div>
              </div>

              {/* Node Feature Badges */}
              <div className="mt-[18px] flex flex-col gap-[8px]">
                {activeNode.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-[8px] rounded-[8px] border border-[#2e2e2e]/60 bg-[#171717]/60 px-[10px] py-[7px] text-[12px] text-[#b4b4b4]"
                  >
                    <CheckCircle2 className="h-[13px] w-[13px] text-[#ff6b35] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Guarantee */}
            <div className="mt-[20px] pt-[14px] border-t border-[#2e2e2e] flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
              <span>Hardware Encryption:</span>
              <span className="text-[#fafafa]">TLS 1.3 + ChaCha20</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
