"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Play,
  Save,
  Check,
  AlertCircle,
  Clock,
  Database,
  BarChart2,
  Sliders,
  Layers,
  Sparkles,
} from "lucide-react";
import type {
  ChartData,
  ChartType,
  ChartConfig,
  ChartMeasure,
  ChartFilter,
  ChartSort,
  DatasetData,
  DatasetQueryResult,
} from "../../lib/api";
import {
  apiGetDataset,
  apiQueryDataset,
  apiCreateChart,
  apiUpdateChart,
  ApiError,
} from "../../lib/api";
import { buildVisualizationQuery, isAggregationCompatible, getAllowedAggregations } from "../../lib/chart-query-mapper";
import { FieldPanel } from "./FieldPanel";
import { ConfigurationPanel } from "./ConfigurationPanel";
import { ChartRenderer } from "./ChartRenderer";

export interface VisualizationStudioProps {
  dashboardId: string;
  dashboardName: string;
  initialChart?: ChartData | null;
  datasets: DatasetData[];
  onClose: () => void;
  onSaved: (chart: ChartData) => void;
}

export function VisualizationStudio({
  dashboardId,
  dashboardName,
  initialChart,
  datasets,
  onClose,
  onSaved,
}: VisualizationStudioProps) {
  // Mobile / Tablet Tab Mode: "data" | "preview" | "config"
  const [mobileTab, setMobileTab] = useState<"data" | "preview" | "config">("preview");

  // Chart Metadata
  const [title, setTitle] = useState(initialChart?.title || "Untitled Visualization");
  const [description, setDescription] = useState(initialChart?.description || "");
  const [chartType, setChartType] = useState<ChartType>(initialChart?.chartType || "BAR");
  const [datasetId, setDatasetId] = useState<string>(initialChart?.datasetId || (datasets[0]?.id ?? ""));

  // Chart Configuration State
  const initialConfig = initialChart?.config || {};
  const [dimensions, setDimensions] = useState<string[]>(initialConfig.dimensions || []);
  const [measures, setMeasures] = useState<ChartMeasure[]>(initialConfig.measures || []);
  const [filters, setFilters] = useState<ChartFilter[]>(initialConfig.filters || []);
  const [filterLogic, setFilterLogic] = useState<"AND" | "OR">("AND");
  const [sort, setSort] = useState<ChartSort | undefined>(initialConfig.sort);
  const [options, setOptions] = useState<Record<string, unknown>>(initialConfig.options || {});

  // Selected Dataset Schema
  const [datasetDetail, setDatasetDetail] = useState<DatasetData | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Live Query Preview State
  const [queryResult, setQueryResult] = useState<DatasetQueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch Dataset Details whenever datasetId changes
  useEffect(() => {
    if (!datasetId) return;
    let ignore = false;
    apiGetDataset(datasetId)
      .then((data) => {
        if (!ignore) {
          setDatasetDetail(data);
          setLoadingSchema(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setDatasetDetail(null);
          setLoadingSchema(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [datasetId]);

  const handleRefreshSchema = async () => {
    if (!datasetId) return;
    setLoadingSchema(true);
    try {
      const data = await apiGetDataset(datasetId);
      setDatasetDetail(data);
    } catch {
      setDatasetDetail(null);
    } finally {
      setLoadingSchema(false);
    }
  };

  // Current consolidated ChartConfig
  const currentConfig: ChartConfig = useMemo(
    () => ({
      dimensions,
      measures,
      filters,
      sort,
      options,
    }),
    [dimensions, measures, filters, sort, options]
  );

  // Query Execution Adapter
  const executePreviewQuery = useCallback(async () => {
    if (!datasetId) {
      setQueryError("Please select a dataset to query.");
      return;
    }

    setIsQuerying(true);
    setQueryError(null);

    try {
      const queryParams = buildVisualizationQuery(currentConfig, 100, filterLogic);
      const res = await apiQueryDataset(datasetId, queryParams);
      setQueryResult(res);
    } catch (err) {
      setQueryResult(null);
      setQueryError(
        err instanceof ApiError ? err.message : "Query execution failed. Please verify configuration."
      );
    } finally {
      setIsQuerying(false);
    }
  }, [datasetId, currentConfig, filterLogic]);

  // Auto-run preview when dataset is loaded or user adds dimension/measure
  useEffect(() => {
    if (datasetId && (dimensions.length > 0 || measures.length > 0)) {
      const timer = setTimeout(() => {
        void executePreviewQuery();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [datasetId, dimensions, measures, filters, sort, executePreviewQuery]);

  // Dimension helpers
  const handleAddDimension = (colName: string) => {
    if (!dimensions.includes(colName)) {
      setDimensions((prev) => [...prev, colName]);
    } else {
      setDimensions((prev) => prev.filter((d) => d !== colName));
    }
  };

  const handleRemoveDimension = (colName: string) => {
    setDimensions((prev) => prev.filter((d) => d !== colName));
  };

  // Measure helpers
  const handleAddMeasure = (colName: string) => {
    const col = datasetDetail?.columns.find((c) => c.name === colName);
    const allowed = getAllowedAggregations(col?.type);
    const defaultAgg = allowed.includes("SUM") ? "SUM" : allowed[0] || "COUNT";

    setMeasures((prev) => [
      ...prev,
      {
        column: colName,
        aggregation: defaultAgg,
        alias: `${defaultAgg.toLowerCase()}_${colName}`,
      },
    ]);
  };

  const handleUpdateMeasure = (index: number, updated: ChartMeasure) => {
    setMeasures((prev) => {
      const clone = [...prev];
      clone[index] = updated;
      return clone;
    });
  };

  const handleRemoveMeasure = (index: number) => {
    setMeasures((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Filter helpers
  const handleAddFilter = () => {
    const defaultCol = datasetDetail?.columns[0]?.name || "";
    setFilters((prev) => [
      ...prev,
      {
        column: defaultCol,
        operator: "=",
        value: "",
      },
    ]);
  };

  const handleUpdateFilter = (index: number, updated: ChartFilter) => {
    setFilters((prev) => {
      const clone = [...prev];
      clone[index] = updated;
      return clone;
    });
  };

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Options helper
  const handleOptionChange = (key: string, value: unknown) => {
    setOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save Visualization to Dashboard
  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError("Visualization title is required.");
      return;
    }
    if (!datasetId) {
      setSaveError("Please select a dataset.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let saved: ChartData;
      if (initialChart?.id) {
        // Edit existing chart
        saved = await apiUpdateChart(dashboardId, initialChart.id, {
          title: title.trim(),
          description: description.trim() || null,
          chartType,
          datasetId,
          config: currentConfig,
        });
      } else {
        // Create new chart
        saved = await apiCreateChart(dashboardId, {
          title: title.trim(),
          description: description.trim() || null,
          chartType,
          datasetId,
          config: currentConfig,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        onSaved(saved);
      }, 500);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save visualization.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-100 overflow-hidden">
      {/* ============================================================ */}
      {/* 1. STUDIO TOP ACTION BAR */}
      {/* ============================================================ */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-20 shrink-0">
        {/* Left: Back & Title Edit */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>

          <span className="text-gray-300">|</span>

          {/* Breadcrumb & Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden md:inline truncate max-w-[140px]">
              {dashboardName} /
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Visualization Title..."
              className="text-sm font-bold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-indigo-600 focus:outline-none px-1 py-0.5 transition bg-transparent"
            />
          </div>
        </div>

        {/* Center: Mobile View Switcher */}
        <div className="flex lg:hidden items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMobileTab("data")}
            className={`px-2.5 py-1 rounded transition ${
              mobileTab === "data" ? "bg-white text-indigo-600 shadow-2xs" : "text-gray-500"
            }`}
          >
            Data
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className={`px-2.5 py-1 rounded transition ${
              mobileTab === "preview" ? "bg-white text-indigo-600 shadow-2xs" : "text-gray-500"
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("config")}
            className={`px-2.5 py-1 rounded transition ${
              mobileTab === "config" ? "bg-white text-indigo-600 shadow-2xs" : "text-gray-500"
            }`}
          >
            Config
          </button>
        </div>

        {/* Right: Preview & Save Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void executePreviewQuery()}
            disabled={isQuerying || !datasetId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs disabled:opacity-50 transition"
          >
            <Play className={`h-3.5 w-3.5 text-emerald-600 ${isQuerying ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Run Query</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition ${
              saveSuccess
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {isSaving ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{initialChart?.id ? "Update Chart" : "Save to Dashboard"}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Save Error Alert */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-red-500 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. THREE-PANEL STUDIO WORKSPACE */}
      {/* ============================================================ */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* PANEL 1: LEFT FIELD & DATASET EXPLORER (3 COLS) */}
        <div
          className={`col-span-12 lg:col-span-3 h-full overflow-hidden ${
            mobileTab !== "data" ? "hidden lg:block" : "block"
          }`}
        >
          <FieldPanel
            datasets={datasets}
            selectedDatasetId={datasetId}
            onSelectDataset={(newId) => {
              setDatasetId(newId);
              setDimensions([]);
              setMeasures([]);
              setFilters([]);
            }}
            datasetDetail={datasetDetail}
            loadingSchema={loadingSchema}
            onRefreshSchema={handleRefreshSchema}
            selectedDimensions={dimensions}
            onAddDimension={handleAddDimension}
            selectedMeasures={measures.map((m) => m.column)}
            onAddMeasure={handleAddMeasure}
          />
        </div>

        {/* PANEL 2: CENTER LIVE CANVAS & PREVIEW (6 COLS) */}
        <div
          className={`col-span-12 lg:col-span-6 h-full flex flex-col bg-gray-50/50 overflow-hidden ${
            mobileTab !== "preview" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Canvas Sub-Header */}
          <div className="h-10 border-b border-gray-200 bg-white/70 px-4 flex items-center justify-between text-xs text-gray-500 shrink-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {chartType}
              </span>
              <span className="font-medium text-gray-700 truncate max-w-xs">{title}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span>{dimensions.length} Dim</span>
              <span>·</span>
              <span>{measures.length} Meas</span>
              <span>·</span>
              <span>{filters.length} Filter</span>
            </div>
          </div>

          {/* Main Chart Canvas Viewport */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="flex-1 bg-white rounded-xl border border-gray-200/90 shadow-xs p-4 flex flex-col justify-between overflow-hidden">
              <ChartRenderer
                chartType={chartType}
                config={currentConfig}
                queryResult={queryResult}
                isLoading={isQuerying}
                error={queryError}
                height="100%"
              />
            </div>
          </div>

          {/* Query Engine Telemetry Footer */}
          <div className="h-9 border-t border-gray-200 bg-white px-4 flex items-center justify-between text-[11px] text-gray-500 font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    queryResult ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                />
                <span className="text-gray-700 font-semibold">
                  {queryResult ? `${queryResult.rows.length} rows returned` : "Query Idle"}
                </span>
              </span>
              {queryResult && (
                <>
                  <span>·</span>
                  <span className="text-indigo-600 font-semibold">
                    ⚡ {queryResult.executionTimeMs}ms execution
                  </span>
                </>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600 uppercase font-sans font-bold">
                {measures.length > 0 ? "AGGREGATE MODE" : "RAW MODE"}
              </span>
              <span>·</span>
              <span>Safe Query Engine</span>
            </div>
          </div>
        </div>

        {/* PANEL 3: RIGHT CONFIGURATION & APPEARANCE (3 COLS) */}
        <div
          className={`col-span-12 lg:col-span-3 h-full overflow-hidden ${
            mobileTab !== "config" ? "hidden lg:block" : "block"
          }`}
        >
          <ConfigurationPanel
            columns={datasetDetail?.columns || []}
            chartType={chartType}
            onChangeChartType={setChartType}
            dimensions={dimensions}
            onAddDimension={handleAddDimension}
            onRemoveDimension={handleRemoveDimension}
            measures={measures}
            onAddMeasure={handleAddMeasure}
            onUpdateMeasure={handleUpdateMeasure}
            onRemoveMeasure={handleRemoveMeasure}
            filters={filters}
            filterLogic={filterLogic}
            onChangeFilterLogic={setFilterLogic}
            onAddFilter={handleAddFilter}
            onUpdateFilter={handleUpdateFilter}
            onRemoveFilter={handleRemoveFilter}
            sort={sort}
            onChangeSort={setSort}
            options={options}
            onChangeOption={handleOptionChange}
          />
        </div>
      </div>
    </div>
  );
}
