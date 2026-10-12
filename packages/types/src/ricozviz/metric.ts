import type {
  AlertConditionExtended,
  AlertStatus,
  MetricAggregation,
  MetricFormat
} from './enums';
import type { DatasetColumn, DatasetQueryFilter } from './dataset';
import type { UserSummary } from './common';

// ---- KPI / metric layer ------------------------------------------------------

export interface MetricData {
  id: string;
  organizationId: string;
  workspaceId: string;
  datasetId: string;
  name: string;
  description: string | null;
  calculation: MetricAggregation;
  aggregation?: MetricAggregation;
  field: string;
  column?: string;
  format: MetricFormat;
  targetValue: number | null;
  createdAt: string;
  updatedAt: string;
  dataset?: {
    id: string;
    name: string;
    rowCount?: number;
    columns?: DatasetColumn[];
  };
  createdBy?: UserSummary;
  _count?: { alerts: number };
}

export interface CreateMetricPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  datasetId: string;
  calculation?: MetricAggregation;
  aggregation?: MetricAggregation;
  field?: string;
  column?: string;
  format?: MetricFormat;
  targetValue?: number | null;
}

export interface CalculatedMetricResult {
  metricId: string;
  name: string;
  calculation: MetricAggregation;
  field: string;
  format: MetricFormat;
  rawValue: number;
  formattedValue: string;
  targetValue: number | null;
  targetDelta: number | null;
  targetPercentage: number | null;
  progressPercent?: number | null;
  targetMet: boolean | null;
  executionTimeMs: number;
  calculatedAt: string;
}

export type MetricCalculationResult = CalculatedMetricResult;

export interface CalculateMetricOptions {
  filters?: DatasetQueryFilter[];
  filterLogic?: 'AND' | 'OR';
  timeRange?: { column: string; start?: string; end?: string };
  dimensions?: string[];
}

// ---- Smart data alerts -------------------------------------------------------

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  value: number;
  metricValue?: number;
  threshold: number;
  condition: string;
  status: 'TRIGGERED' | 'OK';
  message: string;
  triggeredAt: string;
  evaluatedAt?: string;
  triggered?: boolean;
  notified?: boolean;
}

export type AlertHistoryData = AlertHistoryEntry;

export interface AlertData {
  id: string;
  organizationId: string;
  workspaceId: string;
  metricId: string;
  name: string;
  description: string | null;
  condition: AlertConditionExtended;
  threshold: number;
  enabled: boolean;
  isEnabled?: boolean;
  status: AlertStatus;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastValue: number | null;
  createdAt: string;
  updatedAt: string;
  metric?: {
    id: string;
    name: string;
    format: MetricFormat;
    calculation: MetricAggregation;
    aggregation?: MetricAggregation;
    field: string;
    column?: string;
    dataset?: { id: string; name: string };
  };
  history?: AlertHistoryEntry[];
  createdBy?: UserSummary;
}

export interface CreateAlertPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  metricId: string;
  condition: AlertConditionExtended;
  threshold: number;
  enabled?: boolean;
  isEnabled?: boolean;
}

export interface AlertEvaluationResult {
  alertId: string;
  alertName: string;
  metricName: string;
  condition: AlertConditionExtended;
  conditionSymbol: string;
  threshold: number;
  formattedThreshold: string;
  currentValue: number;
  formattedCurrent: string;
  isTriggered: boolean;
  triggered?: boolean;
  status: AlertStatus;
  lastEvaluatedAt: string;
  historyId: string;
  message: string;
  notificationDelivery: string;
  alert?: AlertData;
}