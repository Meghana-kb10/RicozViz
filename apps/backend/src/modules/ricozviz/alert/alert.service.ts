// ============================================================
// Smart Data Alerts Engine & Service
// ============================================================
// Automated metric threshold evaluation, trigger detection, status management,
// alert history auditing, duplicate spam prevention, clearing notifications
// and tenant isolation.
// ============================================================

import mongoose from 'mongoose';
import {
  AlertHistoryModel,
  AlertModel,
  DatasetColumnModel,
  DatasetModel,
  MetricModel,
  UserModel
} from '@repo/database';
import { ALERT_CONDITION, ALERT_STATUS } from '@repo/types';
import type {
  AlertConditionExtended,
  AlertEvaluationResult,
  AlertHistoryEntry,
  AlertStatus,
  MetricAggregation,
  MetricFormat
} from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import {
  executeLocalDatasetQuery,
  loadDatasetSnapshot,
  resolveWorkspaceAccess
} from '../visualization/visualization.service.js';
import type { AuditRequestMeta } from '../visualization/visualization.service.js';
import { formatMetricValue } from '../metric/metric.service.js';
import { dispatchAlertNotifications } from './notification.service.js';
import type { NotificationDispatchResult } from './notification.service.js';

export const VALID_CONDITIONS: AlertConditionExtended[] = [
  ALERT_CONDITION.GREATER_THAN,
  ALERT_CONDITION.LESS_THAN,
  ALERT_CONDITION.EQUALS,
  ALERT_CONDITION.GREATER_THAN_OR_EQUAL,
  ALERT_CONDITION.LESS_THAN_OR_EQUAL
];

// ============================================================
// REQUEST BODIES (legacy had no Zod schema for alerts)
// ============================================================

export interface CreateAlertBody {
  name?: unknown;
  description?: unknown;
  workspaceId?: unknown;
  metricId?: unknown;
  condition?: unknown;
  threshold?: unknown;
  enabled?: unknown;
  isEnabled?: unknown;
  recipients?: unknown;
  slackWebhookUrl?: unknown;
}

export interface UpdateAlertBody {
  name?: unknown;
  description?: unknown;
  condition?: unknown;
  threshold?: unknown;
  enabled?: unknown;
  isEnabled?: unknown;
  recipients?: unknown;
  slackWebhookUrl?: unknown;
}

export interface AlertListQuery {
  workspaceId?: string;
  metricId?: string;
}

export interface AlertPrincipal {
  userId: string;
  organizationId: string;
  email: string;
  roleName?: string;
}

export interface NormalizedCondition {
  prismaCondition: AlertConditionExtended;
  isPercentIncrease: boolean;
  isPercentDecrease: boolean;
  canonicalName: string;
}

// ============================================================
// PURE HELPERS (preserved verbatim from the legacy engine)
// ============================================================

/**
 * Normalizes user input operators into the system canonical format.
 * Supports >, <, >=, <=, =, increase %, decrease %.
 */
export function normalizeConditionInput(condition: unknown): NormalizedCondition {
  const norm = String(condition || '')
    .trim()
    .toUpperCase();

  if (norm === '>' || norm === 'GT' || norm === 'GREATER_THAN') {
    return {
      prismaCondition: ALERT_CONDITION.GREATER_THAN,
      isPercentIncrease: false,
      isPercentDecrease: false,
      canonicalName: 'GREATER_THAN'
    };
  }
  if (norm === '<' || norm === 'LT' || norm === 'LESS_THAN') {
    return {
      prismaCondition: ALERT_CONDITION.LESS_THAN,
      isPercentIncrease: false,
      isPercentDecrease: false,
      canonicalName: 'LESS_THAN'
    };
  }
  if (norm === '>=' || norm === 'GTE' || norm === 'GREATER_THAN_OR_EQUAL') {
    return {
      prismaCondition: ALERT_CONDITION.GREATER_THAN_OR_EQUAL,
      isPercentIncrease: false,
      isPercentDecrease: false,
      canonicalName: 'GREATER_THAN_OR_EQUAL'
    };
  }
  if (norm === '<=' || norm === 'LTE' || norm === 'LESS_THAN_OR_EQUAL') {
    return {
      prismaCondition: ALERT_CONDITION.LESS_THAN_OR_EQUAL,
      isPercentIncrease: false,
      isPercentDecrease: false,
      canonicalName: 'LESS_THAN_OR_EQUAL'
    };
  }
  if (norm === '=' || norm === '==' || norm === 'EQ' || norm === 'EQUALS') {
    return {
      prismaCondition: ALERT_CONDITION.EQUALS,
      isPercentIncrease: false,
      isPercentDecrease: false,
      canonicalName: 'EQUALS'
    };
  }
  if (
    norm === 'INCREASE %' ||
    norm === 'PERCENT_INCREASE' ||
    norm === 'INCREASE_PERCENT' ||
    norm === 'INCREASE_PCT' ||
    norm === 'INCREASE'
  ) {
    return {
      prismaCondition: ALERT_CONDITION.GREATER_THAN,
      isPercentIncrease: true,
      isPercentDecrease: false,
      canonicalName: 'PERCENT_INCREASE'
    };
  }
  if (
    norm === 'DECREASE %' ||
    norm === 'PERCENT_DECREASE' ||
    norm === 'DECREASE_PERCENT' ||
    norm === 'DECREASE_PCT' ||
    norm === 'DECREASE'
  ) {
    return {
      prismaCondition: ALERT_CONDITION.LESS_THAN,
      isPercentIncrease: false,
      isPercentDecrease: true,
      canonicalName: 'PERCENT_DECREASE'
    };
  }

  throw AppError.badRequest(
    `Invalid alert condition: "${String(condition)}". Supported conditions: >, <, >=, <=, =, increase %, decrease %`
  );
}

