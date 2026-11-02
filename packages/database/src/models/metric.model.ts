import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';
import { defineModel, objectIdRef } from './model.util';
import { ALERT_CONDITION, ALERT_STATUS, METRIC_AGGREGATION, METRIC_FORMAT } from '@repo/types';

/**
 * A reusable aggregate over a dataset field (sum, average, count, ...).
 *
 * `targetValue` is optional and only used by the alerting engine to evaluate
 * alerts attached to this metric.
 */
export interface IMetricDocument extends Document {
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

const MetricSchema = new Schema<IMetricDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRef('Workspace', true),
    datasetId: objectIdRef('Dataset', true),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    calculation: {
      type: String,
      enum: Object.values(METRIC_AGGREGATION),
      default: METRIC_AGGREGATION.SUM
    },
    field: { type: String, required: true },
    format: {
      type: String,
      enum: Object.values(METRIC_FORMAT),
      default: METRIC_FORMAT.NUMBER
    },
    targetValue: { type: Number, default: null },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.METRICS, timestamps: true, versionKey: false }
);

export const MetricModel: Model<IMetricDocument> =
  defineModel<IMetricDocument>('Metric', MetricSchema);

/**
 * Threshold rule evaluated against a {@link Metric}. The latest evaluation
 * outcome is denormalised onto the row for cheap dashboard rendering; the full
 * history lives in `alert_history`.
 */
export interface IAlertDocument extends Document {
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
  recipients?: string[];
  slackWebhookUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlertDocument>(
  {
    organizationId: objectIdRef('Organization', true),
    workspaceId: objectIdRef('Workspace', true),
    metricId: objectIdRef('Metric', true),
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    condition: {
      type: String,
      enum: Object.values(ALERT_CONDITION),
      required: true
    },
    threshold: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(ALERT_STATUS),
      default: ALERT_STATUS.PENDING
    },
    lastEvaluatedAt: { type: Date, default: null },
    lastTriggeredAt: { type: Date, default: null },
    lastValue: { type: Number, default: null },
    recipients: { type: [String], default: [] },
    slackWebhookUrl: { type: String, default: null },
    createdById: objectIdRef('User', true)
  },
  { collection: COLLECTIONS.ALERTS, timestamps: true, versionKey: false }
);

export const AlertModel: Model<IAlertDocument> =
  defineModel<IAlertDocument>('Alert', AlertSchema);

/**
 * Append-only evaluation log for an alert. The condition and status are copied
 * verbatim so historical rows keep their original meaning after an alert is
 * edited.
 */
export interface IAlertHistoryDocument extends Document {
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
}

const AlertHistorySchema = new Schema<IAlertHistoryDocument>(
  {
    alertId: objectIdRef('Alert', true),
    value: { type: Number, required: true },
    threshold: { type: Number, required: true },
    condition: { type: String, required: true },
    status: { type: String, required: true },
    message: { type: String, required: true },
    triggeredAt: { type: Date, default: Date.now },
    deliveryStatus: {
      type: String,
      enum: ['DELIVERED', 'FAILED', 'SKIPPED', 'NOT_CONFIGURED'],
      default: 'SKIPPED'
    },
    deliveredAt: { type: Date, default: null },
    deliveryError: { type: String, default: null },
    deliveryChannel: { type: String, default: null }
  },
  { collection: COLLECTIONS.ALERT_HISTORY, timestamps: true, versionKey: false }
);

export const AlertHistoryModel: Model<IAlertHistoryDocument> =
  defineModel<IAlertHistoryDocument>('AlertHistory', AlertHistorySchema);