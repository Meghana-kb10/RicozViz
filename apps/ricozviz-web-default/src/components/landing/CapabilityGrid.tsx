"use client";

import React, { useState } from "react";

const PIPELINE_STAGES = [
  { id: "sources", label: "01. Sources", metric: "9 Connectors · SQL & REST" },
  { id: "discovery", label: "02. Schema", metric: "Automated Quality Profiling" },
  { id: "execution", label: "03. SQL & AI", metric: "Natural Language to Chart" },
  { id: "viz", label: "04. Dashboards", metric: "10+ Recharts Visualizers" },
  { id: "decision", label: "05. Alerts", metric: "Automated Webhook Dispatches" },
];

const SDK_SNIPPETS = {
  ai_nl_chart: {
    label: "NL-to-Chart AI",
    docsLabel: "View AI Analytics API ↗",
    code: `// POST /api/v1/ai/nl-to-chart
const response = await fetch('/api/v1/ai/nl-to-chart', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({
    prompt: 'Plot monthly ARR growth by acquisition cohort',
    dataSourceId: 'ds_postgres_prod',
  }),
})

const { chartType, sqlQuery, vizConfig } = await response.json()
return <DynamicRecharts chartType={chartType} config={vizConfig} />`,
  },
  sql_dataset: {
    label: "Dataset SQL Query",
    docsLabel: "View Dataset Query API ↗",
    code: `// POST /api/v1/datasets/execute
const result = await fetch('/api/v1/datasets/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({
    dataSourceId: 'ds_snowflake_analytics',
    sql: 'SELECT region, SUM(amount) AS revenue FROM orders GROUP BY 1',
  }),
})

const { rows, executionMs } = await result.json()`,
  },
  alerts: {
    label: "Threshold Alerts",
    docsLabel: "View Alerts API ↗",
    code: `// POST /api/v1/alerts
const alert = await fetch('/api/v1/alerts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({
    name: 'High Churn Alert',
    metric: 'churn_rate',
    operator: 'GREATER_THAN',
    threshold: 4.5,
    channel: 'WEBHOOK',
    webhookUrl: 'https://api.acme.io/webhooks/ops',
  }),
})`,
  },
  embed: {
    label: "Signed Embeds",
    docsLabel: "View Embed API ↗",
    code: `// POST /api/v1/dashboards/embed/token
const embed = await fetch('/api/v1/dashboards/embed/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({
    dashboardId: 'dash_exec_q4',
    expiresInSeconds: 3600,
  }),
})

const { iframeUrl } = await embed.json()
// https://viz.ricoz.in/dashboards/embed/rvz_signed_tok_8f12a`,
  },
};

