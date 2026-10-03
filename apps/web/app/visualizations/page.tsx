"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Table as TableIcon,
  Gauge,
  Plus,
  Trash2,
  Play,
  Save,
  RefreshCw,
  Database,
  ArrowUpDown,
  Filter as FilterIcon,
  Check,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "../../contexts/auth-context";
import {
  apiListDatasets,
  apiQueryDataset,
  apiListVisualizations,
  apiCreateVisualization,
  apiUpdateVisualization,
  apiDeleteVisualization,
  type DatasetData,
  type DatasetColumn,
  type DatasetQueryResult,
  type VisualizationData,
  type ChartType,
  type AggregationFunction,
} from "../../lib/api";
import { ChartRenderer } from "../../components/charts/ChartRenderer";

const CHART_TYPES: Array<{
  id: ChartType;
  label: string;
  icon: typeof BarChart3;
  description: string;
}> = [
  { id: "BAR", label: "Bar Chart", icon: BarChart3, description: "Compare categorical values" },
  { id: "LINE", label: "Line Chart", icon: LineChartIcon, description: "Trends and continuous sequences" },
  { id: "AREA", label: "Area Chart", icon: AreaChartIcon, description: "Volume and trend over categories" },
  { id: "PIE", label: "Pie Chart", icon: PieChartIcon, description: "Proportions and shares" },
  { id: "DONUT", label: "Donut Chart", icon: PieChartIcon, description: "Ring proportions with center readout" },
  { id: "TABLE", label: "Data Table", icon: TableIcon, description: "Tabular records and aggregations" },
  { id: "KPI", label: "KPI Metric", icon: Gauge, description: "Single highlighted key metric" },
];

const AGGREGATIONS: Array<{ id: AggregationFunction; label: string }> = [
  { id: "SUM", label: "SUM — Total" },
  { id: "AVG", label: "AVG — Average" },
  { id: "COUNT", label: "COUNT — Frequency" },
  { id: "MIN", label: "MIN — Minimum" },
  { id: "MAX", label: "MAX — Maximum" },
];

const FILTER_OPERATORS = [
  { id: "equals", label: "Equals (=)" },
  { id: "not equals", label: "Not Equals (!=)" },
  { id: "greater than", label: "Greater Than (>)" },
  { id: "greater than or equal", label: "Greater Than or Equal (>=)" },
  { id: "less than", label: "Less Than (<)" },
  { id: "less than or equal", label: "Less Than or Equal (<=)" },
  { id: "contains", label: "Contains text" },
  { id: "is empty", label: "Is Empty" },
  { id: "is not empty", label: "Is Not Empty" },
];

interface FilterRow {
  column: string;
  operator: string;
  value: string;
}

