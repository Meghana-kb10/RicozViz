"use client";

import React from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from "recharts";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber } from "../../lib/formatting";

const PALETTE = [
  "#4f46e5", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
];

export interface RadarChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
}

export function RadarChartRenderer({
  data,
  config,
  height = "100%",
}: RadarChartRendererProps) {
  const options = config.options || {};
  const showLegend = options.showLegend !== false;
  const xKey = data.xKey || "category";
  const measureKeys = data.measureKeys.length > 0 ? data.measureKeys : ["value"];

  if (!data.rows || data.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-gray-400">
        No data available for Radar Chart
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.rows}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey={xKey} tick={{ fill: "#4b5563", fontSize: 11 }} />
          <PolarRadiusAxis angle={30} tick={{ fill: "#9ca3af", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              border: "1px solid #e5e7eb",
              fontSize: "12px",
            }}
            formatter={(val: unknown) => [
              typeof val === "number" ? formatNumber(val) : String(val),
              "",
            ]}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: "12px" }} />}
          {measureKeys.map((key, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            return (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={color}
                fill={color}
                fillOpacity={0.4}
              />
            );
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
