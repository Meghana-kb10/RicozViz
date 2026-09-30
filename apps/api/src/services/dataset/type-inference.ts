// ========================================
// Column Type Inference & CSV Parser
// ========================================
// Infers column types and detects nullability from tabular samples.
// Supported inferred types: integer, number, boolean, date, string
// ========================================

export type InferredColumnType = "integer" | "number" | "boolean" | "date" | "string";

export interface ColumnSchema {
  name: string;
  type: InferredColumnType;
  nullable: boolean;
  sampleValues?: string[];
}

/**
 * Checks if a string represents an integer.
 */
function isInteger(val: string): boolean {
  return /^-?\d+$/.test(val.trim());
}

/**
 * Checks if a string represents a floating-point or integer number.
 */
function isNumber(val: string): boolean {
  if (val.trim() === "") return false;
  return !Number.isNaN(Number(val.trim()));
}

/**
 * Checks if a string represents a boolean value.
 */
function isBoolean(val: string): boolean {
  const lower = val.trim().toLowerCase();
  return ["true", "false", "1", "0", "yes", "no", "t", "f"].includes(lower);
}

/**
 * Checks if a string represents a valid date.
 */
function isDate(val: string): boolean {
  const trimmed = val.trim();
  // Require at least a date-like pattern (YYYY-MM-DD or similar) before parsing
  if (!/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return !Number.isNaN(parsed);
}

/**
 * Infers the best data type for a list of string values in a column.
 */
export function inferColumnType(values: string[]): { type: InferredColumnType; nullable: boolean } {
  const nonNullValues = values.filter((v) => v !== undefined && v !== null && v.trim() !== "");
  const nullable = nonNullValues.length < values.length;

  if (nonNullValues.length === 0) {
    return { type: "string", nullable: true };
  }

  // Check integer
  if (nonNullValues.every(isInteger)) {
    return { type: "integer", nullable };
  }

  // Check number (floats)
  if (nonNullValues.every(isNumber)) {
    return { type: "number", nullable };
  }

  // Check boolean
  if (nonNullValues.every(isBoolean)) {
    return { type: "boolean", nullable };
  }

  // Check date
  if (nonNullValues.every(isDate)) {
    return { type: "date", nullable };
  }

  return { type: "string", nullable };
}

/**
 * Parses raw CSV text into headers and row objects.
 * Handles quoted cells with commas and newlines safely.
 */
export function parseCsvText(
  csvText: string,
  delimiter = ",",
  maxRows = 1000
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Helper to split a CSV line honoring quotes
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    return result;
  };

  const firstLine = lines[0];
  if (!firstLine) return { headers: [], rows: [] };
  const rawHeaders = parseLine(firstLine);
  // Clean and ensure unique column headers
  const headers: string[] = [];
  const seenHeaders = new Map<string, number>();

  for (const h of rawHeaders) {
    let clean = h.trim().replace(/[^a-zA-Z0-9_]/g, "_") || "col";
    if (seenHeaders.has(clean)) {
      const count = seenHeaders.get(clean)! + 1;
      seenHeaders.set(clean, count);
      clean = `${clean}_${count}`;
    } else {
      seenHeaders.set(clean, 1);
    }
    headers.push(clean);
  }

  const rows: Record<string, string>[] = [];
  const rowLimit = Math.min(lines.length, maxRows + 1);

  for (let i = 1; i < rowLimit; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        row[header] = values[j] ?? "";
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Discovers the full schema (column list with types and nullability)
 * from parsed CSV headers and rows.
 */
export function discoverCsvSchema(headers: string[], rows: Record<string, string>[]): ColumnSchema[] {
  return headers.map((header) => {
    const colValues = rows.map((r) => r[header] ?? "");
    const { type, nullable } = inferColumnType(colValues);
    const sampleValues = Array.from(new Set(colValues.filter((v) => v.trim() !== ""))).slice(0, 3);

    return {
      name: header,
      type,
      nullable,
      sampleValues,
    };
  });
}
