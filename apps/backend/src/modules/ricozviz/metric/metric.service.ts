// ============================================================
// KPI / Metrics Layer Service
// ============================================================
// Governed, reusable business metrics with secure query execution, calculation
// verification, target tracking and tenant isolation.
//
// Dataset reads go through the self-contained local query foundation exported
// by the visualization module (`executeLocalDatasetQuery`), which behaves like
// the legacy `datasetQueryEngine` in-memory path.
// ============================================================

import mongoose from 'mongoose';
import {
  AlertModel,
  DatasetColumnModel,
  DatasetModel,
  MetricModel,
  UserModel
} from '@repo/database';
import {
  METRIC_AGGREGATION,
  METRIC_FORMAT
} from '@repo/types';
import type {
  CalculatedMetricResult,
  DatasetQueryFilter,
  MetricAggregation,
  MetricData,
  MetricFormat
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  compileCalculatedField,
  evaluateExpression,
  executeLocalDatasetQuery,
  loadDatasetSnapshot,
  resolveWorkspaceAccess,
  validateSqlIdentifier
} from '../visualization/visualization.service.js';
import type { AuditRequestMeta } from '../visualization/visualization.service.js';

const VALID_AGGREGATIONS: MetricAggregation[] = [
  METRIC_AGGREGATION.SUM,
  METRIC_AGGREGATION.AVG,
  METRIC_AGGREGATION.COUNT,
  METRIC_AGGREGATION.MIN,
  METRIC_AGGREGATION.MAX
];

const VALID_FORMATS: MetricFormat[] = [
  METRIC_FORMAT.NUMBER,
  METRIC_FORMAT.CURRENCY,
  METRIC_FORMAT.PERCENT
];

// ============================================================
// REQUEST BODIES (legacy had no Zod schema for metrics)
// ============================================================

export interface CreateMetricBody {
  name?: unknown;
  description?: unknown;
  workspaceId?: unknown;
  datasetId?: unknown;
  calculation?: unknown;
  aggregation?: unknown;
  field?: unknown;
  column?: unknown;
  format?: unknown;
  targetValue?: unknown;
}

export interface UpdateMetricBody {
  name?: unknown;
  description?: unknown;
  calculation?: unknown;
  field?: unknown;
  format?: unknown;
  targetValue?: unknown;
}

export interface CalculateMetricBody {
  filters?: unknown;
  filterLogic?: unknown;
  timeRange?: unknown;
  dimensions?: unknown;
}

export interface MetricListQuery {
  workspaceId?: string;
  datasetId?: string;
}

export interface PrincipalContext {
  userId: string;
  organizationId: string;
  email: string;
  roleName?: string;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Format metric value based on configured format.
 */
export function formatMetricValue(val: number, format: MetricFormat | string): string {
  if (format === METRIC_FORMAT.CURRENCY) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  }
  if (format === METRIC_FORMAT.PERCENT) {
    return `${(val * (val <= 1 && val >= -1 ? 100 : 1)).toFixed(1)}%`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
}

function toObjectIdSafe(value: string): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

interface MetricRow {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  calculation: string;
  field: string;
  format: string;
  targetValue: number | null;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function baseMetricPayload(metric: MetricRow): Record<string, unknown> {
  return {
    id: metric._id.toString(),
    organizationId: metric.organizationId.toString(),
    workspaceId: metric.workspaceId.toString(),
    datasetId: metric.datasetId.toString(),
    name: metric.name,
    description: metric.description ?? null,
    calculation: metric.calculation,
    field: metric.field,
    format: metric.format,
    targetValue: metric.targetValue ?? null,
    createdById: metric.createdById.toString(),
    createdAt: metric.createdAt.toISOString(),
    updatedAt: metric.updatedAt.toISOString()
  };
}

/** `knownCols` = persisted columns + schemaMeta calculated fields. */
function buildKnownColumns(
  columns: Array<{ name: string; dataType?: string }>,
  schemaMeta: Record<string, unknown>
): Array<{ name: string; type: string }> {
  const knownCols = columns.map((c) => ({
    name: c.name,
    type: (c.dataType || 'STRING').toLowerCase()
  }));

  const calculatedFields = Array.isArray(schemaMeta.calculatedFields)
    ? (schemaMeta.calculatedFields as Array<{ name: string; expression: string; dataType?: string }>)
    : [];
  for (const cf of calculatedFields) {
    knownCols.push({ name: cf.name, type: (cf.dataType || 'NUMBER').toLowerCase() });
  }

  return knownCols;
}

async function loadColumnsForDataset(datasetId: mongoose.Types.ObjectId) {
  return DatasetColumnModel.find({ datasetId }).sort({ ordinalPosition: 1 }).lean();
}

/** Load the metric + full dataset snapshot needed by calculation and guards. */
async function findMetricWithDataset(metricId: string) {
  const metricObjectId = toObjectIdSafe(metricId);
  if (!metricObjectId) return null;

  const metric = (await MetricModel.findById(metricObjectId).lean()) as unknown as MetricRow | null;
  if (!metric) return null;

  const snapshot = await loadDatasetSnapshot(metric.datasetId.toString());
  return { metric, snapshot };
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/** POST /api/v1/metrics */
export async function createMetric(
  body: CreateMetricBody,
  principal: PrincipalContext,
  meta: AuditRequestMeta = {}
): Promise<MetricData> {
  const {
    name,
    description,
    workspaceId,
    datasetId,
    calculation = METRIC_AGGREGATION.SUM,
    field,
    format = METRIC_FORMAT.NUMBER,
    targetValue
  } = body;

  // `aggregation` is an accepted alias in the shared contract.
  const rawField = field ?? body.column;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw AppError.badRequest('Metric name is required (1-100 characters)');
  }
  if (name.trim().length > 100) {
    throw AppError.badRequest('Metric name cannot exceed 100 characters');
  }

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw AppError.badRequest('Workspace ID is required');
  }

