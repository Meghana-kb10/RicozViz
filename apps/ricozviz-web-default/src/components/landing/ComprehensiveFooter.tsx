"use client";

import React from "react";
import Link from "next/link";
import {
  Terminal,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Activity,
} from "lucide-react";

export default function ComprehensiveFooter() {
  return (
    <footer className="border-t border-[#2e2e2e] bg-[#121212] pt-[64px] pb-[40px]">
      <div className="mx-auto max-w-[1200px] px-[24px]">
        {/* TOP BRAND & NEWSLETTER / CLI QUICKSTART ROW */}
        <div className="mb-[48px] grid grid-cols-1 gap-[32px] pb-[40px] border-b border-[#2e2e2e] lg:grid-cols-12">
          <div className="flex flex-col gap-[14px] lg:col-span-5">
            <Link href="/" className="flex items-center gap-[10px]">
              <img className="size-6" src="images/logo.png" alt="RicozViz Logo" />
              <span className="text-[18px] font-medium tracking-[-0.02em] text-[#fafafa]">
                ricozviz
              </span>
              <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[8px] py-[1px] font-mono-code text-[10px] text-[#ff6b35]">
                Intelligence OS
              </span>
            </Link>
            <p className="max-w-[420px] text-[14px] leading-[1.6] text-[#898989]">
              In-memory DuckDB WebAssembly analytics, real-time Kafka event streaming,
              zero-copy Apache Arrow buffers, and hardware-grade cryptographic row-level security.
            </p>
            <div className="flex items-center gap-[10px] text-[12px] font-mono-code text-[#898989]">
              <span className="flex h-[8px] w-[8px] rounded-full bg-emerald-400" />
              <Link href="/status" className="text-emerald-400 hover:underline">
                All Systems Operational
              </Link>
              <span className="text-[#393939]">·</span>
              <span>99.99% Uptime</span>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-[14px] border border-[#2e2e2e] bg-[#171717] p-[20px] lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[12px] text-[#fafafa] flex items-center gap-[6px]">
                <Terminal className="h-[14px] w-[14px] text-[#ff6b35]" />
                Zero-Config Local CLI Workspace
              </span>
              <span className="font-mono-code text-[11px] text-[#898989]">v0.1.0</span>
            </div>
            <div className="mt-[10px] flex items-center justify-between rounded-[8px] border border-[#2e2e2e] bg-[#0d0d0d] px-[14px] py-[10px] font-mono-code text-[12px]">
              <span className="text-[#fafafa]">
                <span className="text-[#ff6b35]">$</span> npx @ricoz/viz init
              </span>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText("npx @ricoz/viz init")}
                className="text-[11px] text-[#898989] hover:text-[#fafafa] transition-colors cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* 4-COLUMN DETAILED DIRECTORY */}
        <div className="grid grid-cols-2 gap-[32px] sm:grid-cols-4 lg:grid-cols-4 pb-[48px]">
          {/* Column 1: Platform */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Platform
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <a href="#products" className="hover:text-[#fafafa] transition-colors">
                DuckDB Wasm OLAP
              </a>
              <a href="#piece-workbench" className="hover:text-[#fafafa] transition-colors">
                Multi-Canvas Workbench
              </a>
              <a href="#workflow" className="hover:text-[#fafafa] transition-colors">
                Data Pipeline &amp; Vectorizer
              </a>
              <a href="#topology" className="hover:text-[#fafafa] transition-colors">
                Infrastructure Topology
              </a>
              <a href="#audit-trail" className="hover:text-[#fafafa] transition-colors">
                Audit Trail &amp; Kill-Switch
              </a>
              <a href="#governance" className="hover:text-[#fafafa] transition-colors">
                Cryptographic Governance
              </a>
            </div>
          </div>

          {/* Column 2: Connectors */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Connectors
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Snowflake Flight SQL
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                ClickHouse Columnar
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Google BigQuery Storage
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Databricks Delta Lake
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Amazon S3 Parquet
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Apache Kafka Streaming
              </a>
            </div>
          </div>

          {/* Column 3: Developers */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Developers
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <Link href="/docs" className="hover:text-[#fafafa] transition-colors">
                Documentation
              </Link>
              <Link href="/benchmarks" className="hover:text-[#fafafa] transition-colors">
                DuckDB Benchmarks
              </Link>
              <Link href="/status" className="hover:text-[#fafafa] transition-colors">
                System Status
              </Link>
              <Link href="/whitepaper" className="hover:text-[#fafafa] transition-colors">
                Security Whitepaper
              </Link>
              <Link href="/openapi" className="hover:text-[#fafafa] transition-colors">
                OpenAPI Specification
              </Link>
            </div>
          </div>

          {/* Column 4: Account & Enterprise */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Workspace
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <Link href="/login" className="text-[#fafafa] hover:text-[#ff6b35] transition-colors font-medium">
                Sign In to Workspace →
              </Link>
              <Link href="/register" className="text-[#ff6b35] hover:text-[#ff8252] transition-colors font-medium">
                Launch Free Project →
              </Link>
              <a href="#provision" className="hover:text-[#fafafa] transition-colors">
                Request Enterprise Demo
              </a>
              <a href="#governance" className="hover:text-[#fafafa] transition-colors">
                SOC 2 Attestation
              </a>
              <a href="#governance" className="hover:text-[#fafafa] transition-colors">
                HIPAA BAA Agreement
              </a>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: COPYRIGHT & METADATA */}
        <div className="flex flex-col items-start justify-between gap-[16px] border-t border-[#2e2e2e] pt-[24px] sm:flex-row sm:items-center text-[12px] text-[#898989]">
          <div className="flex items-center gap-[6px]">
            <span>© {new Date().getFullYear()} RicozViz Inc.</span>
            <span>All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-[20px]">
            <Link href="/docs" className="hover:text-[#fafafa] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/docs" className="hover:text-[#fafafa] transition-colors">
              Terms of Service
            </Link>
            <Link href="/whitepaper" className="hover:text-[#fafafa] transition-colors">
              Security Architecture
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
