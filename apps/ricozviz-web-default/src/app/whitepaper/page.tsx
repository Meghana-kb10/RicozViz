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
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size={28} />
              <span className="text-base font-bold text-white tracking-tight">RicozViz</span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-xs font-mono font-semibold text-indigo-400">Architecture Whitepaper</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link href="/benchmarks" className="text-slate-400 hover:text-white transition">
              Benchmarks
            </Link>
            <Link href="/docs" className="text-slate-400 hover:text-white transition">
              Docs
            </Link>
            <Link href="/status" className="text-emerald-400 hover:text-emerald-300 transition">
              Status
            </Link>
          </div>
        </div>
      </header>

      {/* Main Whitepaper Content */}
      <main className="flex-1 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 w-full space-y-12">
        {/* Document Header */}
        <div className="border-b border-white/[0.08] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-0.5 text-xs font-mono text-indigo-300 mb-6">
            <span>RFC-2026-004 · Technical Architecture Specification</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            The Zero-Latency Analytical Mesh: <br />
            Decoupling In-Memory OLAP from Database Exposure
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <span>Authors: RicozViz Core Architecture Group</span>
            <span>·</span>
            <span>Published: October 2026</span>
            <span>·</span>
            <span className="text-emerald-400">Revision: 2.4-Production</span>
          </div>
        </div>

        {/* Abstract */}
        <div className="p-6 rounded-xl border border-indigo-500/30 bg-indigo-950/20 text-slate-300 text-xs sm:text-sm leading-relaxed space-y-2">
          <span className="font-mono font-bold text-indigo-300 uppercase tracking-wider text-[11px] block">
            Abstract
          </span>
          <p>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400 font-mono text-base">01.</span>
            The Zero Raw SQL Exposure Paradigm
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            In traditional business intelligence tools, client dashboards construct and transmit arbitrary SQL
            queries to backend databases. This design exposes database schemas, opens attack vectors for SQL
            injection, and forces databases to parse, optimize, and lock tables for every visual interaction.
          </p>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            RicozViz eliminates raw SQL from the client tier completely. The user interacts exclusively with
            typed, declarative visual intent models (e.g. dimensions, metrics, time-grain, filters). These
            models are validated against cryptographic schemas and compiled into parameterized, sandboxed
            columnar execution plans.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400 font-mono text-base">02.</span>
            Dual-Engine Hybrid OLAP with DuckDB WASM
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Rather than routing every slice-and-dice interaction across the internet to a cloud warehouse,
            RicozViz streams optimized Apache Arrow Parquet chunks into a client-isolated WebAssembly instance
            of DuckDB.
          </p>
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0F172A] font-mono text-xs text-slate-300 space-y-2">
            <div className="text-emerald-400 font-bold">Execution Characteristics:</div>
            <div>• Vectorized columnar execution processing 1024-value SIMD vectors per cycle</div>
            <div>• Zero-copy memory buffer sharing between Web Workers and WebGL renderers</div>
            <div>• Sub-12ms aggregations across 10,000,000+ data points</div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400 font-mono text-base">03.</span>
            Cryptographic Row-Level Security (RLS)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Multi-tenant data isolation is enforced through non-bypassable cryptographic row filters. Tenant
            identifiers and organization policies are signed using HMAC-SHA256 and embedded into JWT claims.
            Even if a client attempts to modify query parameters, the underlying Arrow data partition physically
            excludes records outside the user's cryptographic tenant boundary.
          </p>
        </section>
      </main>

      <TechnicalFooter />
    </div>
  );
}