export default function VisualizationsPage() {
  const { auth, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Navigation & State
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");

  // Datasets
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [isLoadingDatasets, setIsLoadingDatasets] = useState<boolean>(true);

  // Visualization Configuration
  const [title, setTitle] = useState<string>("New Visualization");
  const [description, setDescription] = useState<string>("");
  const [chartType, setChartType] = useState<ChartType>("BAR");
  const [categoryCol, setCategoryCol] = useState<string>("");
  const [valueCol, setValueCol] = useState<string>("");
  const [aggregation, setAggregation] = useState<AggregationFunction>("SUM");
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [editingVizId, setEditingVizId] = useState<string | null>(null);

  // Live Query Execution & Preview
  const [queryResult, setQueryResult] = useState<DatasetQueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"chart" | "data">("chart");

  // Saved Visualizations
  const [savedVisualizations, setSavedVisualizations] = useState<VisualizationData[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auth Protection
  useEffect(() => {
    if (!authLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, authLoading, router]);

  // Load Datasets
  const loadDatasets = useCallback(async () => {
    setIsLoadingDatasets(true);
    try {
      const list = await apiListDatasets();
      setDatasets(list);
      if (list.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(list[0].id);
      }
    } catch {
      // Ignore initial load error
    } finally {
      setIsLoadingDatasets(false);
    }
  }, [selectedDatasetId]);

  // Load Saved Visualizations
  const loadSavedVisualizations = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const list = await apiListVisualizations();
      setSavedVisualizations(list);
    } catch {
      // Ignore
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    if (auth) {
      void loadDatasets();
      void loadSavedVisualizations();
    }
  }, [auth, loadDatasets, loadSavedVisualizations]);

  // Current selected dataset object and its columns
  const currentDataset = useMemo(() => {
    return datasets.find((d) => d.id === selectedDatasetId) || null;
  }, [datasets, selectedDatasetId]);

  const columns: DatasetColumn[] = useMemo(() => {
    if (!currentDataset) return [];
    return currentDataset.columns || [];
  }, [currentDataset]);

  // Auto-select initial Category & Value fields when dataset changes
  useEffect(() => {
    if (columns.length > 0) {
      const numericCols = columns.filter(
        (c) => c.type.toLowerCase() === "number" || c.type.toLowerCase() === "integer"
      );
      const textCols = columns.filter(
        (c) => c.type.toLowerCase() !== "number" && c.type.toLowerCase() !== "integer"
      );

      // Category
      if (!categoryCol || !columns.some((c) => c.name === categoryCol)) {
        setCategoryCol(textCols[0]?.name || columns[0].name);
      }

      // Value
      if (!valueCol || !columns.some((c) => c.name === valueCol)) {
        setValueCol(numericCols[0]?.name || columns[1]?.name || columns[0].name);
      }
    }
  }, [columns, categoryCol, valueCol]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Execute Query against Backend Engine
  const executeQuery = useCallback(async () => {
    if (!selectedDatasetId) {
      setQueryError("Please select a dataset.");
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      // Build filters
      const validFilters = filters
        .filter((f) => f.column && f.operator)
        .map((f) => ({
          column: f.column,
          operator: f.operator,
          value: f.operator === "is empty" || f.operator === "is not empty" ? undefined : f.value,
        }));

      // Grouping and Aggregation logic
      const isKpi = chartType === "KPI";
      const isTable = chartType === "TABLE";

      const queryPayload: Record<string, unknown> = {
        limit: 1000,
        filters: validFilters,
      };

      if (sortCol) {
        queryPayload.orderBy = {
          column: sortCol,
          direction: sortDir,
        };
      }

      if (isKpi) {
        if (valueCol) {
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        }
      } else if (isTable) {
        // Raw table mode if no aggregation, or group by category if selected
        if (categoryCol && valueCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        } else {
          queryPayload.columns = columns.map((c) => c.name).slice(0, 10);
        }
      } else {
        // BAR, LINE, AREA, PIE, DONUT
        if (categoryCol && valueCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: valueCol,
              function: aggregation,
              alias: valueCol,
            },
          ];
        } else if (categoryCol) {
          queryPayload.groupBy = [categoryCol];
          queryPayload.aggregations = [
            {
              column: "*",
              function: "COUNT",
              alias: "count",
            },
          ];
        }
      }

      const res = await apiQueryDataset(selectedDatasetId, queryPayload);
      setQueryResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute query";
      setQueryError(msg);
      setQueryResult(null);
    } finally {
      setIsQuerying(false);
    }
  }, [selectedDatasetId, chartType, categoryCol, valueCol, aggregation, sortCol, sortDir, filters, columns]);

  // Auto-run query on configuration change
  useEffect(() => {
    if (selectedDatasetId && (categoryCol || valueCol)) {
      void executeQuery();
    }
  }, [selectedDatasetId, chartType, categoryCol, valueCol, aggregation, executeQuery]);

  // Save Visualization to Backend
  const handleSaveVisualization = async () => {
    if (!title.trim()) {
      setFeedbackMessage({ type: "error", text: "Please enter a visualization title." });
      return;
    }
    if (!selectedDatasetId) {
      setFeedbackMessage({ type: "error", text: "Please select a dataset." });
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);

    const config = {
      xAxis: categoryCol,
      category: categoryCol,
      yAxis: valueCol,
      value: valueCol,
      aggregation,
      dimensions: categoryCol ? [categoryCol] : [],
      measures: valueCol
        ? [
            {
              column: valueCol,
              aggregation,
              alias: valueCol,
            },
          ]
        : [],
      filters: filters.map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value,
      })),
      sort: sortCol ? { column: sortCol, direction: sortDir } : undefined,
    };

    try {
      if (editingVizId) {
        await apiUpdateVisualization(editingVizId, {
          title,
          description: description || undefined,
          chartType,
          datasetId: selectedDatasetId,
          config,
        });
        setFeedbackMessage({ type: "success", text: "Visualization updated successfully!" });
      } else {
        const created = await apiCreateVisualization({
          title,
          description: description || undefined,
          chartType,
          datasetId: selectedDatasetId,
          config,
        });
        setEditingVizId(created.id);
        setFeedbackMessage({ type: "success", text: "Visualization saved successfully! Ready to add to Dashboards." });
      }
      void loadSavedVisualizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save visualization";
      setFeedbackMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Load an existing saved visualization into the builder
  const handleLoadSaved = (viz: VisualizationData) => {
    setEditingVizId(viz.id);
    setTitle(viz.title);
    setDescription(viz.description || "");
    setChartType(viz.chartType);
    if (viz.datasetId) {
      setSelectedDatasetId(viz.datasetId);
    }

    const cfg = viz.config || {};
    const cat = cfg.xAxis || cfg.category || (cfg.dimensions && cfg.dimensions[0]) || "";
    const val =
      (typeof cfg.yAxis === "string" ? cfg.yAxis : cfg.yAxis?.[0]) ||
      (typeof cfg.value === "string" ? cfg.value : cfg.value?.[0]) ||
      (cfg.measures && cfg.measures[0]?.column) ||
      "";
    const agg =
      (cfg.aggregation as AggregationFunction) ||
      (cfg.measures && (cfg.measures[0]?.aggregation as AggregationFunction)) ||
      "SUM";

    setCategoryCol(cat);
    setValueCol(val);
    setAggregation(agg);

    if (cfg.filters && Array.isArray(cfg.filters)) {
      setFilters(
        cfg.filters.map((f) => ({
          column: f.column,
          operator: String(f.operator),
          value: f.value !== undefined ? String(f.value) : "",
        }))
      );
    } else {
      setFilters([]);
    }

    if (cfg.sort) {
      setSortCol(cfg.sort.column);
      setSortDir(cfg.sort.direction.toLowerCase() === "desc" ? "desc" : "asc");
    }

    setActiveTab("builder");
    setFeedbackMessage({ type: "success", text: `Loaded "${viz.title}" into builder.` });
  };

  // Delete saved visualization
  const handleDeleteSaved = async (id: string, name: string) => {
    if (!confirm(`Delete visualization "${name}"?`)) return;
    try {
      await apiDeleteVisualization(id);
      if (editingVizId === id) {
        setEditingVizId(null);
      }
      setFeedbackMessage({ type: "success", text: "Visualization deleted." });
      void loadSavedVisualizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setFeedbackMessage({ type: "error", text: msg });
    }
  };

  // Add / Remove Filter Row
  const addFilterRow = () => {
    const firstCol = columns[0]?.name || "";
    setFilters((prev) => [...prev, { column: firstCol, operator: "equals", value: "" }]);
  };

  const removeFilterRow = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilterRow = (index: number, field: keyof FilterRow, val: string) => {
    setFilters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading visualization engine…</p>
        </div>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900">
      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <Link href="/workspace" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm shadow-sm group-hover:bg-indigo-700 transition">
              R
            </div>
            <span className="font-bold text-gray-900 tracking-tight">RicozViz</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-800">Visualizations Studio</span>

          {/* Tab switcher */}
          <div className="ml-4 flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === "builder"
                  ? "bg-white text-indigo-700 shadow-xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Studio Builder
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
                activeTab === "saved"
                  ? "bg-white text-indigo-700 shadow-xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Saved Visualizations ({savedVisualizations.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboards"
            className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition"
          >
            Dashboards
          </Link>
          <Link
            href="/datasets"
            className="text-xs font-medium text-gray-600 hover:text-indigo-600 transition"
          >
            Datasets
          </Link>
          <span className="h-4 w-px bg-gray-200" />
          <span className="text-xs text-gray-500 font-mono">{auth.user.email}</span>
          <button
            onClick={() => void logout().then(() => router.push("/login"))}
            className="text-xs font-medium text-red-600 hover:text-red-700 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* FEEDBACK TOAST */}
      {feedbackMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition animate-in fade-in slide-in-from-bottom-2 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* TAB 1: STUDIO BUILDER */}
      {activeTab === "builder" && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT CONFIGURATION SIDEBAR */}
          <aside className="w-96 border-r border-gray-200 bg-white flex flex-col h-[calc(100vh-57px)] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Visualization Settings
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Configure chart axes & aggregations</p>
              </div>
              {editingVizId && (
                <button
                  onClick={() => {
                    setEditingVizId(null);
                    setTitle("New Visualization");
                    setDescription("");
                  }}
                  className="text-[11px] text-indigo-600 hover:underline font-medium"
                >
                  New Chart
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* 1. DATASET SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-indigo-600" />
                    Select Dataset
                  </span>
                  <Link href="/datasets" className="text-[10px] text-indigo-600 hover:underline">
                    Manage Datasets
                  </Link>
                </label>
                {isLoadingDatasets ? (
                  <div className="h-9 w-full bg-gray-100 animate-pulse rounded-lg" />
                ) : datasets.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                    No datasets available.{" "}
                    <Link href="/datasets" className="font-semibold underline">
                      Upload a dataset first
                    </Link>
                    .
                  </div>
                ) : (
                  <select
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.rowCount} rows, {d.columnCount} cols)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. CHART TYPE SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Chart Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHART_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isSelected = chartType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setChartType(t.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-xs"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? "text-indigo-600" : "text-gray-400"}`} />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. DIMENSIONS & MEASURES */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                {/* Category / X-Axis */}
                {chartType !== "KPI" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Category / X-Axis</span>
                      <span className="text-[10px] text-gray-400 font-normal">Dimension</span>
                    </label>
                    <select
                      value={categoryCol}
                      onChange={(e) => setCategoryCol(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="">— Select Category Column —</option>
                      {columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}{c.isCalculated ? " ⚡ (fx)" : ""} ({c.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Value / Y-Axis */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Value / Y-Axis</span>
                    <span className="text-[10px] text-gray-400 font-normal">Numeric Measure</span>
                  </label>
                  <select
                    value={valueCol}
                    onChange={(e) => setValueCol(e.target.value)}
                    className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">— Select Value Column —</option>
                    {columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}{c.isCalculated ? " ⚡ (fx)" : ""} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aggregation Function */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value as AggregationFunction)}
                    className="w-full text-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden"
                  >
                    {AGGREGATIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. FILTERS */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <FilterIcon className="h-3.5 w-3.5 text-indigo-600" />
                    Filters ({filters.length})
                  </label>
                  <button
                    type="button"
                    onClick={addFilterRow}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Filter
                  </button>
                </div>

                {filters.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No filters applied</p>
                ) : (
                  <div className="space-y-2">
                    {filters.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-gray-200 bg-gray-50/70 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <select
                            value={f.column}
                            onChange={(e) => updateFilterRow(idx, "column", e.target.value)}
                            className="flex-1 text-[11px] rounded-md border border-gray-300 bg-white px-2 py-1"
                          >
                            {columns.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeFilterRow(idx)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <select
                          value={f.operator}
                          onChange={(e) => updateFilterRow(idx, "operator", e.target.value)}
                          className="w-full text-[11px] rounded-md border border-gray-300 bg-white px-2 py-1"
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.id} value={op.id}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        {f.operator !== "is empty" && f.operator !== "is not empty" && (
                          <input
                            type="text"
                            placeholder="Filter value..."
                            value={f.value}
                            onChange={(e) => updateFilterRow(idx, "value", e.target.value)}
                            className="w-full text-[11px] rounded-md border border-gray-300 bg-white px-2 py-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. SORTING */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
                  Sorting
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sortCol}
                    onChange={(e) => setSortCol(e.target.value)}
                    className="text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5"
                  >
                    <option value="">Default order</option>
                    {categoryCol && <option value={categoryCol}>Category ({categoryCol})</option>}
                    {valueCol && <option value={valueCol}>Value ({valueCol})</option>}
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    className="text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5"
                  >
                    <option value="asc">Ascending (A–Z, 0–9)</option>
                    <option value="desc">Descending (Z–A, 9–0)</option>
                  </select>
                </div>
              </div>

              {/* 6. TITLE & DESCRIPTION */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Visualization Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Revenue by Region"
                    className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 text-gray-800 shadow-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="mt-auto p-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void executeQuery()}
                disabled={isQuerying || !selectedDatasetId}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {isQuerying ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-indigo-600" />
                )}
                Run Query
              </button>
              <button
                type="button"
                onClick={() => void handleSaveVisualization()}
                disabled={isSaving || !selectedDatasetId}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isSaving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {editingVizId ? "Update" : "Save"}
              </button>
            </div>
          </aside>

          {/* MAIN CANVAS AREA */}
          <main className="flex-1 p-6 overflow-y-auto flex flex-col">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                  {title || "Untitled Visualization"}
                  {editingVizId && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                      Saved
                    </span>
                  )}
                </h1>
                {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
              </div>

              {/* View Switcher: Chart vs Raw Data */}
              <div className="flex items-center gap-3">
                {queryResult && (
                  <div className="text-xs text-gray-500 font-mono">
                    <span className="font-semibold text-gray-700">{queryResult.rowCount}</span> rows{" "}
                    <span className="text-gray-400">({queryResult.executionTimeMs}ms)</span>
                  </div>
                )}
                <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setPreviewTab("chart")}
                    className={`px-3 py-1 rounded-md transition ${
                      previewTab === "chart"
                        ? "bg-white text-gray-900 shadow-xs font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Chart View
                  </button>
                  <button
                    onClick={() => setPreviewTab("data")}
                    className={`px-3 py-1 rounded-md transition ${
                      previewTab === "data"
                        ? "bg-white text-gray-900 shadow-xs font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Data Table ({queryResult?.rowCount ?? 0})
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col min-h-[480px]">
              {previewTab === "chart" ? (
                <div className="flex-1 flex flex-col justify-center">
                  <ChartRenderer
                    chartType={chartType}
                    config={{
                      xAxis: categoryCol,
                      yAxis: valueCol,
                      dimensions: categoryCol ? [categoryCol] : [],
                      measures: valueCol
                        ? [
                            {
                              column: valueCol,
                              aggregation,
                              alias: valueCol,
                            },
                          ]
                        : [],
                    }}
                    queryResult={queryResult}
                    isLoading={isQuerying}
                    error={queryError}
                    height={440}
                  />
                </div>
              ) : (
                /* PROCESSED DATA TABLE */
                <div className="flex-1 overflow-auto">
                  {isQuerying ? (
                    <div className="h-64 flex items-center justify-center text-xs text-gray-500 animate-pulse">
                      Executing query engine...
                    </div>
                  ) : !queryResult || queryResult.rows.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400">
                      <p className="text-xs font-semibold text-gray-500">No rows returned</p>
                      <p className="text-[11px] mt-1">Run query to inspect transformed dataset records.</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {queryResult.columns.map((c) => (
                            <th
                              key={c.name}
                              className="px-4 py-2.5 font-semibold text-gray-700 tracking-wider"
                            >
                              {c.name}
                              <span className="ml-1 text-[10px] text-gray-400 font-normal font-mono">
                                ({c.type})
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {queryResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/80 transition">
                            {queryResult.columns.map((c) => (
                              <td
                                key={c.name}
                                className="px-4 py-2 text-gray-800 font-mono text-[11px]"
                              >
                                {row[c.name] !== null && row[c.name] !== undefined
                                  ? String(row[c.name])
                                  : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* TAB 2: SAVED VISUALIZATIONS */}
      {activeTab === "saved" && (
        <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Saved Visualizations</h1>
              <p className="text-sm text-gray-500 mt-1">
                Visualizations saved in your workspace. Open in the builder or add to dashboards.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVizId(null);
                setTitle("New Visualization");
                setDescription("");
                setActiveTab("builder");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create New Visualization
            </button>
          </div>

          {isLoadingSaved ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse border border-gray-200" />
              ))}
            </div>
          ) : savedVisualizations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <h3 className="text-sm font-semibold text-gray-900">No saved visualizations yet</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Use the Studio Builder to transform your datasets and save your charts.
              </p>
              <button
                onClick={() => setActiveTab("builder")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                Go to Studio Builder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedVisualizations.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {v.chartType}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(v.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 tracking-tight line-clamp-1">
                      {v.title}
                    </h3>
                    {v.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{v.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
                      <Database className="h-3.5 w-3.5 text-gray-400" />
                      <span className="truncate">{v.datasetName || "No dataset attached"}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLoadSaved(v)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        Open in Builder →
                      </button>
                      <Link
                        href="/dashboards"
                        className="text-[11px] font-medium text-gray-400 hover:text-indigo-600 transition"
                      >
                        Add to Dashboard →
                      </Link>
                    </div>
                    <button
                      onClick={() => void handleDeleteSaved(v.id, v.title)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded-md transition"
                      title="Delete visualization"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
