"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, AlertCircle, Filter, FileText } from "lucide-react";
import {
  apiGetDashboardSummary,
  type DashboardSummaryResponse,
  type DatasetQueryFilter,
} from "../../lib/api";

interface DashboardAiSummaryProps {
  dashboardId: string;
  activeFilters?: DatasetQueryFilter[];
  onOpenAnalyst?: () => void;
}

export function DashboardAiSummary({
  dashboardId,
  activeFilters = [],
  onOpenAnalyst,
}: DashboardAiSummaryProps) {
  const [summaryData, setSummaryData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetDashboardSummary({
        dashboardId,
        activeFilters: activeFilters.length > 0 ? activeFilters : undefined,
      });
      setSummaryData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate dashboard summary");
    } finally {
      setLoading(false);
    }
  }, [dashboardId, activeFilters]);

  // Re-fetch whenever dashboardId or activeFilters changes
  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="rounded-xl border border-[#242424] bg-[#141414] p-4 shadow-sm transition">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#242424] pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35] shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#fafafa] flex items-center gap-1.5">
              <span>AI Dashboard Summary</span>
              <span className="rounded bg-[#ff6b35]/10 border border-[#ff6b35]/25 px-1.5 py-0.2 text-[9px] font-mono font-medium text-[#ff8c5a]">
                Grounded
              </span>
            </h3>
            <p className="text-[11px] text-[#898989]">
              Computed from real visualization queries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {summaryData?.filterContextText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1c1c1c] border border-[#2e2e2e] px-2.5 py-0.5 text-[11px] font-normal text-[#fafafa]">
              <Filter className="h-3 w-3 text-[#ff6b35]" />
              <span>{summaryData.filterContextText}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => void fetchSummary()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-[#2e2e2e] bg-[#1a1a1a] px-2.5 py-1 text-xs font-normal text-[#dedede] hover:bg-[#222222] hover:text-white transition disabled:opacity-50 cursor-pointer"
            title="Re-run summary with current data"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-[#ff6b35]" : "text-[#898989]"}`} />
            <span>{loading ? "Generating..." : "Refresh"}</span>
          </button>

          {onOpenAnalyst && (
            <button
              type="button"
              onClick={onOpenAnalyst}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#9a3412] border border-[#ff6b35]/60 px-3 py-1 text-xs font-medium text-white hover:bg-[#c2410c] hover:border-[#ff6b35] transition cursor-pointer shadow-[0_0_12px_rgba(255,107,53,0.15)]"
            >
              <FileText className="h-3 w-3" />
              <span>Ask AI Analyst</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {error ? (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-500/30">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      ) : loading && !summaryData ? (
        <div className="flex items-center gap-2 py-2 text-xs text-[#ff8c5a] animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Analyzing dashboard visualization data points...</span>
        </div>
      ) : summaryData ? (
        <div className="space-y-1.5 text-xs text-[#dedede]">
          {summaryData.summaryBullets.map((bullet, idx) => (
            <div key={idx} className="leading-relaxed flex items-start gap-1">
              <span className="text-[#fafafa]">{bullet.replace(/^•\s*/, "• ")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
