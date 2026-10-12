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
            <span className="text-xs font-mono font-semibold text-[#147D78]">OpenAPI 3.1 Specs</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <button
              onClick={downloadSpec}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DADFD9] bg-white hover:bg-[#F4F1EA] px-3 py-1.5 text-[#147D78] font-medium transition cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>
            <Link href="/docs" className="text-[#596775] hover:text-[#172B3A] transition">
              Docs
            </Link>
            <Link href="/status" className="text-[#147D78] hover:text-[#106963] transition">
              Status
            </Link>
          </div>
        </div>
      </header>

      {/* Main Specs Explorer */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DADFD9] bg-white px-3 py-0.5 text-xs font-mono text-[#147D78] mb-4 shadow-xs">
            <span>REST Specification · OpenAPI 3.1.0 Standard</span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-[#172B3A] tracking-tight">
            OpenAPI Specs & Contract Reference
          </h1>
          <p className="mt-2 text-sm text-[#596775]">
            Contract-driven Fastify API surface with automated input validation, sanitized error envelopes, and cryptographic tokens.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 text-xs font-mono">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                selectedTag === tag
                  ? "border-[#147D78] bg-[#147D78] text-white font-medium shadow-xs"
                  : "border-[#DADFD9] bg-white text-[#596775] hover:text-[#172B3A] hover:border-[#147D78]/40"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Endpoints Table */}
        <div className="rounded-xl border border-[#DADFD9] bg-white overflow-hidden shadow-xs">
          <div className="divide-y divide-[#DADFD9]">
            {filtered.map((ep, idx) => {
              const methodBg =
                ep.method === "GET"
                  ? "bg-[#147D78]/10 text-[#147D78] border-[#147D78]/30"
                  : ep.method === "POST"
                  ? "bg-[#2E5B70]/10 text-[#2E5B70] border-[#2E5B70]/30"
                  : ep.method === "PUT"
                  ? "bg-[#D9A441]/15 text-[#D9A441] border-[#D9A441]/35"
                  : "bg-red-50 text-red-600 border-red-200";

              return (
                <div key={idx} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-[#F4F1EA]/40 transition">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${methodBg} w-14 text-center`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs text-[#172B3A] font-semibold">
                      {ep.path}
                    </span>
                    {ep.authRequired && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#596775] bg-[#F4F1EA] border border-[#DADFD9] px-1.5 py-0.5 rounded">
                        <Lock className="h-2.5 w-2.5 text-[#D9A441]" />
                        Bearer
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#596775] sm:text-right">
                    <span>{ep.summary}</span>
                    <span className="ml-3 text-[10px] font-mono text-[#596775] bg-[#F4F1EA] px-1.5 py-0.5 rounded border border-[#DADFD9]">
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
