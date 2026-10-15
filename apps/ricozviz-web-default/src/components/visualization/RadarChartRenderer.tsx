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
  "#147D78", // Editorial Accent
  "#D9A441", // Subtle Highlight Ochre
  "#2E5B70", // Deep Slate Cyan
  "#10B981", // Emerald
  "#E11D48", // Rose Alert
  "#596775", // Secondary Text Slate
  "#0F625D", // Deep Forest Teal
  "#F59E0B", // Amber Warning
];

export interface RadarChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  palette?: string[];
  height?: number | string;
}

export function RadarChartRenderer({
  data,
  config,
  palette,
  height = "100%",
}: RadarChartRendererProps) {
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
            const color = activePalette[idx % activePalette.length];
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
