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
