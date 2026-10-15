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
    <div className="min-h-screen bg-[#F4F1EA] text-[#172B3A] flex flex-col p-8 font-sans selection:bg-[#147D78] selection:text-white">
      <header className="max-w-3xl mx-auto w-full mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={32} />
          <span className="font-heading font-bold text-lg text-[#172B3A]">RicozViz System Status</span>
        </div>
        <Link
          href="/login"
          className="text-xs bg-white hover:bg-[#F4F1EA] text-[#172B3A] px-3 py-1.5 rounded-lg border border-[#DADFD9] transition font-medium shadow-xs"
        >
          Sign In
        </Link>
      </header>

      <main className="max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-white border border-[#DADFD9] rounded-xl p-6 shadow-xs">
          <h2 className="text-base font-heading font-bold text-[#172B3A] mb-4">Environment & Service Overview</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[#DADFD9]">
              <span className="text-sm text-[#596775]">Frontend Application</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#147D78]">
                <span className="h-2 w-2 rounded-full bg-[#147D78]"></span>
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#DADFD9]">
              <div>
                <span className="text-sm text-[#596775]">Backend API (port 4000)</span>
                <p className="text-xs text-[#596775]/70">{status.apiMessage}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  status.apiStatus === "online"
                    ? "text-[#147D78]"
                    : status.apiStatus === "checking"
                    ? "text-[#D9A441]"
                    : "text-red-600"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    status.apiStatus === "online"
                      ? "bg-[#147D78]"
                      : status.apiStatus === "checking"
                      ? "bg-[#D9A441] animate-pulse"
                      : "bg-red-500"
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
              <span className="text-sm text-[#596775]">Last Verified</span>
              <span suppressHydrationWarning className="text-xs font-mono text-[#596775]">{status.timestamp}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#DADFD9] rounded-xl p-4 text-xs text-[#596775] shadow-xs">
          <p>
            Note: RicozViz uses JWT Authentication with 15-minute access tokens and 7-day HttpOnly refresh cookies.
            Protected workspace, dashboard, dataset, visualization, and settings routes require active authentication.
          </p>
        </div>
      </main>
    </div>
  );
}
