"use client";

import React, { useState, useEffect, useMemo } from "react";

type WorkbenchTab = "viz" | "sql" | "security" | "collab";
type ChartType = "area" | "bar" | "heatmap" | "donut";
type RegionFilter = "ALL" | "NA-EAST" | "EMEA" | "APAC";
type UserRole = "admin" | "regional_emea" | "analyst" | "auditor";
type TenantId = "acme_corp" | "globex_inc" | "umbra_systems";

interface DataRow {
  id: string;
  tenant: TenantId;
  region: "NA-EAST" | "EMEA" | "APAC";
  source: string;
  customerEmail: string;
  taxId: string;
  arrUsd: number;
  latencyMs: number;
}

const CONNECTOR_LOGOS = [
  "PostgreSQL",
  "Snowflake",
  "BigQuery",
  "ClickHouse",
  "Databricks",
  "Redshift",
  "S3 Parquet",
  "Apache Kafka",
  "MySQL",
  "DuckDB Wasm",
  "Okta SAML",
  "SCIM 2.0",
];

const INITIAL_ROWS: DataRow[] = [
  {
    id: "row_01",
    tenant: "acme_corp",
    region: "NA-EAST",
    source: "PostgreSQL",
    customerEmail: "vp.data@acmecorp.io",
    taxId: "US-94-2819402",
    arrUsd: 148500,
    latencyMs: 1.2,
  },
  {
    id: "row_02",
    tenant: "acme_corp",
    region: "EMEA",
    source: "Snowflake",
    customerEmail: "analytics.eu@acmecorp.io",
    taxId: "DE-819204119",
    arrUsd: 212000,
    latencyMs: 1.6,
  },
  {
    id: "row_03",
    tenant: "acme_corp",
    region: "APAC",
    source: "ClickHouse",
    customerEmail: "ops.sg@acmecorp.io",
    taxId: "SG-20249182A",
    arrUsd: 96400,
    latencyMs: 0.9,
  },
  {
    id: "row_04",
    tenant: "acme_corp",
    region: "EMEA",
    source: "Apache Kafka",
    customerEmail: "treasury.uk@acmecorp.io",
    taxId: "GB-440192831",
    arrUsd: 310000,
    latencyMs: 1.1,
  },
  {
    id: "row_05",
    tenant: "globex_inc",
    region: "NA-EAST",
    source: "BigQuery",
    customerEmail: "bi.lead@globex.com",
    taxId: "US-11-9048123",
    arrUsd: 184000,
    latencyMs: 1.8,
  },
  {
    id: "row_06",
    tenant: "globex_inc",
    region: "EMEA",
    source: "S3 Parquet",
    customerEmail: "dpo@globex.eu",
    taxId: "FR-771029384",
    arrUsd: 129000,
    latencyMs: 1.4,
  },
  {
    id: "row_07",
    tenant: "umbra_systems",
    region: "APAC",
    source: "Databricks",
    customerEmail: "chief.arch@umbra.jp",
    taxId: "JP-501928371",
    arrUsd: 420000,
    latencyMs: 1.3,
  },
];

const ROLE_CONFIG: Record<
  UserRole,
  {
    label: string;
    rlsPolicy: string;
    maskPii: boolean;
    hideFinancials: boolean;
    allowedRegions: ("NA-EAST" | "EMEA" | "APAC")[];
    permissions: string[];
  }
> = {
  admin: {
    label: "Enterprise Admin",
    rlsPolicy: "tenant_id = :active_tenant AND 1=1",
    maskPii: false,
    hideFinancials: false,
    allowedRegions: ["NA-EAST", "EMEA", "APAC"],
    permissions: ["SELECT", "PARAMETERIZED_SQL", "UNMASK_PII", "MANAGE_RLS"],
  },
  regional_emea: {
    label: "Regional Manager (EMEA)",
    rlsPolicy: "tenant_id = :active_tenant AND region = 'EMEA'",
    maskPii: true,
    hideFinancials: false,
    allowedRegions: ["EMEA"],
    permissions: ["SELECT", "PARAMETERIZED_SQL", "DASHBOARD_EDIT"],
  },
  analyst: {
    label: "Self-Service Analyst",
    rlsPolicy: "tenant_id = :active_tenant AND pii_redacted = true",
    maskPii: true,
    hideFinancials: false,
    allowedRegions: ["NA-EAST", "EMEA", "APAC"],
    permissions: ["SELECT", "PARAMETERIZED_SQL", "CHART_BUILD"],
  },
  auditor: {
    label: "Compliance Auditor",
    rlsPolicy: "tenant_id = :active_tenant AND audit_scope = 'GOVERNANCE'",
    maskPii: true,
    hideFinancials: true,
    allowedRegions: ["NA-EAST", "EMEA", "APAC"],
    permissions: ["SELECT_METADATA", "VERIFY_AUDIT_CHAIN"],
  },
};

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

  // SQL & DuckDB State
  const [paramRegion, setParamRegion] = useState<RegionFilter>("ALL");
  const [paramMinArr, setParamMinArr] = useState<number>(50000);
  const [queryRunCount, setQueryRunCount] = useState<number>(1);
  const [lastExecMs, setLastExecMs] = useState<number>(1.38);
  const [isRunningQuery, setIsRunningQuery] = useState<boolean>(false);

  // Security / RLS / RBAC / Multi-tenant State
  const [activeRole, setActiveRole] = useState<UserRole>("admin");
  const [activeTenant, setActiveTenant] = useState<TenantId>("acme_corp");
  const [forceMaskOverride, setForceMaskOverride] = useState<boolean>(false);

  // Collaboration & Embedded Analytics State
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

  const regenerateEmbedToken = () => {
    const hex = Math.random().toString(16).substring(2, 10);
    setTokenNonce(`rvz_tok_${hex}`);
  };

  const visibleRows = useMemo(() => {
    const rolePolicy = ROLE_CONFIG[activeRole];
    return INITIAL_ROWS.filter((row) => {
      if (activeTab === "security") {
        if (row.tenant !== activeTenant) return false;
        if (!rolePolicy.allowedRegions.includes(row.region)) return false;
        return true;
      }
      if (paramRegion !== "ALL" && row.region !== paramRegion) return false;
      if (row.arrUsd < paramMinArr) return false;
      return true;
    });
  }, [activeTab, activeRole, activeTenant, paramRegion, paramMinArr]);

  const shouldMaskPii = ROLE_CONFIG[activeRole].maskPii || forceMaskOverride;
  const shouldHideFinancials = ROLE_CONFIG[activeRole].hideFinancials;

  const maskEmail = (email: string) => {
    if (!shouldMaskPii) return email;
    const [, domain] = email.split("@");
    return `***redacted***@${domain}`;
  };

  const maskTaxId = (taxId: string) => {
    if (!shouldMaskPii) return taxId;
    return `${taxId.slice(0, 3)}-••••-••${taxId.slice(-2)}`;
  };

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
    { name: "kafka_orders", rows: "live" },
    { name: "s3_cohorts", rows: "82.0M" },
    { name: "tenant_policies", rows: "128" },
    { name: "audit_ledger", rows: "4.1M" },
  ].filter((t) =>
    t.name.toLowerCase().includes(tableSearch.trim().toLowerCase())
  );

  return (
    <div id="piece-workbench" className="w-full bg-[#121212] pb-[64px]">
      {/* HAIRLINE-FRAMED 2x6 MONOCHROME CONNECTOR GRID (Matches top of supabase-mid.png 1:1) */}
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
                  className={`flex items-center justify-center gap-[8px] text-[17px] font-medium tracking-[-0.02em] transition-colors cursor-pointer ${
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
              without leaving the analytics workspace
            </span>
          </h2>

          {/* Pill Tab Switchers (Active pill has crisp #fafafa border, inactive has #2e2e2e border) */}
          <div className="flex flex-wrap items-center gap-[10px]">
            {(
              [
                { id: "viz", label: "Dashboard Builder" },
                { id: "sql", label: "SQL Editor" },
                { id: "security", label: "RLS Policies" },
                { id: "collab", label: "Realtime & Embeds" },
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

        {/* FULL-CHROME DARK IDE APPLICATION WINDOW (>98% calm grayscale, 10-icon rail, full schema sidebar) */}
        <div className="overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#141414]">
          {/* Top Window Bar (3 window dots) */}
          <div className="flex h-[32px] items-center border-b border-[#242424] bg-[#171717] px-[14px]">
            <div className="flex items-center gap-[6px]">
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
              <span className="h-[8px] w-[8px] rounded-full bg-[#2e2e2e]" />
            </div>
          </div>

          <div className="flex min-h-[480px]">
            {/* Left Vertical Icon Rail (48px, 10 monochrome icons running full height) */}
            <div className="hidden w-[48px] shrink-0 flex-col items-center justify-between border-r border-[#242424] bg-[#141414] py-[14px] sm:flex">
              <div className="flex flex-col items-center gap-[14px]">
                {/* Single Brand Bolt Mark */}
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

                {/* 10 Monochrome Tool Rail Icons */}
                {[
                  { tab: "viz" as WorkbenchTab, d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
                  { tab: "viz" as WorkbenchTab, d: "M3 3h18v18H3zM3 9h18M9 21V9" },
                  { tab: "sql" as WorkbenchTab, d: "M4 17l6-6-6-6M12 19h8" },
                  { tab: "security" as WorkbenchTab, d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
                  { tab: "security" as WorkbenchTab, d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
                  { tab: "collab" as WorkbenchTab, d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" },
                  { tab: "viz" as WorkbenchTab, d: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" },
                  { tab: "collab" as WorkbenchTab, d: "m4 4 7.07 17 2.51-7.39L21 11.07z" },
                  { tab: "sql" as WorkbenchTab, d: "M18 20V10M12 20V4M6 20v-6" },
                  { tab: "security" as WorkbenchTab, d: "M4 6h16M4 12h16M4 18h16" },
                ].map((ic, idx) => {
                  const isHighlighted =
                    (activeTab === "viz" && idx === 1) ||
                    (activeTab === "sql" && idx === 2) ||
                    (activeTab === "security" && idx === 3) ||
                    (activeTab === "collab" && idx === 7);
                  return (
                    <button
                      key={idx}
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

            {/* Secondary Sidebar (230px — Matches supabase-mid.png Table Editor sidebar) */}
            <div className="hidden w-[230px] shrink-0 flex-col justify-between border-r border-[#242424] bg-[#141414] p-[16px] md:flex">
              <div className="space-y-[10px]">
                <div className="pb-[4px] text-[14px] font-medium text-[#fafafa]">
                  {activeTab === "viz" && "Dashboard Builder"}
                  {activeTab === "sql" && "SQL Editor"}
                  {activeTab === "security" && "RLS Policies"}
                  {activeTab === "collab" && "Realtime & Embeds"}
                </div>

                {/* Schema Selector */}
                <div className="flex items-center justify-between rounded-[6px] border border-[#242424] bg-[#171717] px-[10px] py-[6px] text-[11px] text-[#898989]">
                  <span>
                    schema: <strong className="font-normal text-[#fafafa]">public</strong>
                  </span>
                  <span>⌄</span>
                </div>

                {/* + New Action Button */}
                <button
                  type="button"
                  onClick={handleRunParameterizedSql}
                  className="flex w-full items-center gap-[8px] rounded-[6px] border border-[#242424] bg-[#171717] px-[10px] py-[6px] text-[11px] text-[#b4b4b4] hover:border-[#393939] hover:text-[#fafafa] cursor-pointer"
                >
                  <span>+</span>
                  <span>New canvas</span>
                </button>

                {/* Search Input + Filter Button */}
                <div className="flex items-center gap-[6px]">
                  <div className="flex flex-1 items-center gap-[6px] rounded-[6px] border border-[#242424] bg-[#121212] px-[8px] py-[5px]">
                    <span className="text-[11px] text-[#4d4d4d]">⌕</span>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Search tables..."
                      className="w-full bg-transparent text-[11px] text-[#fafafa] placeholder-[#4d4d4d] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTableSearch("")}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] border border-[#242424] bg-[#171717] text-[10px] text-[#898989]"
                  >
                    ⧩
                  </button>
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
                  <span>DuckDB Scan</span>
                  <span className="font-mono-code text-[#fafafa]">
                    {lastExecMs} ms
                  </span>
                </div>
                <div className="mt-[4px] flex justify-between">
                  <span>Wasm Memory</span>
                  <span className="font-mono-code text-[#b4b4b4]">41.2 MB</span>
                </div>
              </div>
            </div>

            {/* Main IDE Stage: Top Breadcrumb Header + Content */}
            <div className="flex flex-1 flex-col bg-[#121212]">
              {/* Top Breadcrumb Bar (Matches supabase-mid.png) */}
              <div className="flex h-[44px] items-center justify-between border-b border-[#242424] px-[20px]">
                <div className="flex items-center gap-[10px] text-[11px] text-[#b4b4b4]">
                  <span className="text-[#fafafa]">RicozViz Dev</span>
                  <span className="rounded-full border border-[#2e2e2e] bg-[#1c1c1c] px-[7px] py-[1px] text-[10px] text-[#898989]">
                    Pro
                  </span>
                  <span className="text-[#4d4d4d]">/</span>
                  <span>{selectedConnector}</span>
                  <span className="text-[#4d4d4d]">/</span>
                  <span className="hidden text-[#898989] sm:inline">
                    ⑂ {selectedTable}
                  </span>
                </div>

                <div className="flex items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setStreamingEnabled((s) => !s)}
                    className="rounded-full border border-[#2e2e2e] bg-[#171717] px-[10px] py-[3px] text-[11px] text-[#b4b4b4] hover:border-[#393939] hover:text-[#fafafa] cursor-pointer"
                  >
                    {streamingEnabled
                      ? `Stream Live · ${streamTick.toLocaleString("en-US")}`
                      : "Stream Paused"}
                  </button>
                </div>
              </div>

              {/* Stage Content */}
              <div className="flex flex-1 flex-col justify-between p-[20px] sm:p-[24px]">
                {/* TAB 1: DASHBOARD BUILDER */}
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

                    {/* Monochrome Wireframe Chart Stage with Single Primary Action Button */}
                    <div className="flex min-h-[240px] flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[18px]">
                      <div className="flex items-center justify-between text-[12px]">
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
                          className="rounded-full border border-[#ff6b35]/70 bg-[#9a3412] px-[12px] py-[4px] text-[11px] font-medium text-[#fafafa] hover:bg-[#c2410c] cursor-pointer"
                        >
                          {isRunningQuery
                            ? "Refreshing Wasm..."
                            : "Run in DuckDB Wasm"}
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
                          <div className="grid w-full grid-cols-8 gap-[6px]">
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
                              <div>● Apache Kafka Streams — 29.2%</div>
                              <div>● S3 Parquet &amp; ClickHouse — 22.3%</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-[#1c1c1c] pt-[10px] font-mono-code text-[11px] text-[#898989]">
                        <span>RLS Scope: {activeTenant}</span>
                        <span>Zero-Copy Arrow Buffer</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SQL EDITOR */}
                {activeTab === "sql" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-5">
                      <div>
                        <div className="flex items-center justify-between border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                          <span>query.sql</span>
                          <span>AST Parameterized</span>
                        </div>
                        <pre className="mt-[12px] overflow-x-auto font-mono-code text-[12px] text-[#b4b4b4]">
                          <code>
                            SELECT source, region, customer_email,{"\n"}
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
                        <span>DUCKDB_WASM</span>
                      </div>
                      <table className="w-full text-left text-[12px]">
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
                                {r.customerEmail}
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
                )}

                {/* TAB 3: RLS POLICIES */}
                {activeTab === "security" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between gap-[14px] rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-5">
                      <div className="space-y-[12px]">
                        <div>
                          <span className="font-mono-code text-[11px] text-[#898989]">
                            TENANT ISOLATION
                          </span>
                          <div className="mt-[6px] grid grid-cols-3 gap-[6px]">
                            {(
                              [
                                { id: "acme_corp", label: "Acme Corp" },
                                { id: "globex_inc", label: "Globex Inc" },
                                { id: "umbra_systems", label: "Umbra Sys" },
                              ] as { id: TenantId; label: string }[]
                            ).map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTenant(t.id)}
                                className={`rounded-full border px-[8px] py-[5px] text-[11px] cursor-pointer ${
                                  activeTenant === t.id
                                    ? "border-[#fafafa] bg-[#242424] font-medium text-[#fafafa]"
                                    : "border-[#242424] text-[#898989]"
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="font-mono-code text-[11px] text-[#898989]">
                            RBAC ROLE
                          </span>
                          <div className="mt-[6px] grid grid-cols-2 gap-[6px]">
                            {(Object.keys(ROLE_CONFIG) as UserRole[]).map(
                              (rKey) => (
                                <button
                                  key={rKey}
                                  type="button"
                                  onClick={() => setActiveRole(rKey)}
                                  className={`rounded-full border px-[10px] py-[6px] text-left text-[11px] cursor-pointer ${
                                    activeRole === rKey
                                      ? "border-[#fafafa] bg-[#1c1c1c] font-medium text-[#fafafa]"
                                      : "border-[#242424] text-[#898989]"
                                  }`}
                                >
                                  {ROLE_CONFIG[rKey].label}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-[8px] border border-[#242424] bg-[#121212] px-[10px] py-[8px]">
                          <span className="text-[12px] text-[#b4b4b4]">
                            Dynamic PII Masking
                          </span>
                          <button
                            type="button"
                            onClick={() => setForceMaskOverride((v) => !v)}
                            className="rounded-full border border-[#393939] px-[10px] py-[3px] font-mono-code text-[11px] text-[#fafafa] cursor-pointer"
                          >
                            {shouldMaskPii ? "REDACTED" : "CLEARTEXT"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[8px] border border-[#242424] bg-[#121212] p-[10px] font-mono-code text-[11px] text-[#b4b4b4]">
                        WHERE{" "}
                        {ROLE_CONFIG[activeRole].rlsPolicy.replace(
                          ":active_tenant",
                          `'${activeTenant}'`
                        )}
                      </div>
                    </div>

                    <div className="rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-7">
                      <div className="mb-[10px] flex items-center justify-between border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                        <span>ISOLATED_ROWS ({visibleRows.length})</span>
                        <span>PII_GUARD: ACTIVE</span>
                      </div>
                      <table className="w-full text-left text-[12px]">
                        <thead>
                          <tr className="border-b border-[#242424] text-[#898989]">
                            <th className="pb-[8px] font-normal">Region</th>
                            <th className="pb-[8px] font-normal">
                              Email (PII)
                            </th>
                            <th className="pb-[8px] font-normal">
                              Tax ID (PII)
                            </th>
                            <th className="pb-[8px] text-right font-normal">
                              ARR Metric
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1c1c1c]">
                          {visibleRows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-[8px] font-mono-code text-[#fafafa]">
                                {row.region}
                              </td>
                              <td className="py-[8px] font-mono-code text-[#b4b4b4]">
                                {maskEmail(row.customerEmail)}
                              </td>
                              <td className="py-[8px] font-mono-code text-[#898989]">
                                {maskTaxId(row.taxId)}
                              </td>
                              <td className="py-[8px] text-right font-mono-code text-[#fafafa]">
                                {shouldHideFinancials
                                  ? "••••••"
                                  : `$${row.arrUsd.toLocaleString("en-US")}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: REALTIME & EMBEDS */}
                {activeTab === "collab" && (
                  <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-12">
                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-6">
                      <div>
                        <div className="border-b border-[#242424] pb-[8px] font-mono-code text-[11px] text-[#898989]">
                          MULTIPLAYER CRDT PRESENCE
                        </div>
                        <div className="mt-[12px] space-y-[8px]">
                          {[
                            {
                              user: "@elena_architect",
                              state: "Editing SQL AST",
                            },
                            {
                              user: "@marcus_emea",
                              state: "Viewing Cohort KPI",
                            },
                            {
                              user: "@priya_sec",
                              state: "Auditing RLS Policy",
                            },
                          ].map((u) => (
                            <div
                              key={u.user}
                              className="flex items-center justify-between rounded-[8px] border border-[#242424] bg-[#121212] px-[12px] py-[8px]"
                            >
                              <span className="text-[12px] text-[#fafafa]">
                                ● {u.user}
                              </span>
                              <span className="font-mono-code text-[11px] text-[#898989]">
                                {u.state}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-[12px] font-mono-code text-[11px] text-[#898989]">
                        WebSocket sync latency: 14ms
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-[11px] border border-[#242424] bg-[#0d0d0d] p-[16px] lg:col-span-6">
                      <div>
                        <div className="flex items-center justify-between border-b border-[#242424] pb-[8px]">
                          <span className="font-mono-code text-[11px] text-[#898989]">
                            SIGNED IFRAME EMBED
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
                            {`<iframe\n  src="https://embed.ricozviz.io/v4/${selectedTable}?jwt=${tokenNonce}&ttl=${tokenTtl}"\n  sandbox="allow-scripts allow-same-origin"\n/>`}
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
