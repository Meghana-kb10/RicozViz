"use client";

import React, { useState } from "react";
import HeroBentoSection from "@/components/landing/HeroBentoSection";
import InteractiveWorkbench from "@/components/landing/InteractiveWorkbench";
import CapabilityGrid from "@/components/landing/CapabilityGrid";
import WorkflowPipelineSection from "@/components/landing/WorkflowPipelineSection";
import InfrastructureTopologySection from "@/components/landing/InfrastructureTopologySection";
import AuditLedgerSection from "@/components/landing/AuditLedgerSection";
import SecurityGovernanceSection from "@/components/landing/SecurityGovernanceSection";
import ParticleCtaSection from "@/components/landing/ParticleCtaSection";
import ComprehensiveFooter from "@/components/landing/ComprehensiveFooter";

const DATA_CONNECTORS = [
  "PostgreSQL",
  "Snowflake",
  "BigQuery",
  "ClickHouse",
  "Databricks",
  "Amazon Redshift",
  "S3 Parquet",
  "Apache Kafka",
  "MySQL",
];

interface Testimonial {
  handle: string;
  role: string;
  avatar: string;
  category: "engineering" | "security" | "analytics";
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    handle: "@lukas_v",
    role: "VP Data Platform, FinCore",
    avatar: "LV",
    category: "engineering",
    quote:
      "Compiling DuckDB to WebAssembly inside ricozviz eliminated 80% of our warehouse round-trips. Analysts slice 25M Parquet rows from S3 in 1.4 milliseconds.",
  },
  {
    handle: "@sarah_ciso",
    role: "Head of Information Security, VaultHealth",
    avatar: "SC",
    category: "security",
    quote:
      "Row-Level Security, parameterized SQL AST validation, and automatic PII masking allowed us to open self-service SQL to 400 regional managers without a single compliance exception.",
  },
  {
    handle: "@dev_kaito",
    role: "Staff Streaming Architect, PulsePay",
    avatar: "DK",
    category: "engineering",
    quote:
      "Joining live Apache Kafka topics against historical Snowflake tables in a single unified canvas used to take three pipelines. In viz, it is a single query.",
  },
  {
    handle: "@nadia_bi",
    role: "Director of Revenue Operations, ScaleGrid",
    avatar: "NB",
    category: "analytics",
    quote:
      "The multi-canvas dashboard builder and real-time multiplayer presence completely replaced our static weekly slide decks. Everyone explores the live numbers together.",
  },
  {
    handle: "@marcus_audit",
    role: "Principal Governance Lead, EuroBank",
    avatar: "MA",
    category: "security",
    quote:
      "Tamper-evident SHA-256 query logs and SAML 2.0 / SCIM group provisioning gave our external auditors instant verification of multi-tenant data isolation.",
  },
  {
    handle: "@chloe_product",
    role: "Lead Product Manager, CloudMetrics",
    avatar: "CP",
    category: "analytics",
    quote:
      "We embedded ricozviz customer-facing dashboards in two afternoons using expiring iframe tokens. Zero cross-tenant leakage and native dark-mode polish.",
  },
  {
    handle: "@arjun_olap",
    role: "Distinguished Engineer, QuantFlow",
    avatar: "AO",
    category: "engineering",
    quote:
      "The performance monitoring telemetry—inspecting Wasm memory footprint, vectorized scan throughput, and P99 execution times—feels like a true midnight IDE for data.",
  },
  {
    handle: "@elena_exec",
    role: "Chief Data Officer, OmniRetail",
    avatar: "EE",
    category: "analytics",
    quote:
      "From raw data source discovery to automated anomaly webhooks, ricozviz gives us end-to-end lineage visibility for every executive decision.",
  },
];

