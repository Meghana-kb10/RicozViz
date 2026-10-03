// ========================================
// Column Type Inference & CSV Parser
// ========================================
// Infers column types and detects nullability from tabular samples.
// Supported inferred types: integer, number, decimal, boolean, date, datetime, string
// ========================================

import * as XLSX from "xlsx";

export type InferredColumnType = "integer" | "number" | "decimal" | "boolean" | "date" | "datetime" | "string";

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
 * Checks if a string represents a valid ISO or date-time string.
 */
function isDateTime(val: string): boolean {
  const trimmed = val.trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[T ]\d{1,2}:\d{2}/.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return !Number.isNaN(parsed);
  }
  return false;
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

  // Check datetime (must check before date since datetimes contain date prefix)
  if (nonNullValues.every(isDateTime)) {
    return { type: "datetime", nullable };
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
    throw new Error("CSV content is empty");
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
  if (!firstLine) throw new Error("CSV content is empty");
  const rawHeaders = parseLine(firstLine);
  if (rawHeaders.length === 0 || rawHeaders.every((h) => !h.trim())) {
    throw new Error("Malformed CSV: header row is empty");
  }

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
    if (values.length !== headers.length) {
      throw new Error(`Malformed CSV: Row ${i + 1} has ${values.length} values, expected ${headers.length} columns`);
    }
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

/**
 * Parses and validates raw tabular JSON into headers and row objects.
 * Expects a top-level array of JSON objects.
 */
export function parseJsonTabular(
  jsonText: string,
  maxRows = 1000
): { headers: string[]; rows: Record<string, unknown>[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON: syntax error");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Unsupported JSON structure: expected non-empty array of objects");
  }

  const isObjectRecord = (item: unknown): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && !Array.isArray(item);

  for (let i = 0; i < parsed.length; i++) {
    if (!isObjectRecord(parsed[i])) {
      throw new Error(`Unsupported JSON structure: row ${i + 1} is not an object`);
    }
  }

  // Collect unique headers across all records in stable order
  const headersSet = new Set<string>();
  for (const record of parsed) {
    for (const key of Object.keys(record)) {
      headersSet.add(key);
    }
  }

  const rawHeaders = Array.from(headersSet);
  if (rawHeaders.length === 0) {
    throw new Error("Invalid JSON: objects contain no fields or properties");
  }

  // Normalize header names
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

  const rows = parsed.slice(0, maxRows).map((orig) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < rawHeaders.length; i++) {
      const rawKey = rawHeaders[i]!;
      const cleanKey = headers[i]!;
      row[cleanKey] = orig[rawKey];
    }
    return row;
  });

  return { headers, rows };
}

/**
 * Discovers schema (column list with types and nullability) from JSON tabular records.
 */
export function discoverJsonSchema(
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnSchema[] {
  return headers.map((header) => {
    const values = rows.map((r) => r[header]);
    const nonNullValues = values.filter((v) => v !== undefined && v !== null && v !== "");
    const nullable = nonNullValues.length < values.length;

    let type: InferredColumnType = "string";
    if (nonNullValues.length > 0) {
      if (
        nonNullValues.every(
          (v) => typeof v === "boolean" || v === "true" || v === "false"
        )
      ) {
        type = "boolean";
      } else if (
        nonNullValues.every(
          (v) =>
            (typeof v === "number" && Number.isInteger(v)) ||
            (typeof v === "string" && /^-?\d+$/.test(v.trim()))
        )
      ) {
        type = "integer";
      } else if (
        nonNullValues.every(
          (v) =>
            typeof v === "number" ||
            (typeof v === "string" && !Number.isNaN(Number(v.trim())))
        )
      ) {
        type = "number";
      } else if (
        nonNullValues.every((v) => {
          if (typeof v !== "string") return false;
          return (
            /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[T ]\d{1,2}:\d{2}/.test(v.trim()) &&
            !Number.isNaN(Date.parse(v))
          );
        })
      ) {
        type = "datetime";
      } else if (
        nonNullValues.every((v) => {
          if (typeof v !== "string") return false;
          return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(v.trim()) && !Number.isNaN(Date.parse(v));
        })
      ) {
        type = "date";
      } else {
        type = "string";
      }
    }

    const sampleValues = Array.from(
      new Set(nonNullValues.map((v) => String(v)))
    ).slice(0, 3);

    return {
      name: header,
      type,
      nullable,
      sampleValues,
    };
  });
}

/**
 * Parses raw XLSX/XLS buffer into headers and row objects.
 * Reads the first worksheet by default.
 */
export function parseXlsxBuffer(
  buffer: Buffer,
  maxRows = 1000
): { headers: string[]; rows: Record<string, unknown>[] } {
  if (!buffer || buffer.length === 0) {
    throw new Error("XLSX content is empty");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new Error("Invalid or corrupted XLSX file");
  }

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error("Invalid XLSX file: no worksheets found");
  }

  const firstSheetName = sheetNames[0];
  if (!firstSheetName) {
    throw new Error("Invalid XLSX file: no worksheets found");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Invalid XLSX file: first worksheet is empty");
  }

  // Convert worksheet to 2D array of rows
  const data: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (!data || data.length === 0) {
    throw new Error("XLSX content is empty or contains no records");
  }

  const rawHeaders = (data[0] || []).map((h) => String(h ?? "").trim());
  if (rawHeaders.length === 0 || rawHeaders.every((h) => !h)) {
    throw new Error("Malformed XLSX: header row is empty");
  }

  // Clean and ensure unique column headers
  const headers: string[] = [];
  const seenHeaders = new Map<string, number>();

  for (const h of rawHeaders) {
    let clean = h.replace(/[^a-zA-Z0-9_]/g, "_") || "col";
    if (seenHeaders.has(clean)) {
      const count = seenHeaders.get(clean)! + 1;
      seenHeaders.set(clean, count);
      clean = `${clean}_${count}`;
    } else {
      seenHeaders.set(clean, 1);
    }
    headers.push(clean);
  }

  const rows: Record<string, unknown>[] = [];
  const rowLimit = Math.min(data.length, maxRows + 1);

  for (let i = 1; i < rowLimit; i++) {
    const rowData = data[i];
    if (
      !rowData ||
      rowData.length === 0 ||
      rowData.every((cell) => cell === "" || cell === null || cell === undefined)
    ) {
      continue;
    }
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        let val = rowData[j];
        if (val instanceof Date) {
          val = val.toISOString().split("T")[0];
        }
        row[header] = val !== undefined && val !== null ? val : "";
      }
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("XLSX worksheet has headers but contains no data rows");
  }

  return { headers, rows };
}

/**
 * Discovers schema from XLSX records.
 */
export function discoverXlsxSchema(
  headers: string[],
  rows: Record<string, unknown>[]
): ColumnSchema[] {
  return discoverJsonSchema(headers, rows);
}

