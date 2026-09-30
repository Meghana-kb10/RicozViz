"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../contexts/auth-context";
import {
  apiGetDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  apiListCharts,
  apiCreateChart,
  apiUpdateChart,
  apiDeleteChart,
  apiListDatasets,
  apiGetDataset,
  apiQueryDataset,
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  type ChartData,
  type ChartType,
  type ChartConfig,
  type DatasetData,
  type DatasetQueryResult,
  type AggregationFunction,
  type FilterOperator,
  ApiError,
} from "../../../lib/api";
import { buildChartQueryParams } from "../../../lib/chart-query-mapper";
import { ChartRenderer } from "../../../components/charts/ChartRenderer";

const CHART_TYPES: { value: ChartType; label: string; icon: string; desc: string }[] = [
  { value: "BAR", label: "Bar Chart", icon: "📊", desc: "Compare values across categories" },
  { value: "LINE", label: "Line Chart", icon: "📈", desc: "Display continuous time trends" },
  { value: "AREA", label: "Area Chart", icon: "📉", desc: "Track volume progression over time" },
  { value: "PIE", label: "Pie Chart", icon: "🥧", desc: "Show relative percentage proportions" },
  { value: "DONUT", label: "Donut Chart", icon: "🍩", desc: "Ring breakdown of share" },
  { value: "SCATTER", label: "Scatter Plot", icon: "⚬", desc: "Correlate two numeric metrics" },
  { value: "TABLE", label: "Data Table", icon: "📋", desc: "Tabular view of raw/aggregated data" },
  { value: "KPI", label: "KPI Metric", icon: "🔢", desc: "Highlight a single key aggregated value" },
];