export default function HomePage() {
  const [selectedConnector, setSelectedConnector] =
    useState<string>("Snowflake");
  const [testimonialFilter, setTestimonialFilter] = useState<
    "all" | "engineering" | "security" | "analytics"
  >("all");

  // Interactive Demo / Workspace Form State
  const [workEmail, setWorkEmail] = useState<string>("");
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("acme-analytics");
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "PostgreSQL",
    "Snowflake",
    "Apache Kafka",
  ]);
  const [provisionSubmitted, setProvisionSubmitted] = useState<boolean>(false);

  // Interactive Auth / SAML Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [ssoDomain, setSsoDomain] = useState<string>("acmecorp.io");

  const toggleSourceSelection = (name: string) => {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const filteredTestimonials = TESTIMONIALS.filter((t) =>
    testimonialFilter === "all" ? true : t.category === testimonialFilter
  );

  return (
    <div className="min-h-screen bg-[#121212] text-[#fafafa]">
      {/* PIECE 1: Top Nav, 2-Column Hero, 12-Column Product Bento Grid, and Framed 2x6 Connector Grid */}
      <HeroBentoSection
        selectedConnector={selectedConnector}
        onSelectConnector={setSelectedConnector}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      {/* PIECE 2: Framed 2x6 Monochrome Connector Grid & Full-Chrome Dark IDE Application Window */}
      <InteractiveWorkbench
        selectedConnector={selectedConnector}
        onSelectConnector={setSelectedConnector}
      />

      {/* PIECE 3: Split SDK Inspector, Pipeline, Topology, Audit Ledger, Governance, 4-Col Masonry Testimonials, and Instant Provisioner */}
      <div id="piece-governance-social" className="flex flex-col gap-[88px] pb-[80px]">
        <CapabilityGrid />

        {/* WORKFLOW PIPELINE SECTION */}
        <WorkflowPipelineSection />

        {/* INFRASTRUCTURE TOPOLOGY SECTION */}
        <InfrastructureTopologySection />

        {/* MULTI-TENANT AUDIT TRAIL & CRYPTOGRAPHIC KILL-SWITCH */}
        <AuditLedgerSection />

        {/* ENTERPRISE TRUST & GOVERNANCE */}
        <SecurityGovernanceSection />

        {/* 4-COLUMN MASONRY CUSTOMER STORIES */}
        <section
          id="testimonials"
          className="mx-auto w-full max-w-[1200px] px-[24px]"
        >
          <div className="mb-[32px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
            <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
              <span className="block text-[#898989]">
                Data-driven decision making
              </span>
              <span className="block text-[#fafafa]">
                trusted by engineering and security leaders
              </span>
            </h2>

            <div className="flex flex-wrap gap-[8px]">
              {(
                [
                  { id: "all", label: "All Teams" },
                  { id: "engineering", label: "Data Engineering" },
                  { id: "security", label: "Security & Audit" },
                  { id: "analytics", label: "Executive BI" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTestimonialFilter(f.id)}
                  className={`rounded-full border px-[14px] py-[6px] text-[12px] transition-colors cursor-pointer ${testimonialFilter === f.id
                    ? "border-[#fafafa] bg-[#1c1c1c] font-medium text-[#fafafa]"
                    : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="columns-1 gap-[16px] space-y-[16px] sm:columns-2 lg:columns-4">
            {filteredTestimonials.map((item) => (
              <div
                key={item.handle}
                className="break-inside-avoid rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[20px] transition-colors hover:border-[#393939]"
              >
                <div className="flex items-center gap-[12px]">
                  <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-[#393939] bg-[#242424] text-[12px] font-medium text-[#fafafa]">
                    {item.avatar}
                  </div>
                  <div>
                    <div className="text-[14px] font-medium leading-[1.43] text-[#fafafa]">
                      {item.handle}
                    </div>
                    <div className="text-[12px] font-normal leading-[1.5] text-[#898989]">
                      {item.role}
                    </div>
                  </div>
                </div>
                <p className="mt-[14px] text-[14px] font-normal leading-[1.5] text-[#b4b4b4]">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* INSTANT WORKSPACE PROVISIONER CTA SECTION */}
        <section
          id="provision"
          className="mx-auto w-full max-w-[1200px] px-[24px]"
        >
          <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] sm:p-[40px]">
            <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-12">
              <div className="flex flex-col justify-between lg:col-span-6">
                <div>
                  <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
                    <span className="block text-[#898989]">
                      Build in minutes,
                    </span>
                    <span className="block text-[#fafafa]">
                      govern across every tenant
                    </span>
                  </h2>
                  <p className="mt-[12px] text-[15px] font-normal leading-[1.5] text-[#898989]">
                    Configure your isolated multi-tenant workspace, select your
                    initial data connectors, and launch an in-memory DuckDB
                    WebAssembly analytics environment.
                  </p>

                  <div className="mt-[24px]">
                    <label className="block text-[12px] text-[#898989]">
                      Select Data Sources to Pre-Connect:
                    </label>
                    <div className="mt-[10px] flex flex-wrap gap-[8px]">
                      {DATA_CONNECTORS.map((name) => {
                        const active = selectedSources.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleSourceSelection(name)}
                            className={`rounded-full border px-[12px] py-[5px] text-[12px] transition-colors cursor-pointer ${active
                              ? "border-[#fafafa] bg-[#242424] font-medium text-[#fafafa]"
                              : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
                              }`}
                          >
                            {active ? "✓ " : "+ "}
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-[24px] rounded-[11px] border border-[#2e2e2e] bg-[#0d0d0d] p-[16px] font-mono-code text-[11px] text-[#b4b4b4]">
                  <div className="text-[#898989]">
                    // WORKSPACE CONFIGURATION MANIFEST
                  </div>
                  <div className="mt-[6px]">
                    tenant:{" "}
                    <span className="text-[#fafafa]">
                      &quot;{workspaceSlug || "default-org"}&quot;
                    </span>
                    <br />
                    engine:{" "}
                    <span className="text-[#fafafa]">
                      &quot;duckdb_wasm_simd128&quot;
                    </span>
                    <br />
                    sources: [{selectedSources.map((s) => `"${s}"`).join(", ")}]
                    <br />
                    guardrails:{" "}
                    <span className="text-[#fafafa]">
                      &quot;RLS + RBAC + PII_MASK + SAML_2.0&quot;
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[16px] border border-[#2e2e2e] bg-[#121212] p-[24px] lg:col-span-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setProvisionSubmitted(true);
                  }}
                  className="flex flex-col gap-[16px]"
                >
                  <div className="text-[16px] font-medium text-[#fafafa]">
                    Start your RicozViz project
                  </div>

                  <div>
                    <label className="mb-[6px] block text-[12px] text-[#898989]">
                      Work Email (SAML 2.0 / SSO Auto-Discovery)
                    </label>
                    <input
                      type="email"
                      required
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="architect@enterprise.io"
                      className="w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[12px] py-[8px] text-[14px] font-normal text-[#fafafa] placeholder-[#898989] focus:border-[#ff6b35] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-[6px] block text-[12px] text-[#898989]">
                      Isolated Tenant Slug
                    </label>
                    <input
                      type="text"
                      required
                      value={workspaceSlug}
                      onChange={(e) => setWorkspaceSlug(e.target.value)}
                      placeholder="acme-global-analytics"
                      className="w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[12px] py-[8px] text-[14px] font-normal text-[#fafafa] placeholder-[#898989] focus:border-[#ff6b35] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
                    <div>
                      <label className="mb-[6px] block text-[12px] text-[#898989]">
                        Primary Region (RLS Anchor)
                      </label>
                      <select className="w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[12px] py-[8px] text-[14px] font-normal text-[#fafafa] focus:border-[#ff6b35] focus:outline-none">
                        <option>US-East (N. Virginia)</option>
                        <option>EU-Central (Frankfurt)</option>
                        <option>AP-Southeast (Singapore)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-[6px] block text-[12px] text-[#898989]">
                        Identity Provider
                      </label>
                      <select className="w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[12px] py-[8px] text-[14px] font-normal text-[#fafafa] focus:border-[#ff6b35] focus:outline-none">
                        <option>Okta SAML 2.0 + SCIM</option>
                        <option>Microsoft Entra ID</option>
                        <option>Google Workspace SSO</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-[6px] flex flex-wrap items-center gap-[10px]">
                    <button
                      type="submit"
                      className="h-[38px] flex-1 rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-[18px] text-[14px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] cursor-pointer"
                    >
                      {provisionSubmitted
                        ? "Workspace Provisioned ✓"
                        : "Start your project"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="h-[38px] rounded-full border border-[#393939] bg-[#1c1c1c] px-[16px] text-[14px] font-normal text-[#fafafa] hover:border-[#4d4d4d] cursor-pointer"
                    >
                      Request a demo
                    </button>
                  </div>
                </form>

                {provisionSubmitted && (
                  <div className="mt-[14px] rounded-[8px] border border-[#ff6b35] bg-[#0d0d0d] p-[10px] font-mono-code text-[11px] text-[#fafafa]">
                    ✓ Tenant <span className="text-[#ff6b35]">{workspaceSlug}</span>{" "}
                    provisioned with {selectedSources.length} connectors &amp;
                    SHA-256 audit ledger.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* DYNAMIC PARTICLE CTA SECTION */}
      <ParticleCtaSection onOpenAuthModal={() => setAuthModalOpen(true)} />

      {/* COMPREHENSIVE TECHNICAL FOOTER */}
      <ComprehensiveFooter />

      {/* INTERACTIVE SAML 2.0 SSO MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121212]/85 p-[24px]">
          <div className="w-full max-w-[440px] rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px]">
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[12px]">
              <span className="font-mono-code text-[11px] text-[#ff6b35]">
                ENTERPRISE_AUTH // SAML_2.0_SSO
              </span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border border-[#393939] px-[10px] py-[2px] text-[12px] text-[#b4b4b4] hover:text-[#fafafa] cursor-pointer"
              >
                ESC
              </button>
            </div>
            <h3 className="mt-[16px] text-[20px] font-normal text-[#fafafa]">
              Sign in to ricozviz
            </h3>
            <p className="mt-[6px] text-[14px] text-[#898989]">
              Authenticate via your organization&apos;s SAML 2.0 Identity
              Provider to inherit RBAC and Row-Level Security policies.
            </p>
            <div className="mt-[16px]">
              <label className="mb-[6px] block text-[12px] text-[#898989]">
                Organization Domain
              </label>
              <input
                type="text"
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value)}
                className="w-full rounded-[8px] border border-[#393939] bg-[#121212] px-[12px] py-[8px] text-[14px] text-[#fafafa] focus:border-[#ff6b35] focus:outline-none"
              />
            </div>
            <div className="mt-[20px] flex justify-end gap-[10px]">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border border-[#393939] bg-transparent px-[16px] py-[8px] text-[13px] text-[#fafafa] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-[16px] py-[8px] text-[13px] font-medium text-[#fafafa] cursor-pointer"
              >
                Continue with SAML SSO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
