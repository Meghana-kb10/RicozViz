// ========================================
// Dashboard Report & Schedule Service
// ========================================
// Owns the report-schedule CRUD surface and the on-demand / manual report
// execution endpoints that hang off a dashboard.
//
// The snapshot engine itself (`generateDashboardReportSnapshot`) lives in
// `dashboard.service.ts` so the HTTP handlers and the background worker share
// exactly one implementation.
// ========================================

import mongoose from 'mongoose';
import {
  DashboardModel,
  ReportModel,
  ReportExecutionModel,
  toObjectId,
  serializeDocs
} from '@repo/database';
import { AppError } from '../../../utils/errors.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';
import { requireObjectId } from '../dashboard/dashboard-access.service.js';
import { isValidEmail, validateWebhookUrl } from './report-delivery.dispatcher.js';
import {
  generateDashboardReportSnapshot,
  type DashboardReportSnapshot,
  type DashboardRequestContext
} from '../dashboard/dashboard.service.js';
import { REPORT_EXECUTION_STATUS, REPORT_FORMAT, REPORT_STATUS } from '@repo/types';

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// ============================================================
// SCHEDULE CRUD
// ============================================================

/** Lean report shape consumed by {@link buildSchedulePayload}. */
type FlattenedReport = {
  _id: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  status: string;
  cronExpression: string | null;
  deliveryConfig: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function buildSchedulePayload(report: FlattenedReport): Record<string, unknown> {
  const delivery = (report.deliveryConfig || {}) as Record<string, unknown>;
  const frequency = String(
    delivery.frequency || (report.cronExpression?.includes('1') ? 'WEEKLY' : 'DAILY')
  ).toUpperCase();

  return {
    id: report._id.toString(),
    dashboardId: report.dashboardId.toString(),
    frequency,
    enabled: report.status === REPORT_STATUS.ACTIVE,
    nextRunAt: (delivery.nextRunAt as string) || null,
    lastRunAt: (delivery.lastRunAt as string) || null,
    recipients: Array.isArray(delivery.recipients) ? delivery.recipients : [],
    webhookUrl: typeof delivery.webhookUrl === 'string' ? delivery.webhookUrl : null,
    deliveryType: (delivery.deliveryType as string) || 'EMAIL',
    lastDeliveryStatus: (delivery.lastDeliveryStatus as string) || null,
    lastDeliveryAt: (delivery.lastDeliveryAt as string) || null,
    lastDeliveryError: (delivery.lastDeliveryError as string) || null,
    createdAt: toIso(report.createdAt),
    updatedAt: toIso(report.updatedAt)
  };
}

/** Latest report bound to a dashboard (newest first). */
async function findLatestDashboardReport(
  dashboardId: mongoose.Types.ObjectId,
  organizationId: mongoose.Types.ObjectId
): Promise<FlattenedReport | null> {
  return ReportModel.findOne({ dashboardId, organizationId })
    .sort({ createdAt: -1 })
    .lean() as unknown as Promise<FlattenedReport | null>;
}

/** Dashboard fields the report endpoints need after the tenant check passes. */
type OwnedDashboard = {
  _id: mongoose.Types.ObjectId;
  name: string;
  organizationId: mongoose.Types.ObjectId;
};

/** Load a dashboard and assert tenant isolation for the schedule endpoints. */
async function requireOwnedDashboard(
  ctx: DashboardRequestContext,
  id: string
): Promise<OwnedDashboard> {
  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboardObjectId = toObjectId(id);
  const dashboard = dashboardObjectId
    ? await DashboardModel.findById(dashboardObjectId).lean()
    : null;

  if (!dashboard) {
    throw AppError.notFound('Dashboard');
  }

  if (dashboard.organizationId.toString() !== ctx.organizationId) {
    throw AppError.forbidden('Access denied: dashboard belongs to a different organization');
  }

  return dashboard as unknown as OwnedDashboard;
}

/**
 * GET /api/v1/dashboards/:id/schedule
 */
export async function getDashboardSchedule(
  ctx: DashboardRequestContext,
  id: string
): Promise<Record<string, unknown> | null> {
  const dashboard = await requireOwnedDashboard(ctx, id);

  const report = await findLatestDashboardReport(dashboard._id, dashboard.organizationId);
  if (!report) {
    return null;
  }

  return buildSchedulePayload(report);
}

export interface UpsertDashboardScheduleBody {
  frequency?: unknown;
  enabled?: unknown;
  recipients?: unknown;
  webhookUrl?: unknown;
  deliveryType?: unknown;
  format?: unknown;
}

/**
 * POST /api/v1/dashboards/:id/schedule — create or update the schedule.
 */
export async function upsertDashboardSchedule(
  ctx: DashboardRequestContext,
  id: string,
  body: UpsertDashboardScheduleBody
): Promise<Record<string, unknown>> {
  const { userId } = ctx;
  const { frequency, enabled, recipients, webhookUrl, deliveryType, format } = body ?? {};

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const normalizedFreq = String(frequency || 'DAILY').toUpperCase();
  if (normalizedFreq !== 'DAILY' && normalizedFreq !== 'WEEKLY' && normalizedFreq !== 'MONTHLY') {
    throw AppError.badRequest('Frequency must be DAILY, WEEKLY, or MONTHLY');
  }

  // Validate recipients if provided
  if (recipients !== undefined) {
    if (!Array.isArray(recipients)) {
      throw AppError.badRequest('Recipients must be an array of email addresses');
    }
    for (const recipient of recipients) {
      if (!isValidEmail(String(recipient))) {
        throw AppError.badRequest(`Invalid recipient email address format: "${recipient}"`);
      }
    }
  }

  // Validate webhook URL if provided
  if (webhookUrl !== undefined && webhookUrl !== null && String(webhookUrl).trim() !== '') {
    const webhookCheck = validateWebhookUrl(String(webhookUrl));
    if (!webhookCheck.valid) {
      throw AppError.badRequest(webhookCheck.error || 'Invalid webhook URL');
    }
  }

  const dashboard = await requireOwnedDashboard(ctx, id);

  const isEnabled = enabled !== undefined ? Boolean(enabled) : true;
  const cronExpression =
    normalizedFreq === 'MONTHLY'
      ? '0 9 1 * *'
      : normalizedFreq === 'WEEKLY'
        ? '0 9 * * 1'
        : '0 9 * * *';
  const intervalMs =
    normalizedFreq === 'MONTHLY'
      ? 30 * 24 * 60 * 60 * 1000
      : normalizedFreq === 'WEEKLY'
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
  const nextRunAt = new Date(Date.now() + intervalMs).toISOString();

  const existing = await ReportModel.findOne({
    dashboardId: dashboard._id,
    organizationId: dashboard.organizationId
  }).lean();

  const existingDelivery = (existing?.deliveryConfig || {}) as Record<string, unknown>;

  const updatedRecipients =
    recipients !== undefined
      ? (recipients as string[])
      : existing
        ? ((existingDelivery.recipients as string[]) || [])
        : [];
  const updatedWebhookUrl =
    webhookUrl !== undefined
      ? webhookUrl
        ? String(webhookUrl).trim()
        : null
      : existing
        ? ((existingDelivery.webhookUrl as string) || null)
        : null;
  const updatedDeliveryType =
    deliveryType !== undefined
      ? String(deliveryType).toUpperCase()
      : existing
        ? ((existingDelivery.deliveryType as string) || 'EMAIL')
        : 'EMAIL';

  const deliveryConfig: Record<string, unknown> = {
    ...existingDelivery,
    frequency: normalizedFreq,
    enabled: isEnabled,
    nextRunAt,
    recipients: updatedRecipients,
    webhookUrl: updatedWebhookUrl,
    deliveryType: updatedDeliveryType,
    format: format ? String(format).toUpperCase() : existingDelivery.format || REPORT_FORMAT.PDF
  };

  let report: FlattenedReport | null = null;
  if (existing) {
    report = (await ReportModel.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          status: isEnabled ? REPORT_STATUS.ACTIVE : REPORT_STATUS.PAUSED,
          cronExpression,
          deliveryConfig
        }
      },
      { new: true }
    ).lean()) as unknown as FlattenedReport | null;
  } else {
    const created = await ReportModel.create({
      dashboardId: dashboard._id,
      organizationId: dashboard.organizationId,
      createdById: requireObjectId(userId, 'User'),
      name: `${dashboard.name} Scheduled Report`,
      status: isEnabled ? REPORT_STATUS.ACTIVE : REPORT_STATUS.PAUSED,
      cronExpression,
      deliveryConfig
    });
    report = {
      _id: created._id,
      dashboardId: created.dashboardId,
      status: created.status,
      cronExpression: created.cronExpression,
      deliveryConfig: created.deliveryConfig,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };
  }

  if (!report) {
    throw AppError.internal('Failed to persist dashboard schedule');
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'DASHBOARD_UPDATED',
    resourceType: 'Dashboard',
    resourceId: id,
    metadata: {
      action: 'SCHEDULE_UPDATED',
      frequency: normalizedFreq,
      enabled: isEnabled,
      recipientsCount: updatedRecipients.length,
      hasWebhook: Boolean(updatedWebhookUrl)
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return buildSchedulePayload(report);
}

/**
 * DELETE /api/v1/dashboards/:id/schedule
 */
export async function deleteDashboardSchedule(
  ctx: DashboardRequestContext,
  id: string
): Promise<{ success: boolean; message: string }> {
  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboard = await requireOwnedDashboard(ctx, id);

  await ReportModel.deleteMany({
    dashboardId: dashboard._id,
    organizationId: dashboard.organizationId
  }).exec();

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: 'DASHBOARD_UPDATED',
    resourceType: 'Dashboard',
    resourceId: id,
    metadata: { action: 'SCHEDULE_DELETED' },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return { success: true, message: 'Dashboard report schedule deleted successfully.' };
}

// ============================================================
// REPORT GENERATION & EXECUTION
// ============================================================

export interface GenerateReportBody {
  filters?: Array<Record<string, unknown>>;
  dashboardFilters?: Array<Record<string, unknown>>;
  format?: string;
}

/**
 * POST /api/v1/dashboards/:id/reports/generate
 */
export async function generateDashboardReport(
  ctx: DashboardRequestContext,
  id: string,
  body: GenerateReportBody = {}
): Promise<DashboardReportSnapshot> {
  const { organizationId } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const snapshot = await generateDashboardReportSnapshot(id, organizationId, {
    dashboardFilters: body.filters || body.dashboardFilters,
    format: body.format
  });

  // Update lastRunAt on an existing report schedule if any
  const dashboardObjectId = toObjectId(id);
  const existingReport = dashboardObjectId
    ? await ReportModel.findOne({
        dashboardId: dashboardObjectId,
        organizationId: toObjectId(organizationId)
      }).lean()
    : null;

  if (existingReport) {
    const delivery = (existingReport.deliveryConfig || {}) as Record<string, unknown>;
    const freq = String(delivery.frequency || 'DAILY').toUpperCase();
    const intervalMs = freq === 'WEEKLY' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    await ReportModel.updateOne(
      { _id: existingReport._id },
      {
        $set: {
          deliveryConfig: {
            ...delivery,
            lastRunAt: new Date().toISOString(),
            nextRunAt: new Date(Date.now() + intervalMs).toISOString()
          }
        }
      }
    ).catch(() => null);
  }

  return snapshot;
}

export interface CreateReportBody {
  frequency?: unknown;
  format?: unknown;
  recipients?: unknown;
  name?: unknown;
}

/**
 * POST /api/v1/dashboards/:id/reports — create a scheduled report for a dashboard.
 */
export async function createDashboardReport(
  ctx: DashboardRequestContext,
  id: string,
  body: CreateReportBody = {}
): Promise<Record<string, unknown>> {
  const { userId } = ctx;

  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboard = await requireOwnedDashboard(ctx, id);
  const { frequency, format, recipients, name } = body ?? {};

  const freq = String(frequency || 'WEEKLY').toUpperCase();
  const cronExpression =
    freq === 'DAILY' ? '0 9 * * *' : freq === 'MONTHLY' ? '0 9 1 * *' : '0 9 * * 1';

  const report = await ReportModel.create({
    dashboardId: dashboard._id,
    organizationId: dashboard.organizationId,
    createdById: requireObjectId(userId, 'User'),
    name: (name as string) || `${dashboard.name} Scheduled Report`,
    status: REPORT_STATUS.ACTIVE,
    format: String(format || REPORT_FORMAT.PDF).toUpperCase(),
    cronExpression,
    deliveryConfig: {
      frequency: freq,
      recipients: Array.isArray(recipients) ? recipients : [],
      format: String(format || REPORT_FORMAT.PDF).toUpperCase()
    }
  });

  return {
    id: report._id.toString(),
    dashboardId: report.dashboardId.toString(),
    frequency: freq,
    format: report.format,
    recipients: Array.isArray(recipients) ? recipients : [],
    status: report.status,
    createdAt: report.createdAt.toISOString()
  };
}

/**
 * POST /api/v1/dashboards/:id/reports/:reportId/run — run an existing report manually.
 */
export async function runDashboardReport(
  ctx: DashboardRequestContext,
  id: string,
  reportId: string
): Promise<Record<string, unknown>> {
  const { organizationId, userId } = ctx;

  if (!id || !reportId) {
    throw AppError.badRequest('Dashboard ID and Report ID are required');
  }

  const dashboard = await requireOwnedDashboard(ctx, id);

  const report = await ReportModel.findOne({
    _id: toObjectId(reportId),
    dashboardId: dashboard._id
  }).lean();

  if (!report) {
    throw AppError.notFound('Report');
  }

  const startTime = Date.now();
  const snapshot = await generateDashboardReportSnapshot(id, organizationId);
  const durationMs = Date.now() - startTime;

  const execution = await ReportExecutionModel.create({
    reportId: report._id,
    dashboardId: dashboard._id,
    status: REPORT_EXECUTION_STATUS.SUCCESS,
    durationMs,
    chartCount: snapshot.chartCount,
    totalRecords: snapshot.summary.totalRecords,
    summary: snapshot.summary as unknown as Record<string, unknown>
  });

  const delivery = (report.deliveryConfig || {}) as Record<string, unknown>;
  await ReportModel.updateOne(
    { _id: report._id },
    {
      $set: {
        deliveryConfig: {
          ...delivery,
          lastRunAt: new Date().toISOString(),
          lastDeliveryStatus: 'SUCCESS',
          lastDeliveryAt: new Date().toISOString()
        }
      }
    }
  ).catch(() => null);

  await logAuditEvent({
    organizationId,
    userId,
    action: 'REPORT_RUN_MANUAL',
    resourceType: 'Report',
    resourceId: report._id.toString(),
    metadata: {
      durationMs,
      chartCount: snapshot.chartCount,
      totalRecords: snapshot.summary.totalRecords
    },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent
  });

  return {
    id: report._id.toString(),
    reportId: report._id.toString(),
    executionId: execution._id.toString(),
    status: 'COMPLETED',
    executedAt: execution.executedAt.toISOString(),
    durationMs,
    chartCount: snapshot.chartCount,
    totalRecords: snapshot.summary.totalRecords,
    snapshot
  };
}

/**
 * GET /api/v1/dashboards/:id/reports/history
 */
export async function getDashboardReportHistory(
  ctx: DashboardRequestContext,
  id: string
): Promise<Array<Record<string, unknown>>> {
  if (!id) {
    throw AppError.badRequest('Dashboard ID is required');
  }

  const dashboard = await requireOwnedDashboard(ctx, id);

  const executions = await ReportExecutionModel.find({ dashboardId: dashboard._id })
    .sort({ executedAt: -1 })
    .limit(50)
    .lean();

  return serializeDocs<Record<string, unknown>>(executions);
}

export type { DashboardReportSnapshot };
