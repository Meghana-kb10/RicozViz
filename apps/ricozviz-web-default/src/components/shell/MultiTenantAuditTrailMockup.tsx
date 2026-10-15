"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Activity,
  UserCheck,
  UserX,
  Lock,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Database,
  Terminal,
  ExternalLink,
  Layers,
  Search,
  Filter,
  ArrowRight,
  Fingerprint,
  Zap,
  Globe,
  Radio,
  X,
  Clock,
  Shield
} from "lucide-react";
import {
  apiGetAuditTrailPreview,
  apiRevokeToken,
  apiVerifyLedgerChain,
  type ImmutableQueryLog,
  type UserSessionPresence,
  type CryptographicTokenRevocation,
  type LedgerIntegritySummary,
  type AuditTrailPreviewData
} from "@/lib/api";

// Fallback Genesis Data for 100% offline resiliency
const FALLBACK_LOGS: ImmutableQueryLog[] = [
  {
    id: "block-1041",
    blockHeight: 1041,
    tenantId: "org_acme_corp",
    tenantName: "Acme Enterprise",
    workspaceId: "ws_revenue",
    workspaceName: "Global Revenue",
    userId: "usr_elena_r",
    userName: "Elena Rostova",
    userRole: "LEAD_DATA_ARCHITECT",
    queryText: "SELECT region, SUM(mrr_usd) AS arr FROM sales_lakehouse.mrr_fact GROUP BY 1 ORDER BY 2 DESC LIMIT 10;",
    queryEngine: "SNOWFLAKE_PUSHDOWN",
    durationMs: 4.8,
    rowsAffected: 10,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "0000000000000000000000000000000000000000000000000000000000000000",
    blockHash: "e4d29f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201",
    cryptographicProof: "0x7a89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021",
    timestamp: "2026-10-14T11:45:10.000Z"
  },
  {
    id: "block-1042",
    blockHeight: 1042,
    tenantId: "org_finovate_bank",
    tenantName: "Finovate Global",
    workspaceId: "ws_treasury",
    workspaceName: "Treasury & Risk",
    userId: "usr_marcus_v",
    userName: "Marcus Vance",
    userRole: "COMPLIANCE_AUDITOR",
    queryText: "SELECT account_id, balance_eur, pii_mask(iban) FROM sovereign_vault.accounts WHERE balance_eur > 250000;",
    queryEngine: "DUCKDB_WASM",
    durationMs: 1.2,
    rowsAffected: 154,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "e4d29f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201",
    blockHash: "bc38a9202517830b5e82110c94da38654a938174928bcf62047d19385012a9ef",
    cryptographicProof: "0x18b958df634f19816da09c314051bb94205417852a06148590bf183b069d25ea",
    timestamp: "2026-10-14T11:48:30.000Z"
  },
  {
    id: "block-1043",
    blockHeight: 1043,
    tenantId: "org_healthpulse_med",
    tenantName: "HealthPulse Med",
    workspaceId: "ws_oncology",
    workspaceName: "Clinical Trials (HIPAA)",
    userId: "usr_sarah_l",
    userName: "Dr. Sarah Lin",
    userRole: "CHIEF_MEDICAL_OFFICER",
    queryText: "SELECT cohort_id, count(patient_pseudonym), efficacy_ratio FROM trials_ephi.cohort_telemetry WHERE phase = 3 GROUP BY 1, 3;",
    queryEngine: "POSTGRES_CDC",
    durationMs: 6.4,
    rowsAffected: 42,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "bc38a9202517830b5e82110c94da38654a938174928bcf62047d19385012a9ef",
    blockHash: "9a2f1b88e0c4519823f901ab3817498cda55883210aa9843219082acde1177de",
    cryptographicProof: "0x9812acde1177de4109ba2c882199043210aa558872bcf19028a381989028e281",
    timestamp: "2026-10-14T11:51:15.000Z"
  },
  {
    id: "block-1044",
    blockHeight: 1044,
    tenantId: "org_cybershield_gov",
    tenantName: "CyberShield Gov",
    workspaceId: "ws_perimeter",
    workspaceName: "Federal Security Perimeter",
    userId: "usr_restricted_contractor",
    userName: "Restricted Contractor",
    userRole: "EXTERNAL_CONTRACTOR",
    queryText: "SELECT raw_credentials, vault_hmac_nonce FROM auth_system.internal_keys WHERE key_type = \"ROOT\";",
    queryEngine: "SNOWFLAKE_PUSHDOWN",
    durationMs: 0.8,
    rowsAffected: 0,
    status: "GUARDRAIL_BLOCKED",
    prevBlockHash: "9a2f1b88e0c4519823f901ab3817498cda55883210aa9843219082acde1177de",
    blockHash: "33df80aa981237bc901ef54611892019ab76521908cba912087431980aab821f",
    cryptographicProof: "0x44321890ab821fe82901ab3817498cda55883210aa9843219082acde1177de41",
    timestamp: "2026-10-14T11:53:02.000Z"
  },
  {
    id: "block-1045",
    blockHeight: 1045,
    tenantId: "org_apex_logistics",
    tenantName: "Apex Logistics",
    workspaceId: "ws_fleet",
    workspaceName: "Global Freight Telemetry",
    userId: "usr_david_k",
    userName: "David Kim",
    userRole: "VP_SUPPLY_CHAIN",
    queryText: "SELECT vessel_imo, origin_port, destination_port, carbon_offset_tons FROM live_telemetry.cargo_voyages WHERE status = \"EN_ROUTE\";",
    queryEngine: "CLICKHOUSE_OLAP",
    durationMs: 3.1,
    rowsAffected: 890,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "33df80aa981237bc901ef54611892019ab76521908cba912087431980aab821f",
    blockHash: "77de4109ba2c882199043210aa558872bcf19028a381989028e2819812acde11",
    cryptographicProof: "0x28a381989028e2819812acde1177de4109ba2c882199043210aa558872bcf190",
    timestamp: "2026-10-14T11:54:20.000Z"
  }
];

