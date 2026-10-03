"use client";

import React, { useState } from "react";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber } from "../../lib/formatting";

export interface HeatmapRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
}

export function HeatmapRenderer({
  data,
  config,
  height = "100%",
}: HeatmapRendererProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    x: string;
    y: string;
    val: number | null;
  } | null>(null);

  const xCol = config.xAxis || config.dimensions?.[0] || data.xKey || "x";
  const yCol =
    (config as Record<string, unknown>).groupCol as string ||
    config.dimensions?.[1] ||
    "group";
  const valCol =
    data.measureKeys[0] ||
    (typeof config.yAxis === "string" ? config.yAxis : "value");

  // Extract distinct X and Y categories
  const xCategories = Array.from(
    new Set((data.rows || []).map((r) => String(r[xCol] ?? "Unknown")))
  );
  const yCategories = Array.from(
    new Set((data.rows || []).map((r) => String(r[yCol] ?? "Default")))
  );

  // Build lookup map: `${x}:::${y}` -> number
  const cellMap = new Map<string, number>();
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const r of data.rows || []) {
    const x = String(r[xCol] ?? "Unknown");
    const y = String(r[yCol] ?? "Default");
    const val = Number(r[valCol]);
    if (!isNaN(val)) {
      cellMap.set(`${x}:::${y}`, val);
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }
  }

  if (minVal === Infinity) {
    minVal = 0;
    maxVal = 100;
  }
  const range = maxVal - minVal || 1;

  if (xCategories.length === 0 || yCategories.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-gray-400">
        No matrix data available for Heatmap
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full h-full flex flex-col p-2">
      {/* Legend / Info bar */}
      <div className="flex items-center justify-between text-2xs text-gray-500 mb-2 px-1">
        <span>
          Matrix: <strong>{xCol}</strong> × <strong>{yCol}</strong> ({valCol})
        </span>
        <div className="flex items-center gap-1.5">
          <span>Min: {formatNumber(minVal)}</span>
          <div className="w-20 h-2 rounded bg-gradient-to-r from-indigo-100 to-indigo-700" />
          <span>Max: {formatNumber(maxVal)}</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-gray-100 p-2 font-semibold text-gray-600 text-left border-b border-r border-gray-200">
                {yCol} \ {xCol}
              </th>
              {xCategories.map((x) => (
                <th
                  key={x}
                  className="sticky top-0 z-10 bg-gray-50 p-2 font-semibold text-gray-700 text-center border-b border-gray-200 truncate max-w-[120px]"
                  title={x}
                >
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yCategories.map((y) => (
              <tr key={y}>
                <td
                  className="sticky left-0 z-10 bg-gray-50 p-2 font-semibold text-gray-700 text-left border-r border-b border-gray-200 truncate max-w-[120px]"
                  title={y}
                >
                  {y}
                </td>
                {xCategories.map((x) => {
                  const val = cellMap.get(`${x}:::${y}`);
                  const hasVal = val !== undefined;
                  const ratio = hasVal ? Math.max(0, Math.min(1, (val - minVal) / range)) : 0;
                  const bgOpacity = hasVal ? 0.12 + ratio * 0.82 : 0.03;
                  const textColor = ratio > 0.55 ? "#ffffff" : "#1f2937";

                  return (
                    <td
                      key={`${x}-${y}`}
                      onMouseEnter={() => setHoveredCell({ x, y, val: hasVal ? val : null })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        backgroundColor: hasVal
                          ? `rgba(79, 70, 229, ${bgOpacity})`
                          : "#f9fafb",
                        color: hasVal ? textColor : "#9ca3af",
                      }}
                      className="p-2.5 text-center font-mono text-2xs transition-all hover:scale-105 hover:z-30 cursor-pointer border-b border-r border-gray-100"
                    >
                      {hasVal ? formatNumber(val) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating tooltip readout */}
      {hoveredCell && (
        <div className="mt-2 text-2xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md flex items-center justify-between">
          <span>
            <strong>{hoveredCell.x}</strong> &times; <strong>{hoveredCell.y}</strong>
          </span>
          <span className="font-bold text-indigo-600">
            {hoveredCell.val !== null ? formatNumber(hoveredCell.val) : "No data"}
          </span>
        </div>
      )}
    </div>
  );
}
