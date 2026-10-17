"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Activity,
  Lock,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  Terminal,
  Search,
  Zap,
  Radio,
  Clock,
  UserX,
  FileText,
} from "lucide-react";

interface AuditBlock {
  id: string;
  blockHeight: number;
  tenantName: string;
  tenantId: string;
  userName: string;
  userRole: string;
  queryText: string;
  queryEngine: string;
  durationMs: number;
  rowsAffected: number;
  status: "SUCCESS_VERIFIED" | "REVOKED_KILL_SWITCH";
  blockHash: string;
  prevBlockHash: string;
  cryptographicProof: string;
  timestamp: string;
}

const INITIAL_AUDIT_BLOCKS: AuditBlock[] = [
  {
    id: "block-1045",
    blockHeight: 1045,
    tenantName: "Acme Enterprise",
    tenantId: "org_acme_corp",
    userName: "Elena Rostova",
    userRole: "Lead Data Architect",
    queryText:
      "SELECT region, sum(revenue_usd) FROM snowflake_wh.sales_fact WHERE tenant_id = 'org_acme_corp' GROUP BY 1 ORDER BY 2 DESC LIMIT 10;",
    queryEngine: "SNOWFLAKE_PUSHDOWN",
    durationMs: 4.8,
    rowsAffected: 10,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "bc38a9202517830b5e82110c94da38654a938174928bcf62047d19385012a9ef",
    blockHash: "9f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201e4d2",
    cryptographicProof: "0x7a89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021",
    timestamp: "2 minutes ago",
  },
  {
    id: "block-1044",
    blockHeight: 1044,
    tenantName: "Finovate Global",
    tenantId: "org_finovate_bank",
    userName: "Marcus Vance",
    userRole: "Compliance Auditor",
    queryText:
      "SELECT account_id, balance_eur, pii_mask(iban) FROM sovereign_vault.accounts WHERE balance_eur > 250000;",
    queryEngine: "DUCKDB_WASM",
    durationMs: 1.2,
    rowsAffected: 154,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "e4d29f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201",
    blockHash: "bc38a9202517830b5e82110c94da38654a938174928bcf62047d19385012a9ef",
    cryptographicProof: "0x18b958df634f19816da09c314051bb94205417852a06148590bf183b069d25ea",
    timestamp: "5 minutes ago",
  },
  {
    id: "block-1043",
    blockHeight: 1043,
    tenantName: "HealthPulse Med",
    tenantId: "org_healthpulse_med",
    userName: "Dr. Sarah Lin",
    userRole: "Chief Medical Officer",
    queryText:
      "SELECT cohort_id, count(patient_pseudonym), efficacy_ratio FROM trials_ephi.cohort_telemetry WHERE phase = 3 GROUP BY 1, 3;",
    queryEngine: "POSTGRES_CDC",
    durationMs: 6.4,
    rowsAffected: 42,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "7a89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021",
    blockHash: "e4d29f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201",
    cryptographicProof: "0x44fa910bb3219488a0194801ba928410582910ac7482910fa871b0219483011a",
    timestamp: "12 minutes ago",
  },
  {
    id: "block-1042",
    blockHeight: 1042,
    tenantName: "OmniRetail Global",
    tenantId: "org_omni_retail",
    userName: "David Chen",
    userRole: "Staff Streaming Eng",
    queryText:
      "SELECT window_start, count(event_id) AS click_rate FROM kafka_stream.checkout_events GROUP BY 1 ORDER BY 1 DESC LIMIT 50;",
    queryEngine: "KAFKA_STREAM",
    durationMs: 2.3,
    rowsAffected: 50,
    status: "SUCCESS_VERIFIED",
    prevBlockHash: "18b958df634f19816da09c314051bb94205417852a06148590bf183b069d25ea",
    blockHash: "7a89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021",
    cryptographicProof: "0x98124018ba201490218ba9481023847192837482910fa871b0219483011a44fa",
    timestamp: "24 minutes ago",
  },
];

