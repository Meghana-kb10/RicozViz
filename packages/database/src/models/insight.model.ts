import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef, objectIdRefOptional } from './model.util';
import {
  EXPORT_FORMAT,
  EXPORT_STATUS,
  REPORT_EXECUTION_STATUS,
  REPORT_FORMAT,
  REPORT_STATUS
} from '@repo/types';

/**
 * Scheduled or on-demand export of a dashboard to a static document format.
 *
 * `cronExpression` drives the scheduler and `deliveryConfig` holds the delivery
 * targets (email recipients, webhook urls, ...) for the generated report.
 */
export interface IReportDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  status: string;
  format: string;
  cronExpression: string | null;
  deliveryConfig: Record<string, unknown>;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReportDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    dashboardId: objectIdRef('Dashboard', true),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(REPORT_STATUS),
      default: REPORT_STATUS.ACTIVE
    },
    format: {
      type: String,
      enum: Object.values(REPORT_FORMAT),
      default: REPORT_FORMAT.PDF
    },
    cronExpression: { type: String, default: null },
    deliveryConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.REPORTS, timestamps: true, versionKey: false }
);

export const ReportModel: Model<IReportDocument> =
  defineModel<IReportDocument>('Report', ReportSchema);

/**
 * One run of a report. `dashboardId` is denormalised so execution history can
 * be listed without joining through the report.
 */
export interface IReportExecutionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  dashboardId: mongoose.Types.ObjectId;
  status: string;
  executedAt: Date;
  durationMs: number;
  chartCount: number;
  totalRecords: number;
  summary: Record<string, unknown>;
  errorMessage: string | null;
}

const ReportExecutionSchema = new Schema<IReportExecutionDocument>(
  {
    reportId: objectIdRef('Report', true),
    dashboardId: objectIdRef('Dashboard', true),
    status: {
      type: String,
      enum: Object.values(REPORT_EXECUTION_STATUS),
      default: REPORT_EXECUTION_STATUS.SUCCESS
    },
    executedAt: { type: Date, default: Date.now },
    durationMs: { type: Number, default: 0 },
    chartCount: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    summary: { type: Schema.Types.Mixed, default: () => ({}) },
    errorMessage: { type: String, default: null }
  },
  { collection: COLLECTIONS.REPORT_EXECUTIONS, timestamps: true, versionKey: false }
);

export const ReportExecutionModel: Model<IReportExecutionDocument> =
  defineModel<IReportExecutionDocument>('ReportExecution', ReportExecutionSchema);

/**
 * Asynchronous CSV / Excel / PDF / PNG export of a dataset, visualisation or
 * dashboard. `resourceName` is cached so completed jobs can be listed even
 * after the source resource is deleted.
 */
export interface IExportJobDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** One of `DATASET`, `VISUALIZATION` or `DASHBOARD`. */
  resourceType: string;
  resourceId: mongoose.Types.ObjectId;
  resourceName: string;
  format: string;
  status: string;
  rowCount: number | null;
  fileSize: number | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

const ExportJobSchema = new Schema<IExportJobDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRef('Workspace', true),
    userId: objectIdRef('User', true),
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    resourceName: { type: String, required: true },
    format: {
      type: String,
      enum: Object.values(EXPORT_FORMAT),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(EXPORT_STATUS),
      default: EXPORT_STATUS.COMPLETED
    },
    rowCount: { type: Number, default: null },
    fileSize: { type: Number, default: null },
    downloadUrl: { type: String, default: null },
    errorMessage: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    completedAt: { type: Date, default: null }
  },
  { collection: COLLECTIONS.EXPORT_JOBS, timestamps: true, versionKey: false }
);
ExportJobSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

export const ExportJobModel: Model<IExportJobDocument> =
  defineModel<IExportJobDocument>('ExportJob', ExportJobSchema);

/**
 * Reusable dashboard starter layout.
 *
 * System templates (`isSystem: true`) have no scope and are visible to every
 * tenant; workspace templates are scoped to a single workspace.
 */
export interface IDashboardTemplateDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  layoutConfig: Record<string, unknown>;
  chartsConfig: unknown[];
  isSystem: boolean;
  organizationId: mongoose.Types.ObjectId | null;
  workspaceId: mongoose.Types.ObjectId | null;
  createdById: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DashboardTemplateSchema = new Schema<IDashboardTemplateDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: { type: String, required: true, index: true },
    thumbnailUrl: { type: String, default: null },
    layoutConfig: { type: Schema.Types.Mixed, default: () => ({}) },
    chartsConfig: { type: Schema.Types.Mixed, default: () => ([]) },
    isSystem: { type: Boolean, default: false },
    organizationId: objectIdRefOptional('Organization'),
    workspaceId: objectIdRefOptional('Workspace'),
    createdById: objectIdRefOptional('User', false)
  },
  { collection: COLLECTIONS.DASHBOARD_TEMPLATES, timestamps: true, versionKey: false }
);

export const DashboardTemplateModel: Model<IDashboardTemplateDocument> =
  defineModel<IDashboardTemplateDocument>('DashboardTemplate', DashboardTemplateSchema);

/**
 * Immutable audit trail entry for a mutation performed by a user.
 *
 * `resourceId` is intentionally untyped (no `ref`) because audit rows outlive
 * the resources they reference and may also point at polymorphic targets.
 */
export interface IAuditLogDocument extends Document {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId: mongoose.Types.ObjectId | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRefOptional('Workspace'),
    userId: objectIdRef('User', true),
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, default: 'SUCCESS' },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { collection: COLLECTIONS.AUDIT_LOGS, timestamps: true, versionKey: false }
);
AuditLogSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});
AuditLogSchema.virtual('workspace', {
  ref: 'Workspace',
  localField: 'workspaceId',
  foreignField: '_id',
  justOne: true
});
AuditLogSchema.index({ organizationId: 1, createdAt: 1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLogModel: Model<IAuditLogDocument> =
  defineModel<IAuditLogDocument>('AuditLog', AuditLogSchema);