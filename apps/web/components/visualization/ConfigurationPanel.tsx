"use client";

import React, { useState } from "react";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  CircleDot,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
  Hash,
  Layers,
  ArrowUpDown,
  Sliders,
  Palette,
  X,
  Plus,
  Globe,
} from "lucide-react";
import type {
  ChartType,
  ChartMeasure,
  ChartFilter,
  ChartSort,
  DatasetColumn,
  AggregationFunction,
} from "../../lib/api";
import { getAllowedAggregations } from "../../lib/chart-query-mapper";
import { FilterBuilder } from "./FilterBuilder";

export const CHART_TYPES: {
  value: ChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  { value: "BAR", label: "Bar", icon: BarChart3, desc: "Compare categories" },
  { value: "LINE", label: "Line", icon: LineChartIcon, desc: "Time trend" },
  { value: "AREA", label: "Area", icon: LineChartIcon, desc: "Volume progression" },
  { value: "PIE", label: "Pie", icon: PieChartIcon, desc: "Percentage slice" },
  { value: "DONUT", label: "Donut", icon: CircleDot, desc: "Ring breakdown" },
  { value: "SCATTER", label: "Scatter", icon: ScatterIcon, desc: "Two metrics" },
  { value: "TABLE", label: "Table", icon: TableIcon, desc: "Raw or tabular rows" },
  { value: "KPI", label: "KPI", icon: Hash, desc: "Single aggregated metric" },
  { value: "MAP", label: "Geospatial Map", icon: Globe, desc: "Region & coordinate maps" },
];

export interface ConfigurationPanelProps {
  columns: DatasetColumn[];
  chartType: ChartType;
  onChangeChartType: (type: ChartType) => void;
  dimensions: string[];
  onAddDimension: (colName: string) => void;
  onRemoveDimension: (colName: string) => void;
  measures: ChartMeasure[];
  onAddMeasure: (colName: string) => void;
  onUpdateMeasure: (index: number, updated: ChartMeasure) => void;
  onRemoveMeasure: (index: number) => void;
  filters: ChartFilter[];
  filterLogic: "AND" | "OR";
  onChangeFilterLogic: (logic: "AND" | "OR") => void;
  onAddFilter: () => void;
  onUpdateFilter: (index: number, updated: ChartFilter) => void;
  onRemoveFilter: (index: number) => void;
  sort?: ChartSort;
  onChangeSort: (sort?: ChartSort) => void;
  options: Record<string, unknown>;
  onChangeOption: (key: string, value: unknown) => void;
}

