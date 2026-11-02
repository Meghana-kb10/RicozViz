"use client";

import React from "react";
import type { MappedChartData } from "../../lib/chart-query-mapper";
import type { ChartConfig } from "../../lib/api";
import { formatNumber, formatCurrency, formatPercent } from "../../lib/formatting";

export interface KpiRendererProps {
  data: MappedChartData;
  config: ChartConfig;
  height?: number | string;
}

export function KpiRenderer({ data, config, height = "100%" }: KpiRendererProps) {
  const options = config.options || {};
  const numberFormat = (options.numberFormat as string) || "auto";

  const rawValue = data.kpiValue;
  const label = (options.title as string) || data.kpiLabel || "Aggregated Metric";

  let displayValue: string;
  if (typeof rawValue === "number") {
    if (numberFormat === "currency") {
      displayValue = formatCurrency(rawValue);
    } else if (numberFormat === "percent") {
      displayValue = formatPercent(rawValue);
    } else {
      displayValue = formatNumber(rawValue, 2);
    }
  } else {
    displayValue = String(rawValue ?? "—");
  }

  return (
    <div
      style={{ height }}
      className="w-full h-full flex flex-col items-center justify-center rounded-xl bg-[hsl(var(--surface))] p-6 border border-[hsl(var(--surface-border))] text-center shadow-xs"
    >
      <span className="text-xs font-semibold text-[hsl(var(--primary))] uppercase tracking-wider mb-1 line-clamp-1">
        {label}
      </span>
      <div className="text-3xl sm:text-4xl font-semibold text-[hsl(var(--foreground))] tracking-tight font-mono my-2">
        {displayValue}
      </div>
      <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--surface-subtle))] px-2.5 py-1 rounded-full border border-[hsl(var(--surface-border))] font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span>{data.rows.length} source records computed</span>
      </div>
    </div>
  );
}
