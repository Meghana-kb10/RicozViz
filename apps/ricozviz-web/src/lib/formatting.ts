// ========================================
// RicozViz Formatting Utilities
// ========================================
// Handles formatting for numbers, percentages, currencies, and dates
// with defensive defaults and no hardcoded currency assumptions.
// ========================================

export type FormatType = "auto" | "number" | "currency" | "percent" | "date";

export interface FormatOptions {
  decimals?: number;
  currencySymbol?: string;
  dateFormat?: "short" | "medium" | "long";
  compact?: boolean;
}

/**
 * Format a number cleanly with thousands separators.
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals?: number,
  compact = false
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return String(value);

  if (compact && Math.abs(num) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: decimals ?? 1,
    }).format(num);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: decimals !== undefined ? decimals : 2,
  }).format(num);
}

/**
 * Format a number as currency ONLY when explicitly configured or requested.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = "USD",
  decimals = 2
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return String(value);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return `$${formatNumber(num, decimals)}`;
  }
}

/**
 * Format a number as a percentage (e.g. 0.154 -> 15.4% or 15.4 -> 15.4% based on magnitude).
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return String(value);

  // If value is between -1 and 1 (exclusive of 0), treat as fractional (e.g. 0.42 -> 42%)
  const percentage = Math.abs(num) <= 1 && num !== 0 ? num * 100 : num;

  return `${formatNumber(percentage, decimals)}%`;
}

/**
 * Format date values with fallback.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  style: "short" | "medium" | "long" = "medium"
): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { month: "numeric", day: "numeric", year: "2-digit" }
      : style === "long"
      ? { month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Generalized value formatter that routes according to configuration or auto-detection.
 */
export function formatValue(
  value: unknown,
  formatType: FormatType = "auto",
  options: FormatOptions = {}
): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (formatType) {
    case "currency":
      return formatCurrency(value as number, options.currencySymbol || "USD", options.decimals);
    case "percent":
      return formatPercent(value as number, options.decimals);
    case "date":
      return formatDate(value as string | Date, options.dateFormat);
    case "number":
      return formatNumber(value as number, options.decimals, options.compact);
    case "auto":
    default: {
      if (typeof value === "number") {
        return formatNumber(value, options.decimals, options.compact);
      }
      if (typeof value === "boolean") {
        return value ? "true" : "false";
      }
      if (typeof value === "string") {
        // Test if string is an ISO date
        if (/^\d{4}-\d{2}-\d{2}(T|\b)/.test(value)) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) return formatDate(d, options.dateFormat);
        }
      }
      return String(value);
    }
  }
}
