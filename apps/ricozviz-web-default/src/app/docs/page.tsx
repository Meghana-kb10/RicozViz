"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Terminal,
  Shield,
  Layers,
  Zap,
  ArrowRight,
  ExternalLink,
  Code,
  CheckCircle2,
  Lock,
  Database,
} from "lucide-react";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { TechnicalFooter } from "@/components/shell/TechnicalFooter";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<"curl" | "typescript">("curl");

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size={28} />
              <span className="text-base font-bold text-white tracking-tight">RicozViz</span>
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-xs font-mono font-semibold text-indigo-400">Documentation</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link href="/openapi" className="text-slate-400 hover:text-white transition">
              OpenAPI Specs
            </Link>
            <Link href="/benchmarks" className="text-slate-400 hover:text-white transition">
              Benchmarks
            </Link>
            <Link href="/status" className="text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Status
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-white font-semibold transition"
            >
              Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Sidebar Nav */}
          <aside className="space-y-6 text-xs font-mono">
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Getting Started</h4>
              <ul className="space-y-1.5 text-slate-300">
                <li className="text-indigo-400 font-semibold">Architecture Overview</li>
                <li className="hover:text-white cursor-pointer transition">Quickstart Guide</li>
                <li className="hover:text-white cursor-pointer transition">Client SDK Setup</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">API Reference</h4>
              <ul className="space-y-1.5 text-slate-300">
                <li className="hover:text-white cursor-pointer transition">Authentication & JWT</li>
                <li className="hover:text-white cursor-pointer transition">Datasets & Ingestion</li>
                <li className="hover:text-white cursor-pointer transition">Dashboards & Charts</li>
                <li className="hover:text-white cursor-pointer transition">Embedding & Token Revocation</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Security & Governance</h4>
              <ul className="space-y-1.5 text-slate-300">
                <li className="hover:text-white cursor-pointer transition">Sanitized Error Payloads</li>
                <li className="hover:text-white cursor-pointer transition">Row-Level Security (RLS)</li>
                <li className="hover:text-white cursor-pointer transition">Zero Raw SQL Exposure</li>
              </ul>
            </div>
          </aside>

          {/* Doc Body */}
          <div className="lg:col-span-3 space-y-10">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-0.5 text-xs font-mono text-indigo-300 mb-4">
                <span>RicozViz Engine Documentation · v1.0.0</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Developer Documentation & Architecture Guide
              </h1>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                Learn how RicozViz leverages in-memory DuckDB WASM, Fastify REST APIs, and cryptographic
                Row-Level Security to deliver sub-12ms analytical queries without raw SQL exposure.
              </p>
            </div>

            {/* Architecture Card */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-400" />
                In-Memory OLAP & Fastify Pipeline
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                RicozViz decouples transactional storage from low-latency analytical rendering. Queries are compiled
                into columnar execution plans and evaluated directly inside in-memory DuckDB instances with zero-copy
                Apache Arrow buffers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">THROUGHPUT</span>
                  <span className="text-emerald-400 font-bold text-sm">100k+ rps</span>
                </div>
                <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">AVG LATENCY</span>
                  <span className="text-cyan-400 font-bold text-sm">&lt;12ms</span>
                </div>
                <div className="p-3 rounded-lg bg-[#131B2E] border border-white/[0.06]">
                  <span className="text-slate-400 block text-[10px]">ISOLATION</span>
                  <span className="text-indigo-400 font-bold text-sm">Tenant RLS</span>
                </div>
              </div>
            </div>

            {/* Interactive Code Sample */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-[#131B2E]">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <span>Execute Aggregation Query</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setActiveTab("curl")}
                    className={`px-2.5 py-1 rounded transition ${
                      activeTab === "curl"
                        ? "bg-indigo-600 text-white font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setActiveTab("typescript")}
                    className={`px-2.5 py-1 rounded transition ${
                      activeTab === "typescript"
                        ? "bg-indigo-600 text-white font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    TypeScript SDK
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#090D16] font-mono text-xs text-slate-300 overflow-x-auto">
                {activeTab === "curl" ? (
                  <pre>{`curl -X POST http://localhost:4000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@example.com", "password": "Password123!"}'

# Authenticated analytical query with tenant isolation:
curl -X GET http://localhost:4000/api/v1/dashboards \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`}</pre>
                ) : (
                  <pre>{`import { apiLogin, apiListDashboards } from '@repo/api';

// Authenticate session:
const auth = await apiLogin({
  email: 'admin@example.com',
  password: 'Password123!'
});

// Retrieve governed dashboards:
const dashboards = await apiListDashboards();
console.log('Dashboards:', dashboards);`}</pre>
                )}
              </div>
            </div>

            {/* Security Section */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                Sanitized Error Payloads & Security RFC
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                All Fastify endpoints enforce strict error payload sanitization. System file paths, MongoDB/PostgreSQL
                connection strings, JWT signatures, and database URIs are automatically intercepted and redacted before
                reaching the client:
              </p>
              <div className="p-3 rounded-lg bg-[#090D16] border border-white/[0.06] font-mono text-[11px] text-slate-400">
                <code>{`{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "Failed connecting to [REDACTED_URI]" } }`}</code>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TechnicalFooter />
    </div>
  );
}