const FALLBACK_SESSIONS: UserSessionPresence[] = [
  {
    sessionId: "sess_acme_9021",
    tenantId: "org_acme_corp",
    tenantName: "Acme Enterprise",
    workspaceId: "ws_revenue",
    workspaceName: "Global Revenue",
    userId: "usr_elena_r",
    userName: "Elena Rostova",
    userEmail: "elena.rostova@acme-enterprise.com",
    userRole: "LEAD_DATA_ARCHITECT",
    avatar: "ER",
    ipAddress: "198.51.100.14",
    region: "US-East (N. Virginia)",
    deviceInfo: "Chrome 131 / macOS Darwin aarch64",
    activeResource: "Revenue_Analytics_Q3_Blended",
    connectionStatus: "QUERYING",
    lastHeartbeatAt: "Just now",
    tokenFingerprint: "tok_live_89a1e0b",
    ephemeralTokenExpiresAt: "In 45 min"
  },
  {
    sessionId: "sess_fino_4412",
    tenantId: "org_finovate_bank",
    tenantName: "Finovate Global",
    workspaceId: "ws_treasury",
    workspaceName: "Treasury & Risk",
    userId: "usr_marcus_v",
    userName: "Marcus Vance",
    userEmail: "marcus.vance@finovateglobal.ch",
    userRole: "COMPLIANCE_AUDITOR",
    avatar: "MV",
    ipAddress: "192.0.2.88",
    region: "EU-Central (Frankfurt)",
    deviceInfo: "Firefox 133 / Ubuntu Linux x86_64",
    activeResource: "SOX_Regulatory_Ledger",
    connectionStatus: "ACTIVE",
    lastHeartbeatAt: "3s ago",
    tokenFingerprint: "tok_live_bc33d91",
    ephemeralTokenExpiresAt: "In 2 hrs"
  },
  {
    sessionId: "sess_heal_1109",
    tenantId: "org_healthpulse_med",
    tenantName: "HealthPulse Med",
    workspaceId: "ws_oncology",
    workspaceName: "Clinical Trials (HIPAA)",
    userId: "usr_sarah_l",
    userName: "Dr. Sarah Lin",
    userEmail: "s.lin@healthpulse-oncology.org",
    userRole: "CHIEF_MEDICAL_OFFICER",
    avatar: "SL",
    ipAddress: "203.0.113.62",
    region: "US-Central (Iowa)",
    deviceInfo: "Safari 18 / iPadOS 18.2",
    activeResource: "HIPAA_Trial_Cohort_B",
    connectionStatus: "ACTIVE",
    lastHeartbeatAt: "1s ago",
    tokenFingerprint: "tok_live_77e922a",
    ephemeralTokenExpiresAt: "In 60 min"
  },
  {
    sessionId: "sess_cybr_7822",
    tenantId: "org_cybershield_gov",
    tenantName: "CyberShield Gov",
    workspaceId: "ws_perimeter",
    workspaceName: "Federal Security Perimeter",
    userId: "usr_restricted_contractor",
    userName: "Restricted Contractor",
    userEmail: "contractor.ext@cybershield-gov.mil",
    userRole: "EXTERNAL_CONTRACTOR",
    avatar: "RC",
    ipAddress: "45.33.32.156",
    region: "US-Gov (Virginia)",
    deviceInfo: "Edge 130 / Windows 11 Enterprise",
    activeResource: "Public_Export_Preview",
    connectionStatus: "IDLE",
    lastHeartbeatAt: "45s ago",
    tokenFingerprint: "tok_live_12ff9c4",
    ephemeralTokenExpiresAt: "In 15 min"
  }
];

