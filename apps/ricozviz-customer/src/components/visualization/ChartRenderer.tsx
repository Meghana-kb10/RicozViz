"use client";

import React, { useSyncExternalStore } from "react";
import { ArrowLeft, RotateCcw, AlertCircle } from "lucide-react";
import type { ChartType, ChartConfig, DatasetQueryResult } from "../../lib/api";
import { mapQueryResultToChartData } from "../../lib/chart-query-mapper";
import { BarChartRenderer } from "./BarChartRenderer";
import { LineChartRenderer } from "./LineChartRenderer";
import { AreaChartRenderer } from "./AreaChartRenderer";
import { PieChartRenderer } from "./PieChartRenderer";
import { ScatterChartRenderer } from "./ScatterChartRenderer";
import { TableRenderer } from "./TableRenderer";
import { KpiRenderer } from "./KpiRenderer";
import { RadarChartRenderer } from "./RadarChartRenderer";
import { FunnelChartRenderer } from "./FunnelChartRenderer";
import { HeatmapRenderer } from "./HeatmapRenderer";
import { MapRenderer } from "./MapRenderer";

export interface ChartRendererProps {
  chartType: ChartType;
  config: ChartConfig;
  queryResult: DatasetQueryResult | null;
  palette?: string[];
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
  palette,
  isLoading = false,
  error = null,
  height = 320,
  onDataPointClick,
  selectedFilterValue,
  onClearFilter,
  drillDown,
}: ChartRendererProps) {
  const activePalette =
    palette && palette.length > 0
      ? palette
      : Array.isArray((config.options as Record<string, unknown> | undefined)?.palette) &&
          ((config.options as Record<string, unknown>).palette as string[]).length > 0
        ? ((config.options as Record<string, unknown>).palette as string[])
        : Array.isArray((config.options as Record<string, unknown> | undefined)?.colorPalette) &&
            ((config.options as Record<string, unknown>).colorPalette as string[]).length > 0
          ? ((config.options as Record<string, unknown>).colorPalette as string[])
          : undefined;
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
        className="flex flex-col items-center justify-center rounded-xl bg-[#141414] p-6 text-center animate-pulse border border-dashed border-[#262626]"
      >
        <div className="h-8 w-8 rounded-full border-2 border-[#ff6b35] border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold text-white">Executing Secure Query Engine...</p>
        <p className="text-[11px] text-[#888888] font-mono mt-1">Applying filters, groupings and aggregations</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-red-950/20 border border-red-900/40 p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400 mb-2 border border-red-500/20">
          <span className="text-lg font-bold">!</span>
        </div>
        <h5 className="text-xs font-semibold text-red-300">Query Engine Execution Error</h5>
        <p className="mt-1 text-[11px] text-red-400 max-w-sm leading-relaxed">{error}</p>
        <span className="mt-2 text-[10px] text-[#777777] font-mono">
          Check dataset permissions, column types, or filter values.
        </span>
      </div>
    );
  }

  if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-[#141414] border border-dashed border-[#262626] p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1c1c] text-[#888888] border border-[#2a2a2a] mb-2 text-base">
          ∅
        </div>
        <p className="text-xs font-semibold text-white">No data for the selected filters.</p>
        <p className="mt-1 text-[11px] text-[#888888] max-w-xs leading-relaxed">
          The query returned 0 rows. Try adjusting your selections or clearing active filters.
        </p>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#2e2e2e] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#ff6b35] hover:bg-[#222222] hover:text-[#ff8a5c] transition cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear filters</span>
          </button>
        )}
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ height }} className="bg-[#141414] rounded-xl" />;
  }

  // Validate configuration completeness
  const hasDimension = (config.dimensions && config.dimensions.length > 0) || Boolean(config.xAxis || (config as Record<string, unknown>).category);
  const hasMeasure = (config.measures && config.measures.length > 0) || Boolean(config.yAxis || (config as Record<string, unknown>).value);

  if (chartType !== "TABLE" && chartType !== "KPI" && chartType !== "MAP" && (!hasDimension || !hasMeasure)) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-amber-950/20 border border-amber-900/40 p-6 text-center"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h5 className="text-xs font-semibold text-amber-300">Incomplete Visualization Configuration</h5>
        <p className="mt-1 text-[11px] text-amber-400/90 max-w-xs leading-relaxed">
          This {!hasDimension && !hasMeasure ? "chart requires both an X-axis dimension and a Y-axis measure" : !hasDimension ? "chart requires a category / X-axis dimension" : "chart requires a metric / Y-axis measure"} to render.
        </p>
      </div>
    );
  }

  const mapped = mapQueryResultToChartData(chartType, queryResult, config);

  const renderContent = () => {
    switch (chartType) {
      case "BAR":
        return (
          <BarChartRenderer
            data={mapped}
            config={config}
            palette={activePalette}
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
            palette={activePalette}
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
            palette={activePalette}
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
            palette={activePalette}
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
            palette={activePalette}
            isDonut={true}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        );
      case "SCATTER":
        return <ScatterChartRenderer data={mapped} config={config} palette={activePalette} height="100%" />;
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
      case "RADAR":
        return <RadarChartRenderer data={mapped} config={config} palette={activePalette} height="100%" />;
      case "FUNNEL":
        return <FunnelChartRenderer data={mapped} config={config} palette={activePalette} height="100%" />;
      case "HEATMAP":
        return <HeatmapRenderer data={mapped} config={config} height="100%" />;
      case "MAP":
        return (
          <MapRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
            onClearFilter={onClearFilter}
          />
        );
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

  const isDetailedDrillLevel = Boolean(
    drillDown && drillDown.path && drillDown.currentLevel >= drillDown.path.length
  );

  return (
    <div style={{ height }} className="w-full relative flex flex-col">
      {/* Optional Drill-Down Breadcrumb */}
      {drillDown && drillDown.currentLevel > 0 && (
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#242424] text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-[#888888] font-medium">
            <span>Drill Level:</span>
            <span className="font-semibold text-[#ff6b35] bg-[#ff6b35]/15 border border-[#ff6b35]/30 px-2 py-0.5 rounded font-mono text-[11px]">
              {drillDown.path[drillDown.currentLevel] || "Detailed records"}
            </span>
          </div>
          {drillDown.onDrillBack && (
            <button
              type="button"
              onClick={drillDown.onDrillBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#ff6b35] hover:text-[#ff8a5c] transition cursor-pointer"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to {drillDown.path[drillDown.currentLevel - 1] || "Overview"}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Chart Rendering Area */}
      <div className="flex-1 w-full relative min-h-0">
        {isDetailedDrillLevel ? (
          <TableRenderer
            data={mapped}
            config={config}
            height="100%"
            onDataPointClick={onDataPointClick}
            selectedFilterValue={selectedFilterValue}
          />
        ) : (
          renderContent()
        )}

        {/* Subtle Non-Blocking Loading Overlay for Subsequent Queries */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex items-center justify-center z-20 rounded-lg transition-opacity duration-200">
            <div className="flex items-center gap-2 rounded-lg bg-[#181818] px-3.5 py-1.5 shadow-xl border border-[#2c2c2c] text-xs font-medium text-[#dedede] font-mono">
              <div className="h-4 w-4 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
              <span>Updating query...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
