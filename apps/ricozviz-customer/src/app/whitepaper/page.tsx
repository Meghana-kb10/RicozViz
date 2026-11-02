"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Shield,
  Layers,
  Lock,
  Zap,
  ArrowRight,
  Database,
  Terminal,
  Download,
} from "lucide-react";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { TechnicalFooter } from "@/components/shell/TechnicalFooter";

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#121212] text-[#fafafa] flex flex-col font-sans selection:bg-[#ff6b35] selection:text-white antialiased">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[#242424] bg-[#121212]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size={28} />
              <span className="text-base font-bold text-[#fafafa] tracking-tight">RicozViz</span>
            </Link>
            <span className="text-[#333333]">/</span>
            <span className="text-xs font-mono-code font-semibold text-[#ff6b35]">Architecture Whitepaper</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code">
            <Link href="/benchmarks" className="text-[#898989] hover:text-[#fafafa] transition">
              Benchmarks
            </Link>
            <Link href="/docs" className="text-[#898989] hover:text-[#fafafa] transition">
              Docs
            </Link>
            <Link href="/status" className="text-[#ff6b35] hover:text-[#c2410c] transition">
              Status
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg bg-[#ff6b35] hover:bg-[#c2410c] px-3 py-1.5 text-white font-medium transition cursor-pointer"
            >
              Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Main Whitepaper Content */}
      <main className="flex-1 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 w-full space-y-12">
        {/* Document Header */}
        <div className="border-b border-[#242424] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-3 py-0.5 text-xs font-mono-code text-[#ff6b35] mb-6">
            <span>RFC-2026-004 · Technical Architecture Specification</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#fafafa] tracking-tight leading-tight">
            The Zero-Latency Analytical Mesh: <br />
            Decoupling In-Memory OLAP from Database Exposure
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono-code text-[#898989]">
            <span>Authors: RicozViz Core Architecture Group</span>
            <span>·</span>
            <span>Published: October 2026</span>
            <span>·</span>
            <span className="text-[#ff6b35]">Revision: 2.4-Production</span>
          </div>
        </div>

        {/* Abstract */}
        <div className="p-6 rounded-2xl border border-[#242424] bg-[#141414] text-[#fafafa] text-xs sm:text-sm leading-relaxed space-y-2 shadow-xl">
          <span className="font-mono-code font-bold text-[#ff6b35] uppercase tracking-wider text-[11px] block">
            Abstract
          </span>
          <p className="text-[#898989]">
            Modern enterprise analytics architectures suffer from two fundamental bottlenecks: high-latency
            network round-trips for repetitive aggregation queries, and catastrophic security vulnerabilities
            arising from raw SQL strings exposed to client applications. RicozViz introduces an in-memory
            analytical mesh combining browser-native DuckDB WASM, zero-copy Apache Arrow serialization, and
            cryptographic Row-Level Security (RLS) tokens. This architecture delivers sub-12ms query execution
            while eliminating raw SQL exposure entirely.
          </p>
        </div>

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <span className="text-[#ff6b35] font-mono-code text-base">01.</span>
            <span>The Zero Raw SQL Exposure Paradigm</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#898989] leading-relaxed">
            In traditional business intelligence tools, client dashboards construct and transmit arbitrary SQL
            queries to backend databases. This design exposes database schemas, opens attack vectors for SQL
            injection, and forces databases to parse, optimize, and lock tables for every visual interaction.
          </p>
          <p className="text-xs sm:text-sm text-[#898989] leading-relaxed">
            RicozViz eliminates raw SQL from the client tier completely. The user interacts exclusively with
            typed, declarative visual intent models (e.g. dimensions, metrics, time-grain, filters). These
            models are validated against cryptographic schemas and compiled into parameterized, sandboxed
            columnar execution plans.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <span className="text-[#ff6b35] font-mono-code text-base">02.</span>
            <span>Dual-Engine Hybrid OLAP with DuckDB WASM</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#898989] leading-relaxed">
            Rather than routing every slice-and-dice interaction across the internet to a cloud warehouse,
            RicozViz streams optimized Apache Arrow Parquet chunks into a client-isolated WebAssembly instance
            of DuckDB.
          </p>
          <div className="p-4 rounded-xl border border-[#262626] bg-[#181818] font-mono-code text-xs text-[#fafafa] space-y-2 shadow-sm">
            <div className="text-[#ff6b35] font-bold">Execution Characteristics:</div>
            <div className="text-[#898989]">• Vectorized columnar execution processing 1024-value SIMD vectors per cycle</div>
            <div className="text-[#898989]">• Zero-copy memory buffer sharing between Web Workers and WebGL renderers</div>
            <div className="text-[#898989]">• Sub-12ms aggregations across 10,000,000+ data points</div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <span className="text-[#ff6b35] font-mono-code text-base">03.</span>
            <span>Cryptographic Row-Level Security (RLS)</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#898989] leading-relaxed">
            Multi-tenant data isolation is enforced through non-bypassable cryptographic row filters. Tenant
            identifiers and organization policies are signed using HMAC-SHA256 and embedded into JWT claims.
            Even if a client attempts to modify query parameters, the underlying Arrow data partition physically
            excludes records outside the user&apos;s cryptographic tenant boundary.
          </p>
        </section>
      </main>

      <TechnicalFooter />
    </div>
  );
}
