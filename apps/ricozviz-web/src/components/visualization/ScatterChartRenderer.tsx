"use client";

import React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber, formatCurrency, formatPercent } from "../../lib/formatting";

export interface ScatterChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
}

export function ScatterChartRenderer({
  data,
  config,
  height = "100%",
}: ScatterChartRendererProps) {
  const options = config.options || {};
  const showGrid = options.showGrid !== false;
  const showXAxis = options.showXAxis !== false;
  const showYAxis = options.showYAxis !== false;
  const numberFormat = (options.numberFormat as string) || "auto";

  const xKey = data.xKey || "x";
  const yKey = data.yKey || (data.measureKeys[0] ?? "y");

  const formatTick = (val: unknown) => {
    if (typeof val !== "number") return String(val ?? "");
    if (numberFormat === "currency") return formatCurrency(val, undefined, 0);
    if (numberFormat === "percent") return formatPercent(val, 0);
    return formatNumber(val, undefined, true);
  };

  return (
    <div style={{ height }} className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 20 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />}
          {showXAxis && (
            <XAxis
              dataKey={xKey}
              name={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={formatTick}
            />
          )}
          {showYAxis && (
            <YAxis
              dataKey={yKey}
              name={yKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              tickFormatter={formatTick}
            />
          )}
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            formatter={(value, name) => [formatTick(value), String(name)]}
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#e5e7eb",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
          />
          <Scatter
            name={`${xKey} vs ${yKey}`}
            data={data.rows}
            fill="#4f46e5"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
