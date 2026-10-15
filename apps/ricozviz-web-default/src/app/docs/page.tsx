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
    <div className="min-h-screen bg-[#F4F1EA] text-[#172B3A] flex flex-col font-sans selection:bg-[#147D78] selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#DADFD9] bg-[#F4F1EA]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
              <BrandLogo size={28} />
              <span className="text-base font-heading font-bold text-[#172B3A] tracking-tight">RicozViz</span>
            </Link>
            <span className="text-[#DADFD9]">/</span>
            <span className="text-xs font-mono font-semibold text-[#147D78]">Documentation</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link href="/openapi" className="text-[#596775] hover:text-[#172B3A] transition">
              OpenAPI Specs
            </Link>
            <Link href="/benchmarks" className="text-[#596775] hover:text-[#172B3A] transition">
              Benchmarks
            </Link>
            <Link href="/status" className="text-[#147D78] hover:text-[#106963] transition flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#147D78]" />
              API Status
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg bg-[#147D78] hover:bg-[#106963] px-3 py-1.5 text-white font-medium transition shadow-xs"
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
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#596775] mb-2">Getting Started</h4>
              <ul className="space-y-1.5 text-[#596775]">
                <li className="text-[#147D78] font-semibold">Architecture Overview</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Quickstart Guide</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Client SDK Setup</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#596775] mb-2">API Reference</h4>
              <ul className="space-y-1.5 text-[#596775]">
                <li className="hover:text-[#172B3A] cursor-pointer transition">Authentication & JWT</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Datasets & Ingestion</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Dashboards & Charts</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Embedding & Token Revocation</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#596775] mb-2">Security & Governance</h4>
              <ul className="space-y-1.5 text-[#596775]">
                <li className="hover:text-[#172B3A] cursor-pointer transition">Sanitized Error Payloads</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Row-Level Security (RLS)</li>
                <li className="hover:text-[#172B3A] cursor-pointer transition">Zero Raw SQL Exposure</li>
              </ul>
            </div>
          </aside>

          {/* Doc Body */}
          <div className="lg:col-span-3 space-y-10">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DADFD9] bg-white px-3 py-0.5 text-xs font-mono text-[#147D78] mb-4 shadow-xs">
                <span>RicozViz Engine Documentation · v1.0.0</span>
              </div>
              <h1 className="text-3xl font-heading font-bold text-[#172B3A] tracking-tight">
                Developer Documentation & Architecture Guide
              </h1>
              <p className="mt-3 text-sm text-[#596775] leading-relaxed">
                Learn how RicozViz leverages in-memory DuckDB WASM, Fastify REST APIs, and cryptographic
                Row-Level Security to deliver sub-12ms analytical queries without raw SQL exposure.
              </p>
            </div>

            {/* Architecture Card */}
            <div className="rounded-xl border border-[#DADFD9] bg-white p-6 space-y-4 shadow-xs">
              <h2 className="text-lg font-heading font-bold text-[#172B3A] flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#147D78]" />
                In-Memory OLAP & Fastify Pipeline
              </h2>
              <p className="text-xs text-[#596775] leading-relaxed">
                RicozViz decouples transactional storage from low-latency analytical rendering. Queries are compiled
                into columnar execution plans and evaluated directly inside in-memory DuckDB instances with zero-copy
                Apache Arrow buffers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[#F4F1EA] border border-[#DADFD9]">
                  <span className="text-[#596775] block text-[10px]">THROUGHPUT</span>
                  <span className="text-[#147D78] font-bold text-sm">100k+ rps</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F1EA] border border-[#DADFD9]">
                  <span className="text-[#596775] block text-[10px]">AVG LATENCY</span>
                  <span className="text-[#147D78] font-bold text-sm">&lt;12ms</span>
                </div>
                <div className="p-3 rounded-lg bg-[#F4F1EA] border border-[#DADFD9]">
                  <span className="text-[#596775] block text-[10px]">ISOLATION</span>
                  <span className="text-[#147D78] font-bold text-sm">Tenant RLS</span>
                </div>
              </div>
            </div>

            {/* Interactive Code Sample */}
            <div className="rounded-xl border border-[#374151] bg-[#111827] overflow-hidden shadow-lg">
              <div className="flex items-center justify-between border-b border-[#374151] px-4 py-3 bg-[#1F2937]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#E5E7EB]">
                  <Terminal className="h-4 w-4 text-[#4F9D8E]" />
                  <span>Execute Aggregation Query</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setActiveTab("curl")}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      activeTab === "curl"
                        ? "bg-[#147D78] text-white font-medium"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setActiveTab("typescript")}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      activeTab === "typescript"
                        ? "bg-[#147D78] text-white font-medium"
                        : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                    }`}
                  >
                    TypeScript SDK
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#111827] font-mono text-xs text-[#E5E7EB] overflow-x-auto">
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
            <div className="rounded-xl border border-[#DADFD9] bg-white p-6 space-y-4 shadow-xs">
              <h2 className="text-lg font-heading font-bold text-[#172B3A] flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#147D78]" />
                Sanitized Error Payloads & Security RFC
              </h2>
              <p className="text-xs text-[#596775] leading-relaxed">
                All Fastify endpoints enforce strict error payload sanitization. System file paths, MongoDB/PostgreSQL
                connection strings, JWT signatures, and database URIs are automatically intercepted and redacted before
                reaching the client:
              </p>
              <div className="p-3 rounded-lg bg-[#111827] border border-[#374151] font-mono text-[11px] text-[#4F9D8E]">
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
