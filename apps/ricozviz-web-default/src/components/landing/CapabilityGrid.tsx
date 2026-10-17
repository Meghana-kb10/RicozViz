"use client";

import React, { useState } from "react";

const PIPELINE_STAGES = [
  { id: "sources", label: "01. Sources", metric: "9 Connectors · TLS 1.3" },
  { id: "discovery", label: "02. Discovery", metric: "1,420 Tables Cataloged" },
  { id: "execution", label: "03. DuckDB SQL", metric: "1.4ms Vectorized Scan" },
  { id: "viz", label: "04. Dashboards", metric: "60 FPS Multi-Canvas" },
  { id: "decision", label: "05. Decisions", metric: "Automated KPI Action" },
];

const SDK_SNIPPETS = {
  duckdb: {
    label: "DuckDB Wasm",
    docsLabel: "Read docs for DuckDB Wasm ↗",
    code: `export default async function AnalyticsView() {
  const db = await ricoz.connect('snowflake://prod_warehouse')

  useEffect(() => {
    ricoz.from('revenue_metrics').select('*')
      .then(({ data }) => setRows(data))
  }, [])

  return <DashboardCanvas rows={rows} />
}`,
  },
  rls: {
    label: "Row-Level Security",
    docsLabel: "Read docs for RLS Policies ↗",
    code: `export const rlsPolicy = ricoz.security.definePolicy({
  table: 'enterprise_metrics',
  using: "tenant_id = current_setting('app.tenant_id')",
  rbacRoles: ['admin', 'regional_manager', 'analyst'],
  maskPiiColumns: ['customer_email', 'tax_id'],
})`,
  },
  kafka: {
    label: "Kafka Streaming",
    docsLabel: "Read docs for Streaming ↗",
    code: `const stream = await ricoz.stream.subscribe({
  topic: 'kafka://orders_live',
  window: '5s_tumbling',
  onAnomaly: (event) => ricoz.alerts.notify(event),
})`,
  },
  embed: {
    label: "Embedded Iframes",
    docsLabel: "Read docs for Embedded SDK ↗",
    code: `const signedUrl = await ricoz.embeds.createToken({
  dashboardId: 'exec_kpi_v4',
  tenantId: session.orgId,
  expiresIn: '15m',
})`,
  },
};

