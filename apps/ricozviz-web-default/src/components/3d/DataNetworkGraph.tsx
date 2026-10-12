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
        const isDark = document.documentElement.classList.contains("dark");

        ctx.beginPath();
        ctx.moveTo(x1, yMid);
        ctx.bezierCurveTo((x1 + x2) / 2, yMid - 25, (x1 + x2) / 2, yMid + 25, x2, yMid);
        ctx.strokeStyle = isDark ? "rgba(55, 65, 81, 0.9)" : "rgba(218, 223, 217, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Moving energy pulse with restrained teal accent
        if (!prefersReducedMotion) {
          const pulseT = (t * 0.5 + i * 0.2) % 1;
          const px = x1 + (x2 - x1) * pulseT;
          const py = yMid + Math.sin(pulseT * Math.PI) * 10;

          const pulseColor = i % 2 === 0 ? (isDark ? "#4F9D8E" : "#147D78") : "#D9A441";
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = pulseColor;
          ctx.fill();
        }
      }

      t += 0.012;
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
    <div className="relative rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#172B3A] dark:text-[#E5E7EB] p-5 sm:p-8 shadow-xs dark:shadow-md overflow-hidden">
      {/* Background canvas for connected conduits */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-6">
        {/* Active Node Telemetry Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA] dark:bg-[#111827] p-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] text-[#147D78] dark:text-[#4F9D8E] shrink-0 shadow-xs">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-heading font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
                  {activeNodeData.name}
                </span>
                <span className="rounded bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] px-2 py-0.5 text-[10px] font-mono text-[#147D78] dark:text-[#4F9D8E] font-medium">
                  {activeNodeData.layer.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                {activeNodeData.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center font-mono text-xs">
            <span className="text-[#596775] dark:text-[#9CA3AF]">Metric:</span>
            <span className="text-[#147D78] dark:text-[#4F9D8E] bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] px-2.5 py-1 rounded-md text-[11px] font-mono font-medium shadow-xs">
              {activeNodeData.metric}
            </span>
          </div>
        </div>

        {/* Interactive Multi-Stage Pipeline Nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Stage 1: Connectors */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3 border transition flex items-center gap-2.5 cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB] truncate">{node.name}</p>
                    <p className="text-[9px] text-[#596775] dark:text-[#9CA3AF] font-mono truncate">{node.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stage 2: Datasets */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3.5 border transition flex flex-col justify-between h-[132px] cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div>
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{node.name}</p>
                    <p className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#147D78] dark:text-[#4F9D8E]">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 3: Query Engine */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3.5 border transition flex flex-col justify-between h-[132px] cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div>
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{node.name}</p>
                    <p className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#147D78] dark:text-[#4F9D8E]">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 4: Visualization Studio */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3.5 border transition flex flex-col justify-between h-[132px] cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div>
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{node.name}</p>
                    <p className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#147D78] dark:text-[#4F9D8E]">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 5: Dashboards */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3.5 border transition flex flex-col justify-between h-[132px] cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div>
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{node.name}</p>
                    <p className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#147D78] dark:text-[#4F9D8E]">{node.metric}</span>
                </button>
              );
            })}
          </div>

          {/* Stage 6: Insights */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#596775] dark:text-[#9CA3AF] block px-1">
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
                  className={`w-full text-left rounded-lg p-3.5 border transition flex flex-col justify-between h-[132px] cursor-pointer ${
                    isSelected
                      ? "border-[#147D78] dark:border-[#4F9D8E] bg-[#F4F1EA] dark:bg-[#111827] ring-1 ring-[#147D78]/25 dark:ring-[#4F9D8E]/30 shadow-xs"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]/50 hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/50 hover:bg-[#F4F1EA]/40 dark:hover:bg-[#111827]"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-[#147D78] dark:text-[#4F9D8E]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
                  <div>
                    <p className="text-xs font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{node.name}</p>
                    <p className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-snug">{node.description}</p>
                  </div>
                  <span className="text-[9px] font-mono text-[#147D78] dark:text-[#4F9D8E]">{node.metric}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
