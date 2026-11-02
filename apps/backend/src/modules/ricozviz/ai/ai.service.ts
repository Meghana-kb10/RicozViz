// ============================================================
// AI Service (LLM-Powered NL-to-Chart Engine)
// ============================================================
// Features:
// 1. Swappable LLM provider interface (Anthropic, Mock, etc.)
// 2. Schema-aware prompt construction with data types and sample values
// 3. Strict SQL security validator (SELECT only, whitelisted tables/columns, LIMIT)
// 4. Zero-copy DuckDB execution with dynamic Row-Level Security (RLS) views
// 5. Automatic single-retry recovery with error feedback
// 6. Token usage logging per tenant in AiUsage collection
// ============================================================

import {
  DatasetModel,
  AiUsageModel,
  toObjectId
} from '@repo/database';
import type {
  NlToChartParams,
  NlToChartResponse,
  DatasetQueryFilter,
  QueryResultColumn
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { duckdbStore } from '../dataset/duckdb-store.js';
import { resolveUserRlsFilters } from '../dataset/rls.service.js';
import { getLlmProvider } from './llm/index.js';
import { buildNlToChartPrompt, type DatasetColumnSummary } from './prompt-builder.js';
import { validateAndSanitizeSql, type SqlValidationResult } from './sql-validator.js';
import {
  extractDatasetColumns,
  readDatasetRows,
  verifyResourceWorkspaceAccess,
  type QueryableDataset
} from './ai-analytics.service.js';

interface ParsedLlmOutput {
  sql: string;
  chartType: string;
  xField: string | null;
  yField: string;
  title: string;
}

/**
 * Normalise and parse raw JSON output from the LLM.
 */
function parseJsonLlmOutput(content: string): ParsedLlmOutput {
  let cleaned = content.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Attempt to isolate JSON block if surrounded by conversational filler
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw AppError.badRequest('LLM response did not contain a valid JSON object.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw AppError.badRequest(
      `Failed to parse JSON from LLM output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw AppError.badRequest('LLM response must be a JSON object.');
  }

  const p = parsed as Record<string, unknown>;

  if (typeof p['sql'] !== 'string' || !p['sql'].trim()) {
    throw AppError.badRequest('LLM response JSON is missing required "sql" property.');
  }

  const chartType = typeof p['chartType'] === 'string' && p['chartType'].trim()
    ? p['chartType'].trim().toUpperCase()
    : 'BAR';

  const title = typeof p['title'] === 'string' && p['title'].trim()
    ? p['title'].trim()
    : 'Query Results';

  const xField = typeof p['xField'] === 'string' && p['xField'].trim() ? p['xField'].trim() : null;
  const yField = typeof p['yField'] === 'string' && p['yField'].trim() ? p['yField'].trim() : 'value';

  return {
    sql: p['sql'].trim(),
    chartType,
    xField,
    yField,
    title
  };
}

/**
 * Translates a natural language question into an optimal SQL query and chart specification
 * using an LLM client, executes it through DuckDB with RLS, and logs token usage.
 */
export async function nlToChart(
  userId: string,
  organizationId: string,
  roleName: string,
  params: NlToChartParams
): Promise<NlToChartResponse> {
  const startTime = Date.now();
  const { datasetId, prompt, filters: runtimeFilters = [] } = params;

  if (!prompt || !prompt.trim()) {
    throw AppError.badRequest('Prompt cannot be empty');
  }

  const objectId = toObjectId(datasetId);
  if (!objectId) {
    throw AppError.badRequest(`Invalid dataset ID: "${datasetId}"`);
  }

  const dataset = (await DatasetModel.findById(objectId).lean()) as QueryableDataset | null;
  if (!dataset) {
    throw AppError.notFound(`Dataset '${datasetId}'`);
  }

  // 1. Tenant & workspace authorization
  await verifyResourceWorkspaceAccess(
    {
      workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
      organizationId: dataset.organizationId.toString()
    },
    userId,
    organizationId,
    roleName
  );

  // 2. Extract columns and sample values
  const columnsMeta = extractDatasetColumns(dataset);
  if (columnsMeta.length === 0) {
    throw AppError.badRequest('Dataset has no columns to build a chart from.');
  }

  const sampleRows = readDatasetRows(dataset);
  const columnSummaries: DatasetColumnSummary[] = columnsMeta.map((col) => {
    const samples = sampleRows
      .map((r) => r[col.name])
      .filter((val) => val !== undefined && val !== null)
      .slice(0, 3);
    return {
      name: col.name,
      type: col.type,
      sampleValues: samples
    };
  });

  const columnNames = columnsMeta.map((c) => c.name);
  const columnTypeMap = new Map<string, string>();
  for (const col of columnsMeta) {
    columnTypeMap.set(col.name.toLowerCase(), col.type);
  }

  // 3. Resolve user Row-Level Security (RLS) rules
  const rlsFilters = await resolveUserRlsFilters(
    {
      id: dataset._id.toString(),
      organizationId: dataset.organizationId.toString(),
      workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null
    },
    {
      userId,
      email: '',
      organizationId,
      roleName,
      isOrgAdmin: roleName === 'ADMIN'
    }
  );

  // 4. Ensure dataset table is loaded in DuckDB
  const duckdbTableName = await duckdbStore.ensureDatasetTable({
    id: dataset._id.toString(),
    organizationId: dataset.organizationId.toString(),
    workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
    schemaMeta: dataset.schemaMeta as Record<string, unknown> | null
  });

  // Helper to format an RLS filter condition for DuckDB
  const formatRlsSql = (f: DatasetQueryFilter): string => {
    const col = `"${f.column}"`;
    const colType = (columnTypeMap.get(f.column.toLowerCase()) || 'string').toLowerCase();

    if (f.operator === 'isNull') return `${col} IS NULL`;
    if (f.operator === 'isNotNull') return `${col} IS NOT NULL`;

    if (colType === 'number' || colType === 'integer') {
      const num = Number(f.value);
      if (Number.isNaN(num)) return '1=0';
      return `${col} ${f.operator} ${num}`;
    }

    if (colType === 'boolean') {
      return `${col} ${f.operator === '!=' ? '!=' : '='} ${Boolean(f.value) ? 'TRUE' : 'FALSE'}`;
    }

    const strVal = String(f.value ?? '').replace(/'/g, "''");
    return `LOWER(CAST(${col} AS VARCHAR)) ${f.operator === '!=' ? '!=' : '='} LOWER('${strVal}')`;
  };

  // Configure DuckDB view with RLS
  let rlsWhereClause = '';
  if (rlsFilters.length > 0) {
    const rlsParts = rlsFilters.map(formatRlsSql);
    if (rlsParts.length > 0) {
      rlsWhereClause = ` WHERE (${rlsParts.join(' AND ')})`;
    }
  }

  await duckdbStore.executeSql(
    `CREATE OR REPLACE VIEW dataset_table AS SELECT * FROM ${duckdbTableName}${rlsWhereClause};`,
    5000
  );

  // 5. Construct Prompts & Select Provider
  const { systemPrompt, userPrompt } = buildNlToChartPrompt(
    dataset.name,
    columnSummaries,
    prompt,
    runtimeFilters
  );

  const provider = getLlmProvider();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let usedModel = 'unknown';

  let parsedOutput: ParsedLlmOutput | null = null;
  let validationResult: SqlValidationResult | null = null;
  let queryResultRows: Record<string, unknown>[] = [];
  let queryResultColumns: string[] = [];
  let executionStatus: 'SUCCESS' | 'RETRY_SUCCESS' | 'FAILED' = 'SUCCESS';
  let lastErrorMessage: string | null = null;

  // 6. Attempt 1: Initial LLM Generation & Execution
  try {
    const response1 = await provider.complete({
      systemPrompt,
      userPrompt,
      temperature: 0,
      maxTokens: 1200
    });

    totalPromptTokens += response1.promptTokens;
    totalCompletionTokens += response1.completionTokens;
    usedModel = response1.model;

    parsedOutput = parseJsonLlmOutput(response1.content);
    validationResult = validateAndSanitizeSql(parsedOutput.sql, columnNames, 500);

    const execResult = await duckdbStore.executeSql(validationResult.sanitizedSql, 25000);
    queryResultRows = execResult.rows;
    queryResultColumns = execResult.columns;
  } catch (err1) {
    const error1Msg = err1 instanceof Error ? err1.message : String(err1);
    logger.warn(`NL-to-Chart Attempt 1 failed: ${error1Msg}. Retrying with error feedback...`);
    lastErrorMessage = error1Msg;

    // 7. Attempt 2: Retry with Error Feedback
    try {
      const retryPrompt = `${userPrompt}\n\nYour previous query or JSON failed with the following error:\n"${error1Msg}"\n\nPlease fix the issue. Return STRICT JSON with { sql, chartType, xField, yField, title } querying ONLY from "dataset_table".`;
      const response2 = await provider.complete({
        systemPrompt,
        userPrompt: retryPrompt,
        temperature: 0,
        maxTokens: 1200
      });

      totalPromptTokens += response2.promptTokens;
      totalCompletionTokens += response2.completionTokens;
      usedModel = response2.model;

      parsedOutput = parseJsonLlmOutput(response2.content);
      validationResult = validateAndSanitizeSql(parsedOutput.sql, columnNames, 500);

      const execResult = await duckdbStore.executeSql(validationResult.sanitizedSql, 25000);
      queryResultRows = execResult.rows;
      queryResultColumns = execResult.columns;
      executionStatus = 'RETRY_SUCCESS';
      lastErrorMessage = null;
    } catch (err2) {
      executionStatus = 'FAILED';
      const error2Msg = err2 instanceof Error ? err2.message : String(err2);
      lastErrorMessage = error2Msg;
      logger.error(`NL-to-Chart Attempt 2 (retry) also failed: ${error2Msg}`);
    }
  }

  const executionMs = Date.now() - startTime;

  // 8. Log token usage per tenant in AiUsage collection
  try {
    const orgObjId = toObjectId(organizationId);
    const userObjId = toObjectId(userId);
    if (orgObjId && userObjId) {
      await AiUsageModel.create({
        organizationId: orgObjId,
        userId: userObjId,
        datasetId: toObjectId(datasetId),
        prompt,
        provider: provider.providerName,
        model: usedModel,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        executionMs,
        status: executionStatus,
        errorMessage: lastErrorMessage,
        sql: parsedOutput?.sql ?? null,
        chartType: parsedOutput?.chartType ?? null
      });
    }
  } catch (logErr) {
    logger.warn('Failed to record AiUsage log entry', {
      error: logErr instanceof Error ? logErr.message : String(logErr)
    });
  }

  // 9. If failed after retry, return clear AppError to UI
  if (executionStatus === 'FAILED' || !parsedOutput || !validationResult) {
    throw AppError.badRequest(
      `Unable to generate a valid chart for "${prompt}". Error: ${lastErrorMessage ?? 'Query execution failed.'}`
    );
  }

  // 10. Build formatted NlToChartResponse
  const formattedColumns: QueryResultColumn[] = queryResultColumns.map((c) => ({
    name: c,
    type: columnTypeMap.get(c.toLowerCase()) || 'string'
  }));

  const dimensions = parsedOutput.xField ? [parsedOutput.xField] : [];
  const measures = [
    {
      column: parsedOutput.yField,
      aggregation: 'AUTO',
      alias: parsedOutput.yField
    }
  ];

  return {
    title: parsedOutput.title,
    chartType: parsedOutput.chartType,
    explanation: `Synthesized ${parsedOutput.chartType} chart for "${parsedOutput.title}" (${queryResultRows.length} rows returned).`,
    config: {
      dimensions,
      measures,
      limit: validationResult.limit,
      filters: params.filters
    },
    data: queryResultRows,
    columns: formattedColumns,
    rowCount: queryResultRows.length,
    sql: validationResult.sanitizedSql,
    xField: parsedOutput.xField ?? undefined,
    yField: parsedOutput.yField
  };
}
