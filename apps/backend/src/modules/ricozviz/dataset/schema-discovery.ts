// ========================================
// Schema Discovery Service (PostgreSQL, MySQL & Tabular)
// ========================================
// Discovers tables and column definitions from connected sources safely.
// Validates identifiers to prevent SQL injection.
// Never exposes credentials in responses or error logs.
// ========================================

import { createRequire } from 'node:module';
import fs from 'node:fs';
import { DataSourceModel, toObjectId } from '@repo/database';
import { DATA_SOURCE_TYPE } from '@repo/types';
import type { SourceTable } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import type { ColumnSchema, InferredColumnType } from './type-inference.js';

/** `better-sqlite3` and `csv-parser` ship no type declarations — load them untyped. */
const requireOptional = createRequire(import.meta.url);

interface SqliteStatementRow {
  name: string;
  type?: string;
  notnull?: number;
}

interface SqliteDatabase {
  pragma(source: string): SqliteStatementRow[];
  close(): void;
}

interface SqliteDatabaseCtor {
  new (
    filePath: string,
    options?: { fileMustExist?: boolean; readonly?: boolean }
  ): SqliteDatabase;
}

type CsvRow = Record<string, string>;

interface CsvParserInstance {
  on(event: 'data', listener: (row: CsvRow) => void): CsvParserStream;
  on(event: 'close', listener: () => void): CsvParserStream;
  on(event: 'end', listener: () => void): CsvParserStream;
  on(event: 'error', listener: (error: Error) => void): CsvParserStream;
}

/** `csv-parser` transform stream: chainable event emitter that can be destroyed. */
interface CsvParserStream extends CsvParserInstance {
  destroy(): void;
}

export type DiscoveredTable = SourceTable;

/**
 * Resolves the decrypted credential bag for a `DataSource.credentialRef`.
 *
 * The RicozViz credential vault lives in the `data-source` module, which is
 * ported separately. Until it registers a resolver we behave exactly like the
 * legacy service does when the vault holds no record: an empty credential bag,
 * which makes connectors attempt an unauthenticated / rejected connection.
 */
export type CredentialResolver = (credentialRef: string) => Promise<Record<string, unknown> | null>;

let credentialResolver: CredentialResolver | null = null;

/** Wire the credential vault in once the `data-source` module is available. */
export function registerCredentialResolver(resolver: CredentialResolver): void {
  credentialResolver = resolver;
}

async function getCredentials(
  credentialRef: string | null | undefined
): Promise<Record<string, unknown>> {
  if (!credentialRef || !credentialResolver) {
    return {};
  }
  const resolved = await credentialResolver(credentialRef);
  return resolved ?? {};
}

/**
 * Validates that an SQL identifier contains only alphanumeric characters and underscores.
 * Strictly prevents SQL injection in table and column names.
 */
export function validateSqlIdentifier(name: string): string {
  const clean = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(clean)) {
    throw AppError.badRequest(
      `Invalid SQL identifier: "${name}". Identifiers must start with a letter/underscore and contain only alphanumeric characters.`
    );
  }
  return clean;
}

/**
 * Maps SQL / Database data types to standardized InferredColumnType.
 */
export function mapPostgresTypeToColumnType(pgType: string): InferredColumnType {
  const lower = pgType.toLowerCase();

  if (
    lower.includes('int') ||
    lower.includes('serial') ||
    lower === 'smallint' ||
    lower === 'bigint'
  ) {
    return 'integer';
  }

  if (
    lower.includes('numeric') ||
    lower.includes('decimal') ||
    lower.includes('float') ||
    lower.includes('double') ||
    lower === 'real'
  ) {
    return 'number';
  }

  if (lower.includes('bool')) {
    return 'boolean';
  }

  if (lower.includes('date') || lower.includes('time')) {
    return 'date';
  }

  return 'string';
}

/** Shape of the persisted data source row used by the discovery routines. */
interface DiscoveryDataSource {
  _id: unknown;
  organizationId: unknown;
  workspaceId: unknown;
  name: string;
  type: string;
  connectionMeta: Record<string, unknown>;
  credentialRef: string | null;
}

/** Load the data source or raise the legacy 404. Invalid ObjectIds map to 404 too. */
async function loadDataSource(dataSourceId: string): Promise<DiscoveryDataSource> {
  const objectId = toObjectId(dataSourceId);
  const dataSource = objectId
    ? ((await DataSourceModel.findById(objectId).lean()) as DiscoveryDataSource | null)
    : null;

  if (!dataSource) {
    throw AppError.notFound('Data source');
  }

  return dataSource;
}

/** Tenant isolation guard shared by both discovery entry points. */
function assertSameOrganization(dataSource: DiscoveryDataSource, organizationId: string): void {
  if (String(dataSource.organizationId) !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }
}

