// ========================================
// Dataset Query Engine (Safe Preview & Query Foundation)
// ========================================
// Provides column projection, sorting, and bounded row limits.
// Strictly prevents arbitrary SQL injection.
// ========================================

import type { Dataset } from "@prisma/client";
import { validateSqlIdentifier } from "./schema-discovery.service.js";
import { AppError } from "../../utils/errors.js";

export interface DatasetQueryParams {
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    direction: "asc" | "desc";
  };
}

export interface DatasetQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export class DatasetQueryEngine {
  /**
   * Executes a safe, bounded query against a dataset.
   */
  async executeQuery(dataset: Dataset, params: DatasetQueryParams = {}): Promise<DatasetQueryResult> {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    const knownColumns = ((meta.columns || []) as Array<{ name: string }>).map((c) => c.name);

    // Limit enforcement: default 25, max 100
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    // Validate requested columns
    let selectedColumns = knownColumns;
    if (params.columns && params.columns.length > 0) {
      for (const col of params.columns) {
        if (!knownColumns.includes(col)) {
          throw AppError.badRequest(`Requested column "${col}" does not exist in dataset schema`);
        }
        validateSqlIdentifier(col);
      }
      selectedColumns = params.columns;
    }

    // Validate orderBy if present
    if (params.orderBy) {
      if (!knownColumns.includes(params.orderBy.column)) {
        throw AppError.badRequest(`Order by column "${params.orderBy.column}" does not exist in schema`);
      }
      validateSqlIdentifier(params.orderBy.column);
    }

    // Source rows from cached sample/data
    const allRows = ((meta.sampleData || []) as Record<string, unknown>[]) || [];

    const processedRows = [...allRows];

    // Apply sorting
    if (params.orderBy) {
      const { column, direction } = params.orderBy;
      const factor = direction === "desc" ? -1 : 1;
      processedRows.sort((a, b) => {
        const valA = a[column];
        const valB = b[column];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        return valA > valB ? factor : -factor;
      });
    }

    const total = processedRows.length;

    // Apply pagination slice
    const sliced = processedRows.slice(offset, offset + limit);

    // Project requested columns
    const projectedRows = sliced.map((row) => {
      const projected: Record<string, unknown> = {};
      for (const col of selectedColumns) {
        projected[col] = row[col] ?? null;
      }
      return projected;
    });

    return Promise.resolve({
      columns: selectedColumns,
      rows: projectedRows,
      total,
      limit,
      offset,
    });
  }
}

export const datasetQueryEngine = new DatasetQueryEngine();
