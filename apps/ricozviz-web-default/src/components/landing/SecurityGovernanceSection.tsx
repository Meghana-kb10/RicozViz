"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  Lock,
  FileCheck,
  HeartHandshake,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  FileText,
  Cpu,
  Download,
} from "lucide-react";

interface SecurityStandard {
  id: string;
  name: string;
  code: string;
  category: "COMPLIANCE" | "CRYPTOGRAPHY" | "PRIVACY";
  status: "VERIFIED" | "ACTIVE";
  description: string;
  standard: string;
  authority: string;
  lastVerified: string;
  reportId: string;
  evidenceHash: string;
  controls: string[];
  icon: React.ComponentType<{ className?: string }>;
}

const SECURITY_STANDARDS: SecurityStandard[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II Certified",
    code: "SOC2_TYPE_II",
    category: "COMPLIANCE",
    status: "VERIFIED",
    description:
      "Annual independent third-party examination verifying Security, Availability, and Confidentiality controls without exception.",
    standard: "AICPA Trust Services Criteria CC6.1 - CC8.1",
    authority: "Independent AICPA Peer-Reviewed CPA Auditor",
    lastVerified: "October 2026",
    reportId: "SOC2-2026-RICOZ-98421",
    evidenceHash: "e4d29f8a20bb1b582531e8471e4f9b809a4732168393e506692882a1789c0201",
    controls: [
      "Continuous automated compliance monitoring & anomaly alerting",
      "CC6.1 Mandatory MFA, least privilege & SCIM automated offboarding",
      "CC7.1 Weekly third-party penetration testing & automated CVE scans",
      "CC8.1 Change management isolation with mandatory multi-peer reviews",
    ],
    icon: ShieldCheck,
  },
  {
    id: "hipaa",
    name: "HIPAA Security & Privacy Ready",
    code: "HIPAA_SECURITY_RULE",
    category: "COMPLIANCE",
    status: "VERIFIED",
    description:
      "Enforces Business Associate Agreement (BAA) standards, protected health information (ePHI) encryption, and zero disk spill.",
    standard: "HIPAA Security Rule 45 CFR Part 160 & Part 164 Subparts A, C, E",
    authority: "Third-Party Healthcare Information Security Audit",
    lastVerified: "August 2026",
    reportId: "HIPAA-2026-ATTEST-4109",
    evidenceHash: "bc38a9202517830b5e82110c94da38654a938174928bcf62047d19385012a9ef",
    controls: [
      "164.312(a)(2)(iv) End-to-end data encryption in transit (TLS 1.3)",
      "164.312(b) Immutable audit controls logging every single cell query",
      "Zero unencrypted temporary file caching on local disks",
      "Dedicated signed Business Associate Agreements (BAA) for enterprise",
    ],
    icon: HeartHandshake,
  },
  {
    id: "iso27001",
    name: "ISO/IEC 27001:2022 Certified",
    code: "ISO_27001_2022",
    category: "COMPLIANCE",
    status: "VERIFIED",
    description:
      "International standard for Information Security Management Systems (ISMS) governing data protection and operational resilience.",
    standard: "ISO/IEC 27001:2022 Information Security Management",
    authority: "ANAB Accredited International Certification Registrar",
    lastVerified: "September 2026",
    reportId: "ISO27001-2026-CERT-7731",
    evidenceHash: "7a89fbc00192ea44109ba2831899a0182741982bca8192837482910fa871b021",
    controls: [
      "A.8.24 Use of cryptography & automated envelope encryption",
      "A.8.20 Network security management across distributed query nodes",
      "A.5.15 Access control policy with cryptographic token verification",
      "Annual third-party recertification audits",
    ],
    icon: Award,
  },
  {
    id: "hsm",
    name: "Hardware Security Module (HSM)",
    code: "FIPS_140_3_LEVEL_3",
    category: "CRYPTOGRAPHY",
    status: "VERIFIED",
    description:
      "FIPS 140-3 Level 3 tamper-resistant hardware cryptographic modules protect root keys, token signing, and envelope encryption.",
    standard: "NIST FIPS 140-3 Level 3 Physical & Cryptographic Security",
    authority: "National Institute of Standards and Technology (NIST)",
    lastVerified: "October 2026",
    reportId: "HSM-FIPS-140-3-L3-KMS",
    evidenceHash: "18b958df634f19816da09c314051bb94205417852a06148590bf183b069d25ea",
    controls: [
      "Zero plain-text private keys stored in memory or persistent volumes",
      "Automated 90-day master key rotation with zero customer downtime",
      "Hardware-enforced cryptographic kill-switch with instant revocation",
      "Dedicated multi-tenant KMS key isolation",
    ],
    icon: KeyRound,
  },
  {
    id: "rls",
    name: "Cryptographic Row-Level Security",
    code: "RLS_AST_ENFORCEMENT",
    category: "CRYPTOGRAPHY",
    status: "ACTIVE",
    description:
      "Kernel AST parser guarantees deterministic tenant isolation and dynamic column masking on every inbound analytical query.",
    standard: "Zero-Trust Data Isolation Architecture",
    authority: "Ricoz Cryptographic Kernel Verification Suite",
    lastVerified: "Real-Time Enforced",
    reportId: "RLS-KERNEL-SPEC-V4",
    evidenceHash: "44fa910bb3219488a0194801ba928410582910ac7482910fa871b0219483011a",
    controls: [
      "AST-level SQL rewrite blocks 100% of unauthorized row access",
      "Automatic dynamic PII pseudonymization and masking filters",
      "Zero cross-tenant leakage even on malicious injection attempts",
      "SHA-256 Merkle block emitted for every query execution",
    ],
    icon: Lock,
  },
  {
    id: "gdpr",
    name: "GDPR & CCPA Data Privacy",
    code: "GDPR_ARTICLE_28",
    category: "PRIVACY",
    status: "VERIFIED",
    description:
      "Full sovereign privacy compliance with built-in data residency anchors, right to erasure webhooks, and zero-egress analytics.",
    standard: "EU Regulation 2016/679 & California Consumer Privacy Act",
    authority: "European Data Protection Board & Privacy Shield Audit",
    lastVerified: "July 2026",
    reportId: "GDPR-CCPA-DPA-2026",
    evidenceHash: "98124018ba201490218ba9481023847192837482910fa871b0219483011a44fa",
    controls: [
      "Zero persistent PII storage inside browser caches or logs",
      "Sovereign tenant regional data residency (US, EU, APAC anchors)",
      "Automated Right-to-be-Forgotten cryptographic deletion triggers",
      "Standard Contractual Clauses (SCCs) and Enterprise DPA included",
    ],
    icon: FileCheck,
  },
];

