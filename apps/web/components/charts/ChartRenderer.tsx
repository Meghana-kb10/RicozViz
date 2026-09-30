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
} from "recharts";
import type { ChartType, ChartConfig, DatasetQueryResult } from "../../lib/api";
import { mapQueryResultToChartData } from "../../lib/chart-query-mapper";

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

  return (
    <div style={{ height }} className="w-full relative">
      {/* 1. BAR CHART */}
      {chartType === "BAR" && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={mapped.rows}
            margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />}
            {measureKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={PALETTE[idx % PALETTE.length]}
                radius={[4, 4, 0, 0]}
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
            margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />}
            {measureKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PALETTE[idx % PALETTE.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: PALETTE[idx % PALETTE.length] }}
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
            margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
              }}
            />
            {measureKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />}
            {measureKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={PALETTE[idx % PALETTE.length]}
                fill={PALETTE[idx % PALETTE.length]}
                fillOpacity={0.2}
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
              formatter={(val) => [
                typeof val === "number" ? val.toLocaleString() : String(val ?? ""),
                "Value",
              ]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
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
                  fill={PALETTE[index % PALETTE.length]}
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
              formatter={(val) => [
                typeof val === "number" ? val.toLocaleString() : String(val ?? ""),
                "Value",
              ]}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderRadius: "0.5rem",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Pie
              data={mapped.pieSlices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {mapped.pieSlices?.map((_, index) => (
                <Cell
                  key={`donut-cell-${index}`}
                  fill={PALETTE[index % PALETTE.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* 6. SCATTER PLOT */}
      {chartType === "SCATTER" && (
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
              fill="#4f46e5"
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
              ? mapped.kpiValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : mapped.kpiValue ?? 0}
          </div>
          <span className="mt-2 text-[10px] text-gray-400 font-mono">
            {mapped.rows.length} records analyzed
          </span>
        </div>
      )}
    </div>
  );
}