/**
 * Extracts the true condition if it was stored with a percentage tag.
 */
export function extractEffectiveCondition(
  prismaCondition: AlertConditionExtended | string,
  description?: string | null
): string {
  if (description) {
    if (description.includes('[CONDITION:PERCENT_INCREASE]')) return 'PERCENT_INCREASE';
    if (description.includes('[CONDITION:PERCENT_DECREASE]')) return 'PERCENT_DECREASE';
  }
  return String(prismaCondition);
}

/**
 * Pure comparison of a metric value against a threshold, supporting the
 * standard operators and percentage trends.
 */
export function testAlertCondition(
  value: number,
  condition: AlertConditionExtended | string,
  threshold: number,
  previousValue?: number | null
): boolean {
  const norm = String(condition || '')
    .trim()
    .toUpperCase();

  switch (norm) {
    case 'GREATER_THAN':
    case '>':
    case 'GT':
      return value > threshold;

    case 'LESS_THAN':
    case '<':
    case 'LT':
      return value < threshold;

    case 'EQUALS':
    case '=':
    case '==':
    case 'EQ':
      return Math.abs(value - threshold) < 0.0001;

    case 'GREATER_THAN_OR_EQUAL':
    case '>=':
    case 'GTE':
      return value >= threshold;

    case 'LESS_THAN_OR_EQUAL':
    case '<=':
    case 'LTE':
      return value <= threshold;

    case 'PERCENT_INCREASE':
    case 'INCREASE %':
    case 'INCREASE_PERCENT':
    case 'INCREASE_PCT':
    case 'INCREASE': {
      if (previousValue === null || previousValue === undefined || previousValue === 0) {
        return false;
      }
      const diffPct = ((value - previousValue) / Math.abs(previousValue)) * 100;
      return diffPct >= threshold;
    }

    case 'PERCENT_DECREASE':
    case 'DECREASE %':
    case 'DECREASE_PERCENT':
    case 'DECREASE_PCT':
    case 'DECREASE': {
      if (previousValue === null || previousValue === undefined || previousValue === 0) {
        return false;
      }
      const dropPct = ((previousValue - value) / Math.abs(previousValue)) * 100;
      return dropPct >= threshold;
    }

    default:
      return false;
  }
}

export const evaluateAlertCondition = testAlertCondition;

/**
 * Human-readable operator representation.
 */
export function getConditionSymbol(condition: AlertConditionExtended | string): string {
  const norm = String(condition || '')
    .toUpperCase()
    .trim();
  switch (norm) {
    case 'GREATER_THAN':
      return '>';
    case 'LESS_THAN':
      return '<';
    case 'EQUALS':
      return '=';
    case 'GREATER_THAN_OR_EQUAL':
      return '≥';
    case 'LESS_THAN_OR_EQUAL':
      return '≤';
    case 'PERCENT_INCREASE':
      return 'increase >=';
    case 'PERCENT_DECREASE':
      return 'decrease >=';
    default:
      return norm;
  }
}

