"use client";

import React from "react";
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  Cell,
} from "recharts";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber } from "../../lib/formatting";

const PALETTE = [
  "#147D78", // Editorial Accent
  "#106963", // Darker Accent Hover
  "#4F9D8E", // Workspace Sage Teal
  "#D9A441", // Subtle Highlight Ochre
  "#2E5B70", // Deep Slate Cyan
  "#10B981", // Emerald
  "#596775", // Secondary Text Slate
  "#E11D48", // Rose Alert
];

export interface FunnelChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  palette?: string[];
  height?: number | string;
}

export function FunnelChartRenderer({
  data,
  config,
  palette,
  height = "100%",
}: FunnelChartRendererProps) {
  const options = config.options || {};
  const activePalette =
    palette && palette.length > 0
      ? palette
      : Array.isArray(options.palette) && options.palette.length > 0
        ? (options.palette as string[])
        : Array.isArray(options.colorPalette) && options.colorPalette.length > 0
          ? (options.colorPalette as string[])
          : PALETTE;
  const xKey = data.xKey || "category";
  const valKey = data.measureKeys[0] || (data.columns[1]?.name ?? "value");

  const funnelData = (data.rows || []).map((row) => ({
    name: String(row[xKey] ?? "Stage"),
    value: Math.max(0, Number(row[valKey]) || 0),
  }));

  if (funnelData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-gray-400">
        No data available for Funnel Chart
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
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
              "Value",
            ]}
          />
          <Funnel dataKey="value" data={funnelData} isAnimationActive>
            <LabelList
              position="right"
              fill="#374151"
              stroke="none"
              dataKey="name"
              style={{ fontSize: "11px", fontWeight: 600 }}
            />
            {funnelData.map((_, idx) => (
              <Cell key={`cell-${idx}`} fill={activePalette[idx % activePalette.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
