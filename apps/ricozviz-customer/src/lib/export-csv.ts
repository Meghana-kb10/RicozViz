/**
 * Client-Side CSV Export Utility
 * RFC 4180 compliant CSV generator and browser file download helper.
 */

import type { DatasetQueryResult } from "./api";

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str: string;
  if (typeof val === "object") {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportChartDataToCsv(
  title: string,
  result: DatasetQueryResult | null | undefined
): boolean {
  if (!result || !result.rows || result.rows.length === 0) {
    return false;
  }

  const columns =
    result.columns && result.columns.length > 0
      ? result.columns.map((c) => c.name)
      : Object.keys(result.rows[0] || {});

  if (columns.length === 0) return false;

  const headerRow = columns.map(escapeCsvValue).join(",");
  const dataRows = result.rows.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  const cleanTitle = (title || "chart-data").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const filename = `${cleanTitle}-${new Date().toISOString().slice(0, 10)}.csv`;

  downloadCsv(filename, csvContent);
  return true;
}