const FALLBACK_TOKENS: CryptographicTokenRevocation[] = [
  {
    tokenId: "tok_live_89a1e0b",
    tokenType: "EPHEMERAL_QUERY_BEARER",
    tenantId: "org_acme_corp",
    tenantName: "Acme Enterprise",
    userId: "usr_elena_r",
    userName: "Elena Rostova",
    issuedAt: "15 min ago",
    expiresAt: "In 45 min",
    status: "ACTIVE",
    zeroReuseGuaranteed: true
  },
  {
    tokenId: "tok_live_bc33d91",
    tokenType: "SESSION_OAUTH_TOKEN",
    tenantId: "org_finovate_bank",
    tenantName: "Finovate Global",
    userId: "usr_marcus_v",
    userName: "Marcus Vance",
    issuedAt: "1 hr ago",
    expiresAt: "In 2 hrs",
    status: "ACTIVE",
    zeroReuseGuaranteed: true
  },
  {
    tokenId: "tok_live_77e922a",
    tokenType: "EPHEMERAL_QUERY_BEARER",
    tenantId: "org_healthpulse_med",
    tenantName: "HealthPulse Med",
    userId: "usr_sarah_l",
    userName: "Dr. Sarah Lin",
    issuedAt: "30 min ago",
    expiresAt: "In 60 min",
    status: "ACTIVE",
    zeroReuseGuaranteed: true
  },
  {
    tokenId: "tok_live_12ff9c4",
    tokenType: "EXPORT_STREAM_NONCE",
    tenantId: "org_cybershield_gov",
    tenantName: "CyberShield Gov",
    userId: "usr_restricted_contractor",
    userName: "Restricted Contractor",
    issuedAt: "10 min ago",
    expiresAt: "In 15 min",
    status: "ACTIVE",
    zeroReuseGuaranteed: true
  },
  {
    tokenId: "tok_revk_09e4a81",
    tokenType: "EPHEMERAL_QUERY_BEARER",
    tenantId: "org_acme_corp",
    tenantName: "Acme Enterprise",
    userId: "usr_temp_contractor_old",
    userName: "Former External Contractor",
    issuedAt: "24 hrs ago",
    expiresAt: "23 hrs ago",
    status: "REVOKED",
    revokedAt: "23 hrs ago",
    revokedBy: "CISO Automated Guardrail",
    revocationReason: "Scheduled contract expiration & zero-trust token invalidation",
    revocationReceiptSignature: "0x8f4c29a81177de4109ba2c882199043210aa558872bcf19028a381989028e281",
    zeroReuseGuaranteed: true
  }
];

