"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber, formatCurrency, formatPercent } from "../../lib/formatting";

const PALETTE = [
  "#ff6b35", // Primary Coral Accent
  "#38bdf8", // Sky Telemetry
  "#10b981", // Emerald Positive
  "#f59e0b", // Amber Warning
  "#8b5cf6", // Violet Signal
  "#ec4899", // Rose Metric
  "#06b6d4", // Cyan
  "#f43f5e", // Crimson Alert
];

export interface LineChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  palette?: string[];
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
}

export function LineChartRenderer({
  data,
  config,
  palette,
  height = "100%",
  onDataPointClick,
}: LineChartRendererProps) {
  const options = config.options || {};
  const activePalette =
    palette && palette.length > 0
      ? palette
      : Array.isArray(options.palette) && options.palette.length > 0
        ? (options.palette as string[])
        : Array.isArray(options.colorPalette) && options.colorPalette.length > 0
          ? (options.colorPalette as string[])
          : PALETTE;
  const showLegend = options.showLegend !== false && data.measureKeys.length > 1;
  const showGrid = options.showGrid !== false;
  const showXAxis = options.showXAxis !== false;
  const showYAxis = options.showYAxis !== false;
  const numberFormat = (options.numberFormat as string) || "auto";

  const xKey = data.xKey || "dimension";
  const measureKeys = data.measureKeys.length > 0 ? data.measureKeys : ["value"];

  const formatTick = (val: unknown) => {
    if (typeof val !== "number") return String(val ?? "");
    if (numberFormat === "currency") return formatCurrency(val, undefined, 0);
    if (numberFormat === "percent") return formatPercent(val, 0);
    return formatNumber(val, undefined, true);
  };

  return (
    <div style={{ height }} className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data.rows}
          margin={{ top: 12, right: 16, left: 0, bottom: 20 }}
          onClick={(state) => {
            if (state && state.activeLabel !== undefined && onDataPointClick) {
              onDataPointClick(xKey, state.activeLabel);
            }
          }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" opacity={0.5} />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#888888" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a2a" }}
            />
          )}
          {showYAxis && (
            <YAxis
              tick={{ fontSize: 11, fill: "#888888" }}
              tickLine={false}
              axisLine={{ stroke: "#2a2a2a" }}
              tickFormatter={formatTick}
            />
          )}
          <Tooltip
            formatter={(value, name) => [
              formatTick(value),
              String(name),
            ]}
            contentStyle={{
              backgroundColor: "#161616",
              borderColor: "#2e2e2e",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              fontSize: "12px",
              color: "#fafafa",
            }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
          {measureKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={activePalette[idx % activePalette.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: activePalette[idx % activePalette.length] }}
              activeDot={{ r: 6, stroke: "#ff6b35", strokeWidth: 2, className: "cursor-pointer" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