export function ConfigurationPanel({
  columns,
  chartType,
  onChangeChartType,
  dimensions,
  onAddDimension,
  onRemoveDimension,
  measures,
  onAddMeasure,
  onUpdateMeasure,
  onRemoveMeasure,
  filters,
  filterLogic,
  onChangeFilterLogic,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  sort,
  onChangeSort,
  options,
  onChangeOption,
}: ConfigurationPanelProps) {
  const [activeTab, setActiveTab] = useState<"visual" | "data" | "filters" | "sort" | "appearance">("visual");

  const getColumnType = (colName: string): string => {
    return columns.find((c) => c.name === colName)?.type || "string";
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Configuration Section Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50/70 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("visual")}
          className={`flex-1 min-w-[70px] py-2.5 px-2 text-center border-b-2 transition ${
            activeTab === "visual"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Visual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("data")}
          className={`flex-1 min-w-[70px] py-2.5 px-2 text-center border-b-2 transition ${
            activeTab === "data"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Data
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("filters")}
          className={`flex-1 min-w-[70px] py-2.5 px-2 text-center border-b-2 transition ${
            activeTab === "filters"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Filters {filters.length > 0 && `(${filters.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sort")}
          className={`flex-1 min-w-[70px] py-2.5 px-2 text-center border-b-2 transition ${
            activeTab === "sort"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Sort
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`flex-1 min-w-[70px] py-2.5 px-2 text-center border-b-2 transition ${
            activeTab === "appearance"
              ? "border-indigo-600 text-indigo-600 bg-white"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Style
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ============================================================ */}
        {/* 1. VISUAL (CHART TYPE SELECTOR) */}
        {/* ============================================================ */}
        {activeTab === "visual" && (
          <div className="space-y-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Select Visualization Type
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {CHART_TYPES.map((typeItem) => {
                const Icon = typeItem.icon;
                const isSelected = chartType === typeItem.value;

                return (
                  <button
                    key={typeItem.value}
                    type="button"
                    onClick={() => onChangeChartType(typeItem.value)}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg mb-2 ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-900 leading-tight">
                      {typeItem.label}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-1">
                      {typeItem.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. DATA (DIMENSIONS & MEASURES) */}
        {/* ============================================================ */}
        {activeTab === "data" && (
          <div className="space-y-6">
            {/* DIMENSIONS */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-600" />
                  Dimensions (X-Axis / Grouping)
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {dimensions.length} selected
                </span>
              </div>

              {dimensions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center mb-2">
                  <p className="text-[11px] text-gray-400">
                    No dimensions selected. Click a field from the left panel.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 mb-2">
                  {dimensions.map((dim) => (
                    <div
                      key={dim}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50/60 text-xs font-medium text-indigo-900"
                    >
                      <span>{dim}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveDimension(dim)}
                        className="text-indigo-400 hover:text-indigo-700 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Dimension Dropdown */}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onAddDimension(e.target.value);
                }}
                className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">+ Add Dimension Field...</option>
                {columns
                  .filter((c) => !dimensions.includes(c.name))
                  .map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                    </option>
                  ))}
              </select>
            </div>

            {/* MEASURES */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-blue-600" />
                  Measures (Values / Metrics)
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {measures.length} selected
                </span>
              </div>

              {measures.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center mb-2">
                  <p className="text-[11px] text-gray-400">
                    No measures selected. Click a numeric field from the left panel.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 mb-2">
                  {measures.map((m, idx) => {
                    const colType = getColumnType(m.column);
                    const allowedAggs = getAllowedAggregations(colType);

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">{m.column}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveMeasure(idx)}
                            className="text-gray-400 hover:text-red-600 transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">
                              Aggregation
                            </label>
                            <select
                              value={m.aggregation}
                              onChange={(e) =>
                                onUpdateMeasure(idx, {
                                  ...m,
                                  aggregation: e.target.value as AggregationFunction,
                                })
                              }
                              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
                            >
                              {allowedAggs.map((agg) => (
                                <option key={agg} value={agg}>
                                  {agg}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 block mb-0.5">
                              Alias (Display Name)
                            </label>
                            <input
                              type="text"
                              value={m.alias || ""}
                              placeholder={`${m.aggregation.toLowerCase()}_${m.column}`}
                              onChange={(e) =>
                                onUpdateMeasure(idx, {
                                  ...m,
                                  alias: e.target.value,
                                })
                              }
                              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Measure Dropdown */}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onAddMeasure(e.target.value);
                }}
                className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">+ Add Measure Field...</option>
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            {/* DRILL-DOWN HIERARCHY */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                    ↓
                  </span>
                  Drill-Down Hierarchy
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {Array.isArray(options.drillPath) ? (options.drillPath as string[]).length : 0} levels
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mb-2">
                Define the sequence of categories when users click into data points (e.g. Region → State → City).
              </p>

              {(() => {
                const drillPath = Array.isArray(options.drillPath) ? (options.drillPath as string[]) : [];
                return (
                  <div className="space-y-2">
                    {drillPath.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center">
                        <p className="text-[11px] text-gray-400">
                          No drill-down configured. Add at least 2 levels to enable interactive hierarchy exploration.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {drillPath.map((field, idx) => (
                          <div
                            key={`${field}-${idx}`}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50/80 text-xs font-medium text-gray-800"
                          >
                            <span className="flex items-center gap-2">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                                {idx + 1}
                              </span>
                              <span>{field}</span>
                            </span>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...drillPath];
                                    const temp = next[idx - 1];
                                    next[idx - 1] = next[idx];
                                    next[idx] = temp;
                                    onChangeOption("drillPath", next);
                                  }}
                                  className="text-gray-400 hover:text-gray-700 px-1 text-[10px]"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                              )}
                              {idx < drillPath.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...drillPath];
                                    const temp = next[idx + 1];
                                    next[idx + 1] = next[idx];
                                    next[idx] = temp;
                                    onChangeOption("drillPath", next);
                                  }}
                                  className="text-gray-400 hover:text-gray-700 px-1 text-[10px]"
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = drillPath.filter((_, i) => i !== idx);
                                  onChangeOption("drillPath", next.length > 0 ? next : undefined);
                                }}
                                className="text-gray-400 hover:text-red-600 transition ml-1"
                                title="Remove Level"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const next = [...drillPath, val];
                        onChangeOption("drillPath", next);
                      }}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">+ Add Drill-Down Level...</option>
                      {columns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. FILTERS */}
        {/* ============================================================ */}
        {activeTab === "filters" && (
          <FilterBuilder
            columns={columns}
            filters={filters}
            filterLogic={filterLogic}
            onChangeFilterLogic={onChangeFilterLogic}
            onAddFilter={onAddFilter}
            onUpdateFilter={onUpdateFilter}
            onRemoveFilter={onRemoveFilter}
          />
        )}

        {/* ============================================================ */}
        {/* 4. SORTING */}
        {/* ============================================================ */}
        {activeTab === "sort" && (
          <div className="space-y-4">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
              Result Ordering
            </span>

            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                Order by Column
              </label>
              <select
                value={sort?.column || ""}
                onChange={(e) => {
                  if (!e.target.value) {
                    onChangeSort(undefined);
                  } else {
                    onChangeSort({
                      column: e.target.value,
                      direction: sort?.direction || "desc",
                    });
                  }
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">None (Default dataset order)</option>
                {/* Options from dimensions and measures */}
                {dimensions.map((dim) => (
                  <option key={`sort-${dim}`} value={dim}>
                    {dim} (Dimension)
                  </option>
                ))}
                {measures.map((m) => (
                  <option key={`sort-${m.column}`} value={m.column}>
                    {m.column} ({m.aggregation})
                  </option>
                ))}
                {/* Fallback to any column */}
                {columns.map((col) => (
                  <option key={`sort-col-${col.name}`} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            {sort?.column && (
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSort({
                        column: sort.column,
                        direction: "asc",
                      })
                    }
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition ${
                      sort.direction.toLowerCase() === "asc"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Ascending (A → Z, 0 → 9)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSort({
                        column: sort.column,
                        direction: "desc",
                      })
                    }
                    className={`py-1.5 rounded-lg border text-xs font-semibold transition ${
                      sort.direction.toLowerCase() === "desc"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Descending (Z → A, 9 → 0)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. APPEARANCE & STYLING */}
        {/* ============================================================ */}
        {activeTab === "appearance" && (
          <div className="space-y-4">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-indigo-600" />
              Chart Presentation
            </span>

            {/* Geospatial Map Specific Controls */}
            {chartType === "MAP" && (
              <div className="space-y-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                <span className="text-[11px] font-bold text-indigo-900 block">
                  Geospatial Map Configuration
                </span>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 block mb-1">
                    Map Visualization Type
                  </label>
                  <select
                    value={(options.mapType as string) || "CHOROPLETH"}
                    onChange={(e) => onChangeOption("mapType", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none"
                  >
                    <option value="CHOROPLETH">Choropleth (Shaded Regions)</option>
                    <option value="BUBBLE">Bubble Map (Magnitude Circles)</option>
                    <option value="MARKER">Point / Marker Map (Coordinates)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 block mb-1">
                    Geographic Column (Country/State/City)
                  </label>
                  <select
                    value={(options.geoColumn as string) || dimensions[0] || ""}
                    onChange={(e) => onChangeOption("geoColumn", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none"
                  >
                    <option value="">-- Auto-detect or select column --</option>
                    {columns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 block mb-1">
                      Latitude Column (optional)
                    </label>
                    <select
                      value={(options.latColumn as string) || ""}
                      onChange={(e) => onChangeOption("latColumn", e.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none"
                    >
                      <option value="">-- None --</option>
                      {columns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-600 block mb-1">
                      Longitude Column (optional)
                    </label>
                    <select
                      value={(options.lngColumn as string) || ""}
                      onChange={(e) => onChangeOption("lngColumn", e.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none"
                    >
                      <option value="">-- None --</option>
                      {columns.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-600 block mb-1">
                    Map Color Palette
                  </label>
                  <select
                    value={(options.colorScale as string) || "indigo"}
                    onChange={(e) => onChangeOption("colorScale", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none"
                  >
                    <option value="indigo">Indigo Horizon</option>
                    <option value="emerald">Emerald Growth</option>
                    <option value="amber">Amber Sun</option>
                    <option value="rose">Rose Crimson</option>
                    <option value="blue">Ocean Blue</option>
                    <option value="slate">Monochrome Slate</option>
                  </select>
                </div>
              </div>
            )}

            {/* Number Formatting */}
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                Value Formatting
              </label>
              <select
                value={(options.numberFormat as string) || "auto"}
                onChange={(e) => onChangeOption("numberFormat", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value="auto">Auto-detect</option>
                <option value="number">Number (1,234.56)</option>
                <option value="currency">Currency ($1,234.56)</option>
                <option value="percent">Percentage (12.3%)</option>
              </select>
            </div>

            {/* Presentation Toggles */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                <span>Show Legend</span>
                <input
                  type="checkbox"
                  checked={options.showLegend !== false}
                  onChange={(e) => onChangeOption("showLegend", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                <span>Show Grid Lines</span>
                <input
                  type="checkbox"
                  checked={options.showGrid !== false}
                  onChange={(e) => onChangeOption("showGrid", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                <span>Show X-Axis</span>
                <input
                  type="checkbox"
                  checked={options.showXAxis !== false}
                  onChange={(e) => onChangeOption("showXAxis", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                <span>Show Y-Axis</span>
                <input
                  type="checkbox"
                  checked={options.showYAxis !== false}
                  onChange={(e) => onChangeOption("showYAxis", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
