"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  BarChart3,
  PieChart,
  Grid3X3,
  Layers,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Terminal,
  Radio,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  Users
} from "lucide-react";
import { AreaChartRenderer } from "@/components/visualization/AreaChartRenderer";
import { BarChartRenderer } from "@/components/visualization/BarChartRenderer";
import { PieChartRenderer } from "@/components/visualization/PieChartRenderer";
import { HeatmapRenderer } from "@/components/visualization/HeatmapRenderer";
import type { MappedChartData } from "@/lib/chart-query-mapper";
import type { ChartConfig } from "@/lib/api";

type TimeRange = "7D" | "30D" | "90D" | "YTD";
type PrimaryChartType = "AREA" | "BAR" | "DONUT" | "HEATMAP";

interface PointInspection {
  label: string;
  value: number;
  metric: string;
  variance?: string;
}

// ----------------------------------------------------------------------------
// Timeframe Datasets
// ----------------------------------------------------------------------------

const DATA_BY_RANGE: Record<TimeRange, {
  revenueRows: Record<string, unknown>[];
  pieSlices: { name: string; value: number }[];
  heatmapRows: Record<string, unknown>[];
  kpis: {
    totalRevenue: string;
    revenueGrowth: string;
    activeAccounts: string;
    accountGrowth: string;
    throughput: string;
    latency: number;
    memory: string;
  };
  sqlQuery: string;
}> = {
  "7D": {
    revenueRows: [
      { period: "Mon", revenue: 168000, margin: 44.2 },
      { period: "Tue", revenue: 215000, margin: 45.1 },
      { period: "Wed", revenue: 242000, margin: 46.8 },
      { period: "Thu", revenue: 228000, margin: 45.9 },
      { period: "Fri", revenue: 312000, margin: 48.4 },
      { period: "Sat", revenue: 335000, margin: 49.1 },
      { period: "Sun", revenue: 384000, margin: 51.0 },
    ],
    pieSlices: [
      { name: "Enterprise S1", value: 894000 },
      { name: "Commercial Growth", value: 585000 },
      { name: "Self-Serve Core", value: 405000 },
    ],
    heatmapRows: [
      { period: "Mon", tier: "Enterprise", value: 92000 },
      { period: "Mon", tier: "Commercial", value: 48000 },
      { period: "Mon", tier: "Self-Serve", value: 28000 },
      { period: "Tue", tier: "Enterprise", value: 118000 },
      { period: "Tue", tier: "Commercial", value: 62000 },
      { period: "Tue", tier: "Self-Serve", value: 35000 },
      { period: "Wed", tier: "Enterprise", value: 135000 },
      { period: "Wed", tier: "Commercial", value: 71000 },
      { period: "Wed", tier: "Self-Serve", value: 36000 },
      { period: "Thu", tier: "Enterprise", value: 125000 },
      { period: "Thu", tier: "Commercial", value: 68000 },
      { period: "Thu", tier: "Self-Serve", value: 35000 },
      { period: "Fri", tier: "Enterprise", value: 172000 },
      { period: "Fri", tier: "Commercial", value: 89000 },
      { period: "Fri", tier: "Self-Serve", value: 51000 },
      { period: "Sat", tier: "Enterprise", value: 184000 },
      { period: "Sat", tier: "Commercial", value: 96000 },
      { period: "Sat", tier: "Self-Serve", value: 55000 },
      { period: "Sun", tier: "Enterprise", value: 210000 },
      { period: "Sun", tier: "Commercial", value: 112000 },
      { period: "Sun", tier: "Self-Serve", value: 62000 },
    ],
    kpis: {
      totalRevenue: "$1,884,000",
      revenueGrowth: "+14.8%",
      activeAccounts: "892",
      accountGrowth: "+8.4%",
      throughput: "18.4k / day",
      latency: 4.1,
      memory: "8.4 MB",
    },
    sqlQuery: "SELECT date_trunc('day', ts) AS day, sum(revenue) FROM sales WHERE ts >= NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 1;",
  },
  "30D": {
    revenueRows: [
      { period: "Week 1", revenue: 980000, margin: 46.2 },
      { period: "Week 2", revenue: 1140000, margin: 47.8 },
      { period: "Week 3", revenue: 1320000, margin: 49.1 },
      { period: "Week 4", revenue: 1410240, margin: 51.5 },
    ],
    pieSlices: [
      { name: "Enterprise Direct", value: 2420000 },
      { name: "Partner Sourced", value: 1480240 },
      { name: "Product-Led Growth", value: 950000 },
    ],
    heatmapRows: [
      { period: "Week 1", tier: "Enterprise", value: 510000 },
      { period: "Week 1", tier: "Commercial", value: 310000 },
      { period: "Week 1", tier: "Self-Serve", value: 160000 },
      { period: "Week 2", tier: "Enterprise", value: 590000 },
      { period: "Week 2", tier: "Commercial", value: 350000 },
      { period: "Week 2", tier: "Self-Serve", value: 200000 },
      { period: "Week 3", tier: "Enterprise", value: 680000 },
      { period: "Week 3", tier: "Commercial", value: 410000 },
      { period: "Week 3", tier: "Self-Serve", value: 230000 },
      { period: "Week 4", tier: "Enterprise", value: 740000 },
      { period: "Week 4", tier: "Commercial", value: 440240 },
      { period: "Week 4", tier: "Self-Serve", value: 230000 },
    ],
    kpis: {
      totalRevenue: "$4,850,240",
      revenueGrowth: "+18.4%",
      activeAccounts: "1,428",
      accountGrowth: "+12.2%",
      throughput: "42.8k / day",
      latency: 8.2,
      memory: "14.2 MB",
    },
    sqlQuery: "SELECT date_trunc('week', ts) AS wk, sum(revenue) FROM sales WHERE ts >= NOW() - INTERVAL '30 days' GROUP BY 1 ORDER BY 1;",
  },
  "90D": {
    revenueRows: [
      { period: "Month 1", revenue: 3850000, margin: 45.4 },
      { period: "Month 2", revenue: 4520000, margin: 48.0 },
      { period: "Month 3", revenue: 5430000, margin: 51.2 },
    ],
    pieSlices: [
      { name: "North America Cloud", value: 6840000 },
      { name: "EMEA Sovereign Hub", value: 4210000 },
      { name: "APAC Edge Regional", value: 2750000 },
    ],
    heatmapRows: [
      { period: "Month 1", tier: "Enterprise", value: 2100000 },
      { period: "Month 1", tier: "Commercial", value: 1150000 },
      { period: "Month 1", tier: "Self-Serve", value: 600000 },
      { period: "Month 2", tier: "Enterprise", value: 2480000 },
      { period: "Month 2", tier: "Commercial", value: 1340000 },
      { period: "Month 2", tier: "Self-Serve", value: 700000 },
      { period: "Month 3", tier: "Enterprise", value: 2980000 },
      { period: "Month 3", tier: "Commercial", value: 1610000 },
      { period: "Month 3", tier: "Self-Serve", value: 840000 },
    ],
    kpis: {
      totalRevenue: "$13,800,000",
      revenueGrowth: "+24.1%",
      activeAccounts: "2,890",
      accountGrowth: "+19.5%",
      throughput: "89.4k / day",
      latency: 11.4,
      memory: "28.6 MB",
    },
    sqlQuery: "SELECT date_trunc('month', ts) AS m, sum(revenue) FROM sales WHERE ts >= NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1;",
  },
  "YTD": {
    revenueRows: [
      { period: "Jan", revenue: 3100000, margin: 44.1 },
      { period: "Feb", revenue: 3450000, margin: 45.2 },
      { period: "Mar", revenue: 3980000, margin: 46.8 },
      { period: "Apr", revenue: 4320000, margin: 47.9 },
      { period: "May", revenue: 4950000, margin: 49.3 },
      { period: "Jun", revenue: 5800000, margin: 51.0 },
      { period: "Jul", revenue: 6800240, margin: 52.4 },
    ],
    pieSlices: [
      { name: "Subscription ARR", value: 19800000 },
      { name: "Compute Overage", value: 8200240 },
      { name: "Enterprise Custom SLA", value: 4400000 },
    ],
    heatmapRows: [
      { period: "Jan", tier: "Enterprise", value: 1700000 },
      { period: "Jan", tier: "Commercial", value: 920000 },
      { period: "Jan", tier: "Self-Serve", value: 480000 },
      { period: "Feb", tier: "Enterprise", value: 1880000 },
      { period: "Feb", tier: "Commercial", value: 1020000 },
      { period: "Feb", tier: "Self-Serve", value: 550000 },
      { period: "Mar", tier: "Enterprise", value: 2180000 },
      { period: "Mar", tier: "Commercial", value: 1180000 },
      { period: "Mar", tier: "Self-Serve", value: 620000 },
      { period: "Apr", tier: "Enterprise", value: 2360000 },
      { period: "Apr", tier: "Commercial", value: 1280000 },
      { period: "Apr", tier: "Self-Serve", value: 680000 },
      { period: "May", tier: "Enterprise", value: 2720000 },
      { period: "May", tier: "Commercial", value: 1460000 },
      { period: "May", tier: "Self-Serve", value: 770000 },
      { period: "Jun", tier: "Enterprise", value: 3180000 },
      { period: "Jun", tier: "Commercial", value: 1720000 },
      { period: "Jun", tier: "Self-Serve", value: 900000 },
      { period: "Jul", tier: "Enterprise", value: 3740000 },
      { period: "Jul", tier: "Commercial", value: 2010240 },
      { period: "Jul", tier: "Self-Serve", value: 1050000 },
    ],
    kpis: {
      totalRevenue: "$32,400,240",
      revenueGrowth: "+31.2%",
      activeAccounts: "4,750",
      accountGrowth: "+26.8%",
      throughput: "145.2k / day",
      latency: 12.8,
      memory: "42.1 MB",
    },
    sqlQuery: "SELECT date_trunc('month', ts) AS m, sum(revenue) FROM sales WHERE ts >= date_trunc('year', NOW()) GROUP BY 1 ORDER BY 1;",
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
    { region: "EMEA Hub", sales: 1340000 },
    { region: "APAC Regional", sales: 1190000 },
    { region: "LATAM Emerging", sales: 500000 },
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
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");
  const [chartType, setChartType] = useState<PrimaryChartType>("AREA");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [queryLatency, setQueryLatency] = useState(8.2);
  const [inspectedPoint, setInspectedPoint] = useState<PointInspection | null>(null);
  const [isMultiplayerActive, setIsMultiplayerActive] = useState(true);
  const [multiplayerStep, setMultiplayerStep] = useState(0);

  const MULTIPLAYER_CHOREOGRAPHY = useMemo(() => [
    {
      sarah: { x: 38, y: 34, action: "Inspecting Q3 Peak ($1.42M)" },
      david: { x: 76, y: 65, action: "0 B Egress • WASM Verified" },
    },
    {
      sarah: { x: 62, y: 48, action: "Comparing EMEA Growth (+28.4%)" },
      david: { x: 42, y: 28, action: "DuckDB Vector Join • 7.4ms" },
    },
    {
      sarah: { x: 84, y: 26, action: "Pinning annotation on Enterprise renewal" },
      david: { x: 68, y: 72, action: "In-memory cache valid (100%)" },
    },
    {
      sarah: { x: 24, y: 52, action: "Cross-filtering breakdown" },
      david: { x: 82, y: 38, action: "Checking columnar buffers" },
    },
  ], []);

  useEffect(() => {
    if (!isMultiplayerActive) return;
    const interval = setInterval(() => {
      setMultiplayerStep((prev) => (prev + 1) % MULTIPLAYER_CHOREOGRAPHY.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isMultiplayerActive, MULTIPLAYER_CHOREOGRAPHY.length]);

  const activeRangeData = DATA_BY_RANGE[timeRange];

  // Simulated live telemetry micro-pulses
  useEffect(() => {
    if (!isLiveStream) return;
    const interval = setInterval(() => {
      setQueryLatency(+(7.2 + Math.random() * 2.2).toFixed(1));
    }, 2400);
    return () => clearInterval(interval);
  }, [isLiveStream]);

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      setQueryLatency(+(activeRangeData.kpis.latency - 0.4 + Math.random() * 0.8).toFixed(1));
      setIsRefreshing(false);
    }, 350);
  }

  function handleDataPointSelect(label: string, value: unknown) {
    const numVal = typeof value === "number" ? value : Number(value) || 0;
    setInspectedPoint({
      label,
      value: numVal,
      metric: "Revenue",
      variance: `+${(Math.random() * 12 + 8).toFixed(1)}% vs prev`,
    });
  }

  // Construct Primary Chart Mapped Data
  const primaryMappedData: MappedChartData = useMemo(() => {
    switch (chartType) {
      case "AREA":
        return {
          chartType: "AREA",
          xKey: "period",
          measureKeys: ["revenue"],
          columns: [
            { name: "period", type: "string" },
            { name: "revenue", type: "number" },
          ],
          rows: activeRangeData.revenueRows,
        };
      case "BAR":
        return {
          chartType: "BAR",
          xKey: "period",
          measureKeys: ["revenue"],
          columns: [
            { name: "period", type: "string" },
            { name: "revenue", type: "number" },
          ],
          rows: activeRangeData.revenueRows,
        };
      case "DONUT":
        return {
          chartType: "PIE",
          xKey: "name",
          measureKeys: ["value"],
          pieSlices: activeRangeData.pieSlices,
          columns: [
            { name: "name", type: "string" },
            { name: "value", type: "number" },
          ],
          rows: activeRangeData.pieSlices.map((s) => ({ name: s.name, value: s.value })),
        };
      case "HEATMAP":
        return {
          chartType: "HEATMAP",
          xKey: "period",
          measureKeys: ["value"],
          columns: [
            { name: "period", type: "string" },
            { name: "tier", type: "string" },
            { name: "value", type: "number" },
          ],
          rows: activeRangeData.heatmapRows,
        };
    }
  }, [chartType, activeRangeData]);

  const primaryConfig: ChartConfig = useMemo(() => {
    return {
      xAxis: "period",
      yAxis: chartType === "DONUT" ? "value" : "revenue",
      dimensions: chartType === "HEATMAP" ? ["period", "tier"] : ["period"],
      options: {
        title: `Revenue Trajectory (${timeRange})`,
        showGrid: true,
        showXAxis: true,
        showYAxis: true,
        showLegend: chartType === "DONUT",
        numberFormat: "currency",
        palette: ["#4F9D8E", "#D9A441", "#38BDF8", "#34D399", "#E11D48"],
      },
    };
  }, [chartType, timeRange]);

  return (
    <div className="relative mx-auto max-w-6xl w-full">
      {/* Subtle Frame */}
      <div className="rounded-2xl border border-[#374151] bg-[#111827] shadow-xl overflow-hidden transition-all duration-200">
        {/* Window Chrome Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#374151] bg-[#1F2937] px-4 py-3 text-xs">
          {/* Left: Window Dots & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
            </div>
            <div className="h-4 w-px bg-[#374151] shrink-0" aria-hidden="true" />
            <span className="font-semibold text-[#E5E7EB] tracking-tight truncate text-xs sm:text-sm">
              Interactive Dashboard Sandbox
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono font-medium text-[#4F9D8E] bg-[#4F9D8E]/10 border border-[#4F9D8E]/30 px-2 py-0.5 rounded shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4F9D8E]" />
              DuckDB WASM
            </span>
          </div>

          {/* Right: Controls & Interactive Switchers */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            {/* Live Telemetry Pulse Switch */}
            <button
              type="button"
              onClick={() => setIsLiveStream((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                isLiveStream
                  ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/50 shadow-xs"
                  : "bg-[#111827] text-[#9CA3AF] border-[#374151] hover:text-[#E5E7EB]"
              }`}
              title="Toggle Simulated Real-Time Streaming"
            >
              <Radio className={`w-3 h-3 ${isLiveStream ? "text-emerald-400 animate-pulse" : "text-[#9CA3AF]"}`} />
              <span>{isLiveStream ? "Live Streaming" : "Simulate Stream"}</span>
            </button>

            {/* Multiplayer Live Collaborators Toggle */}
            <button
              type="button"
              onClick={() => setIsMultiplayerActive((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                isMultiplayerActive
                  ? "bg-purple-950/70 text-purple-300 border-purple-500/50 shadow-xs"
                  : "bg-[#111827] text-[#9CA3AF] border-[#374151] hover:text-[#E5E7EB]"
              }`}
              title="Toggle Live Collaborative Multiplayer Cursors (@Sarah, @David)"
            >
              <Users className={`w-3 h-3 ${isMultiplayerActive ? "text-purple-400" : "text-[#9CA3AF]"}`} />
              <span>{isMultiplayerActive ? "Multiplayer (2)" : "Multiplayer Off"}</span>
              {isMultiplayerActive && (
                <div className="flex -space-x-1 ml-0.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full bg-[#A855F7] text-[8px] text-white flex items-center justify-center font-bold ring-1 ring-[#111827]"
                    title="@Sarah (Analyst) - Active"
                  >
                    S
                  </span>
                  <span
                    className="w-3.5 h-3.5 rounded-full bg-[#10B981] text-[8px] text-white flex items-center justify-center font-bold ring-1 ring-[#111827]"
                    title="@David (Data Eng) - Active"
                  >
                    D
                  </span>
                </div>
              )}
            </button>

            {/* Timeframe Filter (7D, 30D, 90D, YTD) */}
            <div className="flex items-center rounded-lg border border-[#374151] bg-[#111827] p-0.5">
              {(["7D", "30D", "90D", "YTD"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    setTimeRange(range);
                    setInspectedPoint(null);
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                    timeRange === range
                      ? "bg-[#4F9D8E] text-white shadow-xs"
                      : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-[#374151] bg-[#111827] text-[#9CA3AF] hover:text-[#E5E7EB] hover:border-[#4F9D8E]/50 transition disabled:opacity-50 cursor-pointer"
              title="Refresh In-Memory Computation"
              aria-label="Refresh in-memory computation"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#4F9D8E]" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Dashboard Canvas Body */}
        <div className="p-4 sm:p-6 space-y-5 bg-[#111827]">
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 transition hover:border-[#4F9D8E]/40">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase tracking-wider block">
                Total Revenue ({timeRange})
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E5E7EB] mt-1 transition-all">
                {activeRangeData.kpis.totalRevenue}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>{activeRangeData.kpis.revenueGrowth}</span>
                <span className="text-[#9CA3AF] font-sans text-[11px]">vs previous</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 transition hover:border-[#4F9D8E]/40">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase tracking-wider block">
                Active Accounts
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E5E7EB] mt-1 transition-all">
                {activeRangeData.kpis.activeAccounts}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>{activeRangeData.kpis.accountGrowth}</span>
                <span className="text-[#9CA3AF] font-sans text-[11px]">retention tier</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 transition hover:border-[#4F9D8E]/40">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase tracking-wider block">
                Query Throughput
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E5E7EB] mt-1 transition-all">
                {activeRangeData.kpis.throughput}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                <span className="font-bold">{queryLatency}ms</span>
                <span className="text-[#9CA3AF] font-sans text-[11px]">in-memory execution</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 transition hover:border-[#4F9D8E]/40">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase tracking-wider block">
                Memory Buffer
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[#E5E7EB] mt-1 transition-all">
                {activeRangeData.kpis.memory}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[#4F9D8E] font-mono">
                <span>Zero-Copy</span>
                <span className="text-[#9CA3AF] font-sans text-[11px]">Arrow buffers</span>
              </div>
            </div>
          </div>

          {/* Interactive Sandbox Primary & Secondary Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Primary Interactive Chart Area */}
            <div className="lg:col-span-2 rounded-xl border border-[#374151] bg-[#1F2937] p-4 sm:p-5 flex flex-col justify-between">
              {/* Header with Chart Type Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-[#E5E7EB] tracking-tight">
                      Revenue Trajectory & Pipeline Performance
                    </h4>
                    <span className="text-[10px] font-mono text-[#4F9D8E] bg-[#4F9D8E]/10 border border-[#4F9D8E]/30 px-2 py-0.5 rounded">
                      Sandbox Active
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    Interactive visualization with point hover inspection and multi-type projection.
                  </p>
                </div>

                {/* 4-way Chart Type Switcher Toolbar (Bar, Area, Donut, Heatmap) */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#111827] border border-[#374151] self-start sm:self-auto font-mono text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => {
                      setChartType("AREA");
                      setInspectedPoint(null);
                    }}
                    className={`px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                      chartType === "AREA"
                        ? "bg-[#4F9D8E] text-white font-bold shadow-xs"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                    title="Area Chart"
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>Area</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChartType("BAR");
                      setInspectedPoint(null);
                    }}
                    className={`px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                      chartType === "BAR"
                        ? "bg-[#4F9D8E] text-white font-bold shadow-xs"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3 h-3" />
                    <span>Bar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChartType("DONUT");
                      setInspectedPoint(null);
                    }}
                    className={`px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                      chartType === "DONUT"
                        ? "bg-[#4F9D8E] text-white font-bold shadow-xs"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                    title="Donut Chart"
                  >
                    <PieChart className="w-3 h-3" />
                    <span>Donut</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChartType("HEATMAP");
                      setInspectedPoint(null);
                    }}
                    className={`px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                      chartType === "HEATMAP"
                        ? "bg-[#4F9D8E] text-white font-bold shadow-xs"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                    title="Heatmap Matrix"
                  >
                    <Grid3X3 className="w-3 h-3" />
                    <span>Heatmap</span>
                  </button>
                </div>
              </div>

              {/* Point Inspection Live Banner */}
              {inspectedPoint && (
                <div className="mb-3 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#4F9D8E]/40 text-xs font-mono flex items-center justify-between text-[#E5E7EB] animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#4F9D8E]" />
                    <span>
                      Selected Point: <strong className="text-[#4F9D8E]">{inspectedPoint.label}</strong>
                    </span>
                    <span className="text-slate-500">·</span>
                    <span>${inspectedPoint.value.toLocaleString()}</span>
                    {inspectedPoint.variance && (
                      <span className="text-emerald-400 text-[11px]">({inspectedPoint.variance})</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#9CA3AF]">In-Memory Vector Cache</span>
                </div>
              )}

              {/* Active Chart Renderer Canvas */}
              <div className="h-64 w-full relative">
                {chartType === "AREA" && (
                  <AreaChartRenderer
                    data={primaryMappedData}
                    config={primaryConfig}
                    palette={["#4F9D8E", "#D9A441", "#38BDF8"]}
                    height="100%"
                    onDataPointClick={handleDataPointSelect}
                  />
                )}

                {chartType === "BAR" && (
                  <BarChartRenderer
                    data={primaryMappedData}
                    config={primaryConfig}
                    palette={["#4F9D8E", "#D9A441", "#38BDF8", "#34D399"]}
                    height="100%"
                    onDataPointClick={handleDataPointSelect}
                  />
                )}

                {chartType === "DONUT" && (
                  <PieChartRenderer
                    data={primaryMappedData}
                    config={primaryConfig}
                    palette={["#4F9D8E", "#D9A441", "#38BDF8", "#34D399"]}
                    isDonut={true}
                    height="100%"
                    onDataPointClick={handleDataPointSelect}
                  />
                )}

                {chartType === "HEATMAP" && (
                  <HeatmapRenderer
                    data={primaryMappedData}
                    config={primaryConfig}
                    height="100%"
                  />
                )}

                {/* Live Animated Collaborative Multiplayer Cursors Layer */}
                {isMultiplayerActive && (
                  <>
                    {/* @Sarah (Analyst) Cursor */}
                    <div
                      className="absolute pointer-events-none transition-all duration-700 ease-out z-20"
                      style={{
                        left: `${MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].sarah.x}%`,
                        top: `${MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].sarah.y}%`,
                      }}
                    >
                      <svg
                        className="w-4 h-4 text-[#A855F7] drop-shadow-md"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="white"
                        strokeWidth="1.5"
                      >
                        <path d="M3 3l7 18 3.5-7.5L21 10z" />
                      </svg>
                      <div className="ml-3 -mt-1 inline-flex flex-col items-start">
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-sans font-bold text-white bg-[#A855F7] shadow-xs whitespace-nowrap">
                          @Sarah (Analyst)
                        </span>
                        <span className="mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono text-[#E5E7EB] bg-[#111827]/95 border border-[#A855F7]/40 shadow-xs whitespace-nowrap animate-fadeIn">
                          {MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].sarah.action}
                        </span>
                      </div>
                    </div>

                    {/* @David (Data Eng) Cursor */}
                    <div
                      className="absolute pointer-events-none transition-all duration-700 ease-out z-20"
                      style={{
                        left: `${MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].david.x}%`,
                        top: `${MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].david.y}%`,
                      }}
                    >
                      <svg
                        className="w-4 h-4 text-[#10B981] drop-shadow-md"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="white"
                        strokeWidth="1.5"
                      >
                        <path d="M3 3l7 18 3.5-7.5L21 10z" />
                      </svg>
                      <div className="ml-3 -mt-1 inline-flex flex-col items-start">
                        <span className="px-1.5 py-0.5 rounded text-[8.5px] font-sans font-bold text-white bg-[#10B981] shadow-xs whitespace-nowrap">
                          @David (Data Eng)
                        </span>
                        <span className="mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono text-[#E5E7EB] bg-[#111827]/95 border border-[#10B981]/40 shadow-xs whitespace-nowrap animate-fadeIn">
                          {MULTIPLAYER_CHOREOGRAPHY[multiplayerStep].david.action}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Secondary Regional Distribution Chart */}
            <div className="rounded-xl border border-[#374151] bg-[#1F2937] p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-sm text-[#E5E7EB] tracking-tight">
                      Regional Distribution
                    </h4>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      SUM(sales) by Geography
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[#9CA3AF] bg-[#111827] border border-[#374151] px-2 py-0.5 rounded">
                    Geo Partition
                  </span>
                </div>
                <div className="h-64 w-full">
                  <BarChartRenderer
                    data={REGIONAL_DATA}
                    config={REGIONAL_CONFIG}
                    palette={["#4F9D8E", "#D9A441", "#38BDF8", "#34D399"]}
                    height="100%"
                    onDataPointClick={(field, val) => handleDataPointSelect(field, val)}
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[#374151] flex items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
                <span>Top Geo: North America</span>
                <span className="text-emerald-400 font-semibold">$1.82M (37.5%)</span>
              </div>
            </div>
          </div>

          {/* Bottom Execution Telemetry Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-[#374151] bg-[#111827] px-3.5 py-2.5 text-[11px] font-mono text-[#9CA3AF] overflow-hidden w-full">
            <div className="flex items-center gap-2 truncate max-w-full">
              <Terminal className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-500 shrink-0">Plan ({timeRange}):</span>
              <code className="text-[#E5E7EB] truncate">
                {activeRangeData.sqlQuery}
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 text-[10px]">
              <span className="text-emerald-400 font-bold">{queryLatency}ms execution</span>
              <span className="text-slate-600">·</span>
              <span>10,000,000 rows</span>
              <span className="text-slate-600">·</span>
              <span className="text-[#4F9D8E]">0 B network egress</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
