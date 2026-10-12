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
    <div className="min-h-screen bg-[#F4F1EA] text-[#172B3A] flex flex-col font-sans selection:bg-[#147D78] selection:text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-[#DADFD9] bg-[#F4F1EA]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size={28} />
              <span className="text-base font-heading font-bold text-[#172B3A] tracking-tight">RicozViz</span>
            </Link>
            <span className="text-[#DADFD9]">/</span>
            <span className="text-xs font-mono font-semibold text-[#147D78]">Architecture Whitepaper</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link href="/benchmarks" className="text-[#596775] hover:text-[#172B3A] transition">
              Benchmarks
            </Link>
            <Link href="/docs" className="text-[#596775] hover:text-[#172B3A] transition">
              Docs
            </Link>
            <Link href="/status" className="text-[#147D78] hover:text-[#106963] transition">
              Status
            </Link>
          </div>
        </div>
      </header>

      {/* Main Whitepaper Content */}
      <main className="flex-1 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 w-full space-y-12">
        {/* Document Header */}
        <div className="border-b border-[#DADFD9] pb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DADFD9] bg-white px-3 py-0.5 text-xs font-mono text-[#147D78] mb-6 shadow-xs">
            <span>RFC-2026-004 · Technical Architecture Specification</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-[#172B3A] tracking-tight leading-tight">
            The Zero-Latency Analytical Mesh: <br />
            Decoupling In-Memory OLAP from Database Exposure
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-[#596775]">
            <span>Authors: RicozViz Core Architecture Group</span>
            <span>·</span>
            <span>Published: October 2026</span>
            <span>·</span>
            <span className="text-[#147D78]">Revision: 2.4-Production</span>
          </div>
        </div>

        {/* Abstract */}
        <div className="p-6 rounded-xl border border-[#DADFD9] bg-white text-[#172B3A] text-xs sm:text-sm leading-relaxed space-y-2 shadow-xs">
          <span className="font-mono font-bold text-[#147D78] uppercase tracking-wider text-[11px] block">
            Abstract
          </span>
          <p className="text-[#596775]">
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
          <h2 className="text-xl font-heading font-bold text-[#172B3A] flex items-center gap-2">
            <span className="text-[#147D78] font-mono text-base">01.</span>
            The Zero Raw SQL Exposure Paradigm
          </h2>
          <p className="text-xs sm:text-sm text-[#596775] leading-relaxed">
            In traditional business intelligence tools, client dashboards construct and transmit arbitrary SQL
            queries to backend databases. This design exposes database schemas, opens attack vectors for SQL
            injection, and forces databases to parse, optimize, and lock tables for every visual interaction.
          </p>
          <p className="text-xs sm:text-sm text-[#596775] leading-relaxed">
            RicozViz eliminates raw SQL from the client tier completely. The user interacts exclusively with
            typed, declarative visual intent models (e.g. dimensions, metrics, time-grain, filters). These
            models are validated against cryptographic schemas and compiled into parameterized, sandboxed
            columnar execution plans.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-xl font-heading font-bold text-[#172B3A] flex items-center gap-2">
            <span className="text-[#147D78] font-mono text-base">02.</span>
            Dual-Engine Hybrid OLAP with DuckDB WASM
          </h2>
          <p className="text-xs sm:text-sm text-[#596775] leading-relaxed">
            Rather than routing every slice-and-dice interaction across the internet to a cloud warehouse,
            RicozViz streams optimized Apache Arrow Parquet chunks into a client-isolated WebAssembly instance
            of DuckDB.
          </p>
          <div className="p-4 rounded-xl border border-[#DADFD9] bg-white font-mono text-xs text-[#172B3A] space-y-2 shadow-xs">
            <div className="text-[#147D78] font-bold">Execution Characteristics:</div>
            <div className="text-[#596775]">• Vectorized columnar execution processing 1024-value SIMD vectors per cycle</div>
            <div className="text-[#596775]">• Zero-copy memory buffer sharing between Web Workers and WebGL renderers</div>
            <div className="text-[#596775]">• Sub-12ms aggregations across 10,000,000+ data points</div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-4">
          <h2 className="text-xl font-heading font-bold text-[#172B3A] flex items-center gap-2">
            <span className="text-[#147D78] font-mono text-base">03.</span>
            Cryptographic Row-Level Security (RLS)
          </h2>
          <p className="text-xs sm:text-sm text-[#596775] leading-relaxed">
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
