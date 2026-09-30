"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
  height?: number | string;
}

export function BarChartRenderer({ data, config, height = "100%" }: BarChartRendererProps) {
  const options = config.options || {};
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
        <BarChart
          data={data.rows}
          margin={{ top: 12, right: 16, left: 0, bottom: 20 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          )}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
          )}
          {showYAxis && (
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={formatTick}
            />
          )}
          <Tooltip
            formatter={(value, name) => [
              formatTick(value),
              String(name),
            ]}
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#e5e7eb",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
          {measureKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={PALETTE[idx % PALETTE.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
