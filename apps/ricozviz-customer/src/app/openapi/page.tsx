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
            <span className="text-xs font-mono-code font-semibold text-[#ff6b35]">OpenAPI 3.1 Specs</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code">
            <button
              onClick={downloadSpec}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff6b35]/40 bg-[#ff6b35]/10 hover:bg-[#ff6b35]/20 px-3 py-1.5 text-[#ff6b35] font-medium transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>
            <Link href="/docs" className="text-[#898989] hover:text-[#fafafa] transition">
              Docs
            </Link>
            <Link href="/benchmarks" className="text-[#898989] hover:text-[#fafafa] transition">
              Benchmarks
            </Link>
            <Link href="/status" className="text-[#ff6b35] hover:text-[#c2410c] transition">
              Status
            </Link>
          </div>
        </div>
      </header>

      {/* Main Specs Explorer */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-3 py-0.5 text-xs font-mono-code text-[#ff6b35] mb-4">
            <span>REST Specification · OpenAPI 3.1.0 Standard</span>
          </div>
          <h1 className="text-3xl font-bold text-[#fafafa] tracking-tight">
            OpenAPI Specs & Contract Reference
          </h1>
          <p className="mt-2 text-sm text-[#898989]">
            Contract-driven Fastify API surface with automated input validation, sanitized error envelopes, and cryptographic tokens.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs font-mono-code">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                selectedTag === tag
                  ? "border-[#ff6b35] bg-[#ff6b35] text-white font-medium"
                  : "border-[#242424] bg-[#141414] text-[#898989] hover:text-[#fafafa] hover:border-[#ff6b35]/50"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Endpoints Table */}
        <div className="rounded-xl border border-[#242424] bg-[#141414] overflow-hidden">
          <div className="divide-y divide-[#242424]">
            {filtered.map((ep, idx) => {
              const methodBg =
                ep.method === "GET"
                  ? "bg-[#ff6b35]/15 text-[#ff6b35] border-[#ff6b35]/30"
                  : ep.method === "POST"
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  : ep.method === "PUT"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/35"
                  : "bg-rose-500/15 text-rose-400 border-rose-500/30";

              return (
                <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#181818] transition">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded border ${methodBg} w-14 text-center`}>
                      {ep.method}
                    </span>
                    <span className="font-mono-code text-xs text-[#fafafa] font-semibold">
                      {ep.path}
                    </span>
                    {ep.authRequired && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono-code text-[#898989] bg-[#181818] border border-[#242424] px-1.5 py-0.5 rounded">
                        <Lock className="h-2.5 w-2.5 text-amber-400" />
                        Bearer
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#898989] sm:text-right">
                    <span>{ep.summary}</span>
                    <span className="ml-3 text-[10px] font-mono-code text-[#898989] bg-[#181818] px-1.5 py-0.5 rounded border border-[#242424]">
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
