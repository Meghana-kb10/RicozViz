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
  "#ff6b35", // Primary Coral Accent
  "#38bdf8", // Sky Telemetry
  "#10b981", // Emerald Positive
  "#f59e0b", // Amber Warning
  "#8b5cf6", // Violet Signal
  "#ec4899", // Rose Metric
  "#06b6d4", // Cyan
  "#f43f5e", // Crimson Alert
];

export interface PieChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  palette?: string[];
  isDonut?: boolean;
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
}

export function PieChartRenderer({
  data,
  config,
  palette,
  isDonut = false,
  height = "100%",
  onDataPointClick,
  selectedFilterValue,
}: PieChartRendererProps) {
  const options = config.options || {};
  const activePalette =
    palette && palette.length > 0
      ? palette
      : Array.isArray(options.palette) && options.palette.length > 0
        ? (options.palette as string[])
        : Array.isArray(options.colorPalette) && options.colorPalette.length > 0
          ? (options.colorPalette as string[])
          : PALETTE;
  const showLegend = options.showLegend !== false;
  const numberFormat = (options.numberFormat as string) || "auto";

  const slices = data.pieSlices || [];
  const totalValue = slices.reduce((acc, slice) => acc + (slice.value || 0), 0);
  const xKey = data.xKey || "category";

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
              backgroundColor: "#161616",
              borderColor: "#2e2e2e",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
              fontSize: "12px",
              color: "#fafafa",
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
            className="cursor-pointer"
            onClick={(entry) => {
              if (onDataPointClick && entry && entry.name) {
                onDataPointClick(xKey, entry.name);
              }
            }}
          >
            {slices.map((slice, index) => {
              const isSelected =
                selectedFilterValue === undefined ||
                selectedFilterValue === null ||
                String(slice.name) === String(selectedFilterValue);

              return (
                <Cell
                  key={`slice-${index}`}
                  fill={activePalette[index % activePalette.length]}
                  opacity={isSelected ? 1 : 0.35}
                  stroke={isSelected && selectedFilterValue !== undefined ? "#1e1b4b" : "none"}
                  strokeWidth={isSelected && selectedFilterValue !== undefined ? 2 : 0}
                />
              );
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Donut Center Summary */}
      {isDonut && totalValue > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
          <span className="text-[10px] text-[#777777] font-semibold uppercase tracking-wider font-mono">
            Total
          </span>
          <span className="text-sm font-bold text-white font-mono">
            {formatNumber(totalValue, 0, true)}
          </span>
        </div>
      )}
    </div>
  );
}
