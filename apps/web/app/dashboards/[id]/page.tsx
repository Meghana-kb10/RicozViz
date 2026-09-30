"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  apiListCharts,
  apiDeleteChart,
  apiListDatasets,
  apiQueryDataset,
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  type ChartData,
  type ChartType,
  type DatasetData,
  type DatasetColumn,
  type DatasetQueryResult,
  ApiError,
} from "../../../lib/api";
import { buildChartQueryParams } from "../../../lib/chart-query-mapper";
import { ChartRenderer } from "../../../components/visualization/ChartRenderer";
import { VisualizationStudio } from "../../../components/visualization/VisualizationStudio";
import { DashboardFilterBar } from "../../../components/dashboard/DashboardFilterBar";
import {
  type DashboardFilter,
  type DrillDownState,
  isFilterApplicableToChart,
  mergeChartAndDashboardFilters,
  toggleCrossFilter,
  drillDownNext,
  drillDownPrev,
  encodeFiltersToUrl,
  parseFiltersFromUrl,
} from "../../../lib/dashboard-filters";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  CircleDot,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Hash,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Sliders,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const QUICK_CHART_TYPES: { value: ChartType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "BAR", label: "Bar Chart", icon: BarChart3 },
  { value: "LINE", label: "Line Chart", icon: LineChartIcon },
  { value: "AREA", label: "Area Chart", icon: LineChartIcon },
  { value: "PIE", label: "Pie Chart", icon: PieChartIcon },
  { value: "DONUT", label: "Donut Chart", icon: CircleDot },
  { value: "SCATTER", label: "Scatter Plot", icon: ScatterIcon },
  { value: "TABLE", label: "Data Table", icon: TableIcon },
  { value: "KPI", label: "KPI Metric", icon: Hash },
];

