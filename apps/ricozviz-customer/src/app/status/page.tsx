"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBaseUrl } from "../../lib/api";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { TechnicalFooter } from "@/components/shell/TechnicalFooter";
import { ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";

interface SystemStatus {
  apiStatus: "checking" | "online" | "offline";
  apiMessage: string;
  timestamp: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus>({
    apiStatus: "checking",
    apiMessage: "Pinging API service...",
    timestamp: new Date().toISOString(),
  });

  const checkHealth = () => {
    setStatus((prev) => ({ ...prev, apiStatus: "checking", apiMessage: "Pinging API service..." }));
    const apiUrl = getApiBaseUrl();
    fetch(`${apiUrl}/api/v1/health`)
      .then((res) => res.json())
      .then((data: { success?: boolean; data?: { status?: string } }) => {
        if (data?.data?.status === "ok" || data?.success) {
          setStatus({
            apiStatus: "online",
            apiMessage: "API service is running and responsive.",
            timestamp: new Date().toISOString(),
          });
        } else {
          setStatus({
            apiStatus: "offline",
            apiMessage: "API returned unexpected response.",
            timestamp: new Date().toISOString(),
          });
        }
      })
      .catch((err: unknown) => {
        setStatus({
          apiStatus: "offline",
          apiMessage: err instanceof Error ? err.message : "Unable to reach API server.",
          timestamp: new Date().toISOString(),
        });
      });
  };

  useEffect(() => {
    checkHealth();
  }, []);

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
            <span className="text-xs font-mono-code font-semibold text-[#ff6b35]">System Status</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code">
            <Link href="/docs" className="text-[#898989] hover:text-[#fafafa] transition">
              Docs
            </Link>
            <Link href="/benchmarks" className="text-[#898989] hover:text-[#fafafa] transition">
              Benchmarks
            </Link>
            <Link href="/openapi" className="text-[#898989] hover:text-[#fafafa] transition">
              OpenAPI
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#181818] hover:bg-[#242424] border border-[#242424] px-3 py-1.5 text-[#fafafa] font-medium transition cursor-pointer"
            >
              Sign In
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

      {/* Main Status Container */}
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 w-full space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between border-b border-[#242424] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-3 py-0.5 text-xs font-mono-code text-[#ff6b35] mb-2">
              <span>Telemetry & Infrastructure Uptime</span>
            </div>
            <h1 className="text-2xl font-bold text-[#fafafa] tracking-tight">
              Platform Service Status
            </h1>
          </div>
          <button
            onClick={checkHealth}
            className="flex items-center gap-1.5 text-xs font-mono-code text-[#898989] hover:text-[#fafafa] bg-[#181818] border border-[#242424] px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status.apiStatus === "checking" ? "animate-spin" : ""}`} />
            <span>Recheck</span>
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-[#141414] border border-[#242424] rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#fafafa] mb-4">Environment & Service Overview</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2.5 border-b border-[#242424]">
              <span className="text-sm text-[#898989]">Frontend Application (Next.js 15)</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono-code font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-[#242424]">
              <div>
                <span className="text-sm text-[#898989]">Backend API Engine (Fastify 5)</span>
                <p className="text-xs text-[#898989]/70 font-mono-code mt-0.5">{status.apiMessage}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-mono-code font-medium ${
                  status.apiStatus === "online"
                    ? "text-emerald-400"
                    : status.apiStatus === "checking"
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    status.apiStatus === "online"
                      ? "bg-emerald-400"
                      : status.apiStatus === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
                {status.apiStatus === "online"
                  ? "Operational"
                  : status.apiStatus === "checking"
                  ? "Checking..."
                  : "Offline"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-[#242424]">
              <span className="text-sm text-[#898989]">DuckDB WASM OLAP Engine</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono-code font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                In-Memory Ready
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#898989]">Last Ping Verified</span>
              <span suppressHydrationWarning className="text-xs font-mono-code text-[#898989]">
                {status.timestamp}
              </span>
            </div>
          </div>
        </div>

        {/* Note Card */}
        <div className="bg-[#141414] border border-[#242424] rounded-xl p-5 text-xs text-[#898989] leading-relaxed">
          <p>
            RicozViz uses JWT Authentication with 15-minute access tokens and 7-day HttpOnly refresh cookies.
            Protected workspace, dashboard, dataset, visualization, metrics, alerts, and settings routes require active authentication.
          </p>
        </div>
      </main>

      <TechnicalFooter />
    </div>
  );
}
