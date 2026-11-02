"use client";

import React, { useState, useEffect, useMemo } from "react";
import { apiNlToChart } from "../../lib/api";

type WorkbenchTab = "viz" | "sql" | "ai" | "embed";
type ChartType = "area" | "bar" | "heatmap" | "donut";
type RegionFilter = "ALL" | "NA-EAST" | "EMEA" | "APAC";

interface DataRow {
  id: string;
  source: string;
  region: "NA-EAST" | "EMEA" | "APAC";
  account: string;
  arrUsd: number;
  latencyMs: number;
}

const CONNECTOR_LOGOS = [
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "Snowflake",
  "BigQuery",
  "ClickHouse",
  "Redshift",
  "MongoDB",
  "Databricks",
  "REST API",
  "CSV Upload",
  "Excel Spreadsheets",
];

const INITIAL_ROWS: DataRow[] = [
  {
    id: "row_01",
    region: "NA-EAST",
    source: "PostgreSQL",
    account: "Acme Enterprises",
    arrUsd: 148500,
    latencyMs: 1.2,
  },
  {
    id: "row_02",
    region: "EMEA",
    source: "Snowflake",
    account: "Globex Europe",
    arrUsd: 212000,
    latencyMs: 1.6,
  },
  {
    id: "row_03",
    region: "APAC",
    source: "ClickHouse",
    account: "Umbra Tokyo",
    arrUsd: 96400,
    latencyMs: 0.9,
  },
  {
    id: "row_04",
    region: "EMEA",
    source: "MySQL",
    account: "Starlight Media",
    arrUsd: 310000,
    latencyMs: 1.1,
  },
  {
    id: "row_05",
    region: "NA-EAST",
    source: "BigQuery",
    account: "Vertex Analytics",
    arrUsd: 184000,
    latencyMs: 1.8,
  },
  {
    id: "row_06",
    region: "EMEA",
    source: "REST API",
    account: "Kite Logistics",
    arrUsd: 129000,
    latencyMs: 1.4,
  },
  {
    id: "row_07",
    region: "APAC",
    source: "CSV Upload",
    account: "Pulse Systems",
    arrUsd: 420000,
    latencyMs: 1.3,
  },
];

interface AiPromptPreset {
  id: string;
  title: string;
  prompt: string;
  chartType: string;
  sqlQuery: string;
  metric: string;
  latency: string;
}

const AI_PRESETS: AiPromptPreset[] = [
  {
    id: "arr_cohort",
    title: "Monthly ARR by Acquisition Cohort",
    prompt: "Plot monthly ARR growth by acquisition cohort as an area spline",
    chartType: "AREA",
    metric: "SUM(arr_usd)",
    latency: "380ms",
    sqlQuery: `SELECT 
  DATE_TRUNC('month', created_at) AS month,
  cohort_group,
  SUM(arr_usd) AS net_arr
FROM orders_master
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY 1, 2
ORDER BY 1 ASC;`,
  },
  {
    id: "top_customers",
    title: "Top 10 Accounts by Contract Value",
    prompt: "Show top 10 accounts ranked by annual recurring revenue with region",
    chartType: "BAR",
    metric: "SUM(arr_usd)",
    latency: "310ms",
    sqlQuery: `SELECT 
  account_name,
  region,
  SUM(arr_usd) AS total_arr
FROM customer_accounts
GROUP BY 1, 2
ORDER BY total_arr DESC
LIMIT 10;`,
  },
  {
    id: "churn_tier",
    title: "90-Day Churn Rate by Plan Tier",
    prompt: "Calculate trailing 90-day churn percentage breakdown by plan tier",
    chartType: "DONUT",
    metric: "CHURN_PCT",
    latency: "420ms",
    sqlQuery: `SELECT 
  plan_tier,
  COUNT(CASE WHEN churned = true THEN 1 END) * 100.0 / COUNT(*) AS churn_rate
FROM subscriptions
WHERE renewed_at >= NOW() - INTERVAL '90 days'
GROUP BY 1;`,
  },
  {
    id: "regional_vol",
    title: "Transaction Volumes by Region",
    prompt: "Compare weekly processed transaction volumes across APAC and EMEA",
    chartType: "LINE",
    metric: "COUNT(orders)",
    latency: "290ms",
    sqlQuery: `SELECT 
  DATE_TRUNC('week', processed_at) AS week,
  region,
  COUNT(*) AS total_orders
FROM transaction_ledger
WHERE region IN ('APAC', 'EMEA')
GROUP BY 1, 2
ORDER BY 1 ASC;`,
  },
];

