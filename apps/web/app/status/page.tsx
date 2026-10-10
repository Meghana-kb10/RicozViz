"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiBaseUrl } from "../../lib/api";
import { BrandLogo } from "@/components/shell/BrandLogo";

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

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-8">
      <header className="max-w-3xl mx-auto w-full mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={32} />
          <span className="font-semibold text-lg">RicozViz System Status</span>
        </div>
        <Link
          href="/login"
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 transition"
        >
          Sign In
        </Link>
      </header>

      <main className="max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Environment & Service Overview</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/60">
              <span className="text-sm text-slate-400">Frontend Application</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-700/60">
              <div>
                <span className="text-sm text-slate-400">Backend API (port 4000)</span>
                <p className="text-xs text-slate-500">{status.apiMessage}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  status.apiStatus === "online"
                    ? "text-emerald-400"
                    : status.apiStatus === "checking"
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    status.apiStatus === "online"
                      ? "bg-emerald-400"
                      : status.apiStatus === "checking"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                ></span>
                {status.apiStatus === "online"
                  ? "Operational"
                  : status.apiStatus === "checking"
                  ? "Checking..."
                  : "Offline"}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-400">Last Verified</span>
              <span className="text-xs font-mono text-slate-400">{status.timestamp}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-400">
          <p>
            Note: RicozViz uses JWT Authentication with 15-minute access tokens and 7-day HttpOnly refresh cookies.
            Protected workspace, dashboard, dataset, visualization, and settings routes require active authentication.
          </p>
        </div>
      </main>
    </div>
  );
}
