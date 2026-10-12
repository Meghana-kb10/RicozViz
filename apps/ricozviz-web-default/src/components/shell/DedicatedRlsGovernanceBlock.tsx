"use client";

import React, { useState, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Database,
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  X,
  RotateCcw,
  Sliders,
  FileCode,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  apiSimulateRls,
  type RlsSimulationRole,
  type RlsSimulatedRecord,
  type RlsSimulationResult,
} from "@/lib/api";

// -----------------------------------------------------------------------------
// DEFAULT IN-MEMORY SOURCE RECORDS (Client Fallback)
// -----------------------------------------------------------------------------
interface ClientRawRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  representative: string;
  email: string;
  region: string;
  grossRevenueNum: number;
  paymentTokenRaw: string;
}

const CLIENT_SOURCE_RECORDS: ClientRawRecord[] = [
  {
    id: "tx_01",
    tenantId: "org_101",
    tenantName: "Acme Enterprise Corp",
    representative: "Sarah Connor",
    email: "sarah.connor@acme.corp",
    region: "US-East",
    grossRevenueNum: 142500,
    paymentTokenRaw: "tok_live_9942a8f89e21",
  },
  {
    id: "tx_02",
    tenantId: "org_101",
    tenantName: "Acme Enterprise Corp",
    representative: "Marcus Wright",
    email: "marcus.wright@acme.corp",
    region: "EU-West",
    grossRevenueNum: 89200,
    paymentTokenRaw: "tok_live_8831c1b34a10",
  },
  {
    id: "tx_03",
    tenantId: "org_102",
    tenantName: "Globex Global Industries",
    representative: "Hank Scorpio",
    email: "hank.scorpio@globex.com",
    region: "US-East",
    grossRevenueNum: 320000,
    paymentTokenRaw: "tok_live_7712d9e902b4",
  },
  {
    id: "tx_04",
    tenantId: "org_102",
    tenantName: "Globex Global Industries",
    representative: "Tanya Adams",
    email: "tanya.adams@globex.com",
    region: "APAC-South",
    grossRevenueNum: 64800,
    paymentTokenRaw: "tok_live_6643e2a715f2",
  },
  {
    id: "tx_05",
    tenantId: "org_103",
    tenantName: "Initech Capital Holdings",
    representative: "Peter Gibbons",
    email: "peter.gibbons@initech.io",
    region: "EU-West",
    grossRevenueNum: 115000,
    paymentTokenRaw: "tok_live_5521f7c833d1",
  },
  {
    id: "tx_06",
    tenantId: "org_101",
    tenantName: "Acme Enterprise Corp",
    representative: "Kenji Sato",
    email: "kenji.sato@acme.corp",
    region: "APAC-South",
    grossRevenueNum: 210400,
    paymentTokenRaw: "tok_live_4410g3d122e8",
  },
];

interface RoleMeta {
  id: RlsSimulationRole;
  label: string;
  badge: string;
  description: string;
  allowedTenant: string;
  allowedRegions: string[];
  defaultPolicies: string[];
}

const ROLES_META: RoleMeta[] = [
  {
    id: "ORGANIZATION_ADMIN",
    label: "Org Admin",
    badge: "Full Access",
    description: "Complete visibility into all tenant records, raw revenue, and unmasked emails.",
    allowedTenant: "org_101",
    allowedRegions: ["US-East", "EU-West", "APAC-South"],
    defaultPolicies: ["TENANT_ISOLATION", "ROW_SIGNING"],
  },
  {
    id: "REGIONAL_SALES_LEAD",
    label: "Regional Lead (EU)",
    badge: "Geo-Partitioned",
    description: "Strictly isolated to EU-West. PII masked and cross-region rows dropped.",
    allowedTenant: "org_101",
    allowedRegions: ["EU-West"],
    defaultPolicies: ["TENANT_ISOLATION", "REGIONAL_PARTITION", "PII_MASKING", "ROW_SIGNING"],
  },
  {
    id: "FINANCIAL_AUDITOR",
    label: "Compliance Auditor",
    badge: "PII Masked",
    description: "Cross-region financial oversight. Contact PII and payment tokens redacted.",
    allowedTenant: "org_101",
    allowedRegions: ["US-East", "EU-West", "APAC-South"],
    defaultPolicies: ["TENANT_ISOLATION", "PII_MASKING", "ROW_SIGNING"],
  },
  {
    id: "RESTRICTED_CONTRACTOR",
    label: "Contractor",
    badge: "Least Privilege",
    description: "Maximum zero-trust isolation. Geo-fenced, PII masked, revenue bucketed into tiers.",
    allowedTenant: "org_101",
    allowedRegions: ["US-East"],
    defaultPolicies: [
      "TENANT_ISOLATION",
      "REGIONAL_PARTITION",
      "PII_MASKING",
      "METRIC_REDACTION",
      "ROW_SIGNING",
    ],
  },
];

