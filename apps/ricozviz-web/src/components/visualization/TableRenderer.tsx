"use client";

import React from "react";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatValue, type FormatType } from "../../lib/formatting";

export interface TableRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
  onDataPointClick?: (field: string, value: unknown) => void;
  selectedFilterValue?: unknown;
}

export function TableRenderer({
  data,
  config,
  height = "100%",
  onDataPointClick,
  selectedFilterValue,
}: TableRendererProps) {
  const options = config.options || {};
  const numberFormat = (options.numberFormat as FormatType) || "auto";
  const primaryDim = data.xKey || data.columns[0]?.name;

  return (
    <div style={{ height }} className="w-full h-full overflow-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
        <thead className="bg-gray-50/90 sticky top-0 backdrop-blur-xs z-10">
          <tr>
            {data.columns.map((col) => (
              <th
                key={col.name}
                className="px-3.5 py-2.5 font-semibold text-gray-700 tracking-wider whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <span>{col.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono font-normal">
                    ({col.type})
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {data.rows.slice(0, 100).map((row, rIdx) => {
            const isSelected =
              selectedFilterValue !== undefined &&
              selectedFilterValue !== null &&
              primaryDim &&
              String(row[primaryDim]) === String(selectedFilterValue);

            return (
              <tr
                key={rIdx}
                onClick={() => {
                  if (onDataPointClick && primaryDim && row[primaryDim] !== undefined) {
                    onDataPointClick(primaryDim, row[primaryDim]);
                  }
                }}
                className={`transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 font-semibold"
                    : "hover:bg-indigo-50/30"
                }`}
              >
                {data.columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-3.5 py-2 text-gray-800 font-mono text-[11px] whitespace-nowrap"
                  >
                    {row[col.name] !== null && row[col.name] !== undefined
                      ? formatValue(row[col.name], numberFormat)
                      : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {data.rows.length > 100 && (
        <div className="p-2 text-center text-[11px] text-gray-400 bg-gray-50 border-t border-gray-100">
          Showing first 100 of {data.rows.length} rows
        </div>
      )}
    </div>
  );
}
