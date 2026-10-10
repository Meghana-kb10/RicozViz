"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/shell/BrandLogo";
import {
  apiGetSharedDashboard,
  apiGetSharedChartData,
  type SharedDashboardData,
  type SharedDashboardChart,
  type DatasetQueryResult,
  type DatasetColumn,
  ApiError,
} from "../../../../lib/api";
import { ChartRenderer } from "../../../../components/visualization/ChartRenderer";
import { DashboardFilterBar } from "../../../../components/dashboard/DashboardFilterBar";
import {
  type DashboardFilter,
  isFilterApplicableToChart,
  toggleCrossFilter,
} from "../../../../lib/dashboard-filters";
import {
  getDashboardTheme,
  getDashboardBranding,
  getRadiusStyle,
  getShadowStyle,
  getFontFamilyClass,
} from "../../../../lib/theme-utils";
import {
  BarChart3,
  Printer,
  RefreshCw,
  AlertCircle,
  Database,
  Lock,
  Download,
  Filter,
} from "lucide-react";
import { exportChartDataToCsv } from "../../../../lib/export-csv";

export default function SharedDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [dashboard, setDashboard] = useState<SharedDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Query Results Cache
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilter[]>([]);
  const [chartDataResults, setChartDataResults] = useState<
    Record<string, { data: DatasetQueryResult | null; loading: boolean; error: string | null }>
  >({});
  const lastParamsRef = useRef<Record<string, string>>({});

  // Auto-Refresh & Last Updated State
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = Off, 30, 60, 300
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const [isRefreshingCharts, setIsRefreshingCharts] = useState(false);
  const isRefreshingRef = useRef(false);

  // Derived Theme & Enterprise Branding
  const dashboardTheme = useMemo(
    () => getDashboardTheme(dashboard?.layoutConfig),
    [dashboard?.layoutConfig]
  );
  const dashboardBranding = useMemo(
    () => getDashboardBranding(dashboard?.layoutConfig),
    [dashboard?.layoutConfig]
  );

  // 1. Load Shared Dashboard metadata & chart list
  useEffect(() => {
    if (!token) return;
    let ignore = false;

    apiGetSharedDashboard(token)
      .then((data) => {
        if (!ignore) {
          setDashboard(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(
            err instanceof ApiError
              ? err.message
              : "This shared dashboard link is invalid, expired, or has been disabled by the owner."
          );
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  // 2. Query chart data with active filters
  const executeChartQuery = useCallback(
    async (chart: SharedDashboardChart, activeFilters: DashboardFilter[], force = false) => {
      if (!token) return;

      const applicableFilters = activeFilters.filter((af) =>
        isFilterApplicableToChart(af, chart as any, chart.datasetColumns)
      );

      const filterPayload = applicableFilters.map((f) => ({
        column: f.field,
        operator: f.operator,
        value: f.value,
      }));

      const paramKey = JSON.stringify(filterPayload);
      if (!force && lastParamsRef.current[chart.id] === paramKey) {
        return;
      }
      lastParamsRef.current[chart.id] = paramKey;

      setChartDataResults((prev) => ({
        ...prev,
        [chart.id]: { data: prev[chart.id]?.data ?? null, loading: true, error: null },
      }));

      try {
        const res = await apiGetSharedChartData(token, chart.id, filterPayload);
        setChartDataResults((prev) => ({
          ...prev,
          [chart.id]: { data: res, loading: false, error: null },
        }));
      } catch (err) {
        setChartDataResults((prev) => ({
          ...prev,
          [chart.id]: {
            data: null,
            loading: false,
            error: err instanceof ApiError ? err.message : "Failed to load chart data",
          },
        }));
      }
    },
    [token]
  );

  // Trigger queries whenever charts or filters change
  useEffect(() => {
    if (!dashboard || dashboard.charts.length === 0) return;
    for (const chart of dashboard.charts) {
      void executeChartQuery(chart, dashboardFilters);
    }
  }, [dashboard, dashboardFilters, executeChartQuery]);

  // Lightweight Refresh of All Visualizations without page reload
  const handleManualRefresh = useCallback(async () => {
    if (!dashboard || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshingCharts(true);
    try {
      await Promise.allSettled(
        dashboard.charts.map((chart) => executeChartQuery(chart, dashboardFilters, true))
      );
      setLastUpdatedAt(new Date());
    } catch {
      // Gracefully handle any query execution error
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingCharts(false);
    }
  }, [dashboard, dashboardFilters, executeChartQuery]);

  // Auto-refresh interval timer (stops polling when unmounted)
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      void handleManualRefresh();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, handleManualRefresh]);

  // Distinct column values for multi-select category filter
  const columnValues = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const res of Object.values(chartDataResults)) {
      if (res.data?.rows) {
        for (const row of res.data.rows) {
          for (const [key, val] of Object.entries(row)) {
            if (val !== null && val !== undefined) {
              if (!map[key]) map[key] = new Set<string>();
              if (map[key].size < 50) {
                map[key].add(String(val));
              }
            }
          }
        }
      }
    }
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(map)) {
      result[k] = Array.from(v);
    }
    return result;
  }, [chartDataResults]);

  // Filter actions
  const handleAddFilter = (filter: DashboardFilter) => {
    setDashboardFilters((prev) => [...prev, filter]);
  };

  const handleRemoveFilter = (filterId: string) => {
    setDashboardFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  const handleClearAll = () => {
    setDashboardFilters([]);
  };

  const handleResetDashboard = () => {
    setDashboardFilters([]);
    lastParamsRef.current = {};
    if (dashboard) {
      for (const chart of dashboard.charts) {
        void executeChartQuery(chart, [], true);
      }
    }
  };

  // Cross-filtering click
  const handleDataPointClick = (chart: SharedDashboardChart, field: string, value: unknown) => {
    setDashboardFilters((prev) =>
      toggleCrossFilter(prev, field, value, chart.id, chart.datasetId || undefined)
    );
  };

  // Browser Print / Save to PDF
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Available columns across all dashboard datasets for filtering
  const availableColumns: DatasetColumn[] = Array.from(
    new Map(
      (dashboard?.charts || [])
        .flatMap((c) => c.datasetColumns || [])
        .map((col) => [col.name, col])
    ).values()
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading Shared Dashboard...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 mx-auto mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Shared Dashboard Unavailable</h2>
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">
            {errorMsg || "The link you followed may be invalid, expired, or deactivated by the dashboard owner."}
          </p>
          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-center">
            <Link
              href="/login"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Sign in to RicozViz →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col antialiased ${getFontFamilyClass(dashboardTheme.fontFamily)}`}
      style={{
        backgroundColor: dashboardTheme.backgroundColor || "#f8fafc",
        color: dashboardTheme.textColor || "#0f172a",
      }}
    >
      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          header,
          .no-print,
          button,
          input,
          select {
            display: none !important;
          }
          body,
          main {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 24px !important;
          }
          .chart-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
          }
        }
        @media screen {
          .print-header {
            display: none;
          }
        }
      `}</style>

      {/* TOP BAR (Hidden on print) */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-20 no-print">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              {dashboardBranding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dashboardBranding.logoUrl}
                  alt="Brand Logo"
                  className="h-7 max-w-[100px] object-contain rounded"
                />
              ) : (
                <BrandLogo size={28} />
              )}
              <span className="text-sm tracking-tight">
                {dashboardBranding.title ? "RicozViz" : "RicozViz"}
              </span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-semibold text-gray-900 truncate max-w-xs sm:max-w-md">
              {dashboardBranding.title || dashboard.name}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 px-2 py-0.5 border border-indigo-200">
              <Lock className="h-2.5 w-2.5" />
              <span>Read-Only Share</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Refresh & Manual Visualizations Refresh Controls */}
            <div className="flex items-center gap-1 bg-gray-100/90 border border-gray-200 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshingCharts}
                title="Refresh Visualizations Now"
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshingCharts ? "animate-spin text-indigo-600" : "text-gray-500"}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                title="Auto-refresh interval"
                className="bg-transparent text-[11px] font-medium text-gray-600 focus:outline-none cursor-pointer py-0.5"
              >
                <option value={0}>Auto: Off</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 1m</option>
                <option value={300}>Auto: 5m</option>
              </select>
              <span className="text-[10px] text-gray-400 pl-1 border-l border-gray-300 hidden xl:inline" title="Last updated time">
                Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* Filter Count Badge */}
            {dashboardFilters.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                <Filter className="h-3 w-3" />
                {dashboardFilters.length} active
              </span>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition"
              title="Print dashboard or save as PDF"
            >
              <Printer className="h-3.5 w-3.5 text-gray-500" />
              <span>Print / Export PDF</span>
            </button>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard Filter Bar (Interactive for public viewers) */}
      <div className="no-print">
        <DashboardFilterBar
          availableColumns={availableColumns}
          filters={dashboardFilters}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAll}
          onResetDashboard={handleResetDashboard}
          columnValues={columnValues}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {/* Printable Header */}
        <div className="print-header">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-xs text-gray-500 mt-1">{dashboard.description}</p>
              )}
            </div>
            <div className="text-right text-[11px] text-gray-400">
              <p className="font-semibold text-gray-700">RicozViz Report</p>
              <p>Generated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Dashboard Title & Meta in Screen Mode */}
        <div
          className="border p-4 mb-6 no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
          style={{
            backgroundColor: dashboardTheme.cardBackground,
            borderColor: dashboardTheme.borderColor,
            borderRadius: getRadiusStyle(dashboardTheme.cardRadius),
            boxShadow: getShadowStyle(dashboardTheme.cardShadow, dashboardTheme.mode === "dark"),
          }}
        >
          <div className="flex items-center gap-3">
            {dashboardBranding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dashboardBranding.logoUrl}
                alt="Brand Logo"
                className="h-9 max-w-[120px] object-contain rounded"
              />
            )}
            <div>
              <h1 className="text-base font-bold" style={{ color: dashboardTheme.textColor }}>
                {dashboardBranding.title || dashboard.name}
              </h1>
              {(dashboardBranding.description || dashboard.description) && (
                <p className="text-xs mt-0.5" style={{ color: dashboardTheme.textMutedColor }}>
                  {dashboardBranding.description || dashboard.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: dashboardTheme.textMutedColor }}>
            <span>{dashboard.charts.length} visualization{dashboard.charts.length === 1 ? "" : "s"}</span>
            <span>•</span>
            <span>Updated {new Date(dashboard.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Canvas Charts Grid */}
        {dashboard.charts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
            <BarChart3 className="mx-auto h-10 w-10 text-gray-400 mb-3" />
            <h3 className="text-sm font-semibold text-gray-900">No visualizations on this dashboard</h3>
            <p className="mt-1 text-xs text-gray-500">
              The owner has not added any visualizations to this dashboard yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">
            {dashboard.charts.map((chart) => {
              const queryState = chartDataResults[chart.id];
              const width = chart.position?.w || 6;
              const heightUnit = chart.position?.h || 4;
              const chartHeight = heightUnit === 6 ? 380 : 250;
              const colSpanClass =
                width >= 12
                  ? "col-span-1 md:col-span-2 lg:col-span-12"
                  : width <= 4
                    ? "col-span-1 md:col-span-1 lg:col-span-4"
                    : "col-span-1 md:col-span-2 lg:col-span-6";

              const applicableFilters = dashboardFilters.filter((df) =>
                isFilterApplicableToChart(df, chart as any, chart.datasetColumns)
              );

              return (
                <div
                  key={chart.id}
                  className={`chart-card border flex flex-col justify-between overflow-hidden transition ${colSpanClass}`}
                  style={{
                    backgroundColor: dashboardTheme.cardBackground,
                    borderColor: dashboardTheme.borderColor,
                    borderRadius: getRadiusStyle(dashboardTheme.cardRadius),
                    boxShadow: getShadowStyle(dashboardTheme.cardShadow, dashboardTheme.mode === "dark"),
                  }}
                >
                  {/* Card Header */}
                  <div
                    className="p-4 border-b flex items-start justify-between gap-2"
                    style={{ borderColor: dashboardTheme.borderColor }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4
                          className="font-bold text-sm line-clamp-1"
                          style={{ color: dashboardTheme.textColor }}
                        >
                          {chart.title}
                        </h4>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                          style={{
                            backgroundColor: `${dashboardBranding.brandColor || "#4f46e5"}18`,
                            color: dashboardBranding.brandColor || "#4f46e5",
                          }}
                        >
                          {chart.chartType}
                        </span>
                      </div>
                      {chart.description && (
                        <p
                          className="text-xs mt-0.5 line-clamp-1"
                          style={{ color: dashboardTheme.textMutedColor }}
                        >
                          {chart.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 no-print">
                      <button
                        type="button"
                        onClick={() => {
                          exportChartDataToCsv(chart.title, queryState?.data);
                        }}
                        title="Export Current Chart Data (CSV)"
                        disabled={!queryState?.data?.rows || queryState?.data?.rows.length === 0}
                        className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-gray-100 text-xs transition disabled:opacity-30 disabled:hover:text-gray-400"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void executeChartQuery(chart, dashboardFilters, true)}
                        title="Refresh Query"
                        disabled={queryState?.loading}
                        className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 text-xs transition"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${queryState?.loading ? "animate-spin text-indigo-600" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Active Filter Indicators */}
                  {applicableFilters.length > 0 && (
                    <div className="px-4 py-1.5 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center gap-1.5 text-[11px] no-print">
                      {applicableFilters.map((af) => (
                        <span
                          key={af.id}
                          className="inline-flex items-center gap-1 rounded bg-white text-gray-700 border border-indigo-200 px-2 py-0.5 shadow-2xs font-medium text-[10px]"
                        >
                          <span>Filtered: {af.field} {af.operator} {String(af.value)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFilter(af.id)}
                            className="text-gray-400 hover:text-gray-700 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card Body */}
                  <div
                    className="p-4 flex-1 flex flex-col justify-center"
                    style={{ minHeight: chartHeight + 20 }}
                  >
                    <ChartRenderer
                      chartType={chart.chartType}
                      config={chart.config}
                      queryResult={queryState?.data || null}
                      isLoading={queryState?.loading || false}
                      error={queryState?.error || null}
                      height={chartHeight}
                      onDataPointClick={(field, value) => handleDataPointClick(chart, field, value)}
                    />
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                    <span className="truncate max-w-[160px] flex items-center gap-1">
                      <Database className="h-3 w-3 text-gray-400 shrink-0" />
                      <span>{chart.datasetName || "Dataset"}</span>
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {queryState?.data?.rowCount !== undefined
                        ? `${queryState.data.rowCount} rows`
                        : "Ready"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
