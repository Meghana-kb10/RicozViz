"use client";

import { useEffect, useState, use, useCallback, useRef, useMemo } from "react";
import {
  apiGetEmbeddedDashboard,
  apiGetEmbeddedChartData,
  type DatasetQueryResult,
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
  BarChart3,
  RefreshCw,
  AlertCircle,
  Lock,
  Download,
} from "lucide-react";
import { exportChartDataToCsv } from "../../../../lib/export-csv";

export default function EmbeddedDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [dashboard, setDashboard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Query Results Cache
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilter[]>([]);
  const [chartDataResults, setChartDataResults] = useState<
    Record<string, { data: DatasetQueryResult | null; loading: boolean; error: string | null }>
  >({});
  const lastParamsRef = useRef<Record<string, string>>({});

  const [isRefreshingCharts, setIsRefreshingCharts] = useState(false);

  // 1. Load Embedded Dashboard metadata
  useEffect(() => {
    if (!token) return;
    let ignore = false;

    apiGetEmbeddedDashboard(token)
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
              : "This embedded dashboard link is invalid, expired, or access has been revoked."
          );
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  // Available columns from charts
  const availableColumns = useMemo(() => {
    if (!dashboard?.charts) return [];
    const seen = new Set<string>();
    const cols: Array<{ name: string; type: string; nullable: boolean }> = [];
    for (const c of dashboard.charts) {
      if (Array.isArray(c.datasetColumns)) {
        for (const col of c.datasetColumns) {
          if (!seen.has(col.name)) {
            seen.add(col.name);
            cols.push({
              name: col.name,
              type: col.type || "string",
              nullable: typeof col.nullable === "boolean" ? col.nullable : true,
            });
          }
        }
      }
    }
    return cols;
  }, [dashboard]);

  // 2. Query chart data with active filters
  const executeChartQuery = useCallback(
    async (chart: any, activeFilters: DashboardFilter[], force = false) => {
      if (!token) return;

      const applicableFilters = activeFilters.filter((af) =>
        isFilterApplicableToChart(af, chart, chart.datasetColumns)
      );

      const filterPayload = applicableFilters.map((f) => ({
        column: f.field,
        operator: f.operator,
        value: f.value,
      }));

      const filterHash = JSON.stringify(filterPayload);
      if (!force && lastParamsRef.current[chart.id] === filterHash) {
        return;
      }
      lastParamsRef.current[chart.id] = filterHash;

      setChartDataResults((prev) => ({
        ...prev,
        [chart.id]: {
          data: prev[chart.id]?.data || null,
          loading: true,
          error: null,
        },
      }));

      try {
        const queryRes = await apiGetEmbeddedChartData(token, chart.id, filterPayload);
        setChartDataResults((prev) => ({
          ...prev,
          [chart.id]: {
            data: queryRes,
            loading: false,
            error: null,
          },
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to execute query";
        setChartDataResults((prev) => ({
          ...prev,
          [chart.id]: {
            data: null,
            loading: false,
            error: msg,
          },
        }));
      }
    },
    [token]
  );

  // Execute queries for all charts on load or filter change
  useEffect(() => {
    if (!dashboard || !dashboard.charts) return;
    for (const chart of dashboard.charts) {
      void executeChartQuery(chart, dashboardFilters);
    }
  }, [dashboard, dashboardFilters, executeChartQuery]);

  const handleRefreshAll = async () => {
    if (!dashboard || !dashboard.charts) return;
    setIsRefreshingCharts(true);
    await Promise.all(
      dashboard.charts.map((c: any) => executeChartQuery(c, dashboardFilters, true))
    );
    setIsRefreshingCharts(false);
  };

  // Cross filter interaction
  const handleDataPointClick = (chart: any, field: string, value: any) => {
    if (!chart || !field || value === undefined) return;
    setDashboardFilters((prev) =>
      toggleCrossFilter(prev, field, value, chart.id, chart.datasetId || undefined)
    );
  };

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
  };

  const isDark = dashboard?.embedConfig?.theme === "dark";

  if (loading) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-blue-600" />
          <p className="text-sm font-medium opacity-70">Loading embedded analytics...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${isDark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"}`}>
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Embedded Access Restricted</h2>
          <p className="mt-2 text-xs text-gray-600 leading-relaxed">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const showTitle = dashboard?.embedConfig?.showTitle !== false && Boolean(dashboard?.name);
  const showFilters = dashboard?.embedConfig?.showFilters !== false;
  const showRefresh = dashboard?.embedConfig?.showRefresh !== false;

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 transition-colors ${
        isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header bar (if title or refresh enabled) */}
      {(showTitle || showRefresh) && (
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/60 pb-4 dark:border-gray-800">
          <div>
            {showTitle && (
              <>
                <h1 className="text-xl font-bold tracking-tight">{dashboard?.name}</h1>
                {dashboard?.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {dashboard.description}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {showRefresh && (
              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={isRefreshingCharts}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingCharts ? "animate-spin text-blue-600" : ""}`} />
                <span>{isRefreshingCharts ? "Refreshing..." : "Refresh"}</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* Filter Bar */}
      {showFilters && (
        <div className="mb-6">
          <DashboardFilterBar
            availableColumns={availableColumns}
            filters={dashboardFilters}
            onAddFilter={handleAddFilter}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAll}
            onResetDashboard={handleResetDashboard}
          />
        </div>
      )}

      {/* Chart Grid */}
      {(!dashboard?.charts || dashboard.charts.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400 dark:border-gray-800">
          <BarChart3 className="mx-auto h-10 w-10 opacity-30 mb-2" />
          No charts configured on this dashboard.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {dashboard.charts.map((chart: any) => {
            const chartResult = chartDataResults[chart.id];
            const data = chartResult?.data || null;
            const loading = chartResult?.loading || false;
            const error = chartResult?.error || null;

            return (
              <div
                key={chart.id}
                className={`flex flex-col rounded-2xl border p-5 shadow-xs transition hover:shadow-md ${
                  isDark
                    ? "bg-gray-900 border-gray-800"
                    : "bg-white border-gray-200/80"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">{chart.title}</h3>
                    {chart.description && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{chart.description}</p>
                    )}
                  </div>
                  {data && data.rows && data.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        exportChartDataToCsv(
                          chart.title || "chart-data",
                          data
                        )
                      }
                      title="Export CSV"
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition dark:hover:bg-gray-800"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="relative min-h-[300px] flex-1">
                  {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-2xs dark:bg-gray-900/60">
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  )}

                  {error ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center p-4 text-center">
                      <AlertCircle className="h-7 w-7 text-red-500 mb-1.5" />
                      <p className="text-xs font-semibold text-red-600">Failed to render chart</p>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-xs">{error}</p>
                    </div>
                  ) : (
                    <ChartRenderer
                      chartType={chart.chartType}
                      config={chart.config || {}}
                      queryResult={data}
                      isLoading={loading}
                      error={error}
                      height={280}
                      onDataPointClick={(field, value) => handleDataPointClick(chart, field, value)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
