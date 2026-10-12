"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileCode,
  Download,
  Terminal,
  Shield,
  Layers,
  CheckCircle2,
  Lock,
  ArrowRight,
  Database,
} from "lucide-react";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { TechnicalFooter } from "@/components/shell/TechnicalFooter";

interface EndpointDoc {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  summary: string;
  tag: string;
  authRequired: boolean;
}

const ENDPOINTS: EndpointDoc[] = [
  { method: "POST", path: "/api/v1/auth/login", summary: "Authenticate with email and password", tag: "Auth", authRequired: false },
  { method: "POST", path: "/api/v1/auth/register", summary: "Register new organization and root user", tag: "Auth", authRequired: false },
  { method: "GET", path: "/api/v1/auth/me", summary: "Retrieve active authenticated session", tag: "Auth", authRequired: true },
  { method: "POST", path: "/api/v1/auth/refresh", summary: "Refresh access token using HttpOnly cookie", tag: "Auth", authRequired: false },
  { method: "POST", path: "/api/v1/auth/logout", summary: "Invalidate refresh cookie and session", tag: "Auth", authRequired: true },
  { method: "GET", path: "/api/v1/workspaces", summary: "List accessible tenant workspaces", tag: "Workspaces", authRequired: true },
  { method: "POST", path: "/api/v1/workspaces", summary: "Create new isolated analytics workspace", tag: "Workspaces", authRequired: true },
  { method: "GET", path: "/api/v1/dashboards", summary: "List dashboards within active workspace", tag: "Dashboards", authRequired: true },
  { method: "POST", path: "/api/v1/dashboards", summary: "Create interactive dashboard canvas", tag: "Dashboards", authRequired: true },
  { method: "GET", path: "/api/v1/dashboards/:id", summary: "Fetch dashboard layout and chart widgets", tag: "Dashboards", authRequired: true },
  { method: "POST", path: "/api/v1/dashboards/:id/embed", summary: "Generate cryptographic public embed token", tag: "Dashboards", authRequired: true },
  { method: "GET", path: "/api/v1/visualizations", summary: "List Studio visualizations and chart configs", tag: "Visualizations", authRequired: true },
  { method: "POST", path: "/api/v1/visualizations", summary: "Create new Recharts/SVG visualization", tag: "Visualizations", authRequired: true },
  { method: "GET", path: "/api/v1/datasets", summary: "List ingested Arrow/DuckDB datasets", tag: "Datasets", authRequired: true },
  { method: "POST", path: "/api/v1/datasets/upload", summary: "Upload and parse CSV / XLSX dataset", tag: "Datasets", authRequired: true },
  { method: "GET", path: "/api/v1/health", summary: "System liveness probe and DuckDB worker check", tag: "System", authRequired: false },
  { method: "GET", path: "/api/v1/metrics", summary: "Prometheus-compatible server telemetry", tag: "System", authRequired: true },
];

export default function OpenApiPage() {
  const [selectedTag, setSelectedTag] = useState<string>("All");

  const tags = ["All", "Auth", "Workspaces", "Dashboards", "Visualizations", "Datasets", "System"];

  const filtered = selectedTag === "All"
    ? ENDPOINTS
    : ENDPOINTS.filter(e => e.tag === selectedTag);

  function downloadSpec() {
    const spec = {
      openapi: "3.1.0",
      info: {
        title: "RicozViz Enterprise Intelligence API",
        version: "1.0.0",
        description: "Standard Fastify 5 REST API with DuckDB WASM in-memory analytics engine."
      },
      paths: ENDPOINTS.reduce((acc, ep) => {
        acc[ep.path] = {
          [ep.method.toLowerCase()]: {
            summary: ep.summary,
            tags: [ep.tag],
            security: ep.authRequired ? [{ bearerAuth: [] }] : []
          }
        };
        return acc;
      }, {} as Record<string, unknown>)
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ricozviz-openapi-3.1.json";
    a.click();
    URL.revokeObjectURL(url);
  }

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
            <span className="text-xs font-mono font-semibold text-indigo-400">OpenAPI 3.1 Specs</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <button
              onClick={downloadSpec}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/60 hover:bg-indigo-900/60 px-3 py-1.5 text-indigo-300 font-semibold transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>
            <Link href="/docs" className="text-slate-400 hover:text-white transition">
              Docs
            </Link>
            <Link href="/status" className="text-emerald-400 hover:text-emerald-300 transition">
              Status
            </Link>
          </div>
        </div>
      </header>

      {/* Main Specs Explorer */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-0.5 text-xs font-mono text-indigo-300 mb-4">
            <span>REST Specification · OpenAPI 3.1.0 Standard</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            OpenAPI Specs & Contract Reference
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Contract-driven Fastify API surface with automated input validation, sanitized error envelopes, and cryptographic tokens.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs font-mono">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg border transition ${
                selectedTag === tag
                  ? "border-indigo-500/50 bg-indigo-600 text-white font-semibold shadow-xs"
                  : "border-white/[0.08] bg-[#0F172A] text-slate-400 hover:text-white hover:border-white/20"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Endpoints Table */}
        <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] overflow-hidden shadow-2xl">
          <div className="divide-y divide-white/[0.06]">
            {filtered.map((ep, idx) => {
              const methodBg =
                ep.method === "GET"
                  ? "bg-emerald-950/70 text-emerald-400 border-emerald-500/30"
                  : ep.method === "POST"
                  ? "bg-indigo-950/70 text-indigo-400 border-indigo-500/30"
                  : ep.method === "PUT"
                  ? "bg-amber-950/70 text-amber-400 border-amber-500/30"
                  : "bg-red-950/70 text-red-400 border-red-500/30";

              return (
                <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${methodBg} w-14 text-center`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs text-white font-semibold">
                      {ep.path}
                    </span>
                    {ep.authRequired && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900 border border-white/[0.06] px-1.5 py-0.5 rounded">
                        <Lock className="h-2.5 w-2.5 text-amber-400" />
                        Bearer
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 sm:text-right">
                    <span>{ep.summary}</span>
                    <span className="ml-3 text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-white/[0.05]">
                      {ep.tag}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <TechnicalFooter />
    </div>
  );
}