/** Strip the internal percentage tag and expose the UI-facing fields. */
export function formatAlertResponse<T extends Record<string, unknown>>(alert: T): T & {
  description: string | null;
  condition: string;
  conditionSymbol: string;
  isEnabled: boolean;
} {
  const effectiveCondition = extractEffectiveCondition(
    alert.condition as string,
    (alert.description as string | null) ?? null
  );
  const cleanDescription = alert.description
    ? String(alert.description)
        .replace('[CONDITION:PERCENT_INCREASE]', '')
        .replace('[CONDITION:PERCENT_DECREASE]', '')
        .trim()
    : null;

  return {
    ...alert,
    description: cleanDescription,
    condition: effectiveCondition,
    conditionSymbol: getConditionSymbol(effectiveCondition),
    isEnabled: Boolean(alert.enabled)
  };
}

// ============================================================
// PERSISTENCE HELPERS
// ============================================================

interface AlertRow {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  metricId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  condition: string;
  threshold: number;
  enabled: boolean;
  status: string;
  lastEvaluatedAt: Date | null;
  lastTriggeredAt: Date | null;
  lastValue: number | null;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function toObjectIdSafe(value: string): mongoose.Types.ObjectId | null {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function baseAlertPayload(alert: AlertRow): Record<string, unknown> {
  return {
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
    recipients: (alert as any).recipients || [],
    slackWebhookUrl: (alert as any).slackWebhookUrl || null,
    createdById: alert.createdById.toString(),
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString()
  };
}

function serializeHistoryEntry(entry: {
  _id: mongoose.Types.ObjectId;
  alertId: mongoose.Types.ObjectId;
  value: number;
  threshold: number;
  condition: string;
  status: string;
  message: string;
  triggeredAt: Date;
  deliveryStatus?: string;
  deliveredAt?: Date | null;
  deliveryError?: string | null;
  deliveryChannel?: string | null;
}): AlertHistoryEntry {
  return {
    id: entry._id.toString(),
    alertId: entry.alertId.toString(),
    value: entry.value,
    threshold: entry.threshold,
    condition: entry.condition,
    status: entry.status as AlertHistoryEntry['status'],
    message: entry.message,
    triggeredAt: entry.triggeredAt.toISOString(),
    deliveryStatus: (entry.deliveryStatus as AlertHistoryEntry['deliveryStatus']) || 'SKIPPED',
    deliveredAt: entry.deliveredAt ? entry.deliveredAt.toISOString() : null,
    deliveryError: entry.deliveryError || null,
    deliveryChannel: entry.deliveryChannel || null
  };
}

function serializeMetricSummary(metric: {
  _id: mongoose.Types.ObjectId;
  name: string;
  format: string;
  calculation: string;
  field: string;
}): Record<string, unknown> {
  return {
    id: metric._id.toString(),
    name: metric.name,
    format: metric.format,
    calculation: metric.calculation,
    field: metric.field
  };
}

async function loadCreator(userId: mongoose.Types.ObjectId) {
  const creator = await UserModel.findById(userId).select('name email').lean();
  return creator
    ? { id: creator._id.toString(), name: creator.name, email: creator.email }
    : undefined;
}

async function findAlertRow(alertId: string): Promise<AlertRow | null> {
  const alertObjectId = toObjectIdSafe(alertId);
  if (!alertObjectId) return null;
  return (await AlertModel.findById(alertObjectId).lean()) as unknown as AlertRow | null;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/** POST /api/v1/alerts */
export async function createAlert(
  body: CreateAlertBody,
  principal: AlertPrincipal,
  meta: AuditRequestMeta = {}
): Promise<Record<string, unknown>> {
  const {
    name,
    description,
    workspaceId,
    metricId,
    condition,
    threshold,
    enabled,
    isEnabled
  } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw AppError.badRequest('Alert name is required (1-100 characters)');
  }
  if (name.trim().length > 100) {
    throw AppError.badRequest('Alert name cannot exceed 100 characters');
  }

  if (!workspaceId || typeof workspaceId !== 'string') {
    throw AppError.badRequest('Workspace ID is required');
  }

  await resolveWorkspaceAccess(workspaceId, principal.userId, principal.organizationId, principal.roleName);

  if (!metricId || typeof metricId !== 'string') {
    throw AppError.badRequest('Metric ID is required');
  }

  const metricObjectId = toObjectIdSafe(metricId);
  const workspaceObjectId = toObjectIdSafe(workspaceId);
  const organizationObjectId = toObjectIdSafe(principal.organizationId);

  const metric =
    metricObjectId && organizationObjectId && workspaceObjectId
      ? await MetricModel.findOne({
          _id: metricObjectId,
          organizationId: organizationObjectId,
          workspaceId: workspaceObjectId
        }).lean()
      : null;

  if (!metric) {
    throw AppError.notFound('Metric not found in specified workspace');
  }

  const norm = normalizeConditionInput(condition);

  const numThreshold = Number(threshold);
  if (
    threshold === undefined ||
    threshold === null ||
    isNaN(numThreshold) ||
    !isFinite(numThreshold)
  ) {
    throw AppError.badRequest('Alert threshold must be a valid finite number');
  }

  const alertEnabled =
    enabled !== undefined
      ? Boolean(enabled)
      : isEnabled !== undefined
        ? Boolean(isEnabled)
        : true;

  let finalDescription = typeof description === 'string' ? description.trim() : '';
  if (norm.isPercentIncrease) {
    finalDescription = `[CONDITION:PERCENT_INCREASE] ${finalDescription}`.trim();
  } else if (norm.isPercentDecrease) {
    finalDescription = `[CONDITION:PERCENT_DECREASE] ${finalDescription}`.trim();
  }

  const rawRecipients = Array.isArray(body.recipients)
    ? (body.recipients as unknown[]).filter((r): r is string => typeof r === 'string' && r.includes('@'))
    : [];
  const rawSlackUrl = typeof body.slackWebhookUrl === 'string' ? body.slackWebhookUrl.trim() : null;

  const creatorId = toObjectIdSafe(principal.userId);
  if (!creatorId) {
    throw AppError.unauthorized('Invalid user context');
  }

  const created = await AlertModel.create({
    organizationId: organizationObjectId as mongoose.Types.ObjectId,
    workspaceId: workspaceObjectId as mongoose.Types.ObjectId,
    metricId: metric._id,
    name: name.trim(),
    description: finalDescription.length > 0 ? finalDescription : null,
    condition: norm.prismaCondition,
    threshold: numThreshold,
    enabled: alertEnabled,
    status: ALERT_STATUS.PENDING,
    recipients: rawRecipients,
    slackWebhookUrl: rawSlackUrl,
    createdById: creatorId
  });

  const alert = created.toObject() as unknown as AlertRow;

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'ALERT_CREATED',
    resourceType: 'Alert',
    resourceId: alert._id.toString(),
    metadata: {
      name: alert.name,
      metricId,
      condition: norm.canonicalName,
      threshold: alert.threshold
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return formatAlertResponse({
    ...baseAlertPayload(alert),
    metric: serializeMetricSummary(metric)
  });
}

/** GET /api/v1/alerts */
export async function listAlerts(
  query: AlertListQuery,
  principal: AlertPrincipal
): Promise<Array<Record<string, unknown>>> {
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

  if (query.metricId) {
    filter.metricId = toObjectIdSafe(query.metricId);
  }

  const alerts = (await AlertModel.find(filter).sort({ createdAt: -1 }).lean()) as unknown as AlertRow[];
  if (alerts.length === 0) {
    return [];
  }

  const metricIds = alerts.map((a) => a.metricId);
  const metrics = await MetricModel.find({ _id: { $in: metricIds } }).lean();
  const metricMap = new Map(metrics.map((m) => [m._id.toString(), m]));

  const datasetIds = metrics.map((m) => m.datasetId);
  const datasets = await DatasetModel.find({ _id: { $in: datasetIds } })
    .select('_id name')
    .lean();
  const datasetMap = new Map(
    datasets.map((d) => [d._id.toString(), { id: d._id.toString(), name: d.name }])
  );

  const creatorIds = alerts.map((a) => a.createdById);
  const creators = await UserModel.find({ _id: { $in: creatorIds } })
    .select('name email')
    .lean();
  const creatorMap = new Map(creators.map((u) => [u._id.toString(), u]));

  // `history: { orderBy: { triggeredAt: desc }, take: 1 }`
  const histories = await AlertHistoryModel.find({ alertId: { $in: alerts.map((a) => a._id) } })
    .sort({ triggeredAt: -1 })
    .lean();

  const latestHistory = new Map<string, (typeof histories)[number]>();
  for (const entry of histories) {
    const key = entry.alertId.toString();
    if (!latestHistory.has(key)) {
      latestHistory.set(key, entry);
    }
  }

  return alerts.map((alert) => {
    const metric = metricMap.get(alert.metricId.toString());
    const creator = creatorMap.get(alert.createdById.toString());
    const history = latestHistory.get(alert._id.toString());

    const metricPayload = metric
      ? {
          ...serializeMetricSummary(metric),
          dataset: datasetMap.has(metric.datasetId.toString())
            ? datasetMap.get(metric.datasetId.toString())
            : null
        }
      : undefined;

    return formatAlertResponse({
      ...baseAlertPayload(alert),
      metric: metricPayload,
      history: history ? [serializeHistoryEntry(history)] : [],
      createdBy: creator
        ? { id: creator._id.toString(), name: creator.name, email: creator.email }
        : undefined
    });
  });
}

/** GET /api/v1/alerts/:id */
export async function getAlert(
  alertId: string,
  principal: AlertPrincipal
): Promise<Record<string, unknown>> {
  if (!alertId) {
    throw AppError.badRequest('Alert ID is required');
  }

  const alert = await findAlertRow(alertId);
  if (!alert) {
    throw AppError.notFound('Alert not found');
  }

  if (alert.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: alert belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    alert.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const metric = await MetricModel.findById(alert.metricId).lean();
  const dataset = metric ? await loadDatasetSummary(metric.datasetId) : null;
  const columns = metric ? await loadDatasetColumnsSummary(metric.datasetId) : [];
  const histories = await AlertHistoryModel.find({ alertId: alert._id })
    .sort({ triggeredAt: -1 })
    .limit(50)
    .lean();
  const createdBy = await loadCreator(alert.createdById);

  const metricPayload = metric
    ? {
        ...serializeMetricSummary(metric),
        dataset: dataset
          ? { ...dataset, columns }
          : null
      }
    : undefined;

  return formatAlertResponse({
    ...baseAlertPayload(alert),
    metric: metricPayload,
    history: histories.map(serializeHistoryEntry),
    createdBy
  });
}

/** PATCH /api/v1/alerts/:id */
export async function updateAlert(
  alertId: string,
  body: UpdateAlertBody,
  principal: AlertPrincipal,
  meta: AuditRequestMeta = {}
): Promise<Record<string, unknown>> {
  const { name, description, condition, threshold, enabled, isEnabled } = body;

  if (!alertId) {
    throw AppError.badRequest('Alert ID is required');
  }

  const existing = await findAlertRow(alertId);
  if (!existing) {
    throw AppError.notFound('Alert not found');
  }

  if (existing.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: alert belongs to a different organization');
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
      throw AppError.badRequest('Alert name must be between 1 and 100 characters');
    }
    dataToUpdate.name = name.trim();
  }

  let finalDesc = typeof description === 'string' ? description.trim() : existing.description || '';

  if (condition !== undefined) {
    const norm = normalizeConditionInput(condition);
    dataToUpdate.condition = norm.prismaCondition;
    finalDesc = finalDesc
      .replace('[CONDITION:PERCENT_INCREASE]', '')
      .replace('[CONDITION:PERCENT_DECREASE]', '')
      .trim();
    if (norm.isPercentIncrease) {
      finalDesc = `[CONDITION:PERCENT_INCREASE] ${finalDesc}`.trim();
    } else if (norm.isPercentDecrease) {
      finalDesc = `[CONDITION:PERCENT_DECREASE] ${finalDesc}`.trim();
    }
    dataToUpdate.description = finalDesc.length > 0 ? finalDesc : null;
  } else if (description !== undefined) {
    dataToUpdate.description =
      typeof description === 'string' && description.trim().length > 0 ? description.trim() : null;
  }

  if (threshold !== undefined) {
    const num = Number(threshold);
    if (isNaN(num) || !isFinite(num)) {
      throw AppError.badRequest('Threshold must be a valid finite number');
    }
    dataToUpdate.threshold = num;
  }

  if (enabled !== undefined || isEnabled !== undefined) {
    dataToUpdate.enabled = Boolean(enabled ?? isEnabled);
  }

  if (body.recipients !== undefined) {
    dataToUpdate.recipients = Array.isArray(body.recipients)
      ? (body.recipients as unknown[]).filter((r): r is string => typeof r === 'string' && r.includes('@'))
      : [];
  }
  if (body.slackWebhookUrl !== undefined) {
    dataToUpdate.slackWebhookUrl = typeof body.slackWebhookUrl === 'string' ? body.slackWebhookUrl.trim() : null;
  }

  const updated = (await AlertModel.findByIdAndUpdate(existing._id, { $set: dataToUpdate }, { new: true })
    .lean()) as unknown as AlertRow;

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'ALERT_UPDATED',
    resourceType: 'Alert',
    resourceId: existing._id.toString(),
    metadata: dataToUpdate,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  const metric = await MetricModel.findById(updated.metricId).lean();

  return formatAlertResponse({
    ...baseAlertPayload(updated),
    metric: metric
      ? {
          id: metric._id.toString(),
          name: metric.name,
          format: metric.format
        }
      : undefined
  });
}

/** DELETE /api/v1/alerts/:id */
export async function deleteAlert(
  alertId: string,
  principal: AlertPrincipal,
  meta: AuditRequestMeta = {}
): Promise<{ message: string }> {
  if (!alertId) {
    throw AppError.badRequest('Alert ID is required');
  }

  const alert = await findAlertRow(alertId);
  if (!alert) {
    throw AppError.notFound('Alert not found');
  }

  if (alert.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: alert belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    alert.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  // Manual cascade: Prisma removed dependent alert history rows.
  await AlertHistoryModel.deleteMany({ alertId: alert._id }).exec();
  await AlertModel.deleteOne({ _id: alert._id }).exec();

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'ALERT_DELETED',
    resourceType: 'Alert',
    resourceId: alert._id.toString(),
    metadata: { name: alert.name },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return { message: `Alert "${alert.name}" deleted successfully` };
}

/** POST /api/v1/alerts/:id/clear */
export async function clearAlert(
  alertId: string,
  principal: AlertPrincipal,
  meta: AuditRequestMeta = {}
): Promise<Record<string, unknown>> {
  if (!alertId) {
    throw AppError.badRequest('Alert ID is required');
  }

  const alert = await findAlertRow(alertId);
  if (!alert) {
    throw AppError.notFound('Alert not found');
  }

  if (alert.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: alert belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    alert.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const now = new Date();

  const updated = (await AlertModel.findByIdAndUpdate(
    alert._id,
    { $set: { status: ALERT_STATUS.OK, lastTriggeredAt: null } },
    { new: true }
  ).lean()) as unknown as AlertRow;

  const historyEntry = await AlertHistoryModel.create({
    alertId: alert._id,
    value: alert.lastValue ?? 0,
    threshold: alert.threshold,
    condition: String(alert.condition),
    status: ALERT_STATUS.OK,
    message: `Alert notification cleared and acknowledged by ${principal.email || 'user'}. Status reset to OK.`,
    triggeredAt: now
  });

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: 'ALERT_CLEARED',
    resourceType: 'Alert',
    resourceId: alert._id.toString(),
    metadata: { alertName: alert.name, clearedAt: now.toISOString() },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  const metric = await MetricModel.findById(updated.metricId).lean();

  return {
    message: `Alert "${alert.name}" notification cleared successfully.`,
    alert: formatAlertResponse({
      ...baseAlertPayload(updated),
      metric: metric
        ? { id: metric._id.toString(), name: metric.name, format: metric.format }
        : undefined
    }),
    historyId: historyEntry._id.toString()
  };
}

/** POST /api/v1/alerts/:id/evaluate */
export async function evaluateAlert(
  alertId: string,
  principal: AlertPrincipal,
  meta: AuditRequestMeta = {}
): Promise<AlertEvaluationResult> {
  if (!alertId) {
    throw AppError.badRequest('Alert ID is required');
  }

  const alert = await findAlertRow(alertId);
  if (!alert) {
    throw AppError.notFound('Alert not found');
  }

  if (alert.organizationId.toString() !== principal.organizationId) {
    throw AppError.forbidden('Access denied: alert belongs to a different organization');
  }

  await resolveWorkspaceAccess(
    alert.workspaceId.toString(),
    principal.userId,
    principal.organizationId,
    principal.roleName
  );

  const metric = await MetricModel.findById(alert.metricId).lean();
  if (!metric) {
    throw AppError.notFound('Metric linked to alert not found');
  }

  // 1. Calculate metric value via the secure query engine
  const snapshot = await loadDatasetSnapshot(metric.datasetId.toString());
  if (!snapshot) {
    throw AppError.notFound('Dataset linked to metric not found');
  }

  const queryResult = await executeLocalDatasetQuery(snapshot, {
    limit: 1,
    measures: [
      {
        column: metric.field,
        aggregation: metric.calculation as MetricAggregation,
        alias: 'metric_val'
      }
    ]
  });

  const rawRow = queryResult.rows[0];
  const currentValue = rawRow ? Number(rawRow['metric_val']) || 0 : 0;
  const previousValue = alert.lastValue;
  const effectiveCondition = extractEffectiveCondition(alert.condition, alert.description);

  // 2. Evaluate condition
  const isTriggered = testAlertCondition(
    currentValue,
    effectiveCondition,
    alert.threshold,
    previousValue
  );
  const symbol = getConditionSymbol(effectiveCondition);

  const status: AlertStatus = isTriggered ? ALERT_STATUS.TRIGGERED : ALERT_STATUS.OK;
  const now = new Date();

  const formattedCurrent = formatMetricValue(currentValue, metric.format as MetricFormat);
  const formattedThreshold = formatMetricValue(alert.threshold, metric.format as MetricFormat);

  const stateChanged = alert.status !== status;
  const isInitialEval = !alert.lastEvaluatedAt;
  const shouldLogHistory = stateChanged || isInitialEval;

  let message = '';
  if (isTriggered) {
    message = `Alert TRIGGERED: Metric "${metric.name}" value (${formattedCurrent}) meets condition ${symbol} threshold (${formattedThreshold})`;
  } else if (stateChanged && alert.status === ALERT_STATUS.TRIGGERED) {
    message = `Alert RECOVERED: Metric "${metric.name}" value (${formattedCurrent}) has returned to normal (${symbol} ${formattedThreshold})`;
  } else {
    message = `Normal: Metric "${metric.name}" value (${formattedCurrent}) satisfies threshold (${formattedThreshold})`;
  }

  // 3. Persist evaluation history and update alert status (prevent duplicate spam)
  const updateData: Record<string, unknown> = {
    status,
    lastEvaluatedAt: now,
    lastValue: currentValue
  };
  if (isTriggered && stateChanged) {
    updateData.lastTriggeredAt = now;
  }

  const updated = (await AlertModel.findByIdAndUpdate(alert._id, { $set: updateData }, { new: true })
    .lean()) as unknown as AlertRow;

  let historyId: string | null = null;
  let dispatchResult: NotificationDispatchResult = {
    deliveryStatus: 'SKIPPED',
    deliveryChannel: null,
    deliveredAt: null,
    deliveryError: null
  };

  if (shouldLogHistory) {
    if (isTriggered) {
      dispatchResult = await dispatchAlertNotifications({
        alertId: alert._id.toString(),
        alertName: alert.name,
        metricName: metric.name,
        condition: effectiveCondition,
        threshold: alert.threshold,
        currentValue,
        triggeredAt: now,
        recipients: (alert as any).recipients,
        slackWebhookUrl: (alert as any).slackWebhookUrl,
        fallbackEmail: principal.email
      });
    }

    const history = await AlertHistoryModel.create({
      alertId: alert._id,
      value: currentValue,
      threshold: alert.threshold,
      condition: effectiveCondition,
      status,
      message,
      triggeredAt: now,
      deliveryStatus: dispatchResult.deliveryStatus,
      deliveredAt: dispatchResult.deliveredAt,
      deliveryError: dispatchResult.deliveryError,
      deliveryChannel: dispatchResult.deliveryChannel
    });
    historyId = history._id.toString();
  }

  await logAuditEvent({
    organizationId: principal.organizationId,
    userId: principal.userId,
    action: isTriggered ? 'ALERT_TRIGGERED' : 'ALERT_EVALUATED',
    resourceType: 'Alert',
    resourceId: alert._id.toString(),
    metadata: {
      alertName: alert.name,
      currentValue,
      threshold: alert.threshold,
      condition: effectiveCondition,
      isTriggered,
      stateChanged,
      duplicatePrevented: isTriggered && !stateChanged,
      deliveryStatus: dispatchResult.deliveryStatus,
      deliveryChannel: dispatchResult.deliveryChannel
    },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return {
    alertId: alert._id.toString(),
    alertName: alert.name,
    metricName: metric.name,
    condition: effectiveCondition,
    conditionSymbol: symbol,
    threshold: alert.threshold,
    formattedThreshold,
    currentValue,
    formattedCurrent,
    isTriggered,
    stateChanged,
    duplicatePrevented: isTriggered && !stateChanged,
    lastEvaluatedAt: now.toISOString(),
    historyId: historyId || null,
    message,
    notificationDelivery: isTriggered
      ? `Alert triggered! Notification delivery: ${dispatchResult.deliveryStatus}${dispatchResult.deliveryChannel ? ` via ${dispatchResult.deliveryChannel}` : ''}.`
      : 'Metric in normal bounds.',
    deliveryStatus: dispatchResult.deliveryStatus,
    deliveredAt: dispatchResult.deliveredAt ? dispatchResult.deliveredAt.toISOString() : null,
    deliveryError: dispatchResult.deliveryError,
    deliveryChannel: dispatchResult.deliveryChannel,
    status: updated.status as AlertStatus
  } as AlertEvaluationResult;
}

/** POST /api/v1/alerts/workspace/:workspaceId/evaluate-all */
export async function evaluateAllWorkspaceAlerts(
  workspaceId: string,
  principal: AlertPrincipal
): Promise<{
  totalEvaluated: number;
  triggeredCount: number;
  results: Array<Record<string, unknown>>;
}> {
  if (!workspaceId) {
    throw AppError.badRequest('Workspace ID is required');
  }

  await resolveWorkspaceAccess(workspaceId, principal.userId, principal.organizationId, principal.roleName);

  const workspaceObjectId = toObjectIdSafe(workspaceId);
  const organizationObjectId = toObjectIdSafe(principal.organizationId);

  const activeAlerts = workspaceObjectId && organizationObjectId
    ? ((await AlertModel.find({
        workspaceId: workspaceObjectId,
        organizationId: organizationObjectId,
        enabled: true
      }).lean()) as unknown as AlertRow[])
    : [];

  const results: Array<Record<string, unknown>> = [];

  for (const alert of activeAlerts) {
    try {
      const metric = await MetricModel.findById(alert.metricId).lean();
      if (!metric) {
        throw AppError.notFound('Metric linked to alert not found');
      }

      const snapshot = await loadDatasetSnapshot(metric.datasetId.toString());
      if (!snapshot) {
        throw AppError.notFound('Dataset linked to metric not found');
      }

      const queryResult = await executeLocalDatasetQuery(snapshot, {
        limit: 1,
        measures: [
          {
            column: metric.field,
            aggregation: metric.calculation as MetricAggregation,
            alias: 'metric_val'
          }
        ]
      });

      const rawRow = queryResult.rows[0];
      const currentValue = rawRow ? Number(rawRow['metric_val']) || 0 : 0;
      const previousValue = alert.lastValue;
      const effectiveCondition = extractEffectiveCondition(alert.condition, alert.description);

      const isTriggered = testAlertCondition(
        currentValue,
        effectiveCondition,
        alert.threshold,
        previousValue
      );
      const status: AlertStatus = isTriggered ? ALERT_STATUS.TRIGGERED : ALERT_STATUS.OK;
      const now = new Date();

      const stateChanged = alert.status !== status;
      const isInitialEval = !alert.lastEvaluatedAt;
      const shouldLogHistory = stateChanged || isInitialEval;

      const updateData: Record<string, unknown> = {
        status,
        lastEvaluatedAt: now,
        lastValue: currentValue
      };
      if (isTriggered && stateChanged) {
        updateData.lastTriggeredAt = now;
      }

      await AlertModel.updateOne({ _id: alert._id }, { $set: updateData }).exec();

      if (shouldLogHistory) {
        let dispatchResult: NotificationDispatchResult = {
          deliveryStatus: 'SKIPPED',
          deliveryChannel: null,
          deliveredAt: null,
          deliveryError: null
        };
        if (isTriggered) {
          dispatchResult = await dispatchAlertNotifications({
            alertId: alert._id.toString(),
            alertName: alert.name,
            metricName: metric.name,
            condition: effectiveCondition,
            threshold: alert.threshold,
            currentValue,
            triggeredAt: now,
            recipients: (alert as any).recipients,
            slackWebhookUrl: (alert as any).slackWebhookUrl,
            fallbackEmail: principal.email
          });
        }

        await AlertHistoryModel.create({
          alertId: alert._id,
          value: currentValue,
          threshold: alert.threshold,
          condition: effectiveCondition,
          status,
          message: isTriggered
            ? `Alert condition met: ${currentValue} ${effectiveCondition} ${alert.threshold}`
            : `Normal reading: ${currentValue}`,
          triggeredAt: now,
          deliveryStatus: dispatchResult.deliveryStatus,
          deliveredAt: dispatchResult.deliveredAt,
          deliveryError: dispatchResult.deliveryError,
          deliveryChannel: dispatchResult.deliveryChannel
        });
      }

      results.push({
        alertId: alert._id.toString(),
        name: alert.name,
        currentValue,
        isTriggered,
        status,
        stateChanged
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[Alerts] Failed to evaluate alert "${alert.name}"`, {
        alertId: alert._id.toString(),
        error: message
      });
      results.push({
        alertId: alert._id.toString(),
        name: alert.name,
        error: message,
        status: 'ERROR'
      });
    }
  }

  return {
    totalEvaluated: results.length,
    triggeredCount: results.filter((r) => r.isTriggered).length,
    results
  };
}

// ---- Dataset summary helpers ------------------------------------------------

async function loadDatasetSummary(datasetId: mongoose.Types.ObjectId) {
  const dataset = await DatasetModel.findById(datasetId).select('_id name').lean();
  return dataset ? { id: dataset._id.toString(), name: dataset.name } : null;
}

async function loadDatasetColumnsSummary(datasetId: mongoose.Types.ObjectId) {
  const columns = await DatasetColumnModel.find({ datasetId })
    .sort({ ordinalPosition: 1 })
    .lean();
  return columns.map((c) => ({
    name: c.name,
    type: (c.dataType || 'STRING').toLowerCase(),
    nullable: c.nullable
  }));
}