interface PolicyToggleMeta {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  astPredicate: string;
  category: string;
}

const POLICIES_META: PolicyToggleMeta[] = [
  {
    id: "TENANT_ISOLATION",
    name: "Tenant Boundary Isolation",
    shortLabel: "Tenant Boundary",
    description: "Injects mandatory tenant_id filter into SQL AST. Mathematically isolates tenants in memory.",
    astPredicate: "tenant_id = auth.current_org()",
    category: "Row Filter",
  },
  {
    id: "REGIONAL_PARTITION",
    name: "Regional Geo-Fencing",
    shortLabel: "Geo-Fence",
    description: "Restricts query execution strictly to authorized geographic territory.",
    astPredicate: "region IN (auth.allowed_regions())",
    category: "Geo Filter",
  },
  {
    id: "PII_MASKING",
    name: "Dynamic Column Masking (PII)",
    shortLabel: "Mask PII",
    description: "Dynamically transforms emails & contact names into masked hashes in query projection.",
    astPredicate: "regexp_replace(email, '(^.).*(@.*$)', '\\1***\\2')",
    category: "Column Mask",
  },
  {
    id: "METRIC_REDACTION",
    name: "Financial Metric Obfuscation",
    shortLabel: "Redact Revenue",
    description: "Obfuscates exact revenue totals into generalized tier ranges ($100k-$250k).",
    astPredicate: "bucket_tier(gross_revenue)",
    category: "Redaction",
  },
];

