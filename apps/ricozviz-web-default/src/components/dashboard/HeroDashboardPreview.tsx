"use client";

import React, { useState } from "react";
import {
  Database,
  Calendar,
  Filter,
  RefreshCw,
  Download,
  Terminal,
  TrendingUp,
  Layers,
  CheckCircle2,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { AreaChartRenderer } from "@/components/visualization/AreaChartRenderer";
import { BarChartRenderer } from "@/components/visualization/BarChartRenderer";
import type { MappedChartData } from "@/lib/chart-query-mapper";
import type { ChartConfig } from "@/lib/api";

const REVENUE_DATA: MappedChartData = {
  chartType: "AREA",
  xKey: "month",
  measureKeys: ["revenue"],
  columns: [
    { name: "month", type: "string" },
    { name: "revenue", type: "number" },
  ],
  rows: [
    { month: "Jan", revenue: 420000 },
    { month: "Feb", revenue: 580000 },
    { month: "Mar", revenue: 710000 },
    { month: "Apr", revenue: 640000 },
    { month: "May", revenue: 890000 },
    { month: "Jun", revenue: 1150000 },
  ],
};

const REVENUE_CONFIG: ChartConfig = {
  options: {
    title: "Monthly Revenue Trajectory",
    showGrid: true,
    showXAxis: true,
    showYAxis: true,
    showLegend: false,
    numberFormat: "currency",
  },
};

const REGIONAL_DATA: MappedChartData = {
  chartType: "BAR",
  xKey: "region",
  measureKeys: ["sales"],
  columns: [
    { name: "region", type: "string" },
    { name: "sales", type: "number" },
  ],
  rows: [
    { region: "North America", sales: 1820000 },
    { region: "EMEA", sales: 1340000 },
    { region: "APAC", sales: 1190000 },
    { region: "LATAM", sales: 500000 },
  ],
};

const REGIONAL_CONFIG: ChartConfig = {
  options: {
    title: "Regional Sales Distribution",
    showGrid: true,
    showXAxis: true,
    showYAxis: true,
    showLegend: false,
    numberFormat: "currency",
  },
};

export function HeroDashboardPreview() {
  const [timeRange, setTimeRange] = useState<"30D" | "90D" | "YTD">("30D");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [queryLatency, setQueryLatency] = useState(8.2);

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      setQueryLatency(+(7.5 + Math.random() * 1.5).toFixed(1));
      setIsRefreshing(false);
    }, 350);
  }

  return (
    <div className="relative mx-auto max-w-6xl w-full">
      {/* Subtle Specular Frame */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A] shadow-2xl overflow-hidden transition-all duration-200">
        {/* Window Chrome Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#131B2E]/90 px-4 py-3 text-xs">
          {/* Left: Window Dots & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            </div>
            <div className="h-4 w-px bg-white/10 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-white tracking-tight truncate text-xs sm:text-sm">
              Executive Revenue & In-Memory Analytics
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              DuckDB WASM
            </span>
          </div>

          {/* Right: Controls & Filters */}
          <div className="flex items-center gap-2 font-mono text-[11px]">
            {/* Timeframe Filter */}
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#090D16] p-0.5">
              {(["30D", "90D", "YTD"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                    timeRange === range
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-white/[0.08] bg-[#090D16] text-slate-400 hover:text-white hover:border-white/20 transition disabled:opacity-50"
              title="Refresh In-Memory Computation"
              aria-label="Refresh in-memory computation"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Dashboard Canvas Body */}
        <div className="p-4 sm:p-6 space-y-5 bg-[#0A0F1D]">
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Total Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                $4,850,240
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+18.4%</span>
                <span className="text-slate-500 font-sans text-[11px]">vs target</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Active Accounts
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                1,428
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+12.2%</span>
                <span className="text-slate-500 font-sans text-[11px]">new clients</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Query Throughput
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                42.8k / day
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                <span>{queryLatency}ms</span>
                <span className="text-slate-500 font-sans text-[11px]">avg execution</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                Memory Footprint
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                14.2 MB
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                <span>Zero-Copy</span>
                <span className="text-slate-500 font-sans text-[11px]">Arrow buffers</span>
              </div>
            </div>
          </div>

          {/* Interactive Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Area Chart: Monthly Trajectory */}
            <div className="lg:col-span-2 rounded-xl border border-white/[0.07] bg-[#111827] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-sm text-white tracking-tight">
                    Monthly Revenue Trajectory
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Aggregate SUM(revenue) by Month · 6-Month Period
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded">
                  Area Chart
                </span>
              </div>
              <div className="h-56 w-full">
                <AreaChartRenderer
                  data={REVENUE_DATA}
                  config={REVENUE_CONFIG}
                  height="100%"
                />
              </div>
            </div>

            {/* Bar Chart: Regional Sales */}
            <div className="rounded-xl border border-white/[0.07] bg-[#111827] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-sm text-white tracking-tight">
                    Regional Distribution
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    SUM(sales) by Geography
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded">
                  Bar Chart
                </span>
              </div>
              <div className="h-56 w-full">
                <BarChartRenderer
                  data={REGIONAL_DATA}
                  config={REGIONAL_CONFIG}
                  height="100%"
                />
              </div>
            </div>
          </div>

          {/* Bottom Execution Telemetry Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-[#090D16] px-3.5 py-2.5 text-[11px] font-mono text-slate-400 overflow-hidden w-full">
            <div className="flex items-center gap-2 truncate max-w-full">
              <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-500 shrink-0">Plan:</span>
              <code className="text-slate-300 truncate">
                SELECT date_trunc(&apos;month&apos;, ts), sum(revenue) FROM sales GROUP BY 1
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 text-[10px]">
              <span className="text-emerald-400">{queryLatency}ms execution</span>
              <span className="text-slate-500">·</span>
              <span>10,000,000 rows</span>
              <span className="text-slate-500">·</span>
              <span className="text-indigo-400">0 B network egress</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