export default function DashboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { auth, isLoading, logout } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // View / Studio Toggle
  const [previewMode, setPreviewMode] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartData | null>(null);

  // Interactive Dashboard Filters & Cross-filtering
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilter[]>([]);
  // Drill-down state per chart
  const [drillDownStates, setDrillDownStates] = useState<Record<string, DrillDownState>>({});
  // Cache of query params to avoid duplicate requests
  const lastQueryParamsRef = useRef<Record<string, string>>({});

  // Query Results Cache for Canvas Charts: chartId -> query state
  const [chartQueryResults, setChartQueryResults] = useState<
    Record<string, { data: DatasetQueryResult | null; loading: boolean; error: string | null }>
  >({});

  // Deleting State
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);

  // Dashboard Meta Edit State
  const [isEditingDash, setIsEditingDash] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<DashboardStatus>("DRAFT");
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [savingDashEdit, setSavingDashEdit] = useState(false);
  const [showDeleteDashModal, setShowDeleteDashModal] = useState(false);

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  // URL search params sync: Load initial filters from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = parseFiltersFromUrl(window.location.search);
    if (initial.length > 0) {
      setDashboardFilters(initial);
    }
  }, []);

  // URL search params sync: Update URL when dashboard filters change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = encodeFiltersToUrl(dashboardFilters);
    const currentPath = window.location.pathname;
    const targetUrl = q ? `${currentPath}?${q}` : currentPath;
    window.history.replaceState(null, "", targetUrl);
  }, [dashboardFilters]);

  // Load dashboard, charts, and datasets
  useEffect(() => {
    if (!auth || !id) return;
    let ignore = false;

    Promise.all([
      apiGetDashboard(id),
      apiListCharts(id),
      apiListDatasets().catch(() => [] as DatasetData[]),
    ])
      .then(([dashData, chartsData, datasetsData]) => {
        if (!ignore) {
          setDashboard(dashData);
          setCharts(chartsData);
          setDatasets(datasetsData);
          setEditName(dashData.name);
          setEditDescription(dashData.description || "");
          setEditStatus(dashData.status);
          setEditVisibility(dashData.visibility);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, id]);

  // Execute query for a chart on the canvas with merged filters and drill-down
  const executeChartQuery = useCallback(
    async (
      chart: ChartData,
      activeFilters: DashboardFilter[],
      activeDrill?: DrillDownState | null,
      forceRefresh = false
    ) => {
      if (!chart.datasetId) {
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: { data: null, loading: false, error: null },
        }));
        return;
      }

      const dataset = datasets.find((d) => d.id === chart.datasetId);
      const datasetColumns = dataset?.columns;

      // Construct effective chart configuration with active drill dimension
      const effectiveConfig = JSON.parse(JSON.stringify(chart.config || {}));
      if (activeDrill && activeDrill.path && activeDrill.path.length > activeDrill.currentLevel) {
        const drillDim = activeDrill.path[activeDrill.currentLevel];
        effectiveConfig.dimensions = [drillDim];
      }

      // Merge chart-level filters with dashboard-level filters
      const mergedFilters = mergeChartAndDashboardFilters(
        chart,
        activeFilters,
        datasetColumns
      );

      // Append drill-down parent filters
      if (activeDrill && activeDrill.filters) {
        for (const df of activeDrill.filters) {
          mergedFilters.push({
            column: df.field,
            operator: "=",
            value: df.value,
          });
        }
      }

      effectiveConfig.filters = mergedFilters;
      const queryParams = buildChartQueryParams(effectiveConfig);

      // Query optimization: skip querying if params are identical and not forced
      const paramKey = JSON.stringify(queryParams);
      if (!forceRefresh && lastQueryParamsRef.current[chart.id] === paramKey) {
        return;
      }
      lastQueryParamsRef.current[chart.id] = paramKey;

      setChartQueryResults((prev) => ({
        ...prev,
        [chart.id]: { data: prev[chart.id]?.data ?? null, loading: true, error: null },
      }));

      try {
        const res = await apiQueryDataset(chart.datasetId, queryParams);
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: { data: res, loading: false, error: null },
        }));
      } catch (err) {
        setChartQueryResults((prev) => ({
          ...prev,
          [chart.id]: {
            data: null,
            loading: false,
            error: err instanceof ApiError ? err.message : "Query execution failed",
          },
        }));
      }
    },
    [datasets]
  );

  // Re-run queries for canvas charts when filters, drill levels, or charts list change
  useEffect(() => {
    if (loading || charts.length === 0) return;
    for (const chart of charts) {
      void executeChartQuery(chart, dashboardFilters, drillDownStates[chart.id] || null);
    }
  }, [charts, dashboardFilters, drillDownStates, executeChartQuery, loading]);

  // Handle data point interaction for cross-filtering or drill-down
  const handleChartDataPointClick = (chart: ChartData, field: string, value: unknown) => {
    // Check if chart has drillPath configured in config.options
    const drillPath = chart.config?.options?.drillPath as string[] | undefined;
    if (drillPath && drillPath.length > 1) {
      const currentDrill = drillDownStates[chart.id] || null;
      const nextDrill = drillDownNext(currentDrill, chart.id, drillPath, field, value);
      if (nextDrill && nextDrill !== currentDrill) {
        setDrillDownStates((prev) => ({ ...prev, [chart.id]: nextDrill }));
        return;
      }
    }

    // Standard cross-filter toggle
    setDashboardFilters((prev) =>
      toggleCrossFilter(prev, field, value, chart.id, chart.datasetId || undefined)
    );
  };

  // Revert drill-down to previous level
  const handleDrillBack = (chartId: string) => {
    setDrillDownStates((prev) => {
      const current = prev[chartId];
      if (!current) return prev;
      const reverted = drillDownPrev(current);
      if (!reverted) {
        const copy = { ...prev };
        delete copy[chartId];
        return copy;
      }
      return { ...prev, [chartId]: reverted };
    });
  };

  // Add dashboard filter
  const handleAddFilter = (filter: DashboardFilter) => {
    setDashboardFilters((prev) => [...prev, filter]);
  };

  // Remove dashboard filter
  const handleRemoveFilter = (filterId: string) => {
    setDashboardFilters((prev) => prev.filter((f) => f.id !== filterId));
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setDashboardFilters([]);
  };

  // Reset entire dashboard to default state
  const handleResetDashboard = () => {
    setDashboardFilters([]);
    setDrillDownStates({});
    lastQueryParamsRef.current = {};
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    for (const chart of charts) {
      void executeChartQuery(chart, [], null, true);
    }
    setSuccessMsg("Dashboard filters and drill levels reset to default state.");
  };

  // Open Visualization Studio for New Chart
  const handleOpenNewStudio = (presetType?: ChartType) => {
    setEditingChart(
      presetType
        ? ({
            title: `New ${presetType} Chart`,
            chartType: presetType,
            config: {},
          } as ChartData)
        : null
    );
    setIsStudioOpen(true);
  };

  // Open Visualization Studio to Edit Existing Chart
  const handleOpenEditStudio = (chart: ChartData) => {
    setEditingChart(chart);
    setIsStudioOpen(true);
  };

  // Delete chart
  const handleDeleteChart = async (chartId: string) => {
    if (!dashboard) return;
    setErrorMsg(null);

    try {
      await apiDeleteChart(dashboard.id, chartId);
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      setSuccessMsg("Visualization deleted from dashboard.");
      setDeletingChartId(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete visualization");
      setDeletingChartId(null);
    }
  };

  // Save dashboard metadata
  const handleSaveDashEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboard) return;
    setSavingDashEdit(true);

    try {
      const updated = await apiUpdateDashboard(dashboard.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      });

      setDashboard(updated);
      setIsEditingDash(false);
      setSuccessMsg("Dashboard details updated.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update dashboard");
    } finally {
      setSavingDashEdit(false);
    }
  };

  // Delete dashboard entirely
  const handleDeleteDashboard = async () => {
    if (!dashboard) return;
    try {
      await apiDeleteDashboard(dashboard.id);
      void router.replace("/dashboards");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
      setShowDeleteDashModal(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Opening Dashboard Studio...</span>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-base font-semibold text-gray-900">Dashboard not found</p>
          <Link
            href="/dashboards"
            className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            ← Back to Dashboards
          </Link>
        </div>
      </div>
    );
  }

  // If Studio is open, render the full 3-panel Visualization Studio
  if (isStudioOpen) {
    return (
      <VisualizationStudio
        dashboardId={id}
        dashboardName={dashboard.name}
        initialChart={editingChart}
        datasets={datasets}
        onClose={() => {
          setIsStudioOpen(false);
          setEditingChart(null);
        }}
        onSaved={(savedChart) => {
          setCharts((prev) => {
            const exists = prev.some((c) => c.id === savedChart.id);
            if (exists) {
              return prev.map((c) => (c.id === savedChart.id ? savedChart : c));
            }
            return [...prev, savedChart];
          });
          void executeChartQuery(savedChart, dashboardFilters, null, true);
          setIsStudioOpen(false);
          setEditingChart(null);
          setSuccessMsg(`Visualization "${savedChart.title}" saved successfully.`);
        }}
      />
    );
  }

  const userInitials = auth?.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canEdit = auth?.role === "ADMIN" || auth?.role === "ANALYST";

  const availableColumns: DatasetColumn[] = Array.from(
    new Map(
      datasets
        .flatMap((d) => d.columns || [])
        .map((c) => [c.name, c])
    ).values()
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col antialiased">
      {/* ============================================================ */}
      {/* 1. TOP BAR — Enterprise Dashboard Studio Header */}
      {/* ============================================================ */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm">
                R
              </span>
              <span className="text-sm tracking-tight">RicozViz</span>
            </Link>

            <span className="text-gray-300">/</span>
            <Link href="/dashboards" className="text-xs text-gray-500 hover:text-gray-900">
              Dashboards
            </Link>
            <span className="text-gray-300">/</span>

            {/* Dashboard Title & Badge */}
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-gray-900 line-clamp-1">
                {dashboard.name}
              </h1>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  dashboard.status === "PUBLISHED"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : dashboard.status === "ARCHIVED"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {dashboard.status}
              </span>
            </div>
          </div>

          {/* Right Controls: Mode Toggle, Add Visualization, Profile */}
          <div className="flex items-center gap-3">
            {/* View Mode Switch */}
            <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className={`rounded-md px-2.5 py-1 transition ${
                  !previewMode
                    ? "bg-white text-gray-900 shadow-2xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Studio</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className={`rounded-md px-2.5 py-1 transition ${
                  previewMode
                    ? "bg-white text-gray-900 shadow-2xs font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Preview</span>
                </span>
              </button>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => handleOpenNewStudio()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Visualization</span>
              </button>
            )}

            <div className="h-5 w-px bg-gray-200" />

            {/* Profile Avatar */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100">
                <span className="text-[11px] font-semibold text-indigo-700">{userInitials}</span>
              </div>
              <button
                onClick={() => {
                  void logout();
                  router.replace("/login");
                }}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Interactive Dashboard Filter Bar */}
      <DashboardFilterBar
        availableColumns={availableColumns}
        filters={dashboardFilters}
        onAddFilter={handleAddFilter}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
        onResetDashboard={handleResetDashboard}
      />

      {/* Global Alerts */}
      {errorMsg && (
        <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700 border-b border-red-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 px-4 py-2 text-xs font-medium text-green-700 border-b border-green-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. DASHBOARD BODY */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Quick Palette (Hidden in Preview Mode) */}
        {!previewMode && (
          <aside className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto hidden md:flex">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Visualizations
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Select a chart type to configure
              </p>
            </div>

            {/* Quick Chart Type Buttons */}
            <div className="p-3 space-y-1">
              {QUICK_CHART_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleOpenNewStudio(type.value)}
                    className="w-full flex items-center justify-between rounded-lg p-2 text-left text-xs font-medium text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600 transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-gray-500 group-hover:text-indigo-600" />
                      <span>{type.label}</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-indigo-500 text-xs font-bold">
                      +
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Available Datasets Section */}
            <div className="p-4 border-t border-gray-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Datasets</span>
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  {datasets.length}
                </span>
              </div>
              <div className="space-y-1.5 mt-2">
                {datasets.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No datasets found.</p>
                ) : (
                  datasets.map((ds) => (
                    <div
                      key={ds.id}
                      onClick={() => handleOpenNewStudio()}
                      className="rounded-lg border border-gray-100 p-2 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer text-xs"
                      title="Open in Visualization Studio"
                    >
                      <p className="font-semibold text-gray-800 line-clamp-1">{ds.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span className="rounded bg-gray-100 px-1.5 py-0.2 uppercase font-mono">
                          {ds.type}
                        </span>
                        {ds.rowCount !== undefined && <span>{ds.rowCount} rows</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active Charts Outline */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-indigo-500" />
                <span>Active Charts ({charts.length})</span>
              </span>
              <ul className="mt-2 space-y-1">
                {charts.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => handleOpenEditStudio(c)}
                    className="flex items-center justify-between text-xs text-gray-600 hover:text-indigo-600 cursor-pointer py-1 truncate"
                  >
                    <span className="truncate">📊 {c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* Center Canvas */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col">
          {/* Dashboard Meta Bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              {isEditingDash ? (
                <form onSubmit={handleSaveDashEdit} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-bold text-gray-900"
                  />
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                  />
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingDashEdit}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDash(false)}
                    className="text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-gray-900">{dashboard.name}</h2>
                  {dashboard.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{dashboard.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Dashboard Quick Meta Actions */}
            <div className="flex items-center gap-3 text-xs">
              {canEdit && !isEditingDash && (
                <button
                  type="button"
                  onClick={() => setIsEditingDash(true)}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 font-medium"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Info</span>
                </button>
              )}
              {auth?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDashModal(true)}
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {charts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                No visualizations on this dashboard
              </h3>
              <p className="mt-1 text-xs text-gray-500 max-w-sm">
                Open the Visualization Studio to select a dataset, configure measures and dimensions, and save interactive charts.
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleOpenNewStudio()}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Visualization</span>
                </button>
              )}
            </div>
          ) : (
            /* Dashboard Grid Canvas */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {charts.map((chart) => {
                const queryState = chartQueryResults[chart.id];
                const dims = chart.config?.dimensions || [];
                const measures = chart.config?.measures || [];
                const dataset = datasets.find((d) => d.id === chart.datasetId);
                const datasetColumns = dataset?.columns;

                const applicableFilters = dashboardFilters.filter((df) => {
                  if (df.isCrossFilter && df.sourceChartId === chart.id) return false;
                  return isFilterApplicableToChart(df, chart, datasetColumns);
                });

                const isCrossFilterSource = dashboardFilters.some(
                  (df) => df.isCrossFilter && df.sourceChartId === chart.id
                );
                const activeSourceFilter = dashboardFilters.find(
                  (df) => df.isCrossFilter && df.sourceChartId === chart.id
                );
                const activeDrill = drillDownStates[chart.id];

                return (
                  <div
                    key={chart.id}
                    className="rounded-xl border border-gray-200 bg-white shadow-xs flex flex-col justify-between overflow-hidden group hover:shadow-md transition"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                            {chart.title}
                          </h4>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-[10px] font-bold text-indigo-700 shrink-0">
                            {chart.chartType}
                          </span>
                        </div>
                        {chart.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {chart.description}
                          </p>
                        )}
                      </div>

                      {/* Card Actions: Refresh, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void executeChartQuery(chart, dashboardFilters, activeDrill, true)}
                          title="Refresh Query"
                          disabled={queryState?.loading}
                          className="rounded p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 text-xs transition"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${queryState?.loading ? "animate-spin text-indigo-600" : ""}`} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditStudio(chart)}
                              title="Edit in Visualization Studio"
                              className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs transition"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingChartId(chart.id)}
                              title="Delete Visualization"
                              className="rounded p-1 text-red-400 hover:text-red-700 hover:bg-red-50 text-xs transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Filter / Drill-down Indicators */}
                    {(applicableFilters.length > 0 || isCrossFilterSource || activeDrill) && (
                      <div className="px-4 py-1.5 bg-indigo-50/40 border-b border-indigo-100 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {isCrossFilterSource && activeSourceFilter && (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 shadow-2xs">
                            <span>⚡ Cross-filtering: {activeSourceFilter.field} = {String(activeSourceFilter.value)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(activeSourceFilter.id)}
                              className="hover:text-indigo-950 font-bold ml-1"
                              title="Clear cross-filter"
                            >
                              ×
                            </button>
                          </span>
                        )}
                        {applicableFilters.map((af) => (
                          <span
                            key={af.id}
                            className="inline-flex items-center gap-1 rounded bg-white text-gray-700 border border-indigo-200 px-2 py-0.5 shadow-2xs font-medium"
                          >
                            <span>Filtered by: <strong className="font-semibold text-gray-900">{af.field}</strong> {af.operator} {String(af.value)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(af.id)}
                              className="text-gray-400 hover:text-gray-700 font-bold ml-1"
                              title="Remove this filter"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {activeDrill && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 font-medium shadow-2xs">
                            <span>Drill level: <strong>{activeDrill.path[activeDrill.currentLevel]}</strong></span>
                            <button
                              type="button"
                              onClick={() => handleDrillBack(chart.id)}
                              className="text-indigo-600 hover:text-indigo-800 underline font-semibold ml-1 cursor-pointer"
                            >
                              ← Back
                            </button>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Visualization Body */}
                    <div className="p-4 flex-1 flex flex-col justify-center min-h-[260px]">
                      <ChartRenderer
                        chartType={chart.chartType}
                        config={chart.config}
                        queryResult={queryState?.data || null}
                        isLoading={queryState?.loading || false}
                        error={queryState?.error || null}
                        height={250}
                        onDataPointClick={(field, value) => handleChartDataPointClick(chart, field, value)}
                        selectedFilterValue={
                          dashboardFilters.find(
                            (f) => f.isCrossFilter && f.sourceChartId === chart.id
                          )?.value
                        }
                        onClearFilter={() => {
                          setDashboardFilters((prev) =>
                            prev.filter((f) => !isFilterApplicableToChart(f, chart, datasetColumns))
                          );
                        }}
                        drillDown={
                          chart.config?.options?.drillPath
                            ? {
                                path: chart.config.options.drillPath as string[],
                                currentLevel: drillDownStates[chart.id]?.currentLevel ?? 0,
                                onDrillBack: () => handleDrillBack(chart.id),
                              }
                            : null
                        }
                      />
                    </div>

                    {/* Card Metadata Footer */}
                    <div className="px-4 py-2 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span className="truncate max-w-[140px] flex items-center gap-1">
                        <Database className="h-3 w-3 text-gray-400 shrink-0" />
                        <span>{chart.datasetName || "Dataset"}</span>
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {dims.length > 0 && <span>Dim: {dims[0]}</span>}
                        {measures.length > 0 && (
                          <span>
                            {measures[0].aggregation}({measures[0].column})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Delete Chart Confirmation Modal */}
      {deletingChartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Delete Visualization?</h3>
            <p className="mt-1 text-xs text-gray-500">
              Are you sure you want to remove this chart from the dashboard? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingChartId(null)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteChart(deletingChartId)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dashboard Confirmation Modal */}
      {showDeleteDashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Delete Dashboard?</h3>
            <p className="mt-1 text-xs text-gray-500">
              This will permanently delete this dashboard and all associated visualization configurations.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteDashModal(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDashboard()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