export default function CapabilityGrid() {
  const [selectedSdk, setSelectedSdk] =
    useState<keyof typeof SDK_SNIPPETS>("duckdb");
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(2);
  const [activeAuditIdx, setActiveAuditIdx] = useState<number>(0);
  const [identityMode, setIdentityMode] = useState<"saml" | "scim">("saml");
  const [activeAlertChannel, setActiveAlertChannel] = useState<number>(1);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-[88px] px-[24px]">
      {/* PART A: SPLIT SDK CODE INSPECTOR (Matches top of supabase-lower.png) */}
      <div className="grid grid-cols-1 items-center gap-[32px] border-b border-[#2e2e2e] pb-[72px] lg:grid-cols-12">
        <div className="flex flex-col gap-[18px] lg:col-span-5">
          <h2 className="text-[32px] font-normal leading-[1.16] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Self-service analytics
            </span>
            <span className="block text-[#fafafa]">
              with parameterized SQL &amp; SDKs
            </span>
          </h2>
          <p className="text-[14px] leading-[1.55] text-[#898989]">
            Enable analysts and engineering teams to execute parameterized SQL,
            subscribe to real-time streams, and embed dashboards without
            bottlenecks.
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
              href="#provision"
              className="rounded-full border border-[#2e2e2e] bg-[#171717] px-[14px] py-[6px] text-[12px] text-[#b4b4b4] transition-colors hover:border-[#393939] hover:text-[#fafafa]"
            >
              {SDK_SNIPPETS[selectedSdk].docsLabel}
            </a>
          </div>
        </div>
      </div>

      {/* PART B: 2x2 FLUSH-BOTTOM MINI-WINDOW GOVERNANCE CARDS (Matches supabase-lower.png 1:1) */}
      <div>
        <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] sm:flex-row sm:items-end">
          <h2 className="text-[32px] font-normal leading-[1.16] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Govern every pipeline stage
            </span>
            <span className="block text-[#fafafa]">
              with enterprise templates and controls
            </span>
          </h2>
          <a
            href="#provision"
            className="text-[13px] text-[#b4b4b4] underline underline-offset-4 hover:text-[#fafafa]"
          >
            View all governance modules
          </a>
        </div>

        <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
          {/* Card 1: Data Pipeline Visibility (Flush-bottom mini-window wireframe) */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[#fafafa] text-[11px] font-medium text-[#121212]">
                P
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Data Pipeline Visibility
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Track lineage end-to-end from data sources and dataset discovery
                through DuckDB query execution, visualizations, and decisions.
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
              <div className="grid grid-cols-5 gap-[8px] p-[16px]">
                {PIPELINE_STAGES.map((stg, idx) => {
                  const active = selectedStageIdx === idx;
                  return (
                    <button
                      key={stg.id}
                      type="button"
                      onClick={() => setSelectedStageIdx(idx)}
                      className={`flex h-[88px] flex-col justify-between rounded-[8px] border p-[10px] text-left transition-colors cursor-pointer ${
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
                      <span className="font-mono-code text-[10px] text-[#b4b4b4]">
                        {stg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Audit Logging and Governance (Flush-bottom mini-window wireframe) */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                A
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Audit Logging &amp; Governance
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Maintain tamper-evident SHA-256 query logs, track user activity,
                and audit data access operations across every workspace.
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
                  sha256_tamper_evident
                </span>
              </div>
              <div className="grid grid-cols-12 gap-[10px] p-[16px]">
                <div className="col-span-4 space-y-[6px]">
                  {["q_904_exec", "rls_check", "scim_sync"].map((item, i) => (
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
                <div className="col-span-8 flex flex-col justify-between rounded-[8px] border border-[#242424] bg-[#161616] p-[12px] font-mono-code text-[10px] text-[#898989]">
                  <div className="text-[#fafafa]">
                    {activeAuditIdx === 0 &&
                      "sha256:9f8a..41c2 · Parameterized SQL Verified"}
                    {activeAuditIdx === 1 &&
                      "sha256:7d2e..88b0 · RLS Region EMEA Enforced"}
                    {activeAuditIdx === 2 &&
                      "sha256:3c11..09fa · SCIM 14 Seats Provisioned"}
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

          {/* Card 3: Enterprise Identity Integration (Flush-bottom mini-window wireframe) */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                S
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                SAML 2.0 SSO &amp; SCIM Provisioning
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Support enterprise authentication and automated role
                provisioning mapped to Administrators, Regional Managers,
                Analysts, and Auditors.
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
                  {(["saml", "scim"] as const).map((m) => (
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
              <div className="grid grid-cols-3 gap-[10px] p-[16px]">
                {[
                  { title: "Okta SAML", active: identityMode === "saml" },
                  { title: "RBAC Sync", active: true },
                  { title: "SCIM 2.0", active: identityMode === "scim" },
                ].map((col, idx) => (
                  <button
                    key={col.title}
                    type="button"
                    onClick={() =>
                      setIdentityMode(idx === 2 ? "scim" : "saml")
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
                    <span className="font-mono-code text-[10px] text-[#b4b4b4]">
                      {col.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 4: Automated Alerts & Performance Monitoring (Flush-bottom mini-window wireframe) */}
          <div className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#2e2e2e] bg-[#171717] px-[28px] pt-[28px] pb-0 transition-colors hover:border-[#393939]">
            <div>
              <div className="flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[11px] font-medium text-[#fafafa]">
                M
              </div>
              <h3 className="mt-[14px] text-[16px] font-medium text-[#fafafa]">
                Automated Alerts &amp; Performance Telemetry
              </h3>
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[#898989]">
                Inspect query execution times, throughput, and Wasm memory while
                delivering scheduled reports via email, webhooks, and workspace
                alerts.
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
                  1.4ms P99 · 142k rows/s
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
