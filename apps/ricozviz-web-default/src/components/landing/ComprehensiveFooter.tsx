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
              <img className="size-6 rounded-md object-contain" src="/images/logo.png" alt="RicozViz Logo" />
              <span className="text-[18px] font-medium tracking-[-0.02em] text-[#fafafa]">
                ricozviz
              </span>
              <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-[8px] py-[1px] font-mono-code text-[10px] text-[#ff6b35]">
                Intelligence OS
              </span>
            </Link>
            <p className="max-w-[420px] text-[14px] leading-[1.6] text-[#898989]">
              Universal SQL pushdown and cloud warehouse connectors, Natural Language to Chart AI,
              10+ interactive Recharts visualizations, and secure expiring embeds.
            </p>
            <div className="flex flex-wrap items-center gap-[10px] text-[12px] font-mono-code text-[#898989]">
              <span className="flex h-[8px] w-[8px] rounded-full bg-emerald-400 shrink-0" />
              <Link href="/status" className="text-emerald-400 hover:underline">
                All Systems Operational
              </Link>
              <span className="text-[#393939]">·</span>
              <span>99.99% Uptime</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[14px] border border-[#2e2e2e] bg-[#171717] p-[20px] lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-medium text-[#fafafa]">
                Ready to build interactive dashboards?
              </span>
              <span className="font-mono-code text-[11px] text-emerald-400 shrink-0 whitespace-nowrap">✓ Instant Setup</span>
            </div>
            <p className="mt-[6px] text-[13px] text-[#898989]">
              Connect your databases in seconds, synthesize charts with AI, and embed governed canvases.
            </p>
            <div className="mt-[14px] flex items-center gap-[10px]">
              <Link
                href="/register"
                className="rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-[16px] py-[6px] text-[12px] font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c]"
              >
                Launch Free Workspace →
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#393939] bg-[#121212] px-[14px] py-[6px] text-[12px] text-[#b4b4b4] hover:text-[#fafafa] transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* 4-COLUMN DETAILED DIRECTORY */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-[32px] sm:grid-cols-4 lg:grid-cols-4 pb-[48px]">
          {/* Column 1: Platform */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Platform
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <a href="#products" className="hover:text-[#fafafa] transition-colors">
                Universal Data Engine
              </a>
              <a href="#piece-workbench" className="hover:text-[#fafafa] transition-colors">
                Interactive Studio
              </a>
              <a href="#capabilities" className="hover:text-[#fafafa] transition-colors">
                Platform Capabilities
              </a>
              <a href="#workflow" className="hover:text-[#fafafa] transition-colors">
                Analytics Pipeline
              </a>
              <Link href="/benchmarks" className="hover:text-[#fafafa] transition-colors">
                DuckDB Benchmarks
              </Link>
            </div>
          </div>

          {/* Column 2: Connectors */}
          <div className="flex flex-col gap-[12px]">
            <span className="font-mono-code text-[11px] uppercase tracking-wider text-[#fafafa]">
              Connectors
            </span>
            <div className="flex flex-col gap-[9px] text-[13px] text-[#898989]">
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                PostgreSQL &amp; MySQL
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Snowflake Cloud SQL
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                ClickHouse Direct TCP
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                Google BigQuery Storage
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                SQLite &amp; File DBs
              </a>
              <a href="#connectors" className="hover:text-[#fafafa] transition-colors">
                REST API &amp; Spreadsheets
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
              <Link href="/data-quality" className="hover:text-[#fafafa] transition-colors">
                Data Quality Profiler
              </Link>
              <Link href="/status" className="hover:text-[#fafafa] transition-colors">
                System Status
              </Link>
              <Link href="/docs" className="hover:text-[#fafafa] transition-colors">
                API Reference
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
              <Link href="/dashboards" className="hover:text-[#fafafa] transition-colors">
                Dashboard Studio
              </Link>
              <Link href="/data-sources" className="hover:text-[#fafafa] transition-colors">
                Data Source Manager
              </Link>
              <Link href="/alerts" className="hover:text-[#fafafa] transition-colors">
                Threshold Alerts
              </Link>
              <Link href="/audit" className="hover:text-[#fafafa] transition-colors">
                Activity Audit Ledger
              </Link>
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