  await resolveWorkspaceAccess(workspaceId, principal.userId, principal.organizationId, principal.roleName);

  if (!datasetId || typeof datasetId !== 'string') {
    throw AppError.badRequest('Dataset ID is required');
  }

  const workspaceObjectId = toObjectIdSafe(workspaceId);
  const organizationObjectId = toObjectIdSafe(principal.organizationId);
  const datasetObjectId = toObjectIdSafe(datasetId);

  const dataset =
    datasetObjectId && organizationObjectId && workspaceObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId,
          workspaceId: workspaceObjectId
        }).lean()
      : null;

  if (!dataset) {
    throw AppError.notFound('Dataset not found in specified workspace');
  }

  const columns = await loadColumnsForDataset(dataset._id);
  const schemaMeta = (dataset.schemaMeta as unknown as Record<string, unknown>) || {};

  const normCalc = String(calculation).toUpperCase() as MetricAggregation;
  if (!VALID_AGGREGATIONS.includes(normCalc)) {
    throw AppError.badRequest(
      `Invalid calculation aggregation. Must be one of: ${VALID_AGGREGATIONS.join(', ')}`
    );
  }

  const normFormat = String(format).toUpperCase() as MetricFormat;
  if (!VALID_FORMATS.includes(normFormat)) {
    throw AppError.badRequest(`Invalid format. Must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  if (!rawField || typeof rawField !== 'string') {
    throw AppError.badRequest('Field (column name) is required');
  }

  const trimmedField = rawField.trim();
  const knownCols = buildKnownColumns(columns, schemaMeta);

  const isExpression = /[+\-*/%()]/.test(trimmedField);
  if (isExpression) {
    try {
      compileCalculatedField(trimmedField, knownCols);
    } catch (err) {
      throw AppError.badRequest(
        `Invalid metric formula expression: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else if (trimmedField !== '*') {
    validateSqlIdentifier(trimmedField);

    const colExists = knownCols.some((c) => c.name.toLowerCase() === trimmedField.toLowerCase());
    if (!colExists) {
      throw AppError.badRequest(
        `Field "${trimmedField}" does not exist in dataset "${dataset.name}"`
      );
    }

    if (normCalc === METRIC_AGGREGATION.SUM || normCalc === METRIC_AGGREGATION.AVG) {
      const col = knownCols.find((c) => c.name.toLowerCase() === trimmedField.toLowerCase());
      if (col && col.type !== 'number' && col.type !== 'decimal' && col.type !== 'integer') {
        throw AppError.badRequest(
          `Aggregation "${normCalc}" requires a numeric field, but "${trimmedField}" has type ${col.type}`
        );
      }
    }
  }

  let parsedTarget: number | null = null;
  if (targetValue !== undefined && targetValue !== null && targetValue !== '') {
    parsedTarget = Number(targetValue);
    if (isNaN(parsedTarget) || !isFinite(parsedTarget)) {
      throw AppError.badRequest('Target value must be a valid finite number');
    }
  }

  const creatorId = toObjectIdSafe(principal.userId);
  if (!creatorId) {
    throw AppError.unauthorized('Invalid user context');
  }

  const metric = (await MetricModel.create({
    organizationId: organizationObjectId as mongoose.Types.ObjectId,
    workspaceId: workspaceObjectId as mongoose.Types.ObjectId,
    datasetId: dataset._id,
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : null,
    calculation: normCalc,
    field: trimmedField,
    format: normFormat,
    targetValue: parsedTarget,
    createdById: creatorId
  })) as unknown as MetricRow;

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'METRIC_CREATED',
    resourceType: 'Metric',
    resourceId: metric._id.toString(),
    metadata: {
      name: metric.name,
      calculation: metric.calculation,
      field: metric.field,
      workspaceId
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  const datasetSummary = await DatasetModel.findById(dataset._id)
    .select('id name')
    .lean();

  return {
    ...(baseMetricPayload(metric) as unknown as MetricData),
    dataset: datasetSummary
      ? { id: datasetSummary._id.toString(), name: datasetSummary.name }
      : undefined
  };
}

/** GET /api/v1/metrics */
export async function listMetrics(
  query: MetricListQuery,
  principal: PrincipalContext
): Promise<MetricData[]> {
  const organizationObjectId = toObjectIdSafe(principal.organizationId);
  if (!organizationObjectId) {
    throw AppError.unauthorized('Invalid organization context');
  }

  const filter: Record<string, unknown> = { organizationId: organizationObjectId };

  if (query.workspaceId) {
    await resolveWorkspaceAccess(
      query.workspaceId,
      principal.userId,
      principal.organizationId,
      principal.roleName
    );
    filter.workspaceId = toObjectIdSafe(query.workspaceId);
  }

  if (query.datasetId) {
    filter.datasetId = toObjectIdSafe(query.datasetId);
  }

  const metrics = (await MetricModel.find(filter).sort({ createdAt: -1 }).lean()) as unknown as MetricRow[];
  if (metrics.length === 0) {
    return [];
  }

  const datasetIds = metrics.map((m) => m.datasetId);
  const datasets = await DatasetModel.find({ _id: { $in: datasetIds } })
    .select('name rowCount')
    .lean();
  const datasetMap = new Map(datasets.map((d) => [d._id.toString(), d]));

  const creatorIds = metrics.map((m) => m.createdById);
  const creators = await UserModel.find({ _id: { $in: creatorIds } })
    .select('name email')
    .lean();
  const creatorMap = new Map(creators.map((u) => [u._id.toString(), u]));

  // `_count: { alerts: true }` equivalent.
  const metricIds = metrics.map((m) => m._id);
  const alertCounts = await AlertModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { metricId: { $in: metricIds } } },
    { $group: { _id: '$metricId', count: { $sum: 1 } } }
  ]);
  const alertCountMap = new Map(alertCounts.map((row) => [row._id.toString(), row.count]));

  return metrics.map((metric) => {
    const dataset = datasetMap.get(metric.datasetId.toString());
    const creator = creatorMap.get(metric.createdById.toString());

    return {
      ...(baseMetricPayload(metric) as unknown as MetricData),
      dataset: dataset
        ? { id: dataset._id.toString(), name: dataset.name, rowCount: dataset.rowCount }
        : undefined,
      createdBy: creator
        ? { id: creator._id.toString(), name: creator.name, email: creator.email }
        : undefined,
      _count: { alerts: alertCountMap.get(metric._id.toString()) ?? 0 }
    } as MetricData;
  });
}