export function MultiTenantAuditTrailMockup() {
  const [activeTab, setActiveTab] = useState<"logs" | "sessions" | "revocation" | "inspector">("logs");
  const [logs, setLogs] = useState<ImmutableQueryLog[]>(FALLBACK_LOGS);
  const [sessions, setSessions] = useState<UserSessionPresence[]>(FALLBACK_SESSIONS);
  const [tokens, setTokens] = useState<CryptographicTokenRevocation[]>(FALLBACK_TOKENS);
  const [selectedTenant, setSelectedTenant] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [engineFilter, setEngineFilter] = useState<string>("ALL");

  // Interactive Verification State
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [chainVerified, setChainVerified] = useState<boolean>(true);
  const [simulatedTampering, setSimulatedTampering] = useState<boolean>(false);

  // Revocation Modal State
  const [revokingToken, setRevokingToken] = useState<CryptographicTokenRevocation | null>(null);
  const [revocationReason, setRevocationReason] = useState<string>("Anomalous geographic IP egress detected by automated SIEM guardrail");
  const [revocationSuccessReceipt, setRevocationSuccessReceipt] = useState<{
    tokenId: string;
    signature: string;
    revokedAt: string;
    reason: string;
  } | null>(null);

  // Copied state
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    async function loadLiveData() {
      try {
        const preview = await apiGetAuditTrailPreview();
        if (preview?.immutableLogs?.length) {
          setLogs(preview.immutableLogs);
        }
        if (preview?.activeSessions?.length) {
          setSessions(preview.activeSessions);
        }
        if (preview?.revokedTokens?.length) {
          setTokens(preview.revokedTokens);
        }
      } catch {
        // Graceful fallback to static genesis data
      }
    }
    loadLiveData();
  }, []);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  }

  async function handleVerifyLedgerChain() {
    setIsVerifying(true);
    try {
      if (simulatedTampering) {
        setChainVerified(false);
      } else {
        await apiVerifyLedgerChain().catch(() => null);
        setChainVerified(true);
      }
    } finally {
      setTimeout(() => setIsVerifying(false), 600);
    }
  }

  function handleToggleSimulatedTampering() {
    if (!simulatedTampering) {
      // Simulate bit-flip on block 1042
      setLogs((prev) =>
        prev.map((block) =>
          block.blockHeight === 1042
            ? { ...block, queryText: "SELECT unmasked_pan, cvv FROM accounts -- INJECTED_BIT_FLIP" }
            : block
        )
      );
      setSimulatedTampering(true);
      setChainVerified(false);
    } else {
      // Restore ledger
      setLogs(FALLBACK_LOGS);
      setSimulatedTampering(false);
      setChainVerified(true);
    }
  }

  async function handleExecuteRevocation() {
    if (!revokingToken) return;

    const tokenId = revokingToken.tokenId;
    const nowIso = new Date().toISOString();
    const signature = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

    try {
      await apiRevokeToken({
        tokenId,
        reason: revocationReason,
        revokedBy: "CISO Autonomous SecOps"
      }).catch(() => null);

      // Optimistic state updates
      setTokens((prev) =>
        prev.map((t) =>
          t.tokenId === tokenId
            ? {
                ...t,
                status: "REVOKED",
                revokedAt: nowIso,
                revokedBy: "CISO Autonomous SecOps",
                revocationReason,
                revocationReceiptSignature: signature
              }
            : t
        )
      );

      setSessions((prev) =>
        prev.map((s) =>
          s.tokenFingerprint === tokenId
            ? {
                ...s,
                connectionStatus: "REVOKED",
                activeResource: "DISCONNECTED (401_TOKEN_REVOKED)",
                lastHeartbeatAt: "Terminated"
              }
            : s
        )
      );

      // Append revocation block to logs
      const nextHeight = logs[logs.length - 1].blockHeight + 1;
      const newBlock: ImmutableQueryLog = {
        id: `block-${nextHeight}`,
        blockHeight: nextHeight,
        tenantId: revokingToken.tenantId,
        tenantName: revokingToken.tenantName,
        workspaceId: "ws_secops",
        workspaceName: "Security Operations Center",
        userId: revokingToken.userId,
        userName: revokingToken.userName,
        userRole: "REVOKED_PRINCIPAL",
        queryText: `CRYPTOGRAPHIC_REVOKE_TOKEN("${tokenId}", REASON="${revocationReason}")`,
        queryEngine: "DUCKDB_WASM",
        durationMs: 0.4,
        rowsAffected: 0,
        status: "GUARDRAIL_BLOCKED",
        prevBlockHash: logs[logs.length - 1].blockHash,
        blockHash: `89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021${Math.floor(Math.random() * 90 + 10)}`,
        cryptographicProof: signature,
        timestamp: nowIso
      };

      setLogs((prev) => [...prev, newBlock]);

      setRevocationSuccessReceipt({
        tokenId,
        signature,
        revokedAt: nowIso,
        reason: revocationReason
      });

      setRevokingToken(null);
    } catch {
      setRevokingToken(null);
    }
  }

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedTenant !== "ALL" && log.tenantId !== selectedTenant) return false;
      if (engineFilter !== "ALL" && log.queryEngine !== engineFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = log.queryText.toLowerCase().includes(q);
        const matchesUser = log.userName.toLowerCase().includes(q);
        const matchesTenant = log.tenantName.toLowerCase().includes(q);
        const matchesHash = log.blockHash.toLowerCase().includes(q);
        if (!matchesQuery && !matchesUser && !matchesTenant && !matchesHash) return false;
      }
      return true;
    });
  }, [logs, selectedTenant, engineFilter, searchQuery]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (selectedTenant !== "ALL" && session.tenantId !== selectedTenant) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUser = session.userName.toLowerCase().includes(q);
        const matchesEmail = session.userEmail.toLowerCase().includes(q);
        const matchesTenant = session.tenantName.toLowerCase().includes(q);
        const matchesResource = session.activeResource.toLowerCase().includes(q);
        const matchesIp = session.ipAddress.includes(q);
        if (!matchesUser && !matchesEmail && !matchesTenant && !matchesResource && !matchesIp) return false;
      }
      return true;
    });
  }, [sessions, selectedTenant, searchQuery]);

  const activeSessionsCount = sessions.filter((s) => s.connectionStatus !== "REVOKED").length;
  const revokedTokensCount = tokens.filter((t) => t.status === "REVOKED").length;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------- */}
      {/* 1. TOP TELEMETRY & INTEGRITY SEAL BANNER                            */}
      {/* ------------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#DADFD9] dark:border-[#374151] bg-[#F4F1EA]/80 dark:bg-[#111827]/80 backdrop-blur-md p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DADFD9] dark:border-[#374151]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] border border-[#147D78]/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                  Multi-Tenant Audit Trail & Cryptographic Ledger
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  WORM CHAIN ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                Hardware-grade tamper-evident query logging, distributed multi-tenant session telemetry, and instantaneous token kill-switch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              type="button"
              onClick={handleVerifyLedgerChain}
              disabled={isVerifying}
              className="text-xs font-mono font-semibold px-3 py-2 rounded-xl bg-white dark:bg-[#1F2937] text-[#172B3A] dark:text-[#E5E7EB] hover:bg-[#147D78]/10 dark:hover:bg-[#4F9D8E]/15 border border-[#DADFD9] dark:border-[#374151] transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin text-[#147D78]" : "text-[#596775] dark:text-[#9CA3AF]"}`} />
              <span>{isVerifying ? "Verifying Hashes..." : "Verify Chain Integrity"}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSimulatedTampering}
              className={`text-xs font-mono font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                simulatedTampering
                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-500/40"
                  : "bg-white dark:bg-[#1F2937] text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB] border-[#DADFD9] dark:border-[#374151]"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{simulatedTampering ? "Reset Ledger" : "Simulate Tamper"}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Chain Integrity
            </span>
            <span className={`text-xs font-bold mt-0.5 block truncate flex items-center gap-1 ${
              chainVerified ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}>
              {chainVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
              {chainVerified ? "100% SOUND" : "ALTERATION DETECTED"}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Current Block Height
            </span>
            <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 block truncate">
              #{logs[logs.length - 1]?.blockHeight || 1045}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Active Tenants
            </span>
            <span className="text-xs font-bold text-[#147D78] dark:text-[#4F9D8E] mt-0.5 block truncate">
              4 Isolated Orgs
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Live Session Presence
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              {activeSessionsCount} Connected
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Revocation Kill-Switch
            </span>
            <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] mt-0.5 block truncate">
              {revokedTokensCount} Revoked (0.4ms)
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151]">
            <span className="text-[9.5px] text-[#596775] dark:text-[#9CA3AF] block uppercase">
              Ledger Standard
            </span>
            <span className="text-xs font-bold text-[#596775] dark:text-[#9CA3AF] mt-0.5 block truncate">
              RFC 6962 WORM
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. TAB CONTROLS & FILTER BAR                                        */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] self-start font-mono text-xs shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
              activeTab === "logs"
                ? "bg-[#147D78] text-white shadow-xs"
                : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Immutable Query Logs ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
              activeTab === "sessions"
                ? "bg-[#147D78] text-white shadow-xs"
                : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Session Presence ({activeSessionsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("revocation")}
            className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
              activeTab === "revocation"
                ? "bg-[#147D78] text-white shadow-xs"
                : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Token Revocation ({tokens.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inspector")}
            className={`px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
              activeTab === "inspector"
                ? "bg-[#147D78] text-white shadow-xs"
                : "text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-[#E5E7EB]"
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Hash Inspector</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Tenant Selector */}
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] focus:outline-hidden focus:border-[#147D78]"
          >
            <option value="ALL">All Tenants (4)</option>
            <option value="org_acme_corp">Acme Enterprise</option>
            <option value="org_finovate_bank">Finovate Global</option>
            <option value="org_healthpulse_med">HealthPulse Med</option>
            <option value="org_cybershield_gov">CyberShield Gov</option>
            <option value="org_apex_logistics">Apex Logistics</option>
          </select>

          {/* Engine Selector */}
          {activeTab === "logs" && (
            <select
              value={engineFilter}
              onChange={(e) => setEngineFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] focus:outline-hidden focus:border-[#147D78]"
            >
              <option value="ALL">All Engines</option>
              <option value="DUCKDB_WASM">DuckDB WASM</option>
              <option value="SNOWFLAKE_PUSHDOWN">Snowflake Pushdown</option>
              <option value="POSTGRES_CDC">Postgres CDC</option>
              <option value="CLICKHOUSE_OLAP">ClickHouse OLAP</option>
            </select>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#596775] dark:text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search query, user, hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#1F2937] border border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] placeholder-[#596775]/70 dark:placeholder-[#9CA3AF]/70 focus:outline-hidden focus:border-[#147D78] w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. TAB CONTENT                                                      */}
      {/* ------------------------------------------------------------------- */}

      {/* TAB 1: IMMUTABLE QUERY LOGS (WORM HASH CHAIN) */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-[#596775] dark:text-[#9CA3AF] px-1">
            <span>Displaying {filteredLogs.length} Cryptographically Chained Blocks</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Genesis → Current (RFC 6962 Linked)
            </span>
          </div>

          <div className="space-y-3">
            {filteredLogs.map((log, index) => {
              const isBlocked = log.status === "GUARDRAIL_BLOCKED";
              return (
                <div
                  key={log.id}
                  className={`rounded-xl border transition p-4 sm:p-5 shadow-2xs ${
                    isBlocked
                      ? "border-amber-400/60 dark:border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:border-[#147D78]/40 dark:hover:border-[#4F9D8E]/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DADFD9]/70 dark:border-[#374151]/70">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#172B3A] dark:bg-[#111827] text-white dark:text-[#4F9D8E] border border-transparent dark:border-[#374151]">
                        Block #{log.blockHeight}
                      </span>
                      <span className="text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                        {log.tenantName}
                      </span>
                      <span className="text-[11px] text-[#596775] dark:text-[#9CA3AF] font-mono">
                        · {log.workspaceName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                        isBlocked
                          ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                          : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {log.status === "GUARDRAIL_BLOCKED" ? "BLOCKED_GUARDRAIL" : "SUCCESS_VERIFIED"}
                      </span>

                      <span className="px-2 py-0.5 rounded bg-[#F4F1EA] dark:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] border border-[#DADFD9] dark:border-[#374151] text-[10.5px]">
                        {log.queryEngine}
                      </span>

                      <span className="text-[#596775] dark:text-[#9CA3AF] text-[11px]">
                        {log.durationMs}ms
                      </span>
                    </div>
                  </div>

                  {/* Executed Query AST */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-[#147D78] dark:text-[#4F9D8E]" />
                        <span>Executed Query Statement (AST Sanitized)</span>
                      </span>
                      <span>User: {log.userName} ({log.userRole})</span>
                    </div>
                    <pre className="p-3 rounded-lg bg-[#111827] text-[#E5E7EB] dark:bg-[#0B0F17] font-mono text-xs overflow-x-auto border border-[#374151]">
                      <code>{log.queryText}</code>
                    </pre>
                  </div>

                  {/* Cryptographic Linkage Strip */}
                  <div className="mt-3 pt-3 border-t border-[#DADFD9]/50 dark:border-[#374151]/50 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9]/70 dark:border-[#374151]/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[#596775] dark:text-[#9CA3AF] uppercase text-[9.5px]">Prev Hash:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB] truncate">{log.prevBlockHash}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(log.prevBlockHash)}
                        className="text-[#596775] hover:text-[#147D78] dark:hover:text-[#4F9D8E] ml-1"
                        title="Copy Previous Hash"
                      >
                        {copiedHash === log.prevBlockHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9]/70 dark:border-[#374151]/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[#147D78] dark:text-[#4F9D8E] uppercase text-[9.5px] font-bold">Block Hash:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB] font-bold truncate">{log.blockHash}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(log.blockHash)}
                        className="text-[#596775] hover:text-[#147D78] dark:hover:text-[#4F9D8E] ml-1"
                        title="Copy Block Hash"
                      >
                        {copiedHash === log.blockHash ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE USER SESSION PRESENCE */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-[#596775] dark:text-[#9CA3AF] px-1">
            <span>Multi-Tenant Active User Sessions ({filteredSessions.length})</span>
            <span className="text-[11px] text-[#147D78] dark:text-[#4F9D8E]">
              Zero-Trust Cross-Tenant Isolation Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((session) => {
              const isRevoked = session.connectionStatus === "REVOKED";
              return (
                <div
                  key={session.sessionId}
                  className={`p-4 rounded-xl border transition shadow-2xs flex flex-col justify-between ${
                    isRevoked
                      ? "border-rose-400/50 bg-rose-50/40 dark:bg-rose-950/20"
                      : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937]"
                  }`}
                >
                  <div>
                    {/* Header: User & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#147D78]/10 text-[#147D78] dark:text-[#4F9D8E] font-bold font-mono flex items-center justify-center border border-[#147D78]/30">
                          {session.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                              {session.userName}
                            </h4>
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#F4F1EA] dark:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] border border-[#DADFD9] dark:border-[#374151]">
                              {session.userRole}
                            </span>
                          </div>
                          <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                            {session.userEmail}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                        isRevoked
                          ? "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-500/30"
                          : session.connectionStatus === "QUERYING"
                          ? "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-500/30 animate-pulse"
                          : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isRevoked ? "bg-rose-500" : "bg-emerald-500"}`} />
                        {session.connectionStatus}
                      </span>
                    </div>

                    {/* Metadata details */}
                    <div className="mt-4 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between text-[#596775] dark:text-[#9CA3AF]">
                        <span>Tenant:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB] font-bold">
                          {session.tenantName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#596775] dark:text-[#9CA3AF]">
                        <span>Workspace:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB]">
                          {session.workspaceName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#596775] dark:text-[#9CA3AF]">
                        <span>IP & Region:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB]">
                          {session.ipAddress} · {session.region}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#596775] dark:text-[#9CA3AF]">
                        <span>Active Target:</span>
                        <span className="text-[#147D78] dark:text-[#4F9D8E] font-medium truncate max-w-[200px]">
                          {session.activeResource}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#596775] dark:text-[#9CA3AF]">
                        <span>Bearer Token:</span>
                        <span className="text-[#172B3A] dark:text-[#E5E7EB]">
                          {session.tokenFingerprint} ({session.ephemeralTokenExpiresAt})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-[#DADFD9]/70 dark:border-[#374151]/70 flex items-center justify-between">
                    <span className="text-[10.5px] font-mono text-[#596775] dark:text-[#9CA3AF]">
                      Heartbeat: {session.lastHeartbeatAt}
                    </span>

                    {!isRevoked ? (
                      <button
                        type="button"
                        onClick={() => {
                          const tok = tokens.find((t) => t.tokenId === session.tokenFingerprint);
                          if (tok) setRevokingToken(tok);
                        }}
                        className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Revoke Session</span>
                      </button>
                    ) : (
                      <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Terminated
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CRYPTOGRAPHIC TOKEN REVOCATION & ZERO-TRUST REGISTRY */}
      {activeTab === "revocation" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-[#596775] dark:text-[#9CA3AF] px-1">
            <span>Cryptographic Token Registry ({tokens.length} Tokens)</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              0.4ms Distributed Revocation SLA Guaranteed
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] shadow-2xs">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#F4F1EA] dark:bg-[#111827] border-b border-[#DADFD9] dark:border-[#374151] text-[#596775] dark:text-[#9CA3AF] uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Token ID & Scope</th>
                  <th className="py-3 px-4">Tenant / Subject</th>
                  <th className="py-3 px-4">Issued / Expires</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cryptographic Receipt</th>
                  <th className="py-3 px-4 text-right">Kill-Switch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DADFD9] dark:divide-[#374151]">
                {tokens.map((token) => {
                  const isRevoked = token.status === "REVOKED";
                  return (
                    <tr key={token.tokenId} className="hover:bg-[#F4F1EA]/50 dark:hover:bg-[#111827]/50 transition">
                      <td className="py-3.5 px-4 font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                        <div>{token.tokenId}</div>
                        <span className="text-[10px] text-[#147D78] dark:text-[#4F9D8E] font-normal">
                          {token.tokenType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[#596775] dark:text-[#9CA3AF]">
                        <div className="font-semibold text-[#172B3A] dark:text-[#E5E7EB]">{token.tenantName}</div>
                        <div className="text-[11px]">{token.userName}</div>
                      </td>

                      <td className="py-3.5 px-4 text-[#596775] dark:text-[#9CA3AF]">
                        <div>Issued: {token.issuedAt}</div>
                        <div className="text-[11px]">Expires: {token.expiresAt}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                          isRevoked
                            ? "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-500/30"
                            : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {isRevoked ? "REVOKED" : "ACTIVE"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {token.revocationReceiptSignature ? (
                          <div className="flex items-center gap-1.5 max-w-[160px]">
                            <span className="text-[10.5px] text-[#596775] dark:text-[#9CA3AF] truncate" title={token.revocationReceiptSignature}>
                              {token.revocationReceiptSignature}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(token.revocationReceiptSignature!)}
                              className="text-[#596775] hover:text-[#147D78] dark:hover:text-[#4F9D8E]"
                            >
                              {copiedHash === token.revocationReceiptSignature ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#596775] dark:text-[#9CA3AF]">
                            Zero Reuse Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isRevoked ? (
                          <button
                            type="button"
                            onClick={() => setRevokingToken(token)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-800 transition cursor-pointer"
                          >
                            Revoke Now
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            Revoked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CRYPTOGRAPHIC CHAIN INSPECTOR & INTEGRITY VALIDATOR */}
      {activeTab === "inspector" && (
        <div className="rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] p-5 sm:p-6 shadow-2xs space-y-5 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DADFD9] dark:border-[#374151]">
            <div>
              <h4 className="text-sm font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                Cryptographic WORM Hash Chain Validator
              </h4>
              <p className="text-xs text-[#596775] dark:text-[#9CA3AF] mt-0.5">
                Evaluates block-by-block hash continuity and proves zero database alteration or retroactive log edits.
              </p>
            </div>

            <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              chainVerified
                ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-500/30"
            }`}>
              {chainVerified ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{chainVerified ? "VERIFICATION PASSED: ZERO TAMPERING" : "VERIFICATION FAILED: INTEGRITY BROKEN"}</span>
            </div>
          </div>

          <div className="space-y-3">
            {logs.map((block, i) => {
              const prev = i > 0 ? logs[i - 1] : null;
              const matches = prev ? block.prevBlockHash === prev.blockHash : true;
              return (
                <div
                  key={block.id}
                  className={`p-3 rounded-lg border text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                    matches
                      ? "bg-[#F4F1EA]/60 dark:bg-[#111827]/60 border-[#DADFD9] dark:border-[#374151]"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#172B3A] dark:text-[#E5E7EB]">
                      Block #{block.blockHeight}
                    </span>
                    <span className="text-[#596775] dark:text-[#9CA3AF] truncate max-w-[200px]">
                      {block.queryText}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="truncate max-w-[140px] text-[#596775] dark:text-[#9CA3AF]" title={block.blockHash}>
                      Hash: {block.blockHash}
                    </div>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      matches
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                    }`}>
                      {matches ? "VALID" : "MISMATCH"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. TOKEN REVOCATION MODAL                                           */}
      {/* ------------------------------------------------------------------- */}
      {revokingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] p-6 shadow-xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DADFD9] dark:border-[#374151]">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5" />
                <span>Cryptographic Kill-Switch Authorization</span>
              </div>
              <button
                type="button"
                onClick={() => setRevokingToken(null)}
                className="text-[#596775] hover:text-[#172B3A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#596775] dark:text-[#9CA3AF] text-xs">
              Revoking this cryptographic token will immediately invalidate any active user session across all query nodes and record an immutable revocation event in the ledger.
            </p>

            <div className="p-3 rounded-lg bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] space-y-1.5 text-xs">
              <div><strong className="text-[#172B3A] dark:text-[#E5E7EB]">Token ID:</strong> {revokingToken.tokenId}</div>
              <div><strong className="text-[#172B3A] dark:text-[#E5E7EB]">Subject:</strong> {revokingToken.userName} ({revokingToken.tenantName})</div>
              <div><strong className="text-[#172B3A] dark:text-[#E5E7EB]">Scope:</strong> {revokingToken.tokenType}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#172B3A] dark:text-[#E5E7EB] mb-1">
                Revocation Reason:
              </label>
              <select
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] text-[#172B3A] dark:text-[#E5E7EB] text-xs focus:outline-hidden focus:border-rose-500"
              >
                <option value="Anomalous geographic IP egress detected by automated SIEM guardrail">
                  Anomalous geographic IP egress detected by automated SIEM guardrail
                </option>
                <option value="Immediate employee / contractor offboarding key deprovisioning">
                  Immediate employee / contractor offboarding key deprovisioning
                </option>
                <option value="Zero-trust privilege escalation prevention kill-switch">
                  Zero-trust privilege escalation prevention kill-switch
                </option>
                <option value="Routine security key rotation and credential revocation">
                  Routine security key rotation and credential revocation
                </option>
              </select>
            </div>

            <div className="pt-3 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRevokingToken(null)}
                className="px-3.5 py-2 rounded-lg bg-[#F4F1EA] dark:bg-[#111827] text-[#596775] dark:text-[#9CA3AF] hover:text-[#172B3A] dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRevocation}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm Immediate Revocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 5. REVOCATION SUCCESS RECEIPT MODAL                                 */}
      {/* ------------------------------------------------------------------- */}
      {revocationSuccessReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#1F2937] p-6 shadow-xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DADFD9] dark:border-[#374151]">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Cryptographic Token Revocation Receipt</span>
              </div>
              <button
                type="button"
                onClick={() => setRevocationSuccessReceipt(null)}
                className="text-[#596775] hover:text-[#172B3A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F4F1EA] dark:bg-[#111827] border border-[#DADFD9] dark:border-[#374151] space-y-2">
              <div>
                <span className="text-[#596775] dark:text-[#9CA3AF] block uppercase text-[9.5px]">Token Invalidation Status</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  PERMANENTLY REVOKED (0.4ms Propagated)
                </span>
              </div>
              <div>
                <span className="text-[#596775] dark:text-[#9CA3AF] block uppercase text-[9.5px]">HMAC Cryptographic Proof</span>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[#172B3A] dark:text-[#E5E7EB] font-bold text-[11px] truncate">
                    {revocationSuccessReceipt.signature}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(revocationSuccessReceipt.signature)}
                    className="text-[#147D78] dark:text-[#4F9D8E]"
                  >
                    {copiedHash === revocationSuccessReceipt.signature ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[#596775] dark:text-[#9CA3AF] block uppercase text-[9.5px]">Reason</span>
                <span className="text-[#172B3A] dark:text-[#E5E7EB] text-xs">
                  {revocationSuccessReceipt.reason}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#DADFD9] dark:border-[#374151] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setRevocationSuccessReceipt(null)}
                className="px-4 py-2 rounded-lg bg-[#147D78] hover:bg-[#106963] text-white font-bold transition cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