export function DedicatedRlsGovernanceBlock({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<RlsSimulationRole>("REGIONAL_SALES_LEAD");
  const [activePolicyIds, setActivePolicyIds] = useState<string[]>([
    "TENANT_ISOLATION",
    "REGIONAL_PARTITION",
    "PII_MASKING",
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedAst, setCopiedAst] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);
  const [isSimulatingBackend, setIsSimulatingBackend] = useState(false);

  // Active Role Info
  const currentRoleMeta = useMemo(() => {
    return ROLES_META.find((r) => r.id === selectedRole) || ROLES_META[1]!;
  }, [selectedRole]);

  // Handle Role Switch: pre-select role's recommended policies
  const handleSelectRole = (role: RlsSimulationRole) => {
    setSelectedRole(role);
    const meta = ROLES_META.find((r) => r.id === role);
    if (meta) {
      setActivePolicyIds(meta.defaultPolicies);
    }
  };

  // Toggle Policy Rule
  const handleTogglePolicy = (policyId: string) => {
    setActivePolicyIds((prev) =>
      prev.includes(policyId) ? prev.filter((id) => id !== policyId) : [...prev, policyId]
    );
  };

  // Evaluate In-Memory Simulation Client-Side for instant reactivity
  const simulation = useMemo(() => {
    const isTenantIsolated = activePolicyIds.includes("TENANT_ISOLATION");
    const isRegionalPartitioned = activePolicyIds.includes("REGIONAL_PARTITION");
    const isPiiMasked = activePolicyIds.includes("PII_MASKING");
    const isFinancialRedacted = activePolicyIds.includes("METRIC_REDACTION");

    let droppedCount = 0;
    let maskedColsCount = 0;

    const records = CLIENT_SOURCE_RECORDS.map((raw) => {
      const violatesTenant = isTenantIsolated && raw.tenantId !== currentRoleMeta.allowedTenant;
      const violatesRegion =
        isRegionalPartitioned && !currentRoleMeta.allowedRegions.includes(raw.region);
      const isDropped = violatesTenant || violatesRegion;

      if (isDropped) {
        droppedCount++;
      }

      const maskedList: string[] = [];
      let displayEmail = raw.email;
      let displayRep = raw.representative;
      let displayRevenue = `$${raw.grossRevenueNum.toLocaleString()}.00`;
      let displayToken = raw.paymentTokenRaw;

      if (isPiiMasked) {
        const parts = raw.email.split("@");
        displayEmail = parts.length === 2 && parts[0]
          ? `${parts[0].charAt(0)}***${parts[0].slice(-1)}@${parts[1]}`
          : "***@***";
        displayRep = `${raw.representative.charAt(0)}*** ${raw.representative.split(" ").slice(-1)[0]}`;
        maskedList.push("email", "representative");
      }

      if (isFinancialRedacted) {
        displayRevenue =
          raw.grossRevenueNum < 100000
            ? "$50k - $100k (Tier B)"
            : raw.grossRevenueNum < 200000
            ? "$100k - $200k (Tier A)"
            : "$200k+ (Enterprise Tier)";
        displayToken = `${raw.paymentTokenRaw.slice(0, 8)}...[HMAC]`;
        maskedList.push("grossRevenue", "paymentToken");
      }

      maskedColsCount += maskedList.length;

      return {
        id: raw.id,
        tenantId: raw.tenantId,
        tenantName: raw.tenantName,
        representative: isDropped ? "[FILTERED_OUT]" : displayRep,
        email: isDropped ? "[FILTERED_OUT]" : displayEmail,
        region: raw.region,
        grossRevenue: isDropped ? "$0.00" : displayRevenue,
        paymentToken: isDropped ? "[FILTERED_OUT]" : displayToken,
        maskedColumns: maskedList,
        isRowFiltered: isDropped,
        rowStatus: isDropped
          ? ("CONFIDENTIAL_DROPPED" as const)
          : maskedList.length > 0
          ? ("PARTIALLY_MASKED" as const)
          : ("ACCESSIBLE" as const),
      };
    });

    const whereClauses: string[] = [];
    if (isTenantIsolated) whereClauses.push(`tenant_id = '${currentRoleMeta.allowedTenant}'`);
    if (isRegionalPartitioned) {
      const formattedRegions = currentRoleMeta.allowedRegions.map((r) => `'${r}'`).join(", ");
      whereClauses.push(`region IN (${formattedRegions})`);
    }

    const whereSql = whereClauses.length > 0 ? `\nWHERE ${whereClauses.join("\n  AND ")}` : "";

    const astSql = `-- Dynamic Cryptographic RLS AST Injected (Zero Database Rebuilds)
SELECT
  id,
  tenant_id,
  ${
    isPiiMasked
      ? "regexp_replace(email, '(^.).*(@.*$)', '\\1***\\2') AS email"
      : "email"
  },
  ${
    isPiiMasked
      ? "concat(substr(representative, 1, 1), '***') AS representative"
      : "representative"
  },
  region,
  ${
    isFinancialRedacted
      ? "bucket_tier(gross_revenue) AS gross_revenue"
      : "gross_revenue"
  },
  ${
    isFinancialRedacted
      ? "concat(substr(payment_token, 1, 8), '...[HMAC]') AS payment_token"
      : "payment_token"
  },
  hmac_sha256(row_bytes, auth.nonce()) AS crypto_signature
FROM transactions${whereSql};`;

    return {
      records,
      visibleCount: CLIENT_SOURCE_RECORDS.length - droppedCount,
      droppedCount,
      maskedColsCount,
      astSql,
      latencyMs: "0.24ms",
      cryptoSig: "0x8fa134d10e82ccf91910bc49ae8101",
    };
  }, [activePolicyIds, currentRoleMeta]);

  // Optional Live Backend Simulation Trigger
  const handleVerifyBackend = async () => {
    setIsSimulatingBackend(true);
    try {
      await apiSimulateRls({
        role: selectedRole,
        activePolicyIds,
        tenantId: currentRoleMeta.allowedTenant,
        userRegion: currentRoleMeta.allowedRegions[0],
      });
    } catch {
      // Graceful fallback to client simulation
    } finally {
      setTimeout(() => setIsSimulatingBackend(false), 300);
    }
  };

  const copyAst = () => {
    navigator.clipboard?.writeText(simulation.astSql);
    setCopiedAst(true);
    setTimeout(() => setCopiedAst(false), 2000);
  };

  const copySig = () => {
    navigator.clipboard?.writeText(simulation.cryptoSig);
    setCopiedSig(true);
    setTimeout(() => setCopiedSig(false), 2000);
  };

  // Get first visible non-dropped record for compact card display
  const primaryVisibleRecord = simulation.records.find((r) => !r.isRowFiltered) || simulation.records[0];

  return (
    <div className="w-full flex flex-col justify-between h-full">
      {/* 1. ROLE SWITCHER BAR */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#172B3A] dark:text-[#E5E7EB] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#147D78] dark:text-[#4F9D8E]" />
            Active Role Context:
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] border border-[#147D78]/20">
            {currentRoleMeta.badge}
          </span>
        </div>

        {/* Roles Quick Pill Selector */}
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 bg-[#F4F1EA] dark:bg-[#111827] p-1 rounded-lg border border-[#DADFD9] dark:border-[#374151]">
          {ROLES_META.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelectRole(role.id)}
                className={`text-[10px] py-1 px-1.5 rounded font-medium transition text-center truncate ${
                  isSelected
                    ? "bg-white dark:bg-[#1F2937] text-[#147D78] dark:text-[#4F9D8E] shadow-xs font-bold border border-[#DADFD9] dark:border-[#374151]"
                    : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-white"
                }`}
                title={role.description}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. POLICY TOGGLES */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] text-[#596775] dark:text-[#9CA3AF] font-mono">
          <span>POLICY RULE TOGGLES</span>
          <span className="text-[#147D78] dark:text-[#4F9D8E] font-semibold">
            {activePolicyIds.length}/4 Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {POLICIES_META.map((policy) => {
            const isActive = activePolicyIds.includes(policy.id);
            return (
              <button
                key={policy.id}
                type="button"
                onClick={() => handleTogglePolicy(policy.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-[10px] font-mono border transition text-left ${
                  isActive
                    ? "bg-[#147D78]/5 dark:bg-[#147D78]/15 border-[#147D78]/40 dark:border-[#4F9D8E]/50 text-[#172B3A] dark:text-[#E5E7EB]"
                    : "bg-[#F4F1EA]/60 dark:bg-[#111827]/60 border-[#DADFD9] dark:border-[#374151] text-[#9CA3AF] opacity-60 hover:opacity-100"
                }`}
                title={policy.description}
              >
                <span className="truncate">{policy.shortLabel}</span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ml-1.5 ${
                    isActive ? "bg-[#147D78] dark:bg-[#4F9D8E]" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. LIVE RECORD & COLUMN MASKING PREVIEW */}
      <div className="mt-3 p-2.5 rounded-lg bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151]">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
          <span className="text-[#596775] dark:text-[#9CA3AF] flex items-center gap-1">
            <Database className="w-3 h-3 text-[#147D78] dark:text-[#4F9D8E]" />
            Live In-Memory Record:
          </span>
          <span className="text-[10px] text-[#147D78] dark:text-[#4F9D8E] font-bold">
            0 DB Rebuilds
          </span>
        </div>

        {primaryVisibleRecord ? (
          <div className="flex flex-col gap-1 text-[11px] font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#596775] dark:text-[#9CA3AF] text-[10px]">Email:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-medium ${
                  primaryVisibleRecord.maskedColumns.includes("email")
                    ? "text-[#147D78] dark:text-[#4F9D8E] bg-[#147D78]/10"
                    : "text-[#172B3A] dark:text-[#E5E7EB]"
                }`}
              >
                {primaryVisibleRecord.email}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#596775] dark:text-[#9CA3AF] text-[10px]">Revenue:</span>
              <span
                className={`px-1.5 py-0.2 rounded font-medium ${
                  primaryVisibleRecord.maskedColumns.includes("grossRevenue")
                    ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]"
                    : "text-[#172B3A] dark:text-[#E5E7EB]"
                }`}
              >
                {primaryVisibleRecord.grossRevenue}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#596775] dark:text-[#9CA3AF]">Tenant / Geo:</span>
              <span className="text-[#172B3A] dark:text-[#E5E7EB]">
                {primaryVisibleRecord.tenantId} • {primaryVisibleRecord.region}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-2 text-center text-[10px] text-amber-600 dark:text-amber-400 font-mono">
            All records filtered out by active geo-fence
          </div>
        )}

        {/* Isolation Metric Footer */}
        <div className="mt-2 pt-2 border-t border-[#DADFD9]/80 dark:border-[#374151]/80 flex items-center justify-between text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">
          <span>{simulation.visibleCount} rows visible</span>
          <span className="text-rose-600 dark:text-rose-400 font-medium">
            {simulation.droppedCount} dropped (zero leak)
          </span>
        </div>
      </div>

      {/* 4. EXPAND & INSPECT POLICY STUDIO BUTTON */}
      <div className="mt-3 pt-1">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-[#1F2937] hover:bg-[#147D78]/10 dark:hover:bg-[#4F9D8E]/15 border border-[#147D78]/30 dark:border-[#4F9D8E]/40 text-[#147D78] dark:text-[#4F9D8E] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Launch RLS Policy Sandbox</span>
          <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE RLS POLICY STUDIO MODAL                                   */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#DADFD9] dark:border-[#374151] flex items-center justify-between bg-[#F4F1EA]/60 dark:bg-[#1F2937]/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#147D78]/10 dark:bg-[#4F9D8E]/20 text-[#147D78] dark:text-[#4F9D8E] flex items-center justify-center border border-[#147D78]/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B3A] dark:text-[#E5E7EB] flex items-center gap-2">
                    Cryptographic RLS & Dynamic Column Masking Studio
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#147D78] text-white font-medium">
                      0 Rebuilds
                    </span>
                  </h3>
                  <p className="text-xs text-[#596775] dark:text-[#9CA3AF]">
                    Simulate how AST-injected policies dynamically mask columns and isolate tenants in memory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#596775] hover:text-[#172B3A] dark:text-[#9CA3AF] dark:hover:text-white hover:bg-[#E5E0D8] dark:hover:bg-[#374151] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm">
              {/* Telemetry Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#F4F1EA] dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
                  <div className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">DATABASE REBUILDS</div>
                  <div className="text-lg font-bold text-[#147D78] dark:text-[#4F9D8E] mt-0.5">0 Required</div>
                  <div className="text-[10px] text-[#596775] dark:text-[#9CA3AF]">Pure memory AST projection</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F1EA] dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
                  <div className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">EXECUTION LATENCY</div>
                  <div className="text-lg font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5">
                    {simulation.latencyMs}
                  </div>
                  <div className="text-[10px] text-[#596775] dark:text-[#9CA3AF]">Sub-millisecond query parsing</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F1EA] dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
                  <div className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">TENANT BOUNDARY</div>
                  <div className="text-lg font-bold text-[#147D78] dark:text-[#4F9D8E] mt-0.5">Enforced</div>
                  <div className="text-[10px] text-[#596775] dark:text-[#9CA3AF]">
                    {simulation.droppedCount} cross-tenant dropped
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F4F1EA] dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
                  <div className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">CRYPTOGRAPHIC NONCE</div>
                  <div className="text-lg font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 font-mono text-xs truncate">
                    {simulation.cryptoSig.slice(0, 10)}...
                  </div>
                  <div className="text-[10px] text-[#596775] dark:text-[#9CA3AF]">HMAC-SHA256 signature</div>
                </div>
              </div>

              {/* Roles & Policy Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Role Switcher */}
                <div className="p-4 rounded-xl bg-[#F4F1EA]/60 dark:bg-[#1F2937]/40 border border-[#DADFD9] dark:border-[#374151] flex flex-col gap-3">
                  <div className="font-semibold text-xs text-[#172B3A] dark:text-[#E5E7EB] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#147D78] dark:text-[#4F9D8E]" />
                      Select RBAC Role Context
                    </span>
                    <span className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                      Org ID: {currentRoleMeta.allowedTenant}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES_META.map((role) => {
                      const isSelected = selectedRole === role.id;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleSelectRole(role.id)}
                          className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? "bg-white dark:bg-[#1F2937] border-[#147D78] dark:border-[#4F9D8E] text-[#172B3A] dark:text-[#E5E7EB] shadow-xs"
                              : "bg-[#F4F1EA] dark:bg-[#111827] border-[#DADFD9] dark:border-[#374151] text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-white"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>{role.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#147D78] dark:text-[#4F9D8E]" />}
                          </div>
                          <div className="text-[10px] text-[#596775] dark:text-[#9CA3AF] mt-1 leading-tight">
                            {role.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Policies Toggles */}
                <div className="p-4 rounded-xl bg-[#F4F1EA]/60 dark:bg-[#1F2937]/40 border border-[#DADFD9] dark:border-[#374151] flex flex-col gap-3">
                  <div className="font-semibold text-xs text-[#172B3A] dark:text-[#E5E7EB] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-[#147D78] dark:text-[#4F9D8E]" />
                      Dynamic Policy Toggles
                    </span>
                    <button
                      type="button"
                      onClick={handleVerifyBackend}
                      disabled={isSimulatingBackend}
                      className="text-[10px] text-[#147D78] dark:text-[#4F9D8E] font-medium hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className={`w-3 h-3 ${isSimulatingBackend ? "animate-spin" : ""}`} />
                      Re-Evaluate
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {POLICIES_META.map((policy) => {
                      const isActive = activePolicyIds.includes(policy.id);
                      return (
                        <div
                          key={policy.id}
                          onClick={() => handleTogglePolicy(policy.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                            isActive
                              ? "bg-white dark:bg-[#1F2937] border-[#147D78]/50 dark:border-[#4F9D8E]/50 shadow-2xs"
                              : "bg-[#F4F1EA] dark:bg-[#111827] border-[#DADFD9] dark:border-[#374151] opacity-70"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-[#172B3A] dark:text-[#E5E7EB]">
                              {policy.name}
                            </span>
                            <span className="text-[10px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                              {policy.astPredicate}
                            </span>
                          </div>
                          <div
                            className={`w-9 h-5 rounded-full p-0.5 transition flex items-center ${
                              isActive ? "bg-[#147D78] justify-end" : "bg-gray-300 dark:bg-gray-600 justify-start"
                            }`}
                          >
                            <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic SQL AST Query */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-[#147D78] dark:text-[#4F9D8E]" />
                    Injected SQL Abstract Syntax Tree (AST)
                  </span>
                  <button
                    type="button"
                    onClick={copyAst}
                    className="text-[11px] font-mono text-[#147D78] dark:text-[#4F9D8E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedAst ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedAst ? "Copied AST" : "Copy SQL"}
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#111827] text-[#E5E7EB] font-mono text-xs overflow-x-auto border border-[#374151]">
                  <code>{simulation.astSql}</code>
                </pre>
              </div>

              {/* Live Evaluated Table */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#147D78] dark:text-[#4F9D8E]" />
                    Live Evaluated Dataset Projection ({simulation.visibleCount} /{" "}
                    {CLIENT_SOURCE_RECORDS.length} Visible)
                  </span>
                  <span className="text-[11px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                    Active Tenant: {currentRoleMeta.allowedTenant}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#DADFD9] dark:border-[#374151]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#F4F1EA] dark:bg-[#1F2937] border-b border-[#DADFD9] dark:border-[#374151] text-[#596775] dark:text-[#9CA3AF]">
                      <tr>
                        <th className="py-2.5 px-3">Row ID</th>
                        <th className="py-2.5 px-3">Tenant</th>
                        <th className="py-2.5 px-3">Representative</th>
                        <th className="py-2.5 px-3">Email (PII)</th>
                        <th className="py-2.5 px-3">Region</th>
                        <th className="py-2.5 px-3">Gross Revenue</th>
                        <th className="py-2.5 px-3">Access Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DADFD9] dark:divide-[#374151] bg-white dark:bg-[#111827]">
                      {simulation.records.map((rec) => (
                        <tr
                          key={rec.id}
                          className={`${
                            rec.isRowFiltered
                              ? "opacity-40 bg-gray-50/60 dark:bg-gray-900/40"
                              : "hover:bg-[#F4F1EA]/50 dark:hover:bg-[#1F2937]/50"
                          }`}
                        >
                          <td className="py-2 px-3 text-[#596775] dark:text-[#9CA3AF]">{rec.id}</td>
                          <td className="py-2 px-3 font-semibold text-[#172B3A] dark:text-[#E5E7EB]">
                            {rec.tenantId}
                          </td>
                          <td className="py-2 px-3 text-[#172B3A] dark:text-[#E5E7EB]">
                            {rec.representative}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] ${
                                rec.maskedColumns.includes("email")
                                  ? "bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] font-medium"
                                  : "text-[#172B3A] dark:text-[#E5E7EB]"
                              }`}
                            >
                              {rec.email}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#596775] dark:text-[#9CA3AF]">{rec.region}</td>
                          <td className="py-2 px-3 font-medium">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                rec.maskedColumns.includes("grossRevenue")
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]"
                                  : "text-[#172B3A] dark:text-[#E5E7EB]"
                              }`}
                            >
                              {rec.grossRevenue}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {rec.isRowFiltered ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                DROPPED
                              </span>
                            ) : rec.maskedColumns.length > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                MASKED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] border border-[#147D78]/20">
                                UNMASKED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-between bg-[#F4F1EA]/60 dark:bg-[#1F2937]/50 text-xs font-mono">
              <div className="flex items-center gap-2 text-[#596775] dark:text-[#9CA3AF]">
                <span>Signature: {simulation.cryptoSig.slice(0, 18)}...</span>
                <button
                  type="button"
                  onClick={copySig}
                  className="hover:text-[#147D78] dark:hover:text-[#4F9D8E] transition"
                  title="Copy signature"
                >
                  {copiedSig ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#147D78] hover:bg-[#106963] text-white text-xs font-semibold transition"
              >
                Close Sandbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
