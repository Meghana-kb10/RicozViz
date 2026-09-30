"use client";

import { useEffect, useState, use } from "react";
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
  type DashboardData,
  type DashboardStatus,
  type DashboardVisibility,
  type ChartData,
  type ChartType,
  type DatasetData,
  ApiError,
} from "../../../lib/api";

const CHART_TYPES: { value: ChartType; label: string; icon: string }[] = [
  { value: "BAR", label: "Bar Chart", icon: "📊" },
  { value: "LINE", label: "Line Chart", icon: "📈" },
  { value: "AREA", label: "Area Chart", icon: "📉" },
  { value: "PIE", label: "Pie Chart", icon: "🥧" },
  { value: "DONUT", label: "Donut Chart", icon: "🍩" },
  { value: "SCATTER", label: "Scatter Plot", icon: "⚬" },
  { value: "TABLE", label: "Data Table", icon: "📋" },
  { value: "KPI", label: "KPI Metric", icon: "🔢" },
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

  // Edit Dashboard State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<DashboardStatus>("DRAFT");
  const [editVisibility, setEditVisibility] = useState<DashboardVisibility>("ORGANIZATION");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Dashboard State
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add Chart Modal State
  const [showAddChart, setShowAddChart] = useState(false);
  const [chartTitle, setChartTitle] = useState("");
  const [chartDesc, setChartDesc] = useState("");
  const [chartType, setChartType] = useState<ChartType>("BAR");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [dimensionCol, setDimensionCol] = useState("");
  const [measureCol, setMeasureCol] = useState("");
  const [measureAgg, setMeasureAgg] = useState<"SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "DISTINCT_COUNT">("SUM");
  const [savingChart, setSavingChart] = useState(false);

  // Edit Chart Modal State
  const [editingChart, setEditingChart] = useState<ChartData | null>(null);
  const [editChartTitle, setEditChartTitle] = useState("");
  const [editChartDesc, setEditChartDesc] = useState("");
  const [editChartType, setEditChartType] = useState<ChartType>("BAR");
  const [editDatasetId, setEditDatasetId] = useState("");
  const [updatingChart, setUpdatingChart] = useState(false);

  // Delete Chart State
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

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
          setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard details");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [auth, id]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard) return;
    setSavingEdit(true);
    setErrorMsg(null);

    try {
      const updated = await apiUpdateDashboard(dashboard.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        visibility: editVisibility,
      });

      setDashboard(updated);
      setIsEditing(false);
      setSuccessMsg("Dashboard updated successfully.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update dashboard");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!dashboard) return;
    setIsDeleting(true);

    try {
      await apiDeleteDashboard(dashboard.id);
      router.push("/dashboards");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete dashboard");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleCreateChart(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard) return;
    setSavingChart(true);
    setErrorMsg(null);

    try {
      const config: ChartData["config"] = {
        dimensions: dimensionCol.trim() ? [dimensionCol.trim()] : [],
        measures: measureCol.trim()
          ? [{ column: measureCol.trim(), aggregation: measureAgg }]
          : [],
      };

      const created = await apiCreateChart(dashboard.id, {
        title: chartTitle.trim(),
        description: chartDesc.trim() || null,
        chartType,
        datasetId: selectedDatasetId || null,
        config,
      });

      setCharts((prev) => [...prev, created]);
      setSuccessMsg(`Visualization "${created.title}" added.`);
      setShowAddChart(false);
      // Reset form
      setChartTitle("");
      setChartDesc("");
      setChartType("BAR");
      setSelectedDatasetId("");
      setDimensionCol("");
      setMeasureCol("");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to create chart");
    } finally {
      setSavingChart(false);
    }
  }

  function startEditChart(chart: ChartData) {
    setEditingChart(chart);
    setEditChartTitle(chart.title);
    setEditChartDesc(chart.description || "");
    setEditChartType(chart.chartType);
    setEditDatasetId(chart.datasetId || "");
  }

  async function handleUpdateChart(e: React.FormEvent) {
    e.preventDefault();
    if (!dashboard || !editingChart) return;
    setUpdatingChart(true);
    setErrorMsg(null);

    try {
      const updated = await apiUpdateChart(dashboard.id, editingChart.id, {
        title: editChartTitle.trim(),
        description: editChartDesc.trim() || null,
        chartType: editChartType,
        datasetId: editDatasetId || null,
      });

      setCharts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSuccessMsg(`Visualization "${updated.title}" updated.`);
      setEditingChart(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update chart");
    } finally {
      setUpdatingChart(false);
    }
  }

  async function handleDeleteChart(chartId: string) {
    if (!dashboard) return;
    setErrorMsg(null);

    try {
      await apiDeleteChart(dashboard.id, chartId);
      setCharts((prev) => prev.filter((c) => c.id !== chartId));
      setSuccessMsg("Visualization deleted successfully.");
      setDeletingChartId(null);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to delete chart");
      setDeletingChartId(null);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
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
  const canDelete = auth?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm">
                R
              </span>
              <span>RicozViz</span>
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/workspace" className="text-sm text-gray-500 hover:text-gray-900">
              Workspace
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/dashboards" className="text-sm text-gray-500 hover:text-gray-900">
              Dashboards
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-900 line-clamp-1">{dashboard.name}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{auth?.user.name}</p>
              <p className="text-xs text-gray-500">
                {auth?.role} · {auth?.organization.name}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
              <span className="text-xs font-semibold text-indigo-700">{userInitials}</span>
            </div>
            <button
              onClick={() => {
                void logout();
                router.replace("/login");
              }}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex-1 w-full">
        {/* Navigation Breadcrumb Back */}
        <div className="mb-4">
          <Link
            href="/dashboards"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 inline-flex items-center gap-1"
          >
            ← Back to all Dashboards
          </Link>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200 flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold text-red-500">×</button>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-xs font-medium text-green-700 border border-green-200 flex justify-between items-center">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-green-500">×</button>
          </div>
        )}

        {/* Dashboard Header Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="flex-1">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3 max-w-md">
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-base font-bold text-gray-900"
                  />
                  <input
                    type="text"
                    maxLength={500}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as DashboardStatus)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    <select
                      value={editVisibility}
                      onChange={(e) => setEditVisibility(e.target.value as DashboardVisibility)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="ORGANIZATION">Organization</option>
                      <option value="PRIVATE">Private</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
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
                  <p className="mt-1 text-xs text-gray-500">
                    {dashboard.description || "No description provided."}
                  </p>
                </>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 self-start">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ✏️ Edit Details
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Visibility</span>
              <span className="font-semibold text-gray-900">
                🔒 {dashboard.visibility}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Visualizations</span>
              <span className="font-semibold text-gray-900">
                {charts.length} {charts.length === 1 ? "chart" : "charts"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Owner</span>
              <span className="font-semibold text-gray-900">
                {dashboard.ownerName || "Organization Member"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Created</span>
              <span className="font-semibold text-gray-900">
                {new Date(dashboard.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Visualizations Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Visualizations</h2>
            <p className="text-xs text-gray-500">
              Configured charts and metrics in this dashboard canvas.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAddChart(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <span>+</span>
              <span>Add Visualization</span>
            </button>
          )}
        </div>

        {/* Dashboard Charts Canvas Area */}
        {charts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center bg-white shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
              📈
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900">No visualizations added yet.</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-md mx-auto">
              Add your first chart to start exploring metrics and trends on this dashboard.
            </p>
            {canEdit && (
              <button
                onClick={() => setShowAddChart(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                + Add Visualization
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {charts.map((chart) => {
              const matchedType = CHART_TYPES.find((t) => t.value === chart.chartType);
              const dims = chart.config?.dimensions || [];
              const measures = chart.config?.measures || [];

              return (
                <div
                  key={chart.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Title & Type */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-sm text-gray-900 leading-snug">
                        {chart.title}
                      </h4>
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase shrink-0">
                        <span>{matchedType?.icon || "📊"}</span>
                        <span>{chart.chartType}</span>
                      </span>
                    </div>

                    {/* Description */}
                    {chart.description && (
                      <p className="text-xs text-gray-500 mb-3">{chart.description}</p>
                    )}

                    {/* Dataset Info */}
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Dataset:</span>
                        <span className="font-semibold text-gray-800">
                          {chart.datasetName || "None linked"}
                        </span>
                      </div>
                      {dims.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Dimension:</span>
                          <span className="font-mono text-gray-700">{dims.join(", ")}</span>
                        </div>
                      )}
                      {measures.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Measure:</span>
                          <span className="font-mono text-gray-700">
                            {measures.map((m) => `${m.aggregation}(${m.column})`).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions: Edit / Delete */}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-end gap-2 text-xs">
                    {canEdit && (
                      <button
                        onClick={() => startEditChart(chart)}
                        className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100 font-medium"
                      >
                        ✏️ Edit
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => setDeletingChartId(chart.id)}
                        className="rounded px-2 py-1 text-red-600 hover:bg-red-50 font-medium"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Visualization Modal */}
        {showAddChart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-gray-900">Add Visualization</h3>
                <button
                  type="button"
                  onClick={() => setShowAddChart(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateChart} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Visualization Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. Monthly Revenue by Region"
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Chart Type *
                  </label>
                  <select
                    value={chartType}
                    onChange={(e) => setChartType(e.target.value as ChartType)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  >
                    {CHART_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label} ({type.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Linked Dataset
                  </label>
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No dataset linked --</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="Brief description or purpose"
                    value={chartDesc}
                    onChange={(e) => setChartDesc(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-[11px] uppercase tracking-wider">
                    Query Configuration
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-gray-600 mb-1">
                        Dimension (e.g. region, date)
                      </label>
                      <input
                        type="text"
                        placeholder="Column name"
                        value={dimensionCol}
                        onChange={(e) => setDimensionCol(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-gray-600 mb-1">
                        Measure Column
                      </label>
                      <input
                        type="text"
                        placeholder="Column name (e.g. revenue)"
                        value={measureCol}
                        onChange={(e) => setMeasureCol(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-gray-600 mb-1">
                      Aggregation
                    </label>
                    <select
                      value={measureAgg}
                      onChange={(e) =>
                        setMeasureAgg(e.target.value as "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "DISTINCT_COUNT")
                      }
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 bg-white"
                    >
                      <option value="SUM">SUM</option>
                      <option value="AVG">AVG</option>
                      <option value="COUNT">COUNT</option>
                      <option value="MIN">MIN</option>
                      <option value="MAX">MAX</option>
                      <option value="DISTINCT_COUNT">DISTINCT_COUNT</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddChart(false)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingChart}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {savingChart ? "Creating..." : "Create Visualization"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Visualization Modal */}
        {editingChart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-gray-900">Edit Visualization</h3>
                <button
                  type="button"
                  onClick={() => setEditingChart(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdateChart} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editChartTitle}
                    onChange={(e) => setEditChartTitle(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Chart Type *
                  </label>
                  <select
                    value={editChartType}
                    onChange={(e) => setEditChartType(e.target.value as ChartType)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                  >
                    {CHART_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label} ({type.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Linked Dataset
                  </label>
                  <select
                    value={editDatasetId}
                    onChange={(e) => setEditDatasetId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                  >
                    <option value="">-- No dataset linked --</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    value={editChartDesc}
                    onChange={(e) => setEditChartDesc(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingChart(null)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingChart}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {updatingChart ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-base font-bold text-gray-900 mb-2">Delete Dashboard</h3>
              <p className="text-xs text-gray-500 mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">&ldquo;{dashboard.name}&rdquo;</span>? This will permanently delete this dashboard canvas and all configured visualizations.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

