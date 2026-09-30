"use client";

import React, { useSyncExternalStore } from "react";
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
}: ChartRendererProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  if (isLoading) {
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
        <p className="text-xs font-bold text-gray-700">No Data Returned</p>
        <p className="mt-1 text-[11px] text-gray-500 max-w-xs leading-relaxed">
          The query returned 0 rows. Try adjusting your dimensions, measures, or removing overly restrictive filters.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ height }} className="bg-gray-50/40 rounded-xl" />;
  }

  const mapped = mapQueryResultToChartData(chartType, queryResult, config);

  switch (chartType) {
    case "BAR":
      return <BarChartRenderer data={mapped} config={config} height={height} />;
    case "LINE":
      return <LineChartRenderer data={mapped} config={config} height={height} />;
    case "AREA":
      return <AreaChartRenderer data={mapped} config={config} height={height} />;
    case "PIE":
      return <PieChartRenderer data={mapped} config={config} isDonut={false} height={height} />;
    case "DONUT":
      return <PieChartRenderer data={mapped} config={config} isDonut={true} height={height} />;
    case "SCATTER":
      return <ScatterChartRenderer data={mapped} config={config} height={height} />;
    case "TABLE":
      return <TableRenderer data={mapped} config={config} height={height} />;
    case "KPI":
      return <KpiRenderer data={mapped} config={config} height={height} />;
    default:
      return <BarChartRenderer data={mapped} config={config} height={height} />;
  }
}
