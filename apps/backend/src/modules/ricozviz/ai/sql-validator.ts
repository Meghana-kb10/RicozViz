import { AppError } from '../../../utils/errors.js';

export interface SqlValidationResult {
  sanitizedSql: string;
  referencedColumns: string[];
  table: string;
  limit: number;
}

const FORBIDDEN_SQL_KEYWORDS = [
  'drop',
  'delete',
  'update',
  'insert',
  'alter',
  'create',
  'attach',
  'detach',
  'copy',
  'pragma',
  'call',
  'execute',
  'prepare',
  'truncate',
  'grant',
  'revoke',
  'vacuum',
  'install',
  'load',
  'export',
  'import'
];

const STANDARD_SQL_KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'group',
  'by',
  'order',
  'having',
  'limit',
  'offset',
  'as',
  'and',
  'or',
  'not',
  'in',
  'is',
  'null',
  'like',
  'ilike',
  'between',
  'asc',
  'desc',
  'case',
  'when',
  'then',
  'else',
  'end',
  'distinct',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'full',
  'cross',
  'on',
  'with',
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'round',
  'coalesce',
  'date_trunc',
  'extract',
  'cast',
  'over',
  'true',
  'false',
  'year',
  'month',
  'day',
  'quarter',
  'week',
  'interval',
  'now',
  'current_date',
  'current_timestamp',
  'all'
]);

/**
 * Validates, checks whitelists, and sanitizes generated SQL for safe DuckDB execution.
 */
export function validateAndSanitizeSql(
  rawSql: string,
  allowedColumns: string[],
  defaultLimit = 500
): SqlValidationResult {
  const sql = rawSql.trim();
  if (!sql) {
    throw AppError.badRequest('Generated SQL query cannot be empty.');
  }

  // 1. Multi-statement check: Check for unquoted semicolons
  // Strip string literals before checking semicolons to allow semicolons inside quotes if any
  const strippedOfStrings = sql.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:""|[^"])*"/g, '""');
  const semicolonCount = (strippedOfStrings.match(/;/g) || []).length;
  if (semicolonCount > 1 || (semicolonCount === 1 && !strippedOfStrings.trim().endsWith(';'))) {
    throw AppError.badRequest('Multi-statement SQL queries are strictly prohibited.');
  }

  const cleanSql = sql.replace(/;+\s*$/, '').trim();

  // 2. Prohibited keywords (DDL/DML checks)
  for (const forbidden of FORBIDDEN_SQL_KEYWORDS) {
    const regex = new RegExp(`\\b${forbidden}\\b`, 'i');
    if (regex.test(cleanSql)) {
      throw AppError.badRequest(
        `SQL statement contains prohibited operation '${forbidden.toUpperCase()}'. Only single SELECT queries are permitted.`
      );
    }
  }

  // 3. Statement type check: Must start with SELECT or WITH ... SELECT
  if (!/^\s*(select|with\b[\s\S]+\bselect)\b/i.test(cleanSql)) {
    throw AppError.badRequest('Query must be a SELECT statement.');
  }

  // 4. Table Whitelist Check: Must ONLY query dataset_table (or temporary view / CTE)
  const fromJoinRegex = /\b(?:from|join)\s+([a-zA-Z0-9_".]+)/gi;
  let match: RegExpExecArray | null;
  const referencedTables: string[] = [];

  while ((match = fromJoinRegex.exec(cleanSql)) !== null) {
    const rawTableName = match[1]?.replace(/["`']/g, '').trim().toLowerCase();
    if (rawTableName && !referencedTables.includes(rawTableName)) {
      referencedTables.push(rawTableName);
    }
  }

  for (const table of referencedTables) {
    // Only 'dataset_table' is allowed (or subquery aliases defined within query)
    if (table !== 'dataset_table') {
      throw AppError.badRequest(
        `Table '${table}' is not permitted. Queries can only reference 'dataset_table'.`
      );
    }
  }

  // 5. Column Whitelist Check
  const allowedColumnSet = new Set(allowedColumns.map((c) => c.toLowerCase()));

  // Extract aliases defined in the SELECT list (e.g., AS total_rev or AS "total_rev")
  const aliasRegex = /\bAS\s+([a-zA-Z0-9_"]+)/gi;
  const aliasSet = new Set<string>();
  let aliasMatch: RegExpExecArray | null;
  while ((aliasMatch = aliasRegex.exec(cleanSql)) !== null) {
    const a = aliasMatch[1]?.replace(/["`']/g, '').toLowerCase();
    if (a) aliasSet.add(a);
  }

  // Tokenize words in query (ignoring string literals and numbers)
  const codeOnly = cleanSql.replace(/'(?:''|[^'])*'/g, "''");
  const identifierTokens = codeOnly.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  const referencedCols: string[] = [];

  for (const token of identifierTokens) {
    const lower = token.toLowerCase();
    if (
      STANDARD_SQL_KEYWORDS.has(lower) ||
      aliasSet.has(lower) ||
      lower === 'dataset_table' ||
      /^\d+$/.test(lower)
    ) {
      continue;
    }

    // Must be in the dataset's allowed columns
    if (!allowedColumnSet.has(lower)) {
      throw AppError.badRequest(
        `Column '${token}' is not present in the dataset schema. Permitted columns: ${allowedColumns.join(', ')}`
      );
    }

    if (!referencedCols.includes(lower)) {
      referencedCols.push(lower);
    }
  }

  // 6. LIMIT Enforcement
  let finalSql = cleanSql;
  let enforcedLimit = defaultLimit;
  const limitMatch = cleanSql.match(/\bLIMIT\s+(\d+)\b/i);

  if (limitMatch && limitMatch[1]) {
    const userLimit = parseInt(limitMatch[1], 10);
    if (userLimit > 1000) {
      finalSql = cleanSql.replace(/\bLIMIT\s+\d+\b/i, 'LIMIT 1000');
      enforcedLimit = 1000;
    } else {
      enforcedLimit = userLimit;
    }
  } else {
    finalSql = `${cleanSql} LIMIT ${defaultLimit}`;
  }

  return {
    sanitizedSql: finalSql,
    referencedColumns: referencedCols,
    table: 'dataset_table',
    limit: enforcedLimit
  };
}