export default function CapabilityGrid() {
  const [selectedSdk, setSelectedSdk] =
    useState<keyof typeof SDK_SNIPPETS>("ai_nl_chart");
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(2);
  const [activeAuditIdx, setActiveAuditIdx] = useState<number>(0);
  const [identityMode, setIdentityMode] = useState<"roles" | "invites">("roles");
  const [activeAlertChannel, setActiveAlertChannel] = useState<number>(1);

  return (
    <div id="capabilities" className="mx-auto flex max-w-[1200px] flex-col gap-[88px] px-[24px]">
      {/* PART A: SPLIT SDK CODE INSPECTOR */}
      <div className="grid grid-cols-1 items-center gap-[32px] border-b border-[#2e2e2e] pb-[72px] lg:grid-cols-12">
        <div className="flex flex-col gap-[18px] lg:col-span-5">
          <h2 className="text-[32px] font-normal leading-[1.16] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Self-service analytics
            </span>
            <span className="block text-[#fafafa]">
              with multi-source SQL &amp; AI
            </span>
          </h2>
          <p className="text-[14px] leading-[1.55] text-[#898989]">
            Enable analysts and engineering teams to query databases directly,
            synthesize visual charts using natural language AI, and embed dashboards
            with signed security tokens.
          </p>

          <div className="flex flex-wrap gap-[8px] pt-[4px]">
            {(Object.keys(SDK_SNIPPETS) as (keyof typeof SDK_SNIPPETS)[]).map(
              (key) => {
                const active = selectedSdk === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedSdk(key)}
                    className={`rounded-full border px-[14px] py-[6px] text-[12px] transition-colors cursor-pointer ${
                      active
                        ? "border-[#fafafa] bg-[#1c1c1c] font-medium text-[#fafafa]"
                        : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                    }`}
                  >
                    {SDK_SNIPPETS[key].label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="relative rounded-[16px] border border-[#2e2e2e] bg-[#0d0d0d] p-[24px] lg:col-span-7">
          <pre className="overflow-x-auto pb-[32px] font-mono-code text-[12px] leading-[1.6] text-[#b4b4b4]">
            <code>
              <span className="text-[#ff6b35]">
                {SDK_SNIPPETS[selectedSdk].code.split("\n")[0]}
              </span>
              {"\n"}
              {SDK_SNIPPETS[selectedSdk].code
                .split("\n")
                .slice(1)
                .join("\n")}
            </code>
          </pre>
          <div className="flex justify-end">
            <a
              href="/register"
              className="rounded-full border border-[#2e2e2e] bg-[#171717] px-[14px] py-[6px] text-[12px] text-[#b4b4b4] transition-colors hover:border-[#393939] hover:text-[#fafafa]"
            >
              {SDK_SNIPPETS[selectedSdk].docsLabel}
            </a>
          </div>
        </div>
      </div>

      {/* PART B: 2x2 FLUSH-BOTTOM MINI-WINDOW GOVERNANCE CARDS */}
      <div>
        <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] sm:flex-row sm:items-end">
          <h2 className="text-[32px] font-normal leading-[1.16] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Govern every pipeline stage
            </span>
            <span className="block text-[#fafafa]">
              with enterprise quality and controls
            </span>
          </h2>
          <a
            href="/dashboards"
            className="text-[13px] text-[#b4b4b4] underline underline-offset-4 hover:text-[#fafafa]"
          >
            Explore Dashboard Studio →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
          {/* Card 1: Data Pipeline Visibility */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#fafafa] text-[11px] font-medium text-[#121212]">
                P
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Data Pipeline Visibility
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Track lineage from multi-source databases through automated schema
                discovery, AI SQL execution, Recharts visualizations, and alerts.
              </p>
            </div>

            {/* Flush-bottom mini-window frame */}
            <div className="mt-[24px] rounded-t-[12px] border-x border-t border-[#2e2e2e] bg-[#121212]">
              <div className="flex h-[28px] items-center justify-between border-b border-[#242424] px-[12px]">
                <div className="flex gap-[5px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                </div>
                <span className="font-mono-code text-[10px] text-[#898989]">
                  {PIPELINE_STAGES[selectedStageIdx].metric}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-[8px] p-[12px] sm:p-[16px]">
                {PIPELINE_STAGES.map((stg, idx) => {
                  const active = selectedStageIdx === idx;
                  return (
                    <button
                      key={stg.id}
                      type="button"
                      onClick={() => setSelectedStageIdx(idx)}
                      className={`flex h-[76px] sm:h-[88px] flex-col justify-between rounded-[8px] border p-[8px] sm:p-[10px] text-left transition-colors cursor-pointer ${
                        idx === PIPELINE_STAGES.length - 1 ? "col-span-2 sm:col-span-1" : ""
                      } ${
                        active
                          ? "border-[#393939] bg-[#1c1c1c]"
                          : "border-[#242424] bg-[#161616] hover:border-[#2e2e2e]"
                      }`}
                    >
                      <span
                        className={`h-[6px] w-[24px] rounded-full ${
                          active ? "bg-[#ff6b35]" : "bg-[#2e2e2e]"
                        }`}
                      />
                      <span className="font-mono-code text-[10px] text-[#b4b4b4] truncate">
                        {stg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Audit Logging and Activity History */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                A
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Audit Logging &amp; Activity Tracking
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Maintain granular activity audit logs tracking every query
                execution, dataset export, user invitation, and permission change.
              </p>
            </div>

            <div className="mt-[24px] rounded-t-[12px] border-x border-t border-[#2e2e2e] bg-[#121212]">
              <div className="flex h-[28px] items-center justify-between border-b border-[#242424] px-[12px]">
                <div className="flex gap-[5px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                </div>
                <span className="font-mono-code text-[10px] text-[#898989]">
                  activity_audit_trail
                </span>
              </div>
              <div className="grid grid-cols-12 gap-[10px] p-[16px]">
                <div className="col-span-12 sm:col-span-4 space-y-[6px]">
                  {["query_exec", "dataset_export", "user_invited"].map((item, i) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setActiveAuditIdx(i)}
                      className={`flex w-full items-center gap-[6px] rounded-[6px] border px-[8px] py-[6px] font-mono-code text-[10px] cursor-pointer ${
                        activeAuditIdx === i
                          ? "border-[#393939] bg-[#1c1c1c] text-[#fafafa]"
                          : "border-[#242424] bg-[#161616] text-[#898989]"
                      }`}
                    >
                      <span
                        className={`h-[5px] w-[5px] rounded-full ${
                          activeAuditIdx === i ? "bg-[#ff6b35]" : "bg-[#4d4d4d]"
                        }`}
                      />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
                <div className="col-span-12 sm:col-span-8 flex flex-col justify-between rounded-[8px] border border-[#242424] bg-[#161616] p-[12px] font-mono-code text-[10px] text-[#898989] min-h-[80px]">
                  <div className="text-[#fafafa]">
                    {activeAuditIdx === 0 &&
                      "audit:9f8a · SQL Query Executed on PostgreSQL"}
                    {activeAuditIdx === 1 &&
                      "audit:7d2e · Dataset Exported to CSV Spreadsheet"}
                    {activeAuditIdx === 2 &&
                      "audit:3c11 · Team Member Invited to Workspace"}
                  </div>
                  <div className="mt-[8px] grid grid-cols-3 gap-[6px]">
                    <div className="h-[22px] rounded-[4px] bg-[#222222]" />
                    <div className="h-[22px] rounded-[4px] bg-[#222222]" />
                    <div className="h-[22px] rounded-[4px] bg-[#222222]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Multi-Tenant Workspace & RBAC */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                W
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Workspace Multi-Tenancy &amp; RBAC
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Organize teams into isolated workspaces with role-based access
                controls for Administrators and Members, safeguarding database credentials.
              </p>
            </div>

            <div className="mt-[24px] rounded-t-[12px] border-x border-t border-[#2e2e2e] bg-[#121212]">
              <div className="flex h-[28px] items-center justify-between border-b border-[#242424] px-[12px]">
                <div className="flex gap-[5px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                </div>
                <div className="flex gap-[6px]">
                  {(["roles", "invites"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setIdentityMode(m)}
                      className={`font-mono-code text-[10px] uppercase cursor-pointer ${
                        identityMode === m ? "text-[#fafafa]" : "text-[#898989]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-[6px] sm:gap-[10px] p-[12px] sm:p-[16px]">
                {[
                  { title: "Admin Role", active: identityMode === "roles" },
                  { title: "Org Isolation", active: true },
                  { title: "Member Access", active: identityMode === "invites" },
                ].map((col, idx) => (
                  <button
                    key={col.title}
                    type="button"
                    onClick={() =>
                      setIdentityMode(idx === 2 ? "invites" : "roles")
                    }
                    className={`flex h-[88px] flex-col justify-between rounded-[8px] border p-[10px] text-left cursor-pointer ${
                      col.active
                        ? "border-[#393939] bg-[#1c1c1c]"
                        : "border-[#242424] bg-[#161616]"
                    }`}
                  >
                    <div
                      className={`h-[5px] w-[28px] rounded-full ${
                        idx === 1 ? "bg-[#ff6b35]" : "bg-[#393939]"
                      }`}
                    />
                    <span className="font-mono-code text-[9.5px] sm:text-[10px] text-[#b4b4b4] truncate">
                      {col.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Automated Alerts & Performance Monitoring */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                M
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Automated Alerts &amp; Metric Telemetry
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Inspect query execution times and data health scores while
                delivering scheduled reports via webhooks and workspace
                notifications.
              </p>
            </div>

            <div className="mt-[24px] rounded-t-[12px] border-x border-t border-[#2e2e2e] bg-[#121212]">
              <div className="flex h-[28px] items-center justify-between border-b border-[#242424] px-[12px]">
                <div className="flex gap-[5px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                  <span className="h-[6px] w-[6px] rounded-full bg-[#2e2e2e]" />
                </div>
                <span className="font-mono-code text-[10px] text-[#898989]">
                  1.2ms latency · 0 ETL
                </span>
              </div>
              <div className="grid grid-cols-3 gap-[10px] p-[16px]">
                {["Email Digest", "Webhook 200", "Workspace"].map(
                  (label, idx) => {
                    const active = activeAlertChannel === idx;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setActiveAlertChannel(idx)}
                        className={`flex h-[88px] flex-col justify-between rounded-[8px] border p-[10px] text-left cursor-pointer ${
                          active
                            ? "border-[#393939] bg-[#1c1c1c]"
                            : "border-[#242424] bg-[#161616]"
                        }`}
                      >
                        <span
                          className={`h-[6px] w-[6px] rounded-full ${
                            active ? "bg-[#ff6b35]" : "bg-[#393939]"
                          }`}
                        />
                        <span className="font-mono-code text-[10px] text-[#b4b4b4]">
                          {label}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
