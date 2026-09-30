"use client";

import React, { useSyncExternalStore } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { ChartType, ChartConfig, DatasetQueryResult } from "../../lib/api";
import { mapQueryResultToChartData } from "../../lib/chart-query-mapper";
import { BarChartRenderer } from "./BarChartRenderer";
import { LineChartRenderer } from "./LineChartRenderer";
import { AreaChartRenderer } from "./AreaChartRenderer";
import { PieChartRenderer } from "./PieChartRenderer";
import { ScatterChartRenderer } from "./ScatterChartRenderer";
import { TableRenderer } from "./TableRenderer";
import { KpiRenderer } from "./KpiRenderer";

export interface ChartRendererProps {
  chartType: ChartType;
  config: ChartConfig;
  queryResult: DatasetQueryResult | null;
  isLoading?: boolean;
  error?: string | null;
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
  onClearFilter?: () => void;
  drillDown?: {
    path: string[];
    currentLevel: number;
    onDrillBack?: () => void;
  } | null;
}

function subscribe() {
  return () => {};
}

export function ChartRenderer({
  chartType,
  config,
  queryResult,
  isLoading = false,
  error = null,
  height = 320,
  onDataPointClick,
  selectedFilterValue,
  onClearFilter,
  drillDown,
}: ChartRendererProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  // If initial load with no existing data
  if (isLoading && (!queryResult || !queryResult.rows || queryResult.rows.length === 0)) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-gray-50/50 p-6 text-center animate-pulse border border-dashed border-gray-200"
      >
        <div className="h-9 w-9 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold text-gray-700">Executing Secure Query Engine...</p>
        <p className="text-[11px] text-gray-400 mt-1">Applying filters, groupings and aggregations</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-red-50/60 border border-red-200 p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2">
          <span className="text-lg font-bold">!</span>
        </div>
        <h5 className="text-xs font-bold text-red-900">Query Engine Execution Error</h5>
        <p className="mt-1 text-[11px] text-red-600 max-w-sm leading-relaxed">{error}</p>
        <span className="mt-2 text-[10px] text-gray-400">
          Check dataset permissions, column types, or filter values.
        </span>
      </div>
    );
  }

  if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-gray-50/40 border border-dashed border-gray-200 p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-2 text-base">
          ∅
        </div>
        <p className="text-xs font-bold text-gray-700">No data for the selected filters.</p>
        <p className="mt-1 text-[11px] text-gray-500 max-w-xs leading-relaxed">
          The query returned 0 rows. Try adjusting your selections or clearing active filters.
        </p>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-gray-50"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear filters</span>
          </button>
        )}
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ height }} className="bg-gray-50/40 rounded-xl" />;
  }

  const mapped = mapQueryResultToChartData(chartType, queryResult, config);

  const renderContent = () => {
    switch (chartType) {
      case "BAR":
        return (
          <BarChartRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "LINE":
        return (
          <LineChartRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "AREA":
        return (
          <AreaChartRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "PIE":
        return (
          <PieChartRenderer
            data={mapped}
            config={config}
            isDonut={false}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "DONUT":
        return (
          <PieChartRenderer
            data={mapped}
            config={config}
            isDonut={true}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "SCATTER":
        return <ScatterChartRenderer data={mapped} config={config} height="100%" />;
      case "TABLE":
        return (
          <TableRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "KPI":
        return <KpiRenderer data={mapped} config={config} height="100%" />;
      default:
        return (
          <BarChartRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
    }
  };

  return (
    <div style={{ height }} className="w-full relative flex flex-col">
      {/* Optional Drill-Down Breadcrumb */}
      {drillDown && drillDown.currentLevel > 0 && (
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-100 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-gray-500 font-medium">
            <span>Drill Level:</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">
              {drillDown.path[drillDown.currentLevel]}
            </span>
          </div>
          {drillDown.onDrillBack && (
            <button
              type="button"
              onClick={drillDown.onDrillBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to {drillDown.path[drillDown.currentLevel - 1]}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Chart Rendering Area */}
      <div className="flex-1 w-full relative min-h-0">
        {renderContent()}

        {/* Subtle Non-Blocking Loading Overlay for Subsequent Queries */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs flex items-center justify-center z-20 rounded-lg transition-opacity duration-200">
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-md border border-gray-200 text-xs font-semibold text-gray-700">
              <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Updating query...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
