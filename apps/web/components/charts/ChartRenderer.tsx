"use client";

import React, { useSyncExternalStore } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Treemap,
} from "recharts";
import type { ChartType, ChartConfig, DatasetQueryResult } from "../../lib/api";
import { mapQueryResultToChartData } from "../../lib/chart-query-mapper";
import { RadarChartRenderer } from "../visualization/RadarChartRenderer";
import { FunnelChartRenderer } from "../visualization/FunnelChartRenderer";
import { HeatmapRenderer } from "../visualization/HeatmapRenderer";

export const COLOR_PALETTES: Record<string, string[]> = {
  default: [
    "#4f46e5", // Indigo
    "#06b6d4", // Cyan
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#8b5cf6", // Purple
    "#3b82f6", // Blue
    "#14b8a6", // Teal
  ],
  emerald: [
    "#059669",
    "#10b981",
    "#34d399",
    "#6ee7b7",
    "#047857",
    "#065f46",
    "#15803d",
    "#22c55e",
  ],
  ocean: [
    "#0284c7",
    "#0ea5e9",
    "#38bdf8",
    "#7dd3fc",
    "#0369a1",
    "#075985",
    "#2563eb",
    "#60a5fa",
  ],
  sunset: [
    "#f97316",
    "#fb923c",
    "#fdba74",
    "#ea580c",
    "#e11d48",
    "#f43f5e",
    "#fb7185",
    "#be123c",
  ],
  purple: [
    "#7c3aed",
    "#8b5cf6",
    "#a78bfa",
    "#c4b5fd",
    "#6d28d9",
    "#5b21b6",
    "#9333ea",
    "#c084fc",
  ],
  monochrome: [
    "#18181b",
    "#27272a",
    "#3f3f46",
    "#52525b",
    "#71717a",
    "#a1a1aa",
    "#d4d4d8",
    "#e4e4e7",
  ],
};

export interface ChartRendererProps {
  chartType: ChartType;
  config: ChartConfig;
  queryResult: DatasetQueryResult | null;
  isLoading?: boolean;
  error?: string | null;
  height?: number | string;
}

function subscribe() {
  return () => {};
}

function formatValue(val: unknown, numConfig?: ChartConfig["numberFormat"]): string {
  if (val === null || val === undefined) return "";
  if (typeof val !== "number") return String(val);
  const decimals = numConfig?.decimals ?? 2;
  const prefix = numConfig?.prefix ?? "";
  const suffix = numConfig?.suffix ?? "";

  let numStr = "";
  if (numConfig?.compact) {
    numStr = Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: decimals,
    }).format(val);
  } else {
    numStr = val.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  if (numConfig?.formatType === "percentage") {
    return `${prefix}${numStr}%${suffix}`;
  }
  if (numConfig?.formatType === "currency" && !prefix) {
    return `$${numStr}${suffix}`;
  }
  return `${prefix}${numStr}${suffix}`;
}

