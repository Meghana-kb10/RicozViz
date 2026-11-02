// ========================================
// DuckDB Vectorized In-Memory OLAP Engine Store
// ========================================
// High-performance embedded DuckDB management:
// - Loads and caches dataset tables per dataset version
// - Supports instant vectorized aggregations, windowing, joins, and filters
// - Thread-safe connection lifecycle with query interruption on timeout
// - Zero placeholder mocks: real DuckDB C++ engine bindings via @duckdb/node-api
// ========================================

import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { compileCalculatedField, evaluateExpression } from './calculated-field.engine.js';
import type { QueryableDataset } from './query-engine.js';

export interface DuckDBTableCacheEntry {
  datasetId: string;
  version: number;
  tableName: string;
  loadedAt: number;
  rowCount: number;
}

export class DuckDBStore {
  private instancePromise: Promise<DuckDBInstance> | null = null;
  private readonly loadedTables = new Map<string, DuckDBTableCacheEntry>();

  /**
   * Lazily initialize or return the singleton DuckDB instance.
   */
  async getInstance(): Promise<DuckDBInstance> {
    if (!this.instancePromise) {
      this.instancePromise = DuckDBInstance.create().catch((err: unknown) => {
        this.instancePromise = null;
        logger.error('[DuckDBStore] Failed to initialize DuckDBInstance', err);
        throw err;
      });
    }
    return this.instancePromise;
  }

  /**
   * Create a dedicated connection from the shared DuckDB instance.
   */
  async createConnection(): Promise<DuckDBConnection> {
    const instance = await this.getInstance();
    return instance.connect();
  }

  /**
   * Produce a safe, deterministic DuckDB SQL table name for a dataset and version.
   */
  getTableName(datasetId: string, version = 1): string {
    const cleanId = String(datasetId).replace(/[^a-zA-Z0-9_]/g, '_');
    const safeVersion = Math.max(1, Math.floor(Number(version) || 1));
    return `ds_${cleanId}_v${safeVersion}`;
  }

  /**
   * Check if a dataset table is currently loaded and matching the requested version.
   */
  isTableLoaded(datasetId: string, version = 1): boolean {
    const entry = this.loadedTables.get(datasetId);
    if (!entry) return false;
    const safeVersion = Math.max(1, Math.floor(Number(version) || 1));
    return entry.version === safeVersion;
  }

  /**
   * Invalidate and drop cached DuckDB tables for a dataset (e.g. on refresh or update).
   */
  async invalidateDataset(datasetId: string): Promise<void> {
    const entry = this.loadedTables.get(datasetId);
    this.loadedTables.delete(datasetId);

    try {
      const conn = await this.createConnection();
      try {
        if (entry?.tableName) {
          await conn.run(`DROP TABLE IF EXISTS "${entry.tableName}"`);
        }
        // Also drop any other version tables for this dataset
        const cleanId = String(datasetId).replace(/[^a-zA-Z0-9_]/g, '_');
        const pattern = `ds_${cleanId}_v%`;
        const existing = await conn.run(
          `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '${pattern}'`
        );
        const rows = await existing.getRows();
        for (const row of rows) {
          const tName = String(row[0]);
          await conn.run(`DROP TABLE IF EXISTS "${tName}"`);
        }
      } finally {
        try {
          conn.closeSync();
        } catch {
          // Connection already closed
        }
      }
      logger.info(`[DuckDBStore] Invalidated tables for dataset "${datasetId}"`);
    } catch (err) {
      logger.warn(`[DuckDBStore] Error invalidating table for dataset "${datasetId}"`, err);
    }
  }

  /**
   * Ensure a dataset is loaded into a DuckDB table.
   * If already loaded with the same version, returns the table name immediately.
   * Otherwise, loads the dataset rows (evaluating calculated fields) into DuckDB.
   */
  async ensureDatasetTable(
    dataset: QueryableDataset,
    explicitRows?: Record<string, unknown>[]
  ): Promise<string> {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    const version = Math.max(
      1,
      Math.floor(
        Number(
          (dataset as unknown as Record<string, unknown>)['currentVersion'] ??
            meta['version'] ??
            1
        ) || 1
      )
    );
    const tableName = this.getTableName(dataset.id, version);

    if (this.isTableLoaded(dataset.id, version)) {
      return tableName;
    }

    // 1. Resolve source rows
    let sourceRows: Record<string, unknown>[] = [];
    if (explicitRows && explicitRows.length > 0) {
      sourceRows = explicitRows;
    } else if (Array.isArray(meta['sampleData']) && meta['sampleData'].length > 0) {
      sourceRows = meta['sampleData'] as Record<string, unknown>[];
    } else if (Array.isArray(meta['previewRows']) && meta['previewRows'].length > 0) {
      sourceRows = meta['previewRows'] as Record<string, unknown>[];
    } else if (Array.isArray(meta['rows']) && meta['rows'].length > 0) {
      sourceRows = meta['rows'] as Record<string, unknown>[];
    }

    // 2. Evaluate calculated fields if present
    const calculatedFields: Array<{
      name: string;
      expression: string;
      dataType?: string;
    }> = Array.isArray(meta['calculatedFields'])
      ? (meta['calculatedFields'] as Array<{
          name: string;
          expression: string;
          dataType?: string;
        }>)
      : [];

    let processedRows = sourceRows;
    if (calculatedFields.length > 0 && sourceRows.length > 0) {
      const knownCols: Array<{ name: string; type: string }> = [];
      if (Array.isArray(dataset.columns)) {
        for (const col of dataset.columns) {
          knownCols.push({ name: col.name, type: col.dataType || 'string' });
        }
      }
      if (Array.isArray(meta['columns'])) {
        for (const col of meta['columns'] as Array<{ name: string; type?: string }>) {
          if (!knownCols.some((k) => k.name === col.name)) {
            knownCols.push({ name: col.name, type: col.type || 'string' });
          }
        }
      }

      const compiledList: Array<{
        name: string;
        ast: ReturnType<typeof compileCalculatedField>['ast'];
      }> = [];
      for (const cf of calculatedFields) {
        try {
          const compiled = compileCalculatedField(cf.expression, knownCols);
          compiledList.push({ name: cf.name, ast: compiled.ast });
          knownCols.push({ name: cf.name, type: cf.dataType || 'number' });
        } catch {
          // Ignore compile errors for invalid legacy expressions
        }
      }

      if (compiledList.length > 0) {
        processedRows = sourceRows.map((r) => {
          const rowCopy = { ...r };
          for (const cf of compiledList) {
            try {
              rowCopy[cf.name] = evaluateExpression(cf.ast, rowCopy);
            } catch {
              rowCopy[cf.name] = null;
            }
          }
          return rowCopy;
        });
      }
    }

    // 3. Load into DuckDB
    const conn = await this.createConnection();
    try {
      if (processedRows.length > 0) {
        // Write to temporary JSON file for fast, vectorized batch ingestion
        const tmpFile = path
          .join(
            os.tmpdir(),
            `ricozviz_duckdb_${dataset.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
          )
          .replace(/\\/g, '/');

        await fs.promises.writeFile(tmpFile, JSON.stringify(processedRows), 'utf8');

        try {
          await conn.run(
            `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${tmpFile}')`
          );
        } finally {
          try {
            await fs.promises.unlink(tmpFile);
          } catch {
            // Ignore cleanup errors
          }
        }
      } else {
        // Handle empty dataset: create empty table with column types if known
        const cols = (dataset.columns ??
          meta['columns'] ??
          []) as Array<{ name: string; dataType?: string; type?: string }>;
        if (cols.length > 0) {
          const colDefs = cols.map((c) => {
            const rawType = (c.dataType || c.type || 'string').toLowerCase();
            let duckType = 'VARCHAR';
            if (rawType.includes('int')) duckType = 'BIGINT';
            else if (rawType.includes('num') || rawType.includes('float') || rawType.includes('double') || rawType.includes('decimal'))
              duckType = 'DOUBLE';
            else if (rawType.includes('bool')) duckType = 'BOOLEAN';
            else if (rawType.includes('date') || rawType.includes('time')) duckType = 'TIMESTAMP';
            return `"${c.name}" ${duckType}`;
          });
          await conn.run(`CREATE OR REPLACE TABLE "${tableName}" (${colDefs.join(', ')})`);
        } else {
          await conn.run(`CREATE OR REPLACE TABLE "${tableName}" (_empty_placeholder INT)`);
        }
      }

      this.loadedTables.set(dataset.id, {
        datasetId: dataset.id,
        version,
        tableName,
        loadedAt: Date.now(),
        rowCount: processedRows.length
      });

      logger.info(
        `[DuckDBStore] Successfully loaded dataset "${dataset.id}" into table "${tableName}" (${processedRows.length} rows)`
      );
      return tableName;
    } finally {
      try {
        conn.closeSync();
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Execute an arbitrary SQL query against DuckDB with timeout enforcement.
   */
  async executeSql(
    sql: string,
    timeoutMs = 5000
  ): Promise<{
    columns: string[];
    rows: Record<string, unknown>[];
    executionTimeMs: number;
  }> {
    const startTime = Date.now();
    const conn = await this.createConnection();

    let timeoutTimer: NodeJS.Timeout | null = null;
    let didTimeout = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        didTimeout = true;
        try {
          conn.interrupt();
        } catch {
          // Interrupt failed or already ended
        }
        reject(
          AppError.timeout(
            `Query execution exceeded timeout limit of ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
    });

    try {
      const queryPromise = conn.run(sql);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }

      const columnNames = result.columnNames();
      const rawRows = await result.getRows();

      // Convert BigInt values to JS numbers and map to Record objects
      const rows = rawRows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < columnNames.length; i++) {
          const colName = columnNames[i]!;
          const val = row[i];
          obj[colName] = typeof val === 'bigint' ? Number(val) : val;
        }
        return obj;
      });

      const executionTimeMs = Date.now() - startTime;
      return {
        columns: columnNames,
        rows,
        executionTimeMs
      };
    } catch (err: unknown) {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (didTimeout) {
        throw AppError.timeout(`Query execution exceeded timeout limit of ${timeoutMs}ms`);
      }
      if (err instanceof Error && /interrupt/i.test(err.message)) {
        throw AppError.timeout(`Query execution was interrupted (timeout of ${timeoutMs}ms)`);
      }
      throw err;
    } finally {
      if (didTimeout) {
        // Allow interrupted C++ query thread to cleanly unwind before closing connection
        setTimeout(() => {
          try {
            conn.closeSync();
          } catch {}
        }, 100);
      } else {
        try {
          conn.closeSync();
        } catch {}
      }
    }
  }

  /**
   * Reset store and close memoized instance.
   */
  async close(): Promise<void> {
    this.loadedTables.clear();
    this.instancePromise = null;
  }
}

export const duckdbStore = new DuckDBStore();