export default function InteractiveWorkbench({
  selectedConnector,
  onSelectConnector,
}: {
  selectedConnector: string;
  onSelectConnector?: (name: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("viz");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(true);
  const [timeWindow, setTimeWindow] = useState<"1H" | "24H" | "7D" | "30D">("24H");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number>(6);
  const [selectedTable, setSelectedTable] = useState<string>("revenue_metrics");
  const [tableSearch, setTableSearch] = useState<string>("");

  // SQL & Query Execution State
  const [paramRegion, setParamRegion] = useState<RegionFilter>("ALL");
  const [paramMinArr, setParamMinArr] = useState<number>(50000);
  const [queryRunCount, setQueryRunCount] = useState<number>(1);
  const [lastExecMs, setLastExecMs] = useState<number>(1.38);
  const [isRunningQuery, setIsRunningQuery] = useState<boolean>(false);

  // AI NL-to-Chart Studio State
  const [selectedAiPreset, setSelectedAiPreset] = useState<number>(0);
  const [isSynthesizingAi, setIsSynthesizingAi] = useState<boolean>(false);
  const [aiSynthesizedMap, setAiSynthesizedMap] = useState<
    Record<number, { sql: string; chartType: string; latency: string }>
  >({});

  // Alerts & Signed Embed State
  const [tokenTtl, setTokenTtl] = useState<"15m" | "1h" | "24h">("1h");
  const [tokenNonce, setTokenNonce] = useState<string>("rvz_tok_98f2a41c7e");
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);

  // Live streaming telemetry series (12 buckets)
  const [series, setSeries] = useState<number[]>([
    46, 58, 52, 68, 74, 89, 84, 96, 91, 108, 102, 118,
  ]);
  const [streamTick, setStreamTick] = useState<number>(142890);

  useEffect(() => {
    if (!streamingEnabled) return;
    const interval = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const delta = Math.floor(Math.random() * 17) - 7;
        const nextVal = Math.max(36, Math.min(130, last + delta));
        return [...prev.slice(1), nextVal];
      });
      setStreamTick((t) => t + Math.floor(Math.random() * 380 + 140));
    }, 1800);
    return () => clearInterval(interval);
  }, [streamingEnabled]);

  const handleRunParameterizedSql = () => {
    setIsRunningQuery(true);
    setTimeout(() => {
      setIsRunningQuery(false);
      setQueryRunCount((c) => c + 1);
      setLastExecMs(Number((0.85 + Math.random() * 0.95).toFixed(2)));
    }, 180);
  };

  const handleSynthesizeAi = async () => {
    setIsSynthesizingAi(true);
    const start = performance.now();
    try {
      const res = await apiNlToChart({
        datasetId: "demo",
        prompt: activeAi.prompt
      });
      const latency = `${Math.round(performance.now() - start)}ms`;
      setAiSynthesizedMap((prev) => ({
        ...prev,
        [selectedAiPreset]: {
          sql: res.sql || activeAi.sqlQuery,
          chartType: res.chartType || activeAi.chartType,
          latency
        }
      }));
    } catch {
      await new Promise((r) => setTimeout(r, 380));
      const latency = `${Math.round(performance.now() - start)}ms`;
      setAiSynthesizedMap((prev) => ({
        ...prev,
        [selectedAiPreset]: {
          sql: activeAi.sqlQuery,
          chartType: activeAi.chartType,
          latency
        }
      }));
    } finally {
      setIsSynthesizingAi(false);
    }
  };

  const regenerateEmbedToken = () => {
    const hex = Math.random().toString(16).substring(2, 10);
    setTokenNonce(`rvz_tok_${hex}`);
  };

  const visibleRows = useMemo(() => {
    return INITIAL_ROWS.filter((row) => {
      if (paramRegion !== "ALL" && row.region !== paramRegion) return false;
      if (row.arrUsd < paramMinArr) return false;
      return true;
    });
  }, [paramRegion, paramMinArr]);

  const svgWidth = 620;
  const svgHeight = 185;

  const points = series.map((val, idx) => {
    const x = 28 + (idx * (svgWidth - 56)) / (series.length - 1);
    const y = svgHeight - 28 - ((val - 20) / 120) * (svgHeight - 56);
    return { x, y, val, label: `T-${(series.length - 1 - idx) * 5}m` };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const allTables = [
    { name: "revenue_metrics", rows: "14.2M" },
    { name: "orders_master", rows: "1.2M" },
    { name: "customer_accounts", rows: "48.2k" },
    { name: "subscriptions", rows: "19.4k" },
    { name: "transaction_ledger", rows: "4.1M" },
  ].filter((t) =>
    t.name.toLowerCase().includes(tableSearch.trim().toLowerCase())
  );

  const activeAi = AI_PRESETS[selectedAiPreset];

  return (
    <div id="piece-workbench" className="w-full bg-[#121212] pb-[64px]">
      {/* 2x6 MONOCHROME CONNECTOR GRID */}
      <div className="border-y border-[#2e2e2e] bg-[#121212]">
        <div className="mx-auto max-w-[1200px] border-x border-[#2e2e2e] px-[32px] py-[44px]">
          <div className="grid grid-cols-2 gap-y-[32px] gap-x-[24px] sm:grid-cols-3 lg:grid-cols-6">
            {CONNECTOR_LOGOS.map((name, idx) => {
              const isSelected = selectedConnector === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectConnector?.(name)}
                  className={`flex items-center justify-center gap-[8px] text-[16px] font-medium tracking-[-0.02em] transition-colors cursor-pointer ${
                    isSelected
                      ? "text-[#fafafa]"
                      : "text-[#898989] hover:text-[#b4b4b4]"
                  }`}
                >
                  {idx % 3 === 0 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.5 8 12 11.7 5.5 8 12 4.3z" />
                    </svg>
                  ) : idx % 3 === 1 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="7" height="7" rx="1.5" />
                      <rect x="13" y="4" width="7" height="7" rx="1.5" />
                      <rect x="4" y="13" width="7" height="7" rx="1.5" />
                      <rect x="13" y="13" width="7" height="7" rx="1.5" />
                    </svg>
                  )}
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* WORKBENCH HEADING + PILL TAB SWITCHERS + FULL-CHROME IDE WINDOW */}
      <div className="mx-auto max-w-[1200px] px-[24px] pt-[72px]">
        <div className="mb-[28px] flex flex-col gap-[24px]">
          <h2 className="text-[32px] font-normal leading-[1.16] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#fafafa]">
              Stay productive and explore your data
            </span>
            <span className="block text-[#898989]">
              without leaving the analytics studio
            </span>
          </h2>

          {/* Pill Tab Switchers */}
          <div className="flex flex-wrap items-center gap-[10px]">
            {(
              [
                { id: "viz", label: "Dashboard Studio" },
                { id: "sql", label: "SQL & Datasets" },
                { id: "ai", label: "NL-to-Chart AI" },
                { id: "embed", label: "Alerts & Signed Embeds" },
              ] as { id: WorkbenchTab; label: string }[]
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-[20px] py-[8px] text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? "border border-[#fafafa] bg-[#171717] font-medium text-[#fafafa]"
                      : "border border-[#2e2e2e] bg-transparent font-normal text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FULL-CHROME DARK IDE APPLICATION WINDOW */}
        <div className="overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#141414]">
          {/* Top Window Bar */}
          <div className="flex h-[32px] items-center border-b border-[#242424] bg-[#171717] px-[14px]">
            <div className="flex items-center gap-[6px]">
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
            </div>
          </div>

          <div className="flex min-h-[480px]">
            {/* Left Vertical Icon Rail */}
            <div className="hidden w-[48px] shrink-0 flex-col items-center justify-between border-r border-[#242424] bg-[#141414] py-[14px] sm:flex">
              <div className="flex flex-col items-center gap-[14px]">
                <svg
                  className="mb-[4px] h-[18px] w-[18px] text-[#ff6b35]"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M13 2L4 13.5h7.5L10.5 22 20 10.5h-7.5L13 2Z"
                    fill="currentColor"
                  />
                </svg>

                {[
                  { tab: "viz" as WorkbenchTab, d: "M3 3h18v18H3zM3 9h18M9 21V9" },
                  { tab: "sql" as WorkbenchTab, d: "M4 17l6-6-6-6M12 19h8" },
                  { tab: "ai" as WorkbenchTab, d: "m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" },
                  { tab: "embed" as WorkbenchTab, d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
                ].map((ic) => {
                  const isHighlighted = activeTab === ic.tab;
                  return (
                    <button
                      key={ic.tab}
                      type="button"
                      onClick={() => setActiveTab(ic.tab)}
                      className={`flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border transition-colors cursor-pointer ${
                        isHighlighted
                          ? "border-[#393939] bg-[#242424] text-[#fafafa]"
                          : "border-transparent text-[#898989] hover:text-[#b4b4b4]"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={ic.d} />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Secondary Sidebar */}
            <div className="hidden w-[230px] shrink-0 flex-col justify-between border-r border-[#242424] bg-[#141414] p-[16px] md:flex">
              <div className="space-y-[10px]">
                <div className="pb-[4px] text-[14px] font-medium text-[#fafafa]">
                  {activeTab === "viz" && "Dashboard Studio"}
                  {activeTab === "sql" && "SQL & Datasets"}
                  {activeTab === "ai" && "NL-to-Chart AI"}
                  {activeTab === "embed" && "Alerts & Signed Embeds"}
                </div>

                {/* Schema Selector */}
                <div className="flex items-center justify-between rounded-[6px] border border-[#242424] bg-[#171717] px-[10px] py-[6px] text-[11px] text-[#898989]">
                  <span>
                    schema: <strong className="font-normal text-[#fafafa]">public</strong>
                  </span>
                  <span>⌄</span>
                </div>

                {/* Search Input */}
                <div className="flex items-center gap-[6px]">
                  <div className="flex flex-1 items-center gap-[6px] rounded-[6px] border border-[#242424] bg-[#121212] px-[8px] py-[5px]">
                    <span className="text-[11px] text-[#4d4d4d]">⌕</span>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search datasets..."
                      className="w-full bg-transparent text-[11px] text-[#fafafa] placeholder-[#4d4d4d] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Clean Entity List */}
                <div className="space-y-[3px] pt-[4px]">
                  {allTables.map((tbl) => {
                    const active = selectedTable === tbl.name;
                    return (
                      <button
                        key={tbl.name}
                        type="button"
                        onClick={() => setSelectedTable(tbl.name)}
                        className={`flex w-full items-center justify-between rounded-[6px] border px-[10px] py-[6px] text-left font-mono-code text-[11px] transition-colors cursor-pointer ${
                          active
                            ? "border-[#2e2e2e] bg-[#1c1c1c] text-[#fafafa]"
                            : "border-transparent text-[#898989] hover:bg-[#171717] hover:text-[#b4b4b4]"
                        }`}
                      >
                        <span>{tbl.name}</span>
                        <span className="text-[10px] text-[#4d4d4d]">
                          {tbl.rows}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[8px] border border-[#242424] bg-[#121212] p-[12px] text-[11px] text-[#898989]">
                <div className="flex justify-between">
                  <span>Query Latency</span>
                  <span className="font-mono-code text-[#fafafa]">
                    {lastExecMs} ms
                  </span>
                </div>
                <div className="mt-[4px] flex justify-between">
                  <span>Status</span>
                  <span className="font-mono-code text-emerald-400">Connected</span>
                </div>
              </div>
            </div>

            {/* Main IDE Stage */}
            <div className="flex flex-1 flex-col bg-[#121212]">
              {/* Top Breadcrumb Bar */}
              <div className="flex h-[44px] items-center justify-between gap-2 border-b border-[#242424] px-[16px] sm:px-[20px] overflow-hidden">
                <div className="flex min-w-0 items-center gap-[8px] sm:gap-[10px] text-[11px] text-[#b4b4b4] overflow-hidden">
                  <span className="text-[#fafafa]">RicozViz Studio</span>
                  <span className="shrink-0 rounded-full border border-[#2e2e2e] bg-[#1c1c1c] px-[7px] py-[1px] text-[10px] text-[#898989] whitespace-nowrap">
                    Active
                  </span>
                  <span className="text-[#4d4d4d]">/</span>
                  <span className="truncate">{selectedConnector}</span>
                  <span className="text-[#4d4d4d]">/</span>
                  <span className="hidden text-[#898989] sm:inline">
                    ⑂ {selectedTable}
                  </span>
                </div>

                <div className="flex items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setStreamingEnabled((s) => !s)}
                    className="shrink-0 whitespace-nowrap rounded-full border border-[#2e2e2e] bg-[#171717] px-[10px] py-[3px] text-[11px] text-[#b4b4b4] hover:border-[#393939] hover:text-[#fafafa] cursor-pointer"
                  >
                    {streamingEnabled
                      ? `Stream Live · ${streamTick.toLocaleString("en-US")}`
                      : "Stream Paused"}
                  </button>
                </div>
              </div>

              {/* Stage Content */}
              <div className="flex flex-1 flex-col justify-between p-[20px] sm:p-[24px]">
                {/* TAB 1: DASHBOARD STUDIO */}
                {activeTab === "viz" && (
                  <div className="flex h-full flex-col justify-between gap-[18px]">
                    <div className="flex flex-wrap items-center justify-between gap-[10px]">
                      <div className="flex flex-wrap gap-[6px]">
                        {(
                          [
                            { id: "area", label: "Area Spline" },
                            { id: "bar", label: "Bar Chart" },
                            { id: "heatmap", label: "Cohort Heatmap" },
                            { id: "donut", label: "Source Donut" },
                          ] as { id: ChartType; label: string }[]
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setChartType(item.id)}
                            className={`rounded-full border px-[12px] py-[4px] text-[11px] transition-colors cursor-pointer ${
                              chartType === item.id
                                ? "border-[#393939] bg-[#1c1c1c] font-medium text-[#fafafa]"
                                : "border-[#242424] bg-transparent text-[#898989] hover:text-[#fafafa]"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-[6px]">
                        {(["1H", "24H", "7D", "30D"] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setTimeWindow(w)}
                            className={`rounded-full border px-[9px] py-[2px] font-mono-code text-[10px] cursor-pointer ${
                              timeWindow === w
                                ? "border-[#393939] bg-[#1c1c1c] text-[#fafafa]"
                                : "border-[#242424] text-[#898989] hover:text-[#fafafa]"
                            }`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex min-h-[240px] flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[18px]">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                        <div>
                          <span className="font-medium text-[#fafafa]">
                            {selectedTable}
                          </span>
                          <span className="ml-[10px] font-mono-code text-[11px] text-[#898989]">
                            {points[hoveredPointIndex]?.label}:{" "}
                            {points[hoveredPointIndex]?.val}.4k rows/s
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRunParameterizedSql}
                          className="shrink-0 whitespace-nowrap rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[12px] py-[4px] text-[11px] font-medium text-[#fafafa] hover:bg-[#c2410c] cursor-pointer"
                        >
                          {isRunningQuery ? "Executing SQL..." : "Execute Query"}
                        </button>
                      </div>

                      <div className="my-[12px] flex min-h-[165px] items-center justify-center">
                        {chartType === "area" && (
                          <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="h-full w-full overflow-visible"
                          >
                            {[0.25, 0.5, 0.75].map((ratio, idx) => (
                              <line
                                key={idx}
                                x1={28}
                                y1={svgHeight * ratio}
                                x2={svgWidth - 28}
                                y2={svgHeight * ratio}
                                stroke="#1c1c1c"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                            ))}

                            {points.map((pt, idx) => (
                              <line
                                key={`stem-${idx}`}
                                x1={pt.x}
                                y1={pt.y}
                                x2={pt.x}
                                y2={svgHeight - 24}
                                stroke={
                                  hoveredPointIndex === idx
                                    ? "#4d4d4d"
                                    : "#1a1a1a"
                                }
                                strokeWidth="1"
                              />
                            ))}

                            <path
                              d={linePath}
                              fill="none"
                              stroke="#898989"
                              strokeWidth="1.5"
                            />

                            {points.map((pt, idx) => {
                              const isHovered = hoveredPointIndex === idx;
                              return (
                                <g
                                  key={idx}
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPointIndex(idx)}
                                  onClick={() => setHoveredPointIndex(idx)}
                                >
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={12}
                                    fill="transparent"
                                  />
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={isHovered ? 4 : 2.5}
                                    fill={isHovered ? "#ff6b35" : "#121212"}
                                    stroke={isHovered ? "#ff6b35" : "#898989"}
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={pt.x}
                                    y={svgHeight - 6}
                                    textAnchor="middle"
                                    fill={isHovered ? "#fafafa" : "#4d4d4d"}
                                    fontSize="10"
                                    fontFamily="monospace"
                                  >
                                    {pt.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        )}

                        {chartType === "bar" && (
                          <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="h-full w-full"
                          >
                            {points.map((pt, idx) => {
                              const barHeight = svgHeight - 28 - pt.y;
                              const isHovered = hoveredPointIndex === idx;
                              return (
                                <g
                                  key={idx}
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPointIndex(idx)}
                                  onClick={() => setHoveredPointIndex(idx)}
                                >
                                  <rect
                                    x={pt.x - 13}
                                    y={pt.y}
                                    width={26}
                                    height={Math.max(8, barHeight)}
                                    rx={3}
                                    fill={isHovered ? "#242424" : "#171717"}
                                    stroke={isHovered ? "#fafafa" : "#2e2e2e"}
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={pt.x}
                                    y={svgHeight - 6}
                                    textAnchor="middle"
                                    fill="#898989"
                                    fontSize="10"
                                    fontFamily="monospace"
                                  >
                                    {pt.label}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        )}

                        {chartType === "heatmap" && (
                          <div className="grid w-full grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-[6px]">
                            {Array.from({ length: 24 }).map((_, cellIdx) => {
                              const intensity =
                                (cellIdx * 17 +
                                  series[cellIdx % series.length]) %
                                100;
                              const isPeak = intensity > 75;
                              return (
                                <button
                                  key={cellIdx}
                                  type="button"
                                  onClick={() =>
                                    setHoveredPointIndex(
                                      cellIdx % series.length
                                    )
                                  }
                                  className={`flex h-[38px] items-center justify-center rounded-[6px] border font-mono-code text-[11px] cursor-pointer ${
                                    isPeak
                                      ? "border-[#4d4d4d] bg-[#242424] text-[#fafafa]"
                                      : "border-[#242424] bg-[#141414] text-[#898989]"
                                  }`}
                                >
                                  {intensity}%
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {chartType === "donut" && (
                          <div className="flex w-full flex-col items-center justify-around gap-[20px] sm:flex-row">
                            <svg
                              viewBox="0 0 150 150"
                              className="h-[140px] w-[140px]"
                            >
                              <circle
                                cx="75"
                                cy="75"
                                r="52"
                                fill="none"
                                stroke="#242424"
                                strokeWidth="14"
                              />
                              <circle
                                cx="75"
                                cy="75"
                                r="52"
                                fill="none"
                                stroke="#fafafa"
                                strokeWidth="14"
                                strokeDasharray="155 340"
                              />
                              <circle
                                cx="75"
                                cy="75"
                                r="52"
                                fill="none"
                                stroke="#898989"
                                strokeWidth="14"
                                strokeDasharray="95 340"
                                strokeDashoffset="-160"
                              />
                              <text
                                x="75"
                                y="79"
                                textAnchor="middle"
                                fill="#fafafa"
                                fontSize="13"
                                fontWeight="500"
                              >
                                9 Sources
                              </text>
                            </svg>
                            <div className="space-y-[6px] text-[12px] text-[#b4b4b4]">
                              <div>● Snowflake &amp; Postgres — 48.5%</div>
                              <div>● MySQL &amp; ClickHouse — 29.2%</div>
                              <div>● REST API &amp; Spreadsheets — 22.3%</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1c1c1c] pt-[10px] font-mono-code text-[10.5px] sm:text-[11px] text-[#898989]">
                        <span className="truncate">Connected: {selectedConnector}</span>
                        <span className="shrink-0">Recharts Canvas</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SQL & DATASETS */}
                {activeTab === "sql" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-5">
                      <div>
                        <div className="flex items-center justify-between border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                          <span>query.sql</span>
                          <span>Parameterized Query</span>
                        </div>
                        <pre className="mt-[12px] overflow-x-auto font-mono-code text-[12px] text-[#b4b4b4]">
                          <code>
                            SELECT source, region, account,{"\n"}
                            {"       "}SUM(arr_usd) AS net_arr{"\n"}
                            FROM {selectedTable}
                            {"\n"}
                            WHERE (:region = &apos;ALL&apos; OR region =
                            :region){"\n"}
                            {"  "}AND arr_usd &gt;= :min_arr{"\n"}
                            GROUP BY 1, 2, 3;
                          </code>
                        </pre>

                        <div className="mt-[14px] grid grid-cols-2 gap-[10px] border-t border-[#242424] pt-[12px]">
                          <div>
                            <label className="block text-[11px] text-[#898989]">
                              :region
                            </label>
                            <select
                              value={paramRegion}
                              onChange={(e) =>
                                setParamRegion(e.target.value as RegionFilter)
                              }
                              className="mt-[4px] w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[10px] py-[6px] text-[12px] text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                            >
                              <option value="ALL">ALL</option>
                              <option value="NA-EAST">NA-EAST</option>
                              <option value="EMEA">EMEA</option>
                              <option value="APAC">APAC</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-[#898989]">
                              :min_arr
                            </label>
                            <select
                              value={paramMinArr}
                              onChange={(e) =>
                                setParamMinArr(Number(e.target.value))
                              }
                              className="mt-[4px] w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[10px] py-[6px] text-[12px] text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
                            >
                              <option value={50000}>$50,000+</option>
                              <option value={150000}>$150,000+</option>
                              <option value={250000}>$250,000+</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="mt-[14px] flex items-center justify-between border-t border-[#242424] pt-[12px]">
                        <span className="font-mono-code text-[11px] text-[#898989]">
                          Run #{queryRunCount} · {lastExecMs}ms
                        </span>
                        <button
                          type="button"
                          onClick={handleRunParameterizedSql}
                          className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[14px] py-[5px] text-[12px] font-medium text-[#fafafa] hover:bg-[#c2410c] cursor-pointer"
                        >
                          Run Query ↵
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-7">
                      <div className="mb-[10px] flex items-center justify-between border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                        <span>RESULT_SET ({visibleRows.length} rows)</span>
                        <span>SQL_EXECUTION_SUCCESS</span>
                      </div>
                      <div className="w-full overflow-x-auto">
                      <table className="w-full text-left text-[12px] min-w-[420px]">
                        <thead>
                          <tr className="border-b border-[#242424] text-[#898989]">
                            <th className="pb-[8px] font-normal">Source</th>
                            <th className="pb-[8px] font-normal">Region</th>
                            <th className="pb-[8px] font-normal">Account</th>
                            <th className="pb-[8px] text-right font-normal">
                              ARR (USD)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1c]">
                          {visibleRows.map((r) => (
                            <tr key={r.id}>
                              <td className="py-[8px] text-[#fafafa]">
                                {r.source}
                              </td>
                              <td className="py-[8px] font-mono-code text-[#898989]">
                                {r.region}
                              </td>
                              <td className="py-[8px] font-mono-code text-[#b4b4b4]">
                                {r.account}
                              </td>
                              <td className="py-[8px] text-right font-mono-code text-[#fafafa]">
                                ${r.arrUsd.toLocaleString("en-US")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: NL-TO-CHART AI */}
                {activeTab === "ai" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between gap-[14px] rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-5">
                      <div className="space-y-[12px]">
                        <div>
                          <span className="font-mono-code text-[11px] text-[#898989]">
                            SELECT NATURAL LANGUAGE PROMPT
                          </span>
                          <div className="mt-[8px] flex flex-col gap-[6px]">
                            {AI_PRESETS.map((preset, idx) => {
                              const active = selectedAiPreset === idx;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => setSelectedAiPreset(idx)}
                                  className={`flex flex-col rounded-[8px] border p-[10px] text-left transition-colors cursor-pointer ${
                                    active
                                      ? "border-[#ff6b35] bg-[#1c1c1c]"
                                      : "border-[#242424] bg-[#141414] hover:border-[#333333]"
                                  }`}
                                >
                                  <span className={`text-[12px] font-medium ${active ? "text-[#fafafa]" : "text-[#b4b4b4]"}`}>
                                    {preset.title}
                                  </span>
                                  <span className="mt-[2px] text-[11px] text-[#898989] truncate">
                                    &ldquo;{preset.prompt}&rdquo;
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-[8px] border border-[#242424] bg-[#121212] p-[10px] text-[11px] font-mono-code text-[#898989]">
                          <div className="flex justify-between text-[#b4b4b4]">
                            <span>AI Engine:</span>
                            <span className="text-[#fafafa]">Schema-Aware Prompt</span>
                          </div>
                          <div className="mt-[4px] flex justify-between text-[#b4b4b4]">
                            <span>Chart Synthesis:</span>
                            <span className="text-[#ff6b35] font-semibold">{activeAi.chartType}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSynthesizeAi}
                        className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] hover:bg-[#c2410c] cursor-pointer"
                      >
                        {isSynthesizingAi ? "Synthesizing SQL & Chart..." : "Synthesize with AI ↵"}
                      </button>
                    </div>

                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-7">
                      <div>
                        {(() => {
                          const synth = aiSynthesizedMap[selectedAiPreset];
                          const sqlToDisplay = synth?.sql || activeAi.sqlQuery;
                          const latencyToDisplay = synth?.latency || activeAi.latency;
                          const chartTypeToDisplay = synth?.chartType || activeAi.chartType;
                          return (
                            <>
                              <div className="mb-[10px] flex items-center justify-between gap-2 border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                                <span className="truncate">SYNTHESIZED_SQL <span className="hidden sm:inline">(POST /api/v1/ai/nl-to-chart)</span></span>
                                <span className="text-emerald-400 font-semibold shrink-0 whitespace-nowrap">{latencyToDisplay}</span>
                              </div>
                              <pre className="overflow-x-auto rounded-[8px] border border-[#1f1f1f] bg-[#141414] p-[12px] font-mono-code text-[11px] leading-[1.6] text-[#b4b4b4]">
                                <code>{sqlToDisplay}</code>
                              </pre>

                              <div className="mt-[14px] grid grid-cols-1 sm:grid-cols-3 gap-[8px]">
                                <div className="rounded-[8px] border border-[#242424] bg-[#141414] p-[10px]">
                                  <span className="block text-[10px] font-mono-code text-[#898989]">Chart Visual</span>
                                  <span className="mt-[2px] block text-[13px] font-medium text-[#fafafa]">{chartTypeToDisplay}</span>
                                </div>
                                <div className="rounded-[8px] border border-[#242424] bg-[#141414] p-[10px]">
                                  <span className="block text-[10px] font-mono-code text-[#898989]">Aggregation</span>
                                  <span className="mt-[2px] block text-[13px] font-medium text-[#ff6b35] font-mono-code">{activeAi.metric}</span>
                                </div>
                                <div className="rounded-[8px] border border-[#242424] bg-[#141414] p-[10px]">
                                  <span className="block text-[10px] font-mono-code text-[#898989]">Render Engine</span>
                                  <span className="mt-[2px] block text-[13px] font-medium text-emerald-400">Recharts 2.x</span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="mt-[16px] flex flex-wrap items-center justify-between gap-2 border-t border-[#242424] pt-[12px]">
                        <span className="font-mono-code text-[11px] text-[#898989]">
                          Natural Language to Chart AI Pipeline
                        </span>
                        <a
                          href="/dashboards"
                          className="shrink-0 whitespace-nowrap rounded-full border border-[#393939] px-[12px] py-[4px] text-[11px] text-[#fafafa] hover:border-[#ff6b35] transition-colors"
                        >
                          Open in Dashboard Studio →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: ALERTS & SIGNED EMBEDS */}
                {activeTab === "embed" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-6">
                      <div>
                        <div className="border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989] flex items-center justify-between gap-2">
                          <span className="truncate">THRESHOLD METRIC ALERTS</span>
                          <span className="text-emerald-400 shrink-0 whitespace-nowrap">3 Monitors Active</span>
                        </div>
                        <div className="mt-[12px] space-y-[8px]">
                          {[
                            {
                              name: "High Churn Alert",
                              condition: "churn_rate > 4.5%",
                              channel: "Webhook (Slack #ops)",
                              status: "HEALTHY",
                            },
                            {
                              name: "Failed Transactions Spike",
                              condition: "failed_count > 15 / min",
                              channel: "Webhook (PagerDuty)",
                              status: "HEALTHY",
                            },
                            {
                              name: "Executive ARR Milestone",
                              condition: "net_arr >= $2.0M",
                              channel: "Email (exec@acme.io)",
                              status: "TRIGGERED",
                            },
                          ].map((a) => (
                            <div
                              key={a.name}
                              className="rounded-[8px] border border-[#242424] bg-[#121212] p-[10px]"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-medium text-[#fafafa]">
                                  {a.name}
                                </span>
                                <span className={`font-mono-code text-[10px] rounded px-[6px] py-[1px] ${
                                  a.status === "TRIGGERED" ? "bg-[#ff6b35]/20 text-[#ff6b35]" : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {a.status}
                                </span>
                              </div>
                              <div className="mt-[4px] flex items-center justify-between gap-2 text-[10.5px] sm:text-[11px] font-mono-code text-[#898989]">
                                <span className="truncate">{a.condition}</span>
                                <span className="shrink-0">{a.channel}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-[12px] font-mono-code text-[11px] text-[#898989]">
                        Evaluation loop: Every 60 seconds via Webhooks &amp; Email
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-6">
                      <div>
                        <div className="flex items-center justify-between border-b border-[#242424] pb-[8px]">
                          <span className="font-mono-code text-[11px] text-[#898989]">
                            HMAC SIGNED IFRAME EMBED
                          </span>
                          <div className="flex gap-[4px]">
                            {(["15m", "1h", "24h"] as const).map((ttl) => (
                              <button
                                key={ttl}
                                type="button"
                                onClick={() => setTokenTtl(ttl)}
                                className={`rounded-full border px-[8px] py-[1px] font-mono-code text-[10px] cursor-pointer ${
                                  tokenTtl === ttl
                                    ? "border-[#fafafa] text-[#fafafa]"
                                    : "border-[#242424] text-[#898989]"
                                }`}
                              >
                                {ttl}
                              </button>
                            ))}
                          </div>
                        </div>

                        <pre className="mt-[12px] overflow-x-auto rounded-[8px] border border-[#242424] bg-[#121212] p-[12px] font-mono-code text-[11px] text-[#b4b4b4]">
                          <code>
                            {`<iframe\n  src="https://viz.ricoz.in/dashboards/embed/${tokenNonce}?ttl=${tokenTtl}"\n  width="100%"\n  height="600"\n  sandbox="allow-scripts allow-same-origin"\n/>`}
                          </code>
                        </pre>
                      </div>

                      <div className="mt-[12px] flex justify-between gap-[8px]">
                        <button
                          type="button"
                          onClick={regenerateEmbedToken}
                          className="rounded-full border border-[#393939] px-[12px] py-[5px] text-[12px] text-[#fafafa] cursor-pointer"
                        >
                          Rotate Token
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCopiedEmbed(true);
                            setTimeout(() => setCopiedEmbed(false), 1500);
                          }}
                          className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[14px] py-[5px] text-[12px] font-medium text-[#fafafa] cursor-pointer"
                        >
                          {copiedEmbed ? "Copied ✓" : "Copy Embed Code"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