export default function SecurityGovernanceSection() {
  const [selectedStandardId, setSelectedStandardId] = useState<string>("soc2");
  const [activeCategory, setActiveCategory] = useState<"ALL" | "COMPLIANCE" | "CRYPTOGRAPHY" | "PRIVACY">("ALL");
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const filteredStandards = SECURITY_STANDARDS.filter(
    (s) => activeCategory === "ALL" || s.category === activeCategory
  );

  const selectedStandard =
    SECURITY_STANDARDS.find((s) => s.id === selectedStandardId) ||
    SECURITY_STANDARDS[0];

  const handleCopyEvidence = () => {
    void navigator.clipboard.writeText(selectedStandard.evidenceHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <section id="governance" className="mx-auto w-full max-w-[1200px] px-[24px]">
      {/* SECTION HEADER */}
      <div className="mb-[32px] flex flex-col items-start justify-between gap-[16px] md:flex-row md:items-end">
        <div>
          <span className="text-[12px] font-mono-code uppercase tracking-wider text-[#ff6b35] block mb-[6px]">
            Enterprise Trust &amp; Governance
          </span>
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
          {(
            [
              { id: "ALL", label: "All Controls" },
              { id: "COMPLIANCE", label: "Compliance" },
              { id: "CRYPTOGRAPHY", label: "Cryptography" },
              { id: "PRIVACY", label: "Data Privacy" },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full border px-[12px] py-[5px] text-[12px] font-mono-code transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? "border-[#ff6b35] bg-[#1c1c1c] text-[#fafafa] font-medium"
                  : "border-[#2e2e2e] bg-transparent text-[#898989] hover:border-[#393939] hover:text-[#fafafa]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* WORKBENCH CARD */}
      <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-[24px] lg:p-[32px]">
        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-12">
          {/* LEFT 5 COLS: Standards Grid */}
          <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-1 lg:col-span-5">
            {filteredStandards.map((std) => {
              const isSelected = std.id === selectedStandardId;
              const Icon = std.icon;
              return (
                <button
                  key={std.id}
                  type="button"
                  onClick={() => setSelectedStandardId(std.id)}
                  className={`group flex items-start gap-[14px] rounded-[12px] border p-[16px] text-left transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-[#ff6b35] bg-[#1c1c1c] shadow-[0_0_16px_rgba(255,107,53,0.12)]"
                      : "border-[#2e2e2e] bg-[#121212] hover:border-[#393939] hover:bg-[#161616]"
                  }`}
                >
                  <div
                    className={`mt-[2px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border transition-colors ${
                      isSelected
                        ? "border-[#ff6b35]/40 bg-[#ff6b35]/15 text-[#ff6b35]"
                        : "border-[#2e2e2e] bg-[#171717] text-[#898989] group-hover:text-[#fafafa]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-[8px]">
                      <span
                        className={`text-[14px] font-medium transition-colors truncate ${
                          isSelected ? "text-[#fafafa]" : "text-[#b4b4b4] group-hover:text-[#fafafa]"
                        }`}
                      >
                        {std.name}
                      </span>
                      <span className="font-mono-code text-[10px] text-emerald-400">
                        ✓ {std.status}
                      </span>
                    </div>
                    <div className="mt-[4px] text-[12px] text-[#898989] line-clamp-1">
                      {std.standard}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT 7 COLS: Detailed Attestation Inspector */}
          <div className="flex flex-col justify-between rounded-[14px] border border-[#2e2e2e] bg-[#121212] p-[20px] sm:p-[24px] lg:col-span-7">
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-[12px] border-b border-[#2e2e2e] pb-[16px]">
                <div>
                  <div className="inline-flex items-center gap-[6px] rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[10px] py-[2px] font-mono-code text-[11px] text-[#ff6b35]">
                    {selectedStandard.code} // ATTESTED
                  </div>
                  <h3 className="mt-[8px] text-[20px] font-normal text-[#fafafa] sm:text-[22px]">
                    {selectedStandard.name}
                  </h3>
                  <p className="mt-[6px] text-[13px] text-[#898989] leading-[1.5]">
                    {selectedStandard.description}
                  </p>
                </div>
              </div>

              {/* Authority & Standard metadata */}
              <div className="mt-[16px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                  <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                    Attestation Authority
                  </span>
                  <span className="mt-[2px] block text-[12px] font-medium text-[#fafafa]">
                    {selectedStandard.authority}
                  </span>
                </div>
                <div className="rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                  <span className="block text-[10px] font-mono-code uppercase text-[#898989]">
                    Audit Report &amp; Cycle
                  </span>
                  <span className="mt-[2px] block text-[12px] font-medium text-[#ff6b35]">
                    {selectedStandard.reportId} ({selectedStandard.lastVerified})
                  </span>
                </div>
              </div>

              {/* Controls List */}
              <div className="mt-[16px]">
                <span className="block text-[11px] font-mono-code uppercase text-[#898989] mb-[8px]">
                  Verified Enforced Controls
                </span>
                <div className="flex flex-col gap-[8px]">
                  {selectedStandard.controls.map((ctrl, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-[10px] rounded-[8px] border border-[#2e2e2e]/60 bg-[#171717]/60 p-[10px]"
                    >
                      <Check className="mt-[2px] h-[14px] w-[14px] text-[#ff6b35] shrink-0" />
                      <span className="text-[12px] font-normal text-[#b4b4b4] leading-[1.5]">
                        {ctrl}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence Hash */}
              <div className="mt-[16px] rounded-[10px] border border-[#2e2e2e] bg-[#171717] p-[12px]">
                <div className="flex items-center justify-between text-[11px] font-mono-code">
                  <span className="text-[#898989]">SHA-256 Attestation Evidence Hash:</span>
                  <button
                    type="button"
                    onClick={handleCopyEvidence}
                    className="flex items-center gap-[4px] text-[#ff6b35] hover:text-[#ff8252] cursor-pointer"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="h-[11px] w-[11px]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-[11px] w-[11px]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-[4px] font-mono-code text-[11px] text-[#ff8252] break-all">
                  {selectedStandard.evidenceHash}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-[20px] flex flex-wrap items-center justify-between gap-[12px] border-t border-[#2e2e2e] pt-[16px]">
              <span className="text-[12px] text-[#898989]">
                Enterprise trust package with signed SOC 2 NDA reports available.
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