/** GET /api/v1/metrics/:id */
export async function getMetric(metricId: string, principal: PrincipalContext): Promise<MetricData> {
  if (!metricId) {
    throw AppError.badRequest('Metric ID is required');
  }

  const found = await findMetricWithDataset(metricId);
  if (!found) {
    throw AppError.notFound('Metric not found');
  }

  const { metric } = found;

  if (metric.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: metric belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    metric.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const dataset = await DatasetModel.findById(metric.datasetId).lean();
  const columns = await loadColumnsForDataset(metric.datasetId);
  const creator = await UserModel.findById(metric.createdById).select('name email').lean();
  const alerts = await AlertModel.find({ metricId: metric._id }).sort({ createdAt: -1 }).lean();

  return {
    ...(baseMetricPayload(metric) as unknown as MetricData),
    dataset: dataset
      ? {
          id: dataset._id.toString(),
          name: dataset.name,
          rowCount: dataset.rowCount,
          columns: columns.map((c) => ({
            name: c.name,
            type: (c.dataType || 'STRING').toLowerCase(),
            nullable: c.nullable
          }))
        }
      : undefined,
    createdBy: creator
      ? {
          id: creator._id.toString(),
          name: creator.name,
          email: creator.email
        }
      : undefined,
    alerts: alerts.map((alert) => ({
      id: alert._id.toString(),
      organizationId: alert.organizationId.toString(),
      workspaceId: alert.workspaceId.toString(),
      metricId: alert.metricId.toString(),
      name: alert.name,
      description: alert.description ?? null,
      condition: alert.condition,
      threshold: alert.threshold,
      enabled: alert.enabled,
      status: alert.status,
      lastEvaluatedAt: alert.lastEvaluatedAt ? alert.lastEvaluatedAt.toISOString() : null,
      lastTriggeredAt: alert.lastTriggeredAt ? alert.lastTriggeredAt.toISOString() : null,
      lastValue: alert.lastValue ?? null,
      createdById: alert.createdById.toString(),
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString()
    }))
  } as MetricData;
}

/** PATCH /api/v1/metrics/:id */
export async function updateMetric(
  metricId: string,
  body: UpdateMetricBody,
  principal: PrincipalContext,
  meta: AuditRequestMeta = {}
): Promise<MetricData> {
  const {
    name,
    description,
    calculation,
    field,
    format,
    targetValue
  } = body;

  if (!metricId) {
    throw AppError.badRequest('Metric ID is required');
  }

  const metricObjectId = toObjectIdSafe(metricId);
  const existing =
    metricObjectId ? ((await MetricModel.findById(metricObjectId).lean()) as unknown as MetricRow | null) : null;

  if (!existing) {
    throw AppError.notFound('Metric not found');
  }

  if (existing.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: metric belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    existing.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const dataToUpdate: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      throw AppError.badRequest('Metric name must be between 1 and 100 characters');
    }
    dataToUpdate.name = name.trim();
  }

  if (description !== undefined) {
    dataToUpdate.description = typeof description === 'string' ? description.trim() : null;
  }

  if (calculation !== undefined) {
    const normCalc = String(calculation).toUpperCase() as MetricAggregation;
    if (!VALID_AGGREGATIONS.includes(normCalc)) {
      throw AppError.badRequest(`Invalid calculation aggregation: ${String(calculation)}`);
    }
    dataToUpdate.calculation = normCalc;
  }

  if (format !== undefined) {
    const normFormat = String(format).toUpperCase() as MetricFormat;
    if (!VALID_FORMATS.includes(normFormat)) {
      throw AppError.badRequest(`Invalid format: ${String(format)}`);
    }
    dataToUpdate.format = normFormat;
  }

  if (field !== undefined) {
    const trimmedField = String(field).trim();
    const columns = await loadColumnsForDataset(existing.datasetId);
    const dataset = await DatasetModel.findById(existing.datasetId).select('schemaMeta').lean();
    const schemaMeta =
      (dataset?.schemaMeta as unknown as Record<string, unknown> | undefined) ?? {};
    const knownCols = buildKnownColumns(columns, schemaMeta);

    const isExpression = /[+\-*/%()]/.test(trimmedField);
    if (isExpression) {
      try {
        compileCalculatedField(trimmedField, knownCols);
      } catch (err) {
        throw AppError.badRequest(
          `Invalid metric formula expression: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else if (trimmedField !== '*') {
      validateSqlIdentifier(trimmedField);
      const exists = knownCols.some((c) => c.name.toLowerCase() === trimmedField.toLowerCase());
      if (!exists) {
        throw AppError.badRequest(`Field "${trimmedField}" does not exist in dataset`);
      }
    }
    dataToUpdate.field = trimmedField;
  }

  if (targetValue !== undefined) {
    if (targetValue === null || targetValue === '') {
      dataToUpdate.targetValue = null;
    } else {
      const parsed = Number(targetValue);
      if (isNaN(parsed) || !isFinite(parsed)) {
        throw AppError.badRequest('Target value must be a valid finite number');
      }
      dataToUpdate.targetValue = parsed;
    }
  }

  const updated = (await MetricModel.findByIdAndUpdate(existing._id, { $set: dataToUpdate }, { new: true })
    .lean()) as unknown as MetricRow;

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'METRIC_UPDATED',
    resourceType: 'Metric',
    resourceId: existing._id.toString(),
    metadata: dataToUpdate,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  const dataset = await DatasetModel.findById(updated.datasetId).select('name').lean();

  return {
    ...(baseMetricPayload(updated) as unknown as MetricData),
    dataset: dataset ? { id: dataset._id.toString(), name: dataset.name } : undefined
  };
}

/** DELETE /api/v1/metrics/:id */
export async function deleteMetric(
  metricId: string,
  principal: PrincipalContext,
  meta: AuditRequestMeta = {}
): Promise<{ message: string }> {
  if (!metricId) {
    throw AppError.badRequest('Metric ID is required');
  }

  const metricObjectId = toObjectIdSafe(metricId);
  const metric =
    metricObjectId ? ((await MetricModel.findById(metricObjectId).lean()) as unknown as MetricRow | null) : null;

  if (!metric) {
    throw AppError.notFound('Metric not found');
  }

  if (metric.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: metric belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    metric.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  // Manual cascade: Prisma removed dependent alerts (and their history rows).
  const alertIds = (
    await AlertModel.find({ metricId: metric._id }).select('_id').lean()
  ).map((alert) => alert._id);

  if (alertIds.length > 0) {
    await AlertModel.deleteMany({ _id: { $in: alertIds } }).exec();
  }
  await MetricModel.deleteOne({ _id: metric._id }).exec();

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'METRIC_DELETED',
    resourceType: 'Metric',
    resourceId: metric._id.toString(),
    metadata: { name: metric.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return { message: `Metric "${metric.name}" deleted successfully` };
}

/** POST /api/v1/metrics/:id/calculate */
export async function calculateMetric(
  metricId: string,
  body: CalculateMetricBody,
  principal: PrincipalContext
): Promise<CalculatedMetricResult> {
  const { filters, filterLogic = 'AND', timeRange, dimensions } = body || {};

  if (!metricId) {
    throw AppError.badRequest('Metric ID is required');
  }

  const found = await findMetricWithDataset(metricId);
  if (!found) {
    throw AppError.notFound('Metric not found');
  }

  const { metric, snapshot } = found;

  if (metric.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: metric belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    metric.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  if (!snapshot) {
    throw AppError.notFound('Dataset linked to metric not found');
  }

  const startTime = Date.now();

  // Prepare runtime filters
  const queryFilters: DatasetQueryFilter[] = [];
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (f && typeof f === 'object' && typeof (f as { column?: unknown }).column === 'string') {
        const filter = f as { column: string; operator?: string; value?: unknown };
        queryFilters.push({
          column: filter.column,
          // The engine aliases every operator spelling it recognises.
          operator: (filter.operator || '=') as DatasetQueryFilter['operator'],
          value: filter.value
        });
      }
    }
  }
  if (
    timeRange &&
    typeof timeRange === 'object' &&
    typeof (timeRange as { column?: unknown }).column === 'string'
  ) {
    const range = timeRange as { column: string; start?: string; end?: string };
    if (range.start) {
      queryFilters.push({ column: range.column, operator: '>=', value: range.start });
    }
    if (range.end) {
      queryFilters.push({ column: range.column, operator: '<=', value: range.end });
    }
  }

  const validatedDimensions: string[] = [];
  if (Array.isArray(dimensions)) {
    for (const d of dimensions) {
      if (typeof d === 'string' && d.trim()) {
        validateSqlIdentifier(d.trim());
        validatedDimensions.push(d.trim());
      }
    }
  }

  const calculation = metric.calculation as MetricAggregation;
  const isExpression = /[+\-*/%()]/.test(metric.field);

  let rawValue = 0;
  let breakdownRows: Record<string, unknown>[] | undefined;

  if (isExpression) {
    // Formula / ratio metric calculation (e.g. revenue / orders)
    const knownCols = buildKnownColumns(
      (await loadColumnsForDataset(metric.datasetId)),
      snapshot.schemaMeta
    );

    const compiled = compileCalculatedField(metric.field, knownCols);
    const measures = compiled.referencedColumns.map((col) => ({
      column: col,
      aggregation: calculation,
      alias: `agg_${col}`
    }));

    const queryResult = await executeLocalDatasetQuery(snapshot, {
      limit: validatedDimensions.length > 0 ? 100 : 1,
      measures,
      dimensions: validatedDimensions.length > 0 ? validatedDimensions : undefined,
      filters: queryFilters.length > 0 ? queryFilters : undefined,
      filterLogic: filterLogic === 'OR' ? 'OR' : 'AND'
    });

    if (validatedDimensions.length > 0) {
      breakdownRows = queryResult.rows.map((row) => {
        const evalContext = buildExpressionContext(row, compiled.referencedColumns);
        const val = evaluateExpression(compiled.ast, evalContext);
        return { ...row, metric_val: typeof val === 'number' ? val : 0 };
      });
      const firstRow = breakdownRows[0];
      rawValue = firstRow ? Number(firstRow['metric_val']) || 0 : 0;
    } else {
      const rawRow = queryResult.rows[0];
      if (rawRow) {
        const evalContext = buildExpressionContext(rawRow, compiled.referencedColumns);
        const evaluated = evaluateExpression(compiled.ast, evalContext);
        rawValue = typeof evaluated === 'number' ? evaluated : 0;
      }
    }
  } else {
    // Standard aggregation metric
    const queryResult = await executeLocalDatasetQuery(snapshot, {
      limit: validatedDimensions.length > 0 ? 100 : 1,
      measures: [{ column: metric.field, aggregation: calculation, alias: 'metric_val' }],
      dimensions: validatedDimensions.length > 0 ? validatedDimensions : undefined,
      filters: queryFilters.length > 0 ? queryFilters : undefined,
      filterLogic: filterLogic === 'OR' ? 'OR' : 'AND'
    });

    if (validatedDimensions.length > 0) {
      breakdownRows = queryResult.rows;
      rawValue = queryResult.rows[0] ? Number(queryResult.rows[0]['metric_val']) || 0 : 0;
    } else {
      const rawRow = queryResult.rows[0];
      rawValue = rawRow ? Number(rawRow['metric_val']) || 0 : 0;
    }
  }

  const durationMs = Date.now() - startTime;
  const formattedValue = formatMetricValue(rawValue, metric.format as MetricFormat);

  let targetDelta: number | null = null;
  let targetPercentage: number | null = null;
  let targetMet: boolean | null = null;

  if (metric.targetValue !== null && metric.targetValue !== undefined) {
    targetDelta = rawValue - metric.targetValue;
    targetPercentage = metric.targetValue !== 0 ? (rawValue / metric.targetValue) * 100 : 0;
    targetMet = rawValue >= metric.targetValue;
  }

  return {
    metricId: metric._id.toString(),
    name: metric.name,
    calculation,
    field: metric.field,
    format: metric.format as MetricFormat,
    rawValue,
    formattedValue,
    breakdown: breakdownRows,
    targetValue: metric.targetValue ?? null,
    targetDelta,
    targetPercentage: targetPercentage !== null ? Math.round(targetPercentage * 10) / 10 : null,
    targetMet,
    appliedFiltersCount: queryFilters.length,
    executionTimeMs: durationMs,
    calculatedAt: new Date().toISOString()
  } as CalculatedMetricResult;
}

/** Map `agg_<col>` aliases back onto plain column names for expression evaluation. */
function buildExpressionContext(
  row: Record<string, unknown>,
  referencedColumns: string[]
): Record<string, unknown> {
  const evalContext: Record<string, unknown> = {};
  for (const col of referencedColumns) {
    evalContext[col] = Number(row[`agg_${col}`] ?? row[col]) || 0;
  }
  return evalContext;
}

