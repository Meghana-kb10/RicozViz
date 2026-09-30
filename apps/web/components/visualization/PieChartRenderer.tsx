"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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

export interface PieChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  isDonut?: boolean;
  height?: number | string;
}

export function PieChartRenderer({
  data,
  config,
  isDonut = false,
  height = "100%",
}: PieChartRendererProps) {
  const options = config.options || {};
  const showLegend = options.showLegend !== false;
  const numberFormat = (options.numberFormat as string) || "auto";

  const slices = data.pieSlices || [];
  const totalValue = slices.reduce((acc, slice) => acc + (slice.value || 0), 0);

  const formatSliceValue = (val: unknown) => {
    if (typeof val !== "number") return String(val ?? "");
    if (numberFormat === "currency") return formatCurrency(val);
    if (numberFormat === "percent") return formatPercent(val);
    return formatNumber(val);
  };

  return (
    <div style={{ height }} className="w-full h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            formatter={(value, name) => [
              formatSliceValue(value),
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
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />}
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? 55 : 0}
            outerRadius={85}
            paddingAngle={isDonut ? 2 : 0}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {slices.map((_, index) => (
              <Cell
                key={`slice-${index}`}
                fill={PALETTE[index % PALETTE.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Donut Center Summary */}
      {isDonut && totalValue > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            Total
          </span>
          <span className="text-sm font-bold text-gray-800">
            {formatNumber(totalValue, 0, true)}
          </span>
        </div>
      )}
    </div>
  );
}