export default function AuditLedgerSection() {
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>(INITIAL_AUDIT_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>("block-1045");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isVerifyingLedger, setIsVerifyingLedger] = useState<boolean>(false);
  const [verificationPassed, setVerificationPassed] = useState<boolean>(true);
  const [killSwitchTriggered, setKillSwitchTriggered] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const selectedBlock =
    auditBlocks.find((b) => b.id === selectedBlockId) || auditBlocks[0];

  const filteredBlocks = auditBlocks.filter(
    (b) =>
      b.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.queryText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.blockHash.includes(searchQuery)
  );

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyChain = () => {
    setIsVerifyingLedger(true);
    setTimeout(() => {
      setIsVerifyingLedger(false);
      setVerificationPassed(true);
    }, 600);
  };

  const handleTriggerKillSwitch = () => {
    setKillSwitchTriggered(true);
    setAuditBlocks((prev) =>
      prev.map((b) =>
        b.id === selectedBlockId
          ? {
              ...b,
              status: "REVOKED_KILL_SWITCH",
              cryptographicProof: "0xREVOKED_KILL_SWITCH_SHA256_IMMEDIATE_EXPIRATION",
            }
          : b
      )
    );
  };

  return (
    <section id="audit-trail" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[32px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <span className="text-[12px] font-mono-code uppercase tracking-wider text-[#ff6b35] block mb-[6px]">
            Zero-Trust Observability
          </span>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Multi-tenant audit trail &amp;
            </span>
            <span className="block text-[#fafafa]">
              cryptographic session kill-switch
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={handleVerifyChain}
            disabled={isVerifyingLedger}
            className="flex items-center gap-[6px] rounded-full border border-[#393939] bg-[#1c1c1c] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] transition-colors hover:border-[#4d4d4d] hover:bg-[#242424] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`h-[12px] w-[12px] text-[#ff6b35] ${
                isVerifyingLedger ? "animate-spin" : ""
              }`}
            />
            <span>
              {isVerifyingLedger ? "Recalculating Merkle Root…" : "Verify Chain Integrity"}
            </span>
          </button>
        </div>
      </div>

      {/* AUDIT WORKBENCH CONTAINER */}
      <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] lg:p-[32px]">
        {/* TOP STATUS BAR */}
        <div className="mb-[24px] flex flex-wrap items-center justify-between gap-[16px] rounded-[12px] border border-[#2e2e2e] bg-[#121212] px-[16px] py-[12px]">
          <div className="flex items-center gap-[12px]">
            <span className="flex h-[8px] w-[8px] rounded-full bg-emerald-400" />
            <span className="font-mono-code text-[12px] font-medium text-[#fafafa]">
              RFC 6962 SHA-256 Merkle Ledger
            </span>
            <span className="text-[#393939]">|</span>
            <span className="font-mono-code text-[11px] text-[#898989]">
              Total Blocks: <strong className="text-[#fafafa]">1,045 Verified</strong>
            </span>
          </div>

          <div className="flex items-center gap-[10px]">
            {verificationPassed && (
              <span className="flex items-center gap-[5px] rounded-full border border-emerald-500/30 bg-emerald-500/10 px-[10px] py-[2px] font-mono-code text-[11px] text-emerald-400">
                <CheckCircle2 className="h-[12px] w-[12px]" />
                100% Hash Consistency
              </span>
            )}
            <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[2px] font-mono-code text-[11px] text-[#ff6b35]">
              Hardware HSM Backed
            </span>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: LOGS LIST & DETAIL INSPECTOR */}
        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-12">
          {/* LEFT 5 COLS: SEARCHABLE BLOCKS LIST */}
          <div className="flex flex-col gap-[12px] lg:col-span-5">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-[12px] top-[10px] h-[14px] w-[14px] text-[#898989]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tenant, user, or block hash…"
                className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#121212] py-[8px] pl-[34px] pr-[12px] font-mono-code text-[12px] text-[#fafafa] placeholder-[#898989] focus:border-[#ff6b35] focus:outline-none"
              />
            </div>

            {/* List of Blocks */}
            <div className="flex flex-col gap-[8px] max-h-[460px] overflow-y-auto pr-[2px]">
              {filteredBlocks.map((block) => {
                const isSelected = block.id === selectedBlockId;
                const isRevoked = block.status === "REVOKED_KILL_SWITCH";
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => {
                      setSelectedBlockId(block.id);
                      setKillSwitchTriggered(isRevoked);
                    }}
                    className={`group flex flex-col items-start rounded-[12px] border p-[14px] text-left transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_0_16px_rgba(255,107,53,0.12)]"
                        : "border-[#2e2e2e] bg-[#121212] hover:border-[#393939] hover:bg-[#161616]"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono-code text-[11px] font-medium text-[#ff6b35]">
                        #{block.blockHeight} // {block.tenantName}
                      </span>
                      <span
                        className={`font-mono-code text-[10px] px-[6px] py-[1px] rounded ${
                          isRevoked
                            ? "bg-red-950/70 border border-red-500/40 text-red-400 font-bold"
                            : "bg-[#242424] text-[#898989]"
                        }`}
                      >
                        {isRevoked ? "KILL-SWITCHED" : block.timestamp}
                      </span>
                    </div>

                    <div className="mt-[6px] text-[13px] font-medium text-[#fafafa] line-clamp-1">
                      {block.queryText}
                    </div>

                    <div className="mt-[8px] flex w-full items-center justify-between font-mono-code text-[11px] text-[#898989]">
                      <span>{block.userName}</span>
                      <span className="text-[#fafafa]">{block.durationMs} ms</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT 7 COLS: DETAILED CRYPTOGRAPHIC INSPECTOR & KILL SWITCH */}
          <div className="flex flex-col justify-between rounded-[14px] border border-[#2e2e2e] bg-[#121212] p-[20px] sm:p-[24px] lg:col-span-7">
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-[12px] border-b border-[#2e2e2e] pb-[16px]">
                <div>
                  <div className="flex items-center gap-[8px]">
                    <span className="font-mono-code text-[13px] font-semibold text-[#fafafa]">
                      Block #{selectedBlock.blockHeight} Inspection
                    </span>
                    <span
                      className={`font-mono-code text-[10px] px-[8px] py-[2px] rounded-full ${
                        selectedBlock.status === "REVOKED_KILL_SWITCH"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {selectedBlock.status === "REVOKED_KILL_SWITCH"
                        ? "TOKEN_REVOKED"
                        : "VERIFIED_VALID"}
                    </span>
                  </div>
                  <div className="mt-[2px] text-[12px] text-[#898989]">
                    Actor: {selectedBlock.userName} ({selectedBlock.userRole})
                  </div>
                </div>

                {/* Kill Switch Button */}
                <button
                  type="button"
                  onClick={handleTriggerKillSwitch}
                  disabled={selectedBlock.status === "REVOKED_KILL_SWITCH"}
                  className="flex items-center gap-[6px] rounded-[8px] border border-red-500/40 bg-red-950/40 px-[12px] py-[6px] font-mono-code text-[11px] font-medium text-red-300 transition-colors hover:bg-red-900/60 disabled:opacity-50 cursor-pointer"
                  title="Immediately revoke user session token and terminate queries"
                >
                  <UserX className="h-[12px] w-[12px]" />
                  <span>
                    {selectedBlock.status === "REVOKED_KILL_SWITCH"
                      ? "Token Killed ✓"
                      : "Trigger Kill-Switch"}
                  </span>
                </button>
              </div>

              {/* Parameterized Query Text */}
              <div className="mt-[16px]">
                <label className="block text-[11px] font-mono-code uppercase text-[#898989]">
                  Audited Parameterized Query (AST Verified)
                </label>
                <div className="mt-[6px] rounded-[10px] border border-[#2e2e2e] bg-[#0d0d0d] p-[14px] font-mono-code text-[12px] text-[#fafafa] leading-[1.6]">
                  {selectedBlock.queryText}
                </div>
              </div>

              {/* SHA-256 Hashes and Cryptographic Chain Proof */}
              <div className="mt-[16px] flex flex-col gap-[10px]">
                <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                  <div className="flex items-center justify-between text-[11px] font-mono-code">
                    <span className="text-[#898989]">Current Block Hash (SHA-256):</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedBlock.blockHash, "curr")}
                      className="text-[#ff6b35] hover:text-[#ff8252] cursor-pointer"
                    >
                      {copiedHash === "curr" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-[4px] font-mono-code text-[11px] text-[#ff8252] break-all">
                    {selectedBlock.blockHash}
                  </div>
                </div>

                <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                  <div className="flex items-center justify-between text-[11px] font-mono-code">
                    <span className="text-[#898989]">Chained Previous Block Hash:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedBlock.prevBlockHash, "prev")}
                      className="text-[#898989] hover:text-[#fafafa] cursor-pointer"
                    >
                      {copiedHash === "prev" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-[4px] font-mono-code text-[11px] text-[#898989] break-all">
                    {selectedBlock.prevBlockHash}
                  </div>
                </div>

                <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                  <span className="block text-[11px] font-mono-code text-[#898989]">
                    Cryptographic Proof Signature:
                  </span>
                  <div className="mt-[4px] font-mono-code text-[11px] text-[#b4b4b4] break-all">
                    {selectedBlock.cryptographicProof}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row Stats */}
            <div className="mt-[20px] grid grid-cols-3 gap-[10px] border-t border-[#2e2e2e] pt-[16px] text-center font-mono-code">
              <div>
                <span className="text-[10px] text-[#898989] uppercase">Duration</span>
                <div className="text-[14px] font-semibold text-[#fafafa]">
                  {selectedBlock.durationMs} ms
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#898989] uppercase">Rows Affected</span>
                <div className="text-[14px] font-semibold text-[#fafafa]">
                  {selectedBlock.rowsAffected}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#898989] uppercase">Engine</span>
                <div className="text-[14px] font-semibold text-[#ff6b35]">
                  {selectedBlock.queryEngine}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
