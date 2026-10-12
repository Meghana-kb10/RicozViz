"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  BarChart3,
  BookOpen,
  FileCode,
  Activity,
  Shield,
  Zap,
  ArrowRight,
  Database,
  Terminal,
  ExternalLink,
  Layers,
  Lock,
} from "lucide-react";
import { BrandLogo } from "@/components/shell/BrandLogo";

export function TechnicalFooter() {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#06090E] text-slate-400 overflow-hidden">
      {/* Precision Technical Grid Backlight */}
      <div className="absolute inset-0 haikei-tech-grid opacity-15 pointer-events-none" />

      {/* Top Accent Gradient Line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/50 via-emerald-500/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 z-10">
        {/* Main Multi-Column Technical Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-14 border-b border-white/[0.07]">
          {/* Brand & Architecture Summary (Column 1 - Spans on Mobile/Tablet) */}
          <div className="lg:col-span-2 space-y-4 pr-0 lg:pr-6">
            <div className="flex items-center gap-2.5">
              <BrandLogo size={28} />
              <span className="text-base font-bold text-white tracking-tight">
                RicozViz
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-950/60 text-indigo-300">
                INTELLIGENCE OS
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              The high-performance, developer-first intelligence engine powered by
              in-memory DuckDB WASM, Arrow zero-copy serialization, cryptographic
              row-level security, and collaborative analytics.
            </p>

            {/* Live Telemetry Status Pill */}
            <div className="pt-2">
              <Link
                href="/status"
                className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0F172A]/90 hover:border-emerald-500/40 px-3 py-1.5 text-xs text-slate-300 transition group"
              >
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">System Operational</span>
                <span className="text-[10px] font-mono text-emerald-400/90 ml-1">
                  99.99% Uptime
                </span>
                <ArrowRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {/* In-Memory Engine Specs */}
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded">
                <Database className="h-2.5 w-2.5 text-cyan-400" />
                DuckDB v1.1 WASM
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded">
                <Zap className="h-2.5 w-2.5 text-amber-400" />
                Sub-12ms Aggregation
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-900 border border-white/[0.06] px-2 py-0.5 rounded">
                <Lock className="h-2.5 w-2.5 text-emerald-400" />
                Cryptographic RLS
              </span>
            </div>
          </div>

          {/* Column 2: Architecture & Engine */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              Architecture
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/whitepaper"
                  className="hover:text-white transition flex items-center justify-between group"
                >
                  <span className="group-hover:translate-x-0.5 transition">
                    Architecture Whitepaper
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
                    CORE RFC
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/benchmarks"
                  className="hover:text-white transition flex items-center justify-between group"
                >
                  <span className="group-hover:translate-x-0.5 transition">
                    DuckDB WASM Benchmarks
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                    &lt;12ms
                  </span>
                </Link>
              </li>
              <li>
                <a
                  href="#pipeline"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Zero-Copy Arrow Pipeline
                </a>
              </li>
              <li>
                <a
                  href="#governance"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Multi-Tenant Cryptographic RLS
                </a>
              </li>
              <li>
                <a
                  href="#collaboration"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  SSE Multiplayer Protocol
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Developers & API */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              Developers & API
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/docs"
                  className="hover:text-white transition flex items-center justify-between group"
                >
                  <span className="group-hover:translate-x-0.5 transition">
                    Documentation
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                    GUIDES
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/openapi"
                  className="hover:text-white transition flex items-center justify-between group"
                >
                  <span className="group-hover:translate-x-0.5 transition">
                    OpenAPI Specs
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
                    v3.1
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="hover:text-white transition flex items-center justify-between group"
                >
                  <span className="group-hover:translate-x-0.5 transition">
                    Status Page
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                    LIVE
                  </span>
                </Link>
              </li>
              <li>
                <span className="text-slate-500 cursor-default block">
                  Sanitized Payloads RFC
                </span>
              </li>
              <li>
                <span className="text-slate-500 cursor-default block">
                  TypeScript SDK (@repo/api)
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Platform Views & Governance */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              Platform & Governance
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/visualizations"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Visualizations Studio
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboards"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Interactive Dashboards
                </Link>
              </li>
              <li>
                <Link
                  href="/datasets"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Datasets & Data Studio
                </Link>
              </li>
              <li>
                <Link
                  href="/workspace"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Workspaces & Teams
                </Link>
              </li>
              <li>
                <Link
                  href="/settings"
                  className="hover:text-white transition block hover:translate-x-0.5 duration-150"
                >
                  Appearance & Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Metadata */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span>© 2026 RicozViz Intelligence OS. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-5 text-slate-400">
            <Link href="/whitepaper" className="hover:text-white transition">
              Whitepaper
            </Link>
            <span>·</span>
            <Link href="/benchmarks" className="hover:text-white transition">
              Benchmarks
            </Link>
            <span>·</span>
            <Link href="/openapi" className="hover:text-white transition">
              OpenAPI
            </Link>
            <span>·</span>
            <Link href="/docs" className="hover:text-white transition">
              Docs
            </Link>
            <span>·</span>
            <Link href="/status" className="hover:text-emerald-400 transition">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