export function ChartRenderer({
  chartType,
  config,
  queryResult,
  isLoading = false,
  error = null,
  height = 260,
}: ChartRendererProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  if (isLoading) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-gray-50/50 p-6 text-center animate-pulse"
      >
        <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-medium text-gray-500">Executing query engine...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-red-50/50 border border-red-200 p-6 text-center"
      >
        <span className="text-2xl mb-2">⚠️</span>
        <h5 className="text-xs font-bold text-red-800">Query Failed</h5>
        <p className="mt-1 text-[11px] text-red-600 max-w-xs">{error}</p>
      </div>
    );
  }

  if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl bg-gray-50/50 border border-dashed border-gray-200 p-6 text-center"
      >
        <span className="text-2xl mb-1 text-gray-400">∅</span>
        <p className="text-xs font-semibold text-gray-600">No data returned</p>
        <p className="mt-1 text-[11px] text-gray-400">
          Run query or adjust filters/dimensions in the configuration panel.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ height }} className="bg-gray-50/40 rounded-xl" />;
  }

  const mapped = mapQueryResultToChartData(chartType, queryResult, config);
  const xKey = mapped.xKey || "dimension";
  const measureKeys =
    mapped.measureKeys.length > 0 ? mapped.measureKeys : ["value"];

  // Resolve palette
  const activePalette =
    config.customColors && config.customColors.length > 0
      ? config.customColors
      : COLOR_PALETTES[config.colorPalette || "default"] || COLOR_PALETTES.default;

  // Customization options
  const showLegend = config.legend?.show !== false && measureKeys.length > 1;
  const legendPos = config.legend?.position || "top";
  const xAxisCfg = config.xAxisConfig;
  const yAxisCfg = config.yAxisConfig;
  const numFmt = config.numberFormat;
  const chartOpts = config.chartOptions;

  const tooltipFormatter = (val: unknown) => [
    formatValue(val, numFmt),
    "Value",
  ];

  return (
    <div style={{ height }} className="w-full relative">
      {/* 1. BAR CHART */}
      {chartType === "BAR" && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={mapped.rows}
            margin={{ top: 10, right: 10, left: -10, bottom: xAxisCfg?.labelRotation ? 35 : 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={xAxisCfg?.showGrid ?? false}
              horizontal={yAxisCfg?.showGrid ?? true}
              stroke="#f3f4f6"
            />
            {xAxisCfg?.showLabels !== false && (
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                angle={xAxisCfg?.labelRotation ?? 0}
                textAnchor={xAxisCfg?.labelRotation ? "end" : "middle"}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
            )}
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={[yAxisCfg?.min ?? "auto", yAxisCfg?.max ?? "auto"]}
              tickFormatter={(v) => formatValue(v, { ...numFmt, compact: true })}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {showLegend && (
              <Legend
                verticalAlign={legendPos === "bottom" ? "bottom" : "top"}
                align={legendPos === "left" ? "left" : legendPos === "right" ? "right" : "center"}
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              />
            )}
            {measureKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={chartOpts?.stacked ? "a" : undefined}
                fill={activePalette[idx % activePalette.length]}
                radius={chartOpts?.stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* 2. LINE CHART */}
      {chartType === "LINE" && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={mapped.rows}
            margin={{ top: 10, right: 10, left: -10, bottom: xAxisCfg?.labelRotation ? 35 : 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={xAxisCfg?.showGrid ?? false}
              horizontal={yAxisCfg?.showGrid ?? true}
              stroke="#f3f4f6"
            />
            {xAxisCfg?.showLabels !== false && (
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                angle={xAxisCfg?.labelRotation ?? 0}
                textAnchor={xAxisCfg?.labelRotation ? "end" : "middle"}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
            )}
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={[yAxisCfg?.min ?? "auto", yAxisCfg?.max ?? "auto"]}
              tickFormatter={(v) => formatValue(v, { ...numFmt, compact: true })}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {showLegend && (
              <Legend
                verticalAlign={legendPos === "bottom" ? "bottom" : "top"}
                align={legendPos === "left" ? "left" : legendPos === "right" ? "right" : "center"}
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              />
            )}
            {measureKeys.map((key, idx) => (
              <Line
                key={key}
                type={chartOpts?.smooth !== false ? "monotone" : "linear"}
                dataKey={key}
                stroke={activePalette[idx % activePalette.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: activePalette[idx % activePalette.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* 3. AREA CHART */}
      {chartType === "AREA" && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={mapped.rows}
            margin={{ top: 10, right: 10, left: -10, bottom: xAxisCfg?.labelRotation ? 35 : 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={xAxisCfg?.showGrid ?? false}
              horizontal={yAxisCfg?.showGrid ?? true}
              stroke="#f3f4f6"
            />
            {xAxisCfg?.showLabels !== false && (
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                angle={xAxisCfg?.labelRotation ?? 0}
                textAnchor={xAxisCfg?.labelRotation ? "end" : "middle"}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
            )}
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              domain={[yAxisCfg?.min ?? "auto", yAxisCfg?.max ?? "auto"]}
              tickFormatter={(v) => formatValue(v, { ...numFmt, compact: true })}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {showLegend && (
              <Legend
                verticalAlign={legendPos === "bottom" ? "bottom" : "top"}
                align={legendPos === "left" ? "left" : legendPos === "right" ? "right" : "center"}
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              />
            )}
            {measureKeys.map((key, idx) => (
              <Area
                key={key}
                type={chartOpts?.smooth !== false ? "monotone" : "linear"}
                stackId={chartOpts?.stacked ? "a" : undefined}
                dataKey={key}
                stroke={activePalette[idx % activePalette.length]}
                fill={activePalette[idx % activePalette.length]}
                fillOpacity={chartOpts?.fillOpacity ?? 0.25}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* 4. PIE CHART */}
      {chartType === "PIE" && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(val) => [formatValue(val, numFmt), "Value"]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Legend
              verticalAlign={legendPos === "bottom" ? "bottom" : "top"}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Pie
              data={mapped.pieSlices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {mapped.pieSlices?.map((_, index) => (
                <Cell
                  key={`pie-cell-${index}`}
                  fill={activePalette[index % activePalette.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* 5. DONUT CHART */}
      {chartType === "DONUT" && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(val) => [formatValue(val, numFmt), "Value"]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Legend
              verticalAlign={legendPos === "bottom" ? "bottom" : "top"}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Pie
              data={mapped.pieSlices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={chartOpts?.donutHoleSize ?? 50}
              outerRadius={80}
              paddingAngle={2}
            >
              {mapped.pieSlices?.map((_, index) => (
                <Cell
                  key={`donut-cell-${index}`}
                  fill={activePalette[index % activePalette.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* 6. SCATTER PLOT / BUBBLE */}
      {(chartType === "SCATTER" || chartType === "BUBBLE") && (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey={xKey}
              name={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              dataKey={mapped.yKey || measureKeys[0]}
              name={mapped.yKey || measureKeys[0]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={tooltipFormatter}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Scatter
              name="Values"
              data={mapped.rows}
              fill={activePalette[0]}
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* 7. TABLE VIEW */}
      {chartType === "TABLE" && (
        <div className="h-full overflow-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {mapped.columns.map((col) => (
                  <th
                    key={col.name}
                    className="px-3 py-2 font-semibold text-gray-700 tracking-wider"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {mapped.rows.slice(0, 50).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/80">
                  {mapped.columns.map((col) => (
                    <td key={col.name} className="px-3 py-1.5 text-gray-800 font-mono text-[11px]">
                      {row[col.name] !== null && row[col.name] !== undefined
                        ? String(row[col.name])
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. KPI CARD */}
      {chartType === "KPI" && (
        <div className="h-full flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50/50 via-white to-white p-6 border border-indigo-100/50 text-center">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            {mapped.kpiLabel || "Metric"}
          </span>
          <div className="text-4xl font-extrabold text-gray-900 tracking-tight">
            {typeof mapped.kpiValue === "number"
              ? formatValue(mapped.kpiValue, numFmt)
              : mapped.kpiValue ?? 0}
          </div>
          <span className="mt-2 text-[10px] text-gray-400 font-mono">
            {mapped.rows.length} records analyzed
          </span>
        </div>
      )}

      {/* 9. RADAR CHART */}
      {chartType === "RADAR" && (
        <RadarChartRenderer data={mapped} config={config} height="100%" />
      )}

      {/* 10. FUNNEL CHART */}
      {chartType === "FUNNEL" && (
        <FunnelChartRenderer data={mapped} config={config} height="100%" />
      )}

      {/* 11. HEATMAP MATRIX */}
      {chartType === "HEATMAP" && (
        <HeatmapRenderer data={mapped} config={config} height="100%" />
      )}

      {/* 12. GAUGE METER */}
      {chartType === "GAUGE" && (
        <div className="h-full flex flex-col items-center justify-center p-4">
          {(() => {
            const rawVal =
              typeof mapped.kpiValue === "number"
                ? mapped.kpiValue
                : typeof mapped.rows[0]?.[measureKeys[0]] === "number"
                ? (mapped.rows[0][measureKeys[0]] as number)
                : 68;
            const min = yAxisCfg?.min ?? 0;
            const max = yAxisCfg?.max ?? (rawVal > 100 ? rawVal * 1.25 : 100);
            const clamped = Math.max(min, Math.min(rawVal, max));
            const pct = Math.round(((clamped - min) / (max - min || 1)) * 100);
            const strokeDash = 251.2;
            const offset = strokeDash - (strokeDash * pct) / 100;

            return (
              <div className="flex flex-col items-center">
                <div className="relative w-44 h-24 flex items-end justify-center overflow-hidden">
                  <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                      strokeDasharray={strokeDash}
                      strokeDashoffset={strokeDash / 2}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={activePalette[0]}
                      strokeWidth="10"
                      strokeDasharray={strokeDash}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute bottom-1 flex flex-col items-center">
                    <span className="text-2xl font-black text-gray-900 tracking-tight">
                      {formatValue(rawVal, numFmt)}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {pct}% of Target
                    </span>
                  </div>
                </div>
                <div className="flex justify-between w-40 text-[10px] text-gray-400 font-mono mt-1">
                  <span>{formatValue(min, numFmt)}</span>
                  <span>{formatValue(max, numFmt)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 13. TREEMAP */}
      {chartType === "TREEMAP" && (
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={mapped.rows.map((r, i) => ({
              name: String(r[xKey] ?? `Item ${i + 1}`),
              size: Number(r[measureKeys[0]] ?? 1),
              fill: activePalette[i % activePalette.length],
            }))}
            dataKey="size"
            stroke="#ffffff"
            fill={activePalette[0]}
          >
            <Tooltip formatter={tooltipFormatter} />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  );
}
