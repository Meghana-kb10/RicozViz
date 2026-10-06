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
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white p-4 shadow-2xs transition">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/60 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <span>AI Dashboard Summary</span>
              <span className="rounded bg-indigo-100/80 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-indigo-800">
                Grounded
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Computed from real visualization queries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {summaryData?.filterContextText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 border border-indigo-200/60 px-2.5 py-0.5 text-[11px] font-medium text-indigo-900 shadow-2xs">
              <Filter className="h-3 w-3 text-indigo-600" />
              <span>{summaryData.filterContextText}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => void fetchSummary()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 shadow-2xs hover:bg-indigo-50 transition disabled:opacity-50 cursor-pointer"
            title="Re-run summary with current data"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Generating..." : "Refresh"}</span>
          </button>

          {onOpenAnalyst && (
            <button
              type="button"
              onClick={onOpenAnalyst}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <FileText className="h-3 w-3" />
              <span>Ask AI Analyst</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {error ? (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading && !summaryData ? (
        <div className="flex items-center gap-2 py-2 text-xs text-indigo-600 animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>Analyzing dashboard visualization data points...</span>
        </div>
      ) : summaryData ? (
        <div className="space-y-1.5 text-xs text-gray-700">
          {summaryData.summaryBullets.map((bullet, idx) => (
            <div key={idx} className="leading-relaxed flex items-start gap-1">
              <span className="text-gray-800">{bullet.replace(/^•\s*/, "• ")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
