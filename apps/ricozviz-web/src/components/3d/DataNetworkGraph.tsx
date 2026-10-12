"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  FileSpreadsheet,
  Globe,
  Layers,
  Cpu,
  BarChart3,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";

interface NodeData {
  id: string;
  name: string;
  layer: "sources" | "datasets" | "query" | "visualization" | "dashboards" | "insights";
  description: string;
  metric: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NODES: NodeData[] = [
  // Layer 1: Sources
  {
    id: "src-pg",
    name: "PostgreSQL",
    layer: "sources",
    description: "Production Relational Database",
    metric: "Connection Pool Encrypted",
    icon: Database,
  },
  {
    id: "src-csv",
    name: "CSV Ingestion",
    layer: "sources",
    description: "Delimited Files & Exports",
    metric: "Auto Type Inference",
    icon: FileSpreadsheet,
  },
  {
    id: "src-api",
    name: "REST APIs",
    layer: "sources",
    description: "External JSON Endpoints",
    metric: "Live Polling Adapter",
    icon: Globe,
  },

  // Layer 2: Datasets
  {
    id: "layer-ds",
    name: "Dataset Layer",
    layer: "datasets",
    description: "Discovered Schema & Metadata",
    metric: "Typed Columns & Nullability",
    icon: Layers,
  },

  // Layer 3: Query Engine
  {
    id: "layer-query",
    name: "Safe Query Engine",
    layer: "query",
    description: "Parameterized Aggregations",
    metric: "< 12ms P95 Latency",
    icon: Cpu,
  },

  // Layer 4: Visualization Studio
  {
    id: "layer-viz",
    name: "Visualization Studio",
    layer: "visualization",
    description: "8 Renderers (Bar, Line, Area, etc)",
    metric: "Pure React 19 / Recharts",
    icon: BarChart3,
  },

  // Layer 5: Dashboards
  {
    id: "layer-dash",
    name: "Governed Dashboards",
    layer: "dashboards",
    description: "Multi-tenant Canvases",
    metric: "RBAC & Tenant Isolation",
    icon: LayoutDashboard,
  },

  // Layer 6: Executive Insight
  {
    id: "layer-insight",
    name: "Business Decisions",
    layer: "insights",
    description: "Actionable Intelligence",
    metric: "100% Governed Access",
    icon: TrendingUp,
  },
];

export function DataNetworkGraph() {
  const [activeNode, setActiveNode] = useState<string>("layer-query");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animated background connection pulse lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let t = 0;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 400;
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // Draw subtle connective conduits
      const layersX = [w * 0.08, w * 0.25, w * 0.42, w * 0.60, w * 0.78, w * 0.92];

      for (let i = 0; i < layersX.length - 1; i++) {
        const x1 = layersX[i];
        const x2 = layersX[i + 1];
        const yMid = h / 2;

        ctx.beginPath();
        ctx.moveTo(x1, yMid);
        ctx.bezierCurveTo((x1 + x2) / 2, yMid - 30, (x1 + x2) / 2, yMid + 30, x2, yMid);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Moving energy pulse
        if (!prefersReducedMotion) {
          const pulseT = (t * 0.6 + i * 0.2) % 1;
          const px = x1 + (x2 - x1) * pulseT;
          const py = yMid + Math.sin(pulseT * Math.PI) * 12;

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      t += 0.015;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const activeNodeData =
    NODES.find((n) => n.id === activeNode) || NODES[4];
  const ActiveIcon = activeNodeData.icon;

  return (
    <div className="relative rounded-2xl border border-gray-200/90 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 shadow-2xl overflow-hidden">
      {/* Background canvas for glowing particle paths */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/60 pb-6 mb-8">
          <div>
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              Unified Data Topology
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Your data, connected.
            </h3>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-xl">
              From diverse storage endpoints through schema discovery, isolated query engine, to live decision dashboards.
            </p>
          </div>

          {/* Active Node Telemetry Badge */}
          <div className="rounded-xl border border-indigo-700/50 bg-indigo-900/50 backdrop-blur-md p-3.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/80 text-white shrink-0">
              <ActiveIcon className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{activeNodeData.name}</span>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300">
                  ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-indigo-300 font-mono mt-0.5">
                {activeNodeData.metric}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Multi-Stage Pipeline Nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Stage 1: Connectors */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              01 · Sources
            </span>
            {NODES.filter((n) => n.layer === "sources").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-3 border transition flex items-center gap-2.5 ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md shadow-cyan-900/20 ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700 hover:bg-indigo-950/30"
                  }`}
                >
                  <Icon className="h-4 w-4 text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">{node.name}</p>
                    <p className="text-[9px] text-indigo-300/70 font-mono truncate">{node.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stage 2: Datasets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              02 · Datasets
            </span>
            {NODES.filter((n) => n.layer === "datasets").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-4 border transition flex flex-col justify-between h-[132px] ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700"
                  }`}
                >
                  <Icon className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] text-indigo-300/80 mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 3: Query Engine */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              03 · Query Engine
            </span>
            {NODES.filter((n) => n.layer === "query").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-4 border transition flex flex-col justify-between h-[132px] ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700"
                  }`}
                >
                  <Icon className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] text-indigo-300/80 mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 4: Visualization Studio */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              04 · Visual Studio
            </span>
            {NODES.filter((n) => n.layer === "visualization").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-4 border transition flex flex-col justify-between h-[132px] ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700"
                  }`}
                >
                  <Icon className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] text-indigo-300/80 mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 5: Dashboards */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              05 · Dashboards
            </span>
            {NODES.filter((n) => n.layer === "dashboards").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-4 border transition flex flex-col justify-between h-[132px] ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700"
                  }`}
                >
                  <Icon className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] text-indigo-300/80 mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-300">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 6: Insights */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block px-1">
              06 · Decisions
            </span>
            {NODES.filter((n) => n.layer === "insights").map((node) => {
              const Icon = node.icon;
              const isSelected = activeNode === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full text-left rounded-xl p-4 border transition flex flex-col justify-between h-[132px] ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-950/40 shadow-md ring-1 ring-cyan-400/50"
                      : "border-indigo-900/50 bg-slate-900/40 hover:border-indigo-700"
                  }`}
                >
                  <Icon className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] text-indigo-300/80 mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">{node.metric}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
