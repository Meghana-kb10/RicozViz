import type { DatasetQueryFilter, DatasetQueryParams, QueryResultColumn } from './dataset';

// ---- Analyst query -----------------------------------------------------------

export interface AnalystQueryResponse {
  answer: string;
  question: string;
  queryExecuted: DatasetQueryParams;
  resultSummary: {
    rowCount: number;
    primaryMetric?: { name: string; value: number; formatted: string };
    topEntity?: { dimension: string; value: string; metricValue: number };
  };
  data: Array<Record<string, unknown>>;
  chartSuggestion?: {
    title: string;
    chartType: string;
    dimension: string;
    measure: string;
    aggregation: string;
  };
  groundingVerification: {
    isGrounded: boolean;
    datasetName: string;
    datasetId: string;
    executionTimeMs: number;
  };
}

export interface AskDataAnalystParams {
  datasetId: string;
  question: string;
  filters?: DatasetQueryFilter[];
  dashboardId?: string;
}

// ---- Natural language to chart ------------------------------------------------

export interface NlToChartResponse {
  title: string;
  chartType: string;
  explanation: string;
  config: {
    dimensions: string[];
    measures: Array<{ column: string; aggregation: string; alias?: string }>;
    sort?: { column: string; direction: 'asc' | 'desc' };
    limit?: number;
    filters?: DatasetQueryFilter[];
  };
  data: Array<Record<string, unknown>>;
  columns: QueryResultColumn[];
    rowCount: number;
    sql?: string;
    xField?: string;
    yField?: string;
  }

export interface NlToChartParams {
  datasetId: string;
  prompt: string;
  filters?: DatasetQueryFilter[];
}

// ---- Auto insights ------------------------------------------------------------

export type AutoInsightType = 'PERFORMER_TOP' | 'PERFORMER_BOTTOM' | 'DOMINANCE' | 'TREND' | 'ANOMALY';

export interface AutoInsight {
  id: string;
  type: AutoInsightType;
  title: string;
  description: string;
  metric: string;
  value?: number;
  formattedValue?: string;
  dimensionValue?: string;
  isAnomaly: boolean;
  detectionMethod?: 'Z_SCORE' | 'IQR' | 'PERCENTAGE_CHANGE' | 'DISTRIBUTION';
  score?: number;
}

export interface InsightsParams {
  datasetId: string;
  dimension?: string;
  measure?: string;
  filters?: DatasetQueryFilter[];
  data?: Array<Record<string, unknown>>;
}

export interface InsightsResponse {
  insights: AutoInsight[];
  summary: string;
  analyzedRows: number;
}

// ---- Dashboard summary ---------------------------------------------------------

export interface DashboardSummaryResponse {
  dashboardId: string;
  dashboardName: string;
  summaryBullets: string[];
  keyMetrics: Array<{ label: string; value: string | number; change?: string }>;
  filterContextText: string;
  comparisonNote: string;
  generatedAt: string;
}

export interface DashboardSummaryParams {
  dashboardId: string;
  activeFilters?: DatasetQueryFilter[];
}