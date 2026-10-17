"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Award,
  Lock,
  HeartHandshake,
  KeyRound,
  FileCheck,
  CheckCircle2,
  Download,
  Check,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface SecurityBadge {
  id: string;
  name: string;
  code: string;
  category: "Compliance" | "Cryptography" | "Data Privacy";
  status: "AUDITED & VERIFIED" | "KERNEL ENFORCED";
  tagline: string;
  authority: string;
  cycle: string;
  controls: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const SECURITY_BADGES: SecurityBadge[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II Certified",
    code: "AICPA_SOC2",
    category: "Compliance",
    status: "AUDITED & VERIFIED",
    tagline: "Independently audited examination verifying Security, Availability & Confidentiality.",
    authority: "Independent AICPA CPA Auditor",
    cycle: "Annual Continuous Audit",
    controls: [
      "CC6.1 Mandatory MFA, least-privilege & SCIM automated offboarding",
      "CC7.1 Weekly third-party penetration testing & automated CVE scans",
      "CC8.1 Change management isolation with mandatory peer-review gates",
    ],
    icon: ShieldCheck,
  },
  {
    id: "hipaa",
    name: "HIPAA Security & Privacy Ready",
    code: "HIPAA_BAA",
    category: "Compliance",
    status: "AUDITED & VERIFIED",
    tagline: "Dedicated Business Associate Agreement (BAA) standards for protected health data.",
    authority: "Healthcare Information Security Board",
    cycle: "BAA Contractual Guarantee",
    controls: [
      "End-to-end data encryption in transit via TLS 1.3 ChaCha20",
      "Zero unencrypted temporary file caching on local disks",
      "Immutable query logging tracking every row and column accessed",
    ],
    icon: HeartHandshake,
  },
  {
    id: "iso27001",
    name: "ISO/IEC 27001:2022 Certified",
    code: "ISO_27001",
    category: "Compliance",
    status: "AUDITED & VERIFIED",
    tagline: "International standard for Information Security Management Systems (ISMS).",
    authority: "ANAB Accredited Registrar",
    cycle: "Annual Surveillance Audit",
    controls: [
      "A.8.24 Automated envelope encryption with 90-day master key rotation",
      "A.8.20 Network perimeter isolation across all query runtime nodes",
      "A.5.15 Strict access control policies with cryptographic token verification",
    ],
    icon: Award,
  },
  {
    id: "hsm",
    name: "Hardware Security Module (HSM)",
    code: "FIPS_140_3",
    category: "Cryptography",
    status: "KERNEL ENFORCED",
    tagline: "FIPS 140-3 Level 3 tamper-resistant hardware modules protect root master keys.",
    authority: "NIST FIPS Validated Enclave",
    cycle: "Real-Time Hardware Security",
    controls: [
      "Zero plain-text private keys stored in memory or persistent volumes",
      "Hardware-level session kill-switch with instant edge revocation",
      "Dedicated tenant KMS key envelope protection",
    ],
    icon: KeyRound,
  },
  {
    id: "rls",
    name: "Kernel Row-Level Security",
    code: "RLS_AST",
    category: "Cryptography",
    status: "KERNEL ENFORCED",
    tagline: "Cryptographic AST rewriting guarantees deterministic tenant boundary isolation.",
    authority: "Ricoz Cryptographic Kernel",
    cycle: "Every Query Intercepted",
    controls: [
      "Zero cross-tenant query leakage on user-submitted SQL queries",
      "Dynamic column-level PII masking for emails and identifiers",
      "SHA-256 Merkle chain block logged for every executed query",
    ],
    icon: Lock,
  },
  {
    id: "gdpr",
    name: "GDPR & Sovereign Data Residency",
    code: "GDPR_EU",
    category: "Data Privacy",
    status: "AUDITED & VERIFIED",
    tagline: "Sovereign tenant regional data residency across US, EU, and APAC clusters.",
    authority: "EU Data Protection Board Ready",
    cycle: "Standard Contractual Clauses",
    controls: [
      "Zero persistent PII storage in intermediate caches or server logs",
      "Automated Right-to-be-Forgotten cryptographic deletion triggers",
      "Regional data boundary anchors ensuring data never leaves geography",
    ],
    icon: FileCheck,
  },
];

export default function SecurityGovernanceSection() {
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>("soc2");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = ["All", "Compliance", "Cryptography", "Data Privacy"];

  const filteredBadges = SECURITY_BADGES.filter(
    (b) => activeCategory === "All" || b.category === activeCategory
  );

  const activeBadge =
    SECURITY_BADGES.find((b) => b.id === selectedBadgeId) || SECURITY_BADGES[0];

  return (
    <section id="governance" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[36px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] text-[11px] font-mono-code text-[#ff6b35] mb-[10px]">
            <ShieldCheck className="h-[12px] w-[12px]" />
            <span>ENTERPRISE TRUST &amp; COMPLIANCE</span>
          </div>
          <h2 className="text-[32px] font-normal leading-[1.18] tracking-[-0.02em] sm:text-[36px]">
            <span className="block text-[#898989]">
              Cryptographically verified
            </span>
            <span className="block text-[#fafafa]">
              security, compliance, and tenant isolation
            </span>
          </h2>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-[8px]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-[12px] py-[5px] text-[12px] font-mono-code transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "border-[#ff6b35] bg-[#1c1c1c] text-[#fafafa] font-medium"
                  : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* WORKBENCH CARD */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#2e2e2e] bg-[#171717] p-[24px] sm:p-[32px] shadow-2xl">
        {/* Subtle Faded Dark Imagery Layer */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/olap-prism.jpg')" }}
        />
        <div className="pointer-events-none absolute inset-0 z-0 bg-linear-to-b from-[#171717]/80 via-[#171717]/95 to-[#171717]" />

        <div className="relative z-10 grid grid-cols-1 gap-[32px] lg:grid-cols-12 items-center">
          {/* LEFT 6 COLS: Visual Badges Grid */}
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2 lg:col-span-6">
            {filteredBadges.map((badge) => {
              const isSelected = badge.id === selectedBadgeId;
              const Icon = badge.icon;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedBadgeId(badge.id)}
                  className={`group relative flex flex-col items-start rounded-[16px] border p-[18px] text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                    isSelected
                      ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_6px_24px_rgba(255,107,53,0.14)] -translate-y-1"
                      : "border-[#2e2e2e] bg-[#121212]/90 hover:border-[#393939] hover:bg-[#161616] hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div
                      className={`flex h-[36px] w-[36px] items-center justify-center rounded-[10px] border transition-colors ${
                        isSelected
                          ? "border-[#ff6b35]/40 bg-[#ff6b35]/20 text-[#ff6b35]"
                          : "border-[#2e2e2e] bg-[#171717] text-[#898989] group-hover:text-[#fafafa]"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <span className="font-mono-code text-[10px] text-emerald-400 flex items-center gap-[4px]">
                      <span className="h-[5px] w-[5px] rounded-full bg-emerald-400" />
                      <span>{badge.status}</span>
                    </span>
                  </div>

                  <div className="mt-[14px] text-[14px] font-medium text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
                    {badge.name}
                  </div>

                  <div className="mt-[4px] text-[12px] text-[#898989] line-clamp-2">
                    {badge.tagline}
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT 6 COLS: Selected Badge Inspector & Verified Controls */}
          <div className="flex flex-col justify-between rounded-[16px] border border-[#2e2e2e] bg-[#121212]/95 p-[24px] lg:col-span-6 shadow-inner">
            <div>
              <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-[14px]">
                <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[3px] font-mono-code text-[11px] text-[#ff6b35]">
                  {activeBadge.code} // VERIFIED_ATTESTED
                </span>
                <span className="text-[11px] font-mono-code text-[#898989]">
                  {activeBadge.cycle}
                </span>
              </div>

              <div className="mt-[16px]">
                <h3 className="text-[22px] font-normal text-[#fafafa]">
                  {activeBadge.name}
                </h3>
                <p className="mt-[6px] text-[13px] text-[#898989] leading-[1.5]">
                  {activeBadge.tagline}
                </p>
              </div>

              {/* Authority Pill */}
              <div className="mt-[16px] rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px] flex items-center justify-between text-[12px]">
                <span className="text-[#898989]">Attestation Authority:</span>
                <span className="text-[#fafafa] font-medium">{activeBadge.authority}</span>
              </div>

              {/* Controls Checklist */}
              <div className="mt-[16px]">
                <span className="block text-[11px] font-mono-code uppercase text-[#898989] mb-[8px]">
                  Verified Enforced Controls
                </span>
                <div className="flex flex-col gap-[8px]">
                  {activeBadge.controls.map((ctrl, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-[10px] rounded-[10px] border border-[#2e2e2e]/60 bg-[#171717]/60 p-[10px]"
                    >
                      <Check className="mt-[2px] h-[14px] w-[14px] text-[#ff6b35] shrink-0" />
                      <span className="text-[12px] text-[#b4b4b4] leading-[1.5]">
                        {ctrl}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-[20px] pt-[16px] border-t border-[#2e2e2e] flex flex-wrap items-center justify-between gap-[12px]">
              <span className="text-[12px] text-[#898989]">
                Full SOC 2 Type II audit packages available under NDA.
              </span>
              <a
                href="/whitepaper"
                className="flex items-center gap-[6px] rounded-full border border-[#393939] bg-[#1c1c1c] px-[14px] py-[6px] text-[12px] font-medium text-[#fafafa] hover:border-[#4d4d4d] hover:bg-[#242424] transition-colors"
              >
                <Download className="h-[12px] w-[12px] text-[#ff6b35]" />
                <span>Security Whitepaper</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
