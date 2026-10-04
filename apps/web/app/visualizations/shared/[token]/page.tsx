"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  apiGetSharedVisualization,
  apiGetSharedVisualizationData,
  type ChartType,
  type ChartConfig,
  type DatasetQueryResult,
} from "../../../../lib/api";
import { ChartRenderer } from "../../../../components/charts/ChartRenderer";
import { BarChart3, RefreshCw, AlertCircle, Lock, Download } from "lucide-react";
import { exportChartDataToCsv } from "../../../../lib/export-csv";

export default function SharedVisualizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [chart, setChart] = useState<any | null>(null);
  const [dataResult, setDataResult] = useState<DatasetQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setIsRefreshing(true);
      const res = await apiGetSharedVisualization(token);
      setChart(res.chart);

      const queryRes = await apiGetSharedVisualizationData(token);
      setDataResult({
        rows: queryRes.rows,
        columns: queryRes.columns.map((c) => ({
          name: c.name,
          type: c.type,
        })),
        rowCount: queryRes.rowCount,
        total: queryRes.rowCount,
        limit: queryRes.rowCount,
        offset: 0,
        executionTimeMs: 12,
        metadata: {
          rowCount: queryRes.rowCount,
          total: queryRes.rowCount,
          limit: 1000,
          offset: 0,
          executionTimeMs: 12,
          queryMode: "RAW",
        },
      });
      setErrorMsg(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load shared visualization";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
        <div className="h-9 w-9 border-3 border-indigo-600 border-t-transparent animate-spin rounded-full mb-3" />
        <p className="text-sm font-semibold text-gray-700">Loading shared visualization...</p>
        <p className="text-xs text-gray-400 mt-1">Securing tenant sandbox & querying metrics...</p>
      </div>
    );
  }

  if (errorMsg || !chart) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 border border-red-200 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Access Restricted or Link Inactive</h2>
          <p className="text-xs text-gray-500 mt-2">
            {errorMsg || "This visualization share link does not exist or has been disabled by the owner."}
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
            >
              Sign In to RicozViz
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">{chart.title}</h1>
            {chart.description && (
              <p className="text-2xs text-gray-500">{chart.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dataResult && dataResult.rows && dataResult.rows.length > 0 && (
            <button
              type="button"
              onClick={() => exportChartDataToCsv(chart.title, dataResult)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Visualization Canvas */}
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-4xl bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                {chart.chartType} Visualization
              </span>
              <h2 className="text-base font-bold text-gray-900 mt-0.5">{chart.title}</h2>
            </div>
            <span className="text-[11px] font-mono text-gray-400">
              {dataResult?.rowCount ?? 0} records
            </span>
          </div>

          <div className="min-h-[420px] flex items-center justify-center">
            <ChartRenderer
              chartType={chart.chartType as ChartType}
              config={chart.config as ChartConfig}
              queryResult={dataResult}
              isLoading={isRefreshing}
              height={420}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-400">
            <span>Powered by RicozViz Analytics Engine</span>
            <span>Secured Tenant Isolation</span>
          </div>
        </div>
      </main>
    </div>
  );
}
