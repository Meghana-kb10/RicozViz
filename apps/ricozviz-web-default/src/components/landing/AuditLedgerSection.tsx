"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Lock,
  RefreshCw,
  CheckCircle2,
  Zap,
  Users,
  Eye,
  FileCheck,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface AuditSession {
  id: string;
  userName: string;
  role: string;
  tenantName: string;
  tenantId: string;
  activeQuery: string;
  duration: string;
  status: "ACTIVE_VERIFIED" | "TOKEN_REVOKED";
  merkleHeight: number;
}

const INITIAL_SESSIONS: AuditSession[] = [
  {
    id: "sess-1",
    userName: "Elena Rostova",
    role: "Lead Data Architect",
    tenantName: "Acme Enterprise",
    tenantId: "org_acme",
    activeQuery: "Aggregating quarterly revenue by region",
    duration: "1.4 ms",
    status: "ACTIVE_VERIFIED",
    merkleHeight: 1045,
  },
  {
    id: "sess-2",
    userName: "Marcus Vance",
    role: "Compliance Auditor",
    tenantName: "Finovate Global",
    tenantId: "org_finovate",
    activeQuery: "Auditing accounts with dynamic PII masking",
    duration: "1.2 ms",
    status: "ACTIVE_VERIFIED",
    merkleHeight: 1044,
  },
  {
    id: "sess-3",
    userName: "Dr. Sarah Lin",
    role: "Chief Medical Officer",
    tenantName: "HealthPulse Med",
    tenantId: "org_healthpulse",
    activeQuery: "Analyzing clinical cohort trials (HIPAA)",
    duration: "6.4 ms",
    status: "ACTIVE_VERIFIED",
    merkleHeight: 1043,
  },
];

export default function AuditLedgerSection() {
  const [sessions, setSessions] = useState<AuditSession[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>("sess-1");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationDone, setVerificationDone] = useState<boolean>(true);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const handleRevokeSession = (id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "TOKEN_REVOKED" } : s
      )
    );
  };

  const handleVerifyMerkle = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationDone(true);
    }, 500);
  };

  return (
    <section id="audit-trail" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35] mb-[10px]">
            <KeyRound className="h-[12px] w-[12px]" />
            <span>ZERO-TRUST AUDIT TRAIL</span>
          </div>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Multi-tenant audit trail &amp;
            </span>
            <span className="block text-[#fafafa]">
              cryptographic session kill-switch
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={handleVerifyMerkle}
          disabled={isVerifying}
          className="flex items-center gap-[6px] rounded-full border border-[#393939] bg-[#1c1c1c] px-[16px] py-[8px] text-[12px] font-medium text-[#fafafa] transition-all hover:border-[#4d4d4d] hover:bg-[#242424] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw
            className={`h-[12px] w-[12px] text-[#ff6b35] ${
              isVerifying ? "animate-spin" : ""
            }`}
          />
          <span>{isVerifying ? "Recalculating Merkle Root…" : "Verify Ledger Integrity"}</span>
        </button>
      </div>

      {/* AUDIT WORKBENCH CONTAINER */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#2e2e2e] bg-[#171717] p-[24px] sm:p-[32px] shadow-2xl">
        {/* Subtle Faded Dark Imagery Layer */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/lineage-cube.jpg')" }}
        />
        <div className="pointer-events-none absolute inset-0 z-0 bg-linear-to-b from-[#171717]/80 via-[#171717]/95 to-[#171717]" />

        <div className="relative z-10 grid grid-cols-1 gap-[32px] lg:grid-cols-12 items-center">
          {/* LEFT 6 COLS: Live Sessions & Kill-Switch Interactive List */}
          <div className="flex flex-col gap-[14px] lg:col-span-6">
            <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[10px] text-[11px] font-mono-code text-[#898989]">
              <span>ACTIVE USER SESSIONS &amp; TENANTS</span>
              <span className="text-[#ff6b35] font-semibold">1,045 SHA-256 Blocks</span>
            </div>

            <div className="flex flex-col gap-[10px]">
              {sessions.map((sess) => {
                const isSelected = sess.id === activeSessionId;
                const isRevoked = sess.status === "TOKEN_REVOKED";
                return (
                  <div
                    key={sess.id}
                    onClick={() => setActiveSessionId(sess.id)}
                    className={`group flex items-center justify-between rounded-[14px] border p-[16px] transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_4px_20px_rgba(255,107,53,0.12)] -translate-y-0.5"
                        : "border-[#2e2e2e] bg-[#121212]/90 hover:border-[#393939] hover:bg-[#161616]"
                    }`}
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border border-[#2e2e2e] bg-[#1c1c1c] text-[12px] font-medium text-[#fafafa] group-hover:border-[#ff6b35]/40 transition-colors">
                        {sess.userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-[8px]">
                          <span className="text-[14px] font-medium text-[#fafafa] truncate">
                            {sess.userName}
                          </span>
                          <span className="text-[11px] font-mono-code text-[#898989]">
                            #{sess.merkleHeight}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#898989] truncate">
                          {sess.tenantName} · {sess.activeQuery}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-[10px] shrink-0 ml-[12px]">
                      {isRevoked ? (
                        <span className="rounded-full border border-red-500/30 bg-red-950/40 px-[10px] py-[3px] font-mono-code text-[11px] text-red-400 font-semibold">
                          REVOKED
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeSession(sess.id);
                          }}
                          className="rounded-full border border-red-500/40 bg-red-950/20 px-[10px] py-[3px] font-mono-code text-[11px] text-red-300 hover:bg-red-900/50 hover:border-red-500 transition-colors cursor-pointer"
                          title="Revoke session token immediately"
                        >
                          Kill Token
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Proof Strip */}
            <div className="mt-[4px] rounded-[12px] border border-[#2e2e2e] bg-[#121212] p-[12px] flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
              <span className="flex items-center gap-[6px]">
                <CheckCircle2 className="h-[14px] w-[14px] text-emerald-400" />
                <span>RFC 6962 Merkle Chain Root Verified</span>
              </span>
              <span className="text-[#fafafa]">100% Tamper Proof</span>
            </div>
          </div>

          {/* RIGHT 6 COLS: Selected Session Visual Trust Guarantee */}
          <div className="flex flex-col justify-between rounded-[16px] border border-[#2e2e2e] bg-[#121212]/95 p-[24px] lg:col-span-6 shadow-inner">
            <div>
              <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[14px]">
                <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] font-mono-code text-[11px] text-[#ff6b35]">
                  SESSION_STATUS // {activeSession.status}
                </span>
                <span className="text-[11px] font-mono-code text-emerald-400">
                  {activeSession.duration} Execution
                </span>
              </div>

              <div className="mt-[16px]">
                <h3 className="text-[20px] font-normal text-[#fafafa]">
                  {activeSession.userName} ({activeSession.role})
                </h3>
                <p className="mt-[4px] text-[13px] text-[#898989]">
                  Operating within isolated tenant boundary:{" "}
                  <strong className="text-[#fafafa] font-mono-code">
                    {activeSession.tenantId}
                  </strong>
                </p>
              </div>

              {/* Visual Trust Cards Grid */}
              <div className="mt-[20px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                <div className="rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[14px] hover:border-[#ff6b35]/40 transition-colors">
                  <div className="flex items-center gap-[8px] text-[12px] font-medium text-[#fafafa] mb-[4px]">
                    <Lock className="h-[14px] w-[14px] text-[#ff6b35]" />
                    <span>Row-Level Isolation</span>
                  </div>
                  <p className="text-[11px] leading-[1.5] text-[#898989]">
                    Strict AST rewriting guarantees zero cross-tenant query spill.
                  </p>
                </div>

                <div className="rounded-[12px] border border-[#2e2e2e] bg-[#171717] p-[14px] hover:border-[#ff6b35]/40 transition-colors">
                  <div className="flex items-center gap-[8px] text-[12px] font-medium text-[#fafafa] mb-[4px]">
                    <Eye className="h-[14px] w-[14px] text-[#ff6b35]" />
                    <span>Automatic PII Mask</span>
                  </div>
                  <p className="text-[11px] leading-[1.5] text-[#898989]">
                    Emails, IP addresses, and account numbers masked on the fly.
                  </p>
                </div>
              </div>

              {/* Kill-Switch CTA Box */}
              <div className="mt-[16px] rounded-[12px] border border-red-500/20 bg-red-950/15 p-[16px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[8px]">
                    <ShieldAlert className="h-[16px] w-[16px] text-red-400" />
                    <span className="text-[13px] font-medium text-red-200">
                      Zero-Reuse Token Kill-Switch
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-code text-red-400 uppercase">
                    Hardware Level
                  </span>
                </div>
                <p className="mt-[6px] text-[12px] leading-[1.5] text-[#898989]">
                  Instantly terminate compromised user sessions across all edge nodes
                  with one click. Session state is revoked with an immutable proof entry.
                </p>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="mt-[20px] pt-[14px] border-t border-[#2e2e2e] flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
              <span>Audit Compliance:</span>
              <span className="text-[#fafafa]">SOC 2 Type II + HIPAA Ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
