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
  "#4f46e5", // Indigo
  "#6366f1", // Lighter indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
];

export interface FunnelChartRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
}

export function FunnelChartRenderer({
  data,
  config: _config,
  height = "100%",
}: FunnelChartRendererProps) {
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
              <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
