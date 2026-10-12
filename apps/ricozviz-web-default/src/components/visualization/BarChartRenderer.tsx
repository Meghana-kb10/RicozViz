"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
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
  "#4f46e5", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#14b8a6", // Teal
];

export interface BarChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  palette?: string[];
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
}

export function BarChartRenderer({
  data,
  config,
  palette,
  height = "100%",
  onDataPointClick,
  selectedFilterValue,
}: BarChartRendererProps) {
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
    if (numberFormat === "currency") {
      if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
      if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
      return formatCurrency(val, undefined, 0);
    }
    if (numberFormat === "percent") return formatPercent(val, 0);
    return formatNumber(val, undefined, true);
  };

  const handleBarClick = (entry: Record<string, unknown>) => {
    if (onDataPointClick && entry && entry[xKey] !== undefined) {
      onDataPointClick(xKey, entry[xKey]);
    }
  };

  return (
    <div style={{ height }} className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.rows}
          margin={{ top: 12, right: 16, left: 16, bottom: 20 }}
          onClick={(state) => {
            if (state && state.activeLabel !== undefined && onDataPointClick) {
              onDataPointClick(xKey, state.activeLabel);
            }
          }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.35} />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
          )}
          {showYAxis && (
            <YAxis
              width={56}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={formatTick}
            />
          )}
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" && numberFormat === "currency"
                ? formatCurrency(value, undefined, 0)
                : formatTick(value),
              String(name),
            ]}
            contentStyle={{
              backgroundColor: "#0F172A",
              borderColor: "rgba(255, 255, 255, 0.12)",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              fontSize: "12px",
              color: "#f8fafc",
            }}
            itemStyle={{ color: "#e2e8f0" }}
            labelStyle={{ color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
          {measureKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={activePalette[idx % activePalette.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
              className="cursor-pointer"
            >
              {data.rows.map((row, rIdx) => {
                const isSelected =
                  selectedFilterValue === undefined ||
                  selectedFilterValue === null ||
                  String(row[xKey]) === String(selectedFilterValue);
                return (
                  <Cell
                    key={`cell-${rIdx}`}
                    fill={activePalette[idx % activePalette.length]}
                    opacity={isSelected ? 1 : 0.35}
                    onClick={() => handleBarClick(row)}
                  />
                );
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