const AGGREGATIONS: AggregationFunction[] = ["SUM", "AVG", "COUNT", "MIN", "MAX"];
const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "=", label: "Equals (=)" },
  { value: "!=", label: "Not Equals (!=)" },
  { value: ">", label: "Greater Than (>)" },
  { value: ">=", label: "Greater Than or Equal (>=)" },
  { value: "<", label: "Less Than (<)" },
  { value: "<=", label: "Less Than or Equal (<=)" },
  { value: "contains", label: "Contains" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
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

  // Studio Mode State
  const [previewMode, setPreviewMode] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Query Results Cache for Canvas Charts: chartId -> query state
  const [chartQueryResults, setChartQueryResults] = useState<
    Record<string, { data: DatasetQueryResult | null; loading: boolean; error: string | null }>
  >({});

  // Active Chart Builder State
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderChartType, setBuilderChartType] = useState<ChartType>("BAR");
  const [builderDatasetId, setBuilderDatasetId] = useState("");
  const [builderDimensions, setBuilderDimensions] = useState<string[]>([]);
  const [builderMeasureCol, setBuilderMeasureCol] = useState("");
  const [builderMeasureAgg, setBuilderMeasureAgg] = useState<AggregationFunction>("SUM");
  const [builderFilterCol, setBuilderFilterCol] = useState("");
  const [builderFilterOp, setBuilderFilterOp] = useState<FilterOperator>("=");
  const [builderFilterVal, setBuilderFilterVal] = useState("");
  const [builderSortCol, setBuilderSortCol] = useState("");
  const [builderSortDir, setBuilderSortDir] = useState<"asc" | "desc">("desc");

  // Selected Dataset Schema for Builder
  const [activeDatasetDetail, setActiveDatasetDetail] = useState<DatasetData | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Preview in Builder
  const [previewResult, setPreviewResult] = useState<DatasetQueryResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Saving State
  const [savingChart, setSavingChart] = useState(false);
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);

  // Dashboard Edit State
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

  // Load dashboard and charts
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

  // Execute query for a chart on the canvas
  const executeChartQuery = useCallback(async (chart: ChartData) => {
    if (!chart.datasetId) {
      setChartQueryResults((prev) => ({
        ...prev,
        [chart.id]: { data: null, loading: false, error: null },
      }));
      return;
    }

    setChartQueryResults((prev) => ({
      ...prev,
      [chart.id]: { data: prev[chart.id]?.data ?? null, loading: true, error: null },
    }));

    try {
      const queryParams = buildChartQueryParams(chart.config);
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
  }, []);

  // Fetch queries for all charts on canvas
  useEffect(() => {
    for (const chart of charts) {
      if (!chartQueryResults[chart.id]) {
        void executeChartQuery(chart);
      }
    }
  }, [charts, executeChartQuery, chartQueryResults]);

  // When builder dataset changes, fetch its full schema
  useEffect(() => {
    if (!builderDatasetId) {
      setActiveDatasetDetail(null);
      return;
    }

    let ignore = false;
    setLoadingSchema(true);
    apiGetDataset(builderDatasetId)
      .then((ds) => {
        if (!ignore) {
          setActiveDatasetDetail(ds);
          setLoadingSchema(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoadingSchema(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [builderDatasetId]);

  // Open builder to create a new chart
  function openCreateBuilder(presetType?: ChartType) {
    setEditingChartId(null);
    setBuilderTitle("");
    setBuilderDesc("");
    setBuilderChartType(presetType || "BAR");
    const defaultDs = datasets.length > 0 ? datasets[0].id : "";
    setBuilderDatasetId(defaultDs);
    setBuilderDimensions([]);
    setBuilderMeasureCol("");
    setBuilderMeasureAgg("SUM");
    setBuilderFilterCol("");
    setBuilderFilterOp("=");
    setBuilderFilterVal("");
    setBuilderSortCol("");
    setBuilderSortDir("desc");
    setPreviewResult(null);
    setPreviewError(null);
    setIsPanelOpen(true);
  }

  // Open builder to edit an existing chart
  function openEditBuilder(chart: ChartData) {
    setEditingChartId(chart.id);
    setBuilderTitle(chart.title);
    setBuilderDesc(chart.description || "");
    setBuilderChartType(chart.chartType);
    setBuilderDatasetId(chart.datasetId || "");
    setBuilderDimensions(chart.config.dimensions || []);

    const firstMeasure = chart.config.measures?.[0];
    setBuilderMeasureCol(firstMeasure?.column || "");
    setBuilderMeasureAgg((firstMeasure?.aggregation as AggregationFunction) || "SUM");

    const firstFilter = chart.config.filters?.[0];
    setBuilderFilterCol(firstFilter?.column || "");
    setBuilderFilterOp((firstFilter?.operator as FilterOperator) || "=");
    setBuilderFilterVal(firstFilter?.value !== undefined ? String(firstFilter.value) : "");

    setBuilderSortCol(chart.config.sort?.column || "");
    setBuilderSortDir(
      (chart.config.sort?.direction?.toLowerCase() as "asc" | "desc") || "desc"
    );

    setPreviewResult(chartQueryResults[chart.id]?.data || null);
    setPreviewError(null);
    setIsPanelOpen(true);
  }

  // Build current chart config from builder state
  function getBuilderConfig(): ChartConfig {
    const config: ChartConfig = {
      dimensions: builderDimensions,
      measures: builderMeasureCol
        ? [
            {
              column: builderMeasureCol,
              aggregation: builderMeasureAgg,
              alias: `${builderMeasureAgg.toLowerCase()}_${builderMeasureCol}`,
            },
          ]
        : [],
    };

    if (builderFilterCol && builderFilterVal) {
      config.filters = [
        {
          column: builderFilterCol,
          operator: builderFilterOp,
          value: builderFilterVal,
        },
      ];
    }

    if (builderSortCol) {
      config.sort = {
        column: builderSortCol,
        direction: builderSortDir,
      };
    }

    return config;
  }

  // Run preview query inside Studio
  async function handleRunPreview() {
    if (!builderDatasetId) {
      setPreviewError("Please select a dataset to query");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const config = getBuilderConfig();
      const params = buildChartQueryParams(config);
      const res = await apiQueryDataset(builderDatasetId, params);
      setPreviewResult(res);
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : "Query failed");
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Save chart from Studio builder
  async function handleSaveChart(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard) return;

    if (!builderTitle.trim()) {
      setErrorMsg("Chart title is required");
      return;
    }

    setSavingChart(true);
    setErrorMsg(null);

    const config = getBuilderConfig();

    try {
      if (editingChartId) {
        // Update existing chart
        const updated = await apiUpdateChart(dashboard.id, editingChartId, {
          title: builderTitle.trim(),
          description: builderDesc.trim() || null,
          chartType: builderChartType,
          datasetId: builderDatasetId || null,
          config,
        });

        setCharts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        void executeChartQuery(updated);
        setSuccessMsg(`Visualization "${updated.title}" updated.`);
      } else {
        // Create new chart
        const created = await apiCreateChart(dashboard.id, {
          title: builderTitle.trim(),
          description: builderDesc.trim() || null,
          chartType: builderChartType,
          datasetId: builderDatasetId || null,
          config,
        });

        setCharts((prev) => [...prev, created]);
        void executeChartQuery(created);
        setSuccessMsg(`Visualization "${created.title}" created.`);
      }

      setIsPanelOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save chart");
    } finally {
      setSavingChart(false);
    }
  }

  // Delete chart
  async function handleDeleteChart(chartId: string) {
    if (!dashboard) return;
    setErrorMsg(null);

    try {
      await apiDeleteChart(dashboard.id, chartId);
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      setSuccessMsg("Visualization deleted.");
      setDeletingChartId(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete visualization");
      setDeletingChartId(null);
    }
  }

  // Save dashboard metadata
  async function handleSaveDashEdit(e: React.FormEvent) {
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
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Opening Visualization Studio...</span>
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

  const userInitials = auth?.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canEdit = auth?.role === "ADMIN" || auth?.role === "ANALYST";
  const columns = activeDatasetDetail?.columns || [];
  const dimensionCols = columns.filter((c) =>
    ["string", "varchar", "text", "date", "timestamp", "boolean"].includes(
      c.type.toLowerCase()
    )
  );
  const measureCols = columns.filter((c) =>
    ["int", "integer", "number", "float", "decimal", "numeric", "bigint"].includes(
      c.type.toLowerCase()
    )
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
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🛠️ Studio
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMode(true);
                  setIsPanelOpen(false);
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  previewMode
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                👁️ Preview
              </button>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => openCreateBuilder()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
              >
                <span>+</span>
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

      {/* Global Alerts */}
      {errorMsg && (
        <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700 border-b border-red-200 flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 px-4 py-2 text-xs font-medium text-green-700 border-b border-green-200 flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. STUDIO WORKSPACE BODY (3-Pane Workspace) */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============================================================ */}
        {/* LEFT SIDEBAR — Visualization Palette & Datasets */}
        {/* ============================================================ */}
        {!previewMode && (
          <aside className="w-64 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto hidden md:flex">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Visualizations
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Pick a chart type to construct
              </p>
            </div>

            {/* Quick Chart Type Buttons */}
            <div className="p-3 space-y-1">
              {CHART_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => openCreateBuilder(type.value)}
                  className="w-full flex items-center justify-between rounded-lg p-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{type.icon}</span>
                    <span>{type.label}</span>
                  </div>
                  <span className="text-gray-300 group-hover:text-indigo-500 text-xs font-bold">
                    +
                  </span>
                </button>
              ))}
            </div>

            {/* Available Datasets Section */}
            <div className="p-4 border-t border-gray-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Organization Datasets
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
                      onClick={() => {
                        setBuilderDatasetId(ds.id);
                        if (!isPanelOpen) openCreateBuilder();
                      }}
                      className="rounded-lg border border-gray-100 p-2 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer text-xs"
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

            {/* Canvas Charts Outline */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Active Charts ({charts.length})
              </span>
              <ul className="mt-2 space-y-1">
                {charts.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => openEditBuilder(c)}
                    className="flex items-center justify-between text-xs text-gray-600 hover:text-indigo-600 cursor-pointer py-0.5 truncate"
                  >
                    <span className="truncate">📈 {c.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* ============================================================ */}
        {/* CENTER CANVAS — Dashboard Grid & Rendered Visualizations */}
        {/* ============================================================ */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col">
          {/* Dashboard Meta Bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDash(false)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-gray-900">{dashboard.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dashboard.description || "Dashboard canvas ready for exploration."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400">
                {charts.length} {charts.length === 1 ? "visualization" : "visualizations"}
              </span>
              {canEdit && !isEditingDash && (
                <button
                  type="button"
                  onClick={() => setIsEditingDash(true)}
                  className="text-gray-500 hover:text-gray-900 font-medium"
                >
                  ✏️ Edit Name
                </button>
              )}
              {auth?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setShowDeleteDashModal(true)}
                  className="text-red-500 hover:text-red-700 font-medium"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {charts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
                📊
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">
                No visualizations on this dashboard
              </h3>
              <p className="mt-1 text-xs text-gray-500 max-w-sm">
                Create a visualization using the Studio controls to query and plot your datasets.
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => openCreateBuilder()}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  + Add Visualization
                </button>
              )}
            </div>
          ) : (
            /* Dashboard Grid Canvas */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {charts.map((chart) => {
                const queryState = chartQueryResults[chart.id];
                const matchedType = CHART_TYPES.find((t) => t.value === chart.chartType);
                const dims = chart.config?.dimensions || [];
                const measures = chart.config?.measures || [];

                return (
                  <div
                    key={chart.id}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden group hover:shadow-md transition"
                  >
                    {/* Card Header */}
                    <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                            {chart.title}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 shrink-0">
                            <span>{matchedType?.icon}</span>
                            <span>{chart.chartType}</span>
                          </span>
                        </div>
                        {chart.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {chart.description}
                          </p>
                        )}
                      </div>

                      {/* Card Actions */}
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => openEditBuilder(chart)}
                            title="Edit Visualization"
                            className="rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingChartId(chart.id)}
                            title="Delete Visualization"
                            className="rounded p-1 text-red-400 hover:text-red-700 hover:bg-red-50 text-xs"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Visualization Body */}
                    <div className="p-4 flex-1 flex flex-col justify-center">
                      <ChartRenderer
                        chartType={chart.chartType}
                        config={chart.config}
                        queryResult={queryState?.data || null}
                        isLoading={queryState?.loading || false}
                        error={queryState?.error || null}
                        height={250}
                      />
                    </div>

                    {/* Card Metadata Footer */}
                    <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                      <span className="truncate max-w-[140px]">
                        📁 {chart.datasetName || "No dataset"}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-gray-400">
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

        {/* ============================================================ */}
        {/* 3. RIGHT SIDEBAR — Interactive Visualization Studio Builder */}
        {/* ============================================================ */}
        {isPanelOpen && !previewMode && (
          <aside className="w-96 border-l border-gray-200 bg-white flex flex-col shrink-0 shadow-lg z-10 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  {editingChartId ? "Edit Visualization" : "Visualization Studio"}
                </h3>
                <p className="text-[11px] text-gray-500">
                  Configure dataset query & plotting
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveChart} className="p-4 space-y-4 text-xs flex-1">
              {/* Chart Title */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Chart Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. Sales by Region"
                  value={builderTitle}
                  onChange={(e) => setBuilderTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Chart Type Selector */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Chart Type *
                </label>
                <select
                  value={builderChartType}
                  onChange={(e) => setBuilderChartType(e.target.value as ChartType)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                >
                  {CHART_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dataset Selector */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Dataset *
                </label>
                <select
                  value={builderDatasetId}
                  onChange={(e) => {
                    setBuilderDatasetId(e.target.value);
                    setBuilderDimensions([]);
                    setBuilderMeasureCol("");
                    setPreviewResult(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Select a Dataset --</option>
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dataset Schema Columns Tag Cloud */}
              {loadingSchema ? (
                <p className="text-[11px] text-gray-400">Loading dataset schema...</p>
              ) : activeDatasetDetail ? (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Available Schema Columns</span>
                    <span>{columns.length}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {dimensionCols.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setBuilderDimensions([c.name])}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono border transition ${
                          builderDimensions.includes(c.name)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                        }`}
                      >
                        🔤 {c.name}
                      </button>
                    ))}
                    {measureCols.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setBuilderMeasureCol(c.name)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono border transition ${
                          builderMeasureCol === c.name
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-700 border-gray-200 hover:border-emerald-300"
                        }`}
                      >
                        🔢 {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Dimensions Picker */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Dimension (X-Axis / Category)
                </label>
                <select
                  value={builderDimensions[0] || ""}
                  onChange={(e) =>
                    setBuilderDimensions(e.target.value ? [e.target.value] : [])
                  }
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900"
                >
                  <option value="">-- None (Raw or Whole Dataset) --</option>
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Measures Picker */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Measure (Metric)
                  </label>
                  <select
                    value={builderMeasureCol}
                    onChange={(e) => setBuilderMeasureCol(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  >
                    <option value="">-- None --</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Aggregation
                  </label>
                  <select
                    value={builderMeasureAgg}
                    onChange={(e) =>
                      setBuilderMeasureAgg(e.target.value as AggregationFunction)
                    }
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                  >
                    {AGGREGATIONS.map((agg) => (
                      <option key={agg} value={agg}>
                        {agg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filter */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <span className="block font-semibold text-gray-700 text-[11px] uppercase tracking-wider">
                  Filter (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={builderFilterCol}
                    onChange={(e) => setBuilderFilterCol(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">-- Column --</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={builderFilterOp}
                    onChange={(e) => setBuilderFilterOp(e.target.value as FilterOperator)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {FILTER_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Filter value..."
                  value={builderFilterVal}
                  onChange={(e) => setBuilderFilterVal(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </div>

              {/* Sorting */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <span className="block font-semibold text-gray-700 text-[11px] uppercase tracking-wider">
                  Sorting
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={builderSortCol}
                    onChange={(e) => setBuilderSortCol(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="">-- Sort by Column --</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={builderSortDir}
                    onChange={(e) => setBuilderSortDir(e.target.value as "asc" | "desc")}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>

              {/* Studio Live Preview Box */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700 text-[11px] uppercase tracking-wider">
                    Query Preview
                  </span>
                  <button
                    type="button"
                    onClick={handleRunPreview}
                    disabled={previewLoading || !builderDatasetId}
                    className="rounded bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                  >
                    {previewLoading ? "Running..." : "▶ Run Query"}
                  </button>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-2">
                  <ChartRenderer
                    chartType={builderChartType}
                    config={getBuilderConfig()}
                    queryResult={previewResult}
                    isLoading={previewLoading}
                    error={previewError}
                    height={160}
                  />
                  {previewResult && (
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span>{previewResult.rowCount} rows</span>
                      <span>{previewResult.executionTimeMs}ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChart}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
                >
                  {savingChart
                    ? "Saving..."
                    : editingChartId
                      ? "Update Chart"
                      : "Save Chart"}
                </button>
              </div>
            </form>
          </aside>
        )}
      </div>

      {/* Delete Chart Confirmation Modal */}
      {deletingChartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">Delete Visualization</h3>
            <p className="text-xs text-gray-500 mb-4">
              Are you sure you want to remove this visualization from the dashboard?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingChartId(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">Delete Dashboard</h3>
            <p className="text-xs text-gray-500 mb-4">
              Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{dashboard.name}&rdquo;</span>? This will permanently delete this dashboard and all visualizations.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDashModal(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!dashboard) return;
                  try {
                    await apiDeleteDashboard(dashboard.id);
                    router.push("/dashboards");
                  } catch (err) {
                    setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
                    setShowDeleteDashModal(false);
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