export class SchemaDiscoveryService {
  /**
   * Lists tables and views for a given DataSource (PostgreSQL, MySQL, CSV, XLSX, JSON).
   */
  async listTables(dataSourceId: string, organizationId: string): Promise<DiscoveredTable[]> {
    const dataSource = await loadDataSource(dataSourceId);

    assertSameOrganization(dataSource, organizationId);

    const credentials = await getCredentials(dataSource.credentialRef);

    const type = dataSource.type;
    const meta = (dataSource.connectionMeta || {}) as Record<string, unknown>;

    if (type === DATA_SOURCE_TYPE.POSTGRESQL) {
      try {
        const { Client: PgClient } = await import('pg');
        const client = new PgClient({
          host: String(meta.host || 'localhost'),
          port: Number(meta.port || 5432),
          database: String(meta.database || ''),
          user: String(meta.username || ''),
          password: String(credentials.password || '')
        });
        await client.connect();
        const res = await client.query(
          `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC`
        );
        await client.end();
        return (res.rows as Array<{ table_name: string; table_type: string }>).map((t) => ({
          name: t.table_name,
          type: t.table_type === 'VIEW' ? 'view' : 'table'
        }));
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to retrieve tables from PostgreSQL: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.MYSQL) {
      try {
        const mysql = await import('mysql2/promise');
        const database = String(meta.database || '');
        const connection = await mysql.createConnection({
          host: String(meta.host || 'localhost'),
          port: Number(meta.port || 3306),
          database,
          user: String(meta.username || ''),
          password: String(credentials.password || '')
        });
        const [rows] = await connection.execute('SHOW FULL TABLES');
        await connection.end();

        return (rows as Array<Record<string, string>>).map((r) => {
          const key = Object.keys(r).find((k) => k.startsWith('Tables_in_'));
          const typeKey = Object.keys(r).find((k) => k === 'Table_type');
          return {
            name: key ? r[key] : 'unknown',
            type: typeKey && r[typeKey] === 'VIEW' ? 'view' : 'table'
          };
        });
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to retrieve tables from MySQL: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.SQLITE) {
      try {
        const Database = requireOptional('better-sqlite3') as SqliteDatabaseCtor;
        const filePath = String(meta.filePath || meta.databasePath || ':memory:');
        const db = new Database(filePath, { fileMustExist: filePath !== ':memory:' });
        const rows = db.pragma('table_list');
        db.close();
        return rows
          .filter((r) => !r.name.startsWith('sqlite_'))
          .map((r) => ({
            name: r.name,
            type: r.type === 'view' ? 'view' : 'table'
          }));
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to retrieve tables from SQLite: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.CSV_UPLOAD || type === 'CSV') {
      const tableName = String(meta.fileName || 'data.csv').replace(/\.[^/.]+$/, '');
      return [{ name: tableName, type: 'table' }];
    }

    const format = String(meta.sourceFormat || type).toUpperCase();

    if (format === 'XLSX') {
      try {
        const xlsx = await import('xlsx');
        const filePath = String(meta.filePath || '');
        const workbook = xlsx.readFile(filePath);
        return workbook.SheetNames.map((name) => ({ name, type: 'table' as const }));
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to read XLSX: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (format === 'JSON') {
      const pathKey = String(meta.dataPath || 'records');
      return [{ name: pathKey || 'root', type: 'table' }];
    }

    return [{ name: 'dataset_table', type: 'table' }];
  }

  /**
   * Backwards-compatible wrapper for PostgreSQL table discovery.
   */
  async listPostgresTables(
    dataSourceId: string,
    organizationId: string
  ): Promise<DiscoveredTable[]> {
    return this.listTables(dataSourceId, organizationId);
  }

  /**
   * Discovers the column schema of a specific table in a DataSource.
   */
  async discoverTableSchema(
    dataSourceId: string,
    organizationId: string,
    tableName: string
  ): Promise<ColumnSchema[]> {
    const safeTable = validateSqlIdentifier(tableName);

    const dataSource = await loadDataSource(dataSourceId);

    assertSameOrganization(dataSource, organizationId);

    const credentials = await getCredentials(dataSource.credentialRef);

    const type = dataSource.type;
    const meta = (dataSource.connectionMeta || {}) as Record<string, unknown>;

    if (type === DATA_SOURCE_TYPE.POSTGRESQL) {
      try {
        const { Client: PgClient } = await import('pg');
        const client = new PgClient({
          host: String(meta.host || 'localhost'),
          port: Number(meta.port || 5432),
          database: String(meta.database || ''),
          user: String(meta.username || ''),
          password: String(credentials.password || '')
        });
        await client.connect();
        const res = await client.query({
          text: 'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1 ORDER BY ordinal_position ASC',
          values: [safeTable]
        });
        await client.end();

        const rows = res.rows as Array<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>;
        if (rows.length === 0) {
          throw AppError.notFound(`Table "${safeTable}"`);
        }
        return rows.map((col) => ({
          name: col.column_name,
          type: mapPostgresTypeToColumnType(col.data_type),
          nullable: col.is_nullable.toUpperCase() === 'YES'
        }));
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        throw AppError.badRequest(
          'Failed to retrieve schema from PostgreSQL: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.MYSQL) {
      try {
        const mysql = await import('mysql2/promise');
        const database = String(meta.database || '');
        const connection = await mysql.createConnection({
          host: String(meta.host || 'localhost'),
          port: Number(meta.port || 3306),
          database,
          user: String(meta.username || ''),
          password: String(credentials.password || '')
        });
        const [rows] = await connection.execute('DESCRIBE `' + safeTable + '`');
        await connection.end();

        return (rows as Array<{ Field: string; Type: string; Null: string }>).map((r) => ({
          name: r.Field,
          type: mapPostgresTypeToColumnType(r.Type),
          nullable: r.Null === 'YES'
        }));
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to retrieve schema from MySQL: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.SQLITE) {
      try {
        const Database = requireOptional('better-sqlite3') as SqliteDatabaseCtor;
        const filePath = String(meta.filePath || meta.databasePath || ':memory:');
        const db = new Database(filePath, { fileMustExist: filePath !== ':memory:' });
        const rows = db.pragma(`table_info("${safeTable}")`);
        db.close();
        return rows.map((r) => ({
          name: r.name,
          type: mapPostgresTypeToColumnType(r.type ?? 'TEXT'),
          nullable: r.notnull === 0
        }));
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to retrieve schema from SQLite: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }

    const format = String(meta.sourceFormat || type).toUpperCase();

    if (format === 'XLSX') {
      try {
        const xlsx = await import('xlsx');
        const filePath = String(meta.filePath || '');
        const workbook = xlsx.readFile(filePath);
        const firstSheetName = workbook.SheetNames[0] || '';
        const sheet = workbook.Sheets[safeTable] || workbook.Sheets[firstSheetName];
        if (!sheet) throw new Error('Sheet not found');
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        if (!rows || rows.length === 0) return [];
        const headers = rows[0] || [];
        return headers.map((h: unknown, i: number) => {
          let t: InferredColumnType = 'string';
          if (rows.length > 1 && rows[1]) {
            const v = rows[1][i];
            if (typeof v === 'number') t = 'number';
            else if (typeof v === 'boolean') t = 'boolean';
          }
          return { name: String(h), type: t, nullable: true };
        });
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to read XLSX schema: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (format === 'JSON') {
      try {
        const filePath = String(meta.filePath || '');
        const content = fs.readFileSync(filePath, 'utf-8');
        let data: unknown = JSON.parse(content);
        const pathKey = String(meta.dataPath || '');
        if (
          pathKey &&
          typeof data === 'object' &&
          data !== null &&
          (data as Record<string, unknown>)[pathKey]
        ) {
          data = (data as Record<string, unknown>)[pathKey];
        }
        if (!Array.isArray(data)) data = [data];
        const records = data as unknown[];
        if (records.length === 0) return [];
        const firstRow = records[0];
        if (typeof firstRow !== 'object' || !firstRow) return [];
        return Object.keys(firstRow as Record<string, unknown>).map((k) => {
          const v = (firstRow as Record<string, unknown>)[k];
          let t: InferredColumnType = 'string';
          if (typeof v === 'number') t = 'number';
          else if (typeof v === 'boolean') t = 'boolean';
          return { name: k, type: t, nullable: true };
        });
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to read JSON schema: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    }

    if (type === DATA_SOURCE_TYPE.CSV_UPLOAD || format === 'CSV') {
      try {
        const csvFactory = requireOptional('csv-parser') as (opts?: unknown) => unknown;
        const filePath = String(meta.filePath || '');
        const results: CsvRow[] = [];
        return await new Promise<ColumnSchema[]>((resolve, reject) => {
          const settle = (): void => {
            if (results.length === 0) {
              resolve([]);
              return;
            }
            const firstRow = results[0];
            const cols: ColumnSchema[] = Object.keys(firstRow).map((k) => {
              const v = firstRow[k];
              let t: InferredColumnType = 'string';
              if (!Number.isNaN(Number(v)) && v !== '') t = 'number';
              return { name: k, type: t, nullable: true };
            });
            resolve(cols);
          };

          const stream: CsvParserStream = (fs
            .createReadStream(filePath)
            .pipe(csvFactory() as import('node:stream').Writable) as unknown as CsvParserStream
          )
            .on('data', (data: CsvRow) => {
              results.push(data);
              if (results.length > 1) {
                stream.destroy();
              }
            })
            .on('close', settle)
            .on('end', settle)
            .on('error', reject);
        });
      } catch (err: unknown) {
        throw AppError.badRequest(
          'Failed to read CSV schema: ' + (err instanceof Error ? err.message : String(err))
        );
      }
    }

    return [
      { name: 'id', type: 'string', nullable: false },
      { name: 'name', type: 'string', nullable: false },
      { name: 'created_at', type: 'date', nullable: false },
      { name: 'value', type: 'number', nullable: true }
    ];
  }

  /**
   * Backwards-compatible wrapper for PostgreSQL column discovery.
   */
  async discoverPostgresTableSchema(
    dataSourceId: string,
    organizationId: string,
    tableName: string
  ): Promise<ColumnSchema[]> {
    return this.discoverTableSchema(dataSourceId, organizationId, tableName);
  }
}

export const schemaDiscoveryService = new SchemaDiscoveryService();