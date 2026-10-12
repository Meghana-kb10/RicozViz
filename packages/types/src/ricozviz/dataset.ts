import type {
  AggregationFunction,
  BlendJoinType,
  DatasetSourceType,
  DatasetStatus,
  DatasetType,
  FilterLogic
} from './enums';
import type { UserSummary } from './common';

// ---- Columns & schema --------------------------------------------------------

export interface DatasetColumn {
  name: string;
  type: 'string' | 'number' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | string;
  nullable: boolean;
  ordinalPosition?: number;
  isCalculated?: boolean;
  expression?: string;
}

export interface SourceTable {
  name: string;
  type: 'table' | 'view';
}

// ---- Datasets ----------------------------------------------------------------

export interface DatasetBlendConfig {
  datasetAId: string;
  datasetAName: string;
  datasetBId: string;
  datasetBName: string;
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
  createdAt: string;
}

export interface DatasetData {
  id: string;
  workspaceId?: string | null;
  name: string;
  description: string | null;
  sourceType?: DatasetSourceType;
  fileName?: string | null;
  fileSize?: number | null;
  rowCount: number;
  columnCount?: number;
  type: DatasetType;
  status: DatasetStatus;
  dataSourceId: string | null;
  dataSourceName: string | null;
  dataSourceType: string | null;
  dataSource?: { id: string; name: string; type: string } | null;
  blendConfig?: DatasetBlendConfig | null;
  columns: DatasetColumn[];
  calculatedFields?: CalculatedFieldConfig[];
  currentVersion?: number;
  parentDatasetId?: string | null;
  transformationSteps?: unknown;
  tableName: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDatasetInput {
  workspaceId?: string | null;
  name: string;
  description?: string;
  type?: DatasetType;
  dataSourceId?: string | null;
  tableName?: string;
  columns?: DatasetColumn[];
  sampleData?: Record<string, unknown>[];
  csvText?: string;
}

export interface UpdateDatasetInput {
  name?: string;
  description?: string | null;
  status?: string;
}

// ---- Preview -----------------------------------------------------------------

export interface DatasetPreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total?: number;
  limit: number;
  offset?: number;
  dataset?: DatasetData;
  datasetId?: string;
  columnNames?: string[];
  columnTypes?: Array<{ name: string; type: string; dataType?: string }>;
  totalRowCount?: number;
  totalColumnCount?: number;
  previewRows?: Record<string, unknown>[];
  previewLimit?: number;
  columnDefinitions?: DatasetColumn[];
}

export interface CsvPreviewSchemaResult {
  columns: DatasetColumn[];
  previewRows: Record<string, unknown>[];
  totalRows: number;
}

// ---- Demo datasets -----------------------------------------------------------

export interface DemoDatasetColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DemoDatasetCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceUrl: string;
  license: string;
  sourceAttribution: string;
  fileName: string;
  sourceType: string;
  rowCount: number;
  columnCount: number;
  tags: string[];
  columns: DemoDatasetColumn[];
  sampleData: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
}

export interface ImportedDatasetData extends DatasetData {
  alreadyImported?: boolean;
}

// ---- Blends ------------------------------------------------------------------

export interface DatasetBlendPreviewRequest {
  datasetAId: string;
  datasetBId: string;
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
  limit?: number;
}

export interface DatasetBlendPreviewResult {
  datasetA: { id: string; name: string; rowCount: number; columnCount: number };
  datasetB: { id: string; name: string; rowCount: number; columnCount: number };
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
  resultingColumns: Array<{ name: string; type: string; origin: 'A' | 'B' }>;
  rowCount: number;
  previewRowCount: number;
  rows: Record<string, unknown>[];
}

export interface CreateDatasetBlendRequest {
  name: string;
  description?: string;
  datasetAId: string;
  datasetBId: string;
  joinColumnA: string;
  joinColumnB: string;
  joinType: BlendJoinType;
}

// ---- Calculated fields -------------------------------------------------------

export interface CalculatedFieldConfig {
  id: string;
  name: string;
  expression: string;
  dataType: 'NUMBER' | 'STRING' | 'BOOLEAN';
  datasetId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewCalculatedFieldRequest {
  name: string;
  expression: string;
  limit?: number;
}

export interface PreviewCalculatedFieldResult {
  name: string;
  expression: string;
  dataType: 'NUMBER' | 'STRING' | 'BOOLEAN';
  referencedColumns: string[];
  previewRowCount: number;
  rows: Record<string, unknown>[];
}

export interface CreateCalculatedFieldRequest {
  name: string;
  expression: string;
}

export interface UpdateCalculatedFieldRequest {
  name?: string;
  expression?: string;
}

// ---- Query engine ------------------------------------------------------------

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'isNull'
  | 'isNotNull'
  | 'in';

export interface DatasetQueryFilter {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface DatasetQueryMeasure {
  column: string;
  aggregation: AggregationFunction;
  alias?: string;
}

export interface DatasetSortSpec {
  column: string;
  direction: 'asc' | 'desc' | 'ASC' | 'DESC';
}

export interface DatasetQueryParams {
  columns?: string[];
  limit?: number;
  offset?: number;
  orderBy?: DatasetSortSpec;
  sort?: DatasetSortSpec;
  sorting?: DatasetSortSpec | DatasetSortSpec[];
  filters?: DatasetQueryFilter[];
  filterLogic?: FilterLogic;
  logic?: FilterLogic;
  dimensions?: string[];
  groupBy?: string[];
  measures?: DatasetQueryMeasure[];
  aggregations?: Array<{
    column: string;
    function?: string;
    aggregation?: AggregationFunction | string;
    alias?: string;
  }>;
}

export interface QueryResultColumn {
  name: string;
  type: string;
}

export interface DatasetQueryResult {
  columns: QueryResultColumn[];
  rows: Record<string, unknown>[];
  processedColumns?: QueryResultColumn[];
  processedRows?: Record<string, unknown>[];
  rowCount: number;
  total: number;
  limit: number;
  offset: number;
  executionTimeMs: number;
  metadata?: {
    rowCount: number;
    total: number;
    limit: number;
    offset: number;
    executionTimeMs: number;
    queryMode: 'RAW' | 'AGGREGATE' | string;
  };
}

// ---- Scheduled refresh -------------------------------------------------------

export interface DatasetRefreshSchedule {
  enabled: boolean;
  frequency: '1H' | '6H' | '12H' | 'DAILY' | 'WEEKLY' | string;
  intervalMinutes?: number;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: 'IDLE' | 'SUCCESS' | 'FAILED' | 'RUNNING' | string;
  lastError?: string | null;
  history?: Array<{
    executedAt: string;
    status: 'SUCCESS' | 'FAILED';
    durationMs: number;
    rowsAffected?: number;
    errorMessage?: string | null;
  }>;
}

// ---- Transformations ---------------------------------------------------------

export type TransformationStep =
  | {
      type: 'FILTER_ROWS';
      column: string;
      operator:
        | 'EQUALS'
        | 'NOT_EQUALS'
        | 'GREATER_THAN'
        | 'LESS_THAN'
        | 'CONTAINS'
        | 'IS_NULL'
        | 'IS_NOT_NULL';
      value?: unknown;
    }
  | { type: 'RENAME_COLUMN'; oldName: string; newName: string }
  | {
      type: 'TYPE_CONVERSION';
      column: string;
      targetType: 'TEXT' | 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN';
    }
  | {
      type: 'FILL_MISSING' | 'HANDLE_MISSING';
      column: string;
      strategy:
        | 'STATIC_VALUE'
        | 'MEAN'
        | 'MEDIAN'
        | 'MODE'
        | 'DROP_ROW'
        | 'FILL_ZERO'
        | 'FILL_MEAN'
        | 'FILL_VALUE';
      staticValue?: unknown;
      fillValue?: unknown;
    }
  | { type: 'REMOVE_DUPLICATES'; columns?: string[] }
  | { type: 'DERIVED_COLUMN'; name: string; expression: string }
  | { type: 'DROP_COLUMN'; column: string }
  | { type: 'TRIM_WHITESPACE'; column: string }
  | { type: 'CHANGE_CASE' | 'CASE_CONVERT'; column: string; casing?: 'UPPER' | 'LOWER'; mode?: 'UPPER' | 'LOWER' };

export interface TransformationPreviewResponse {
  previewRows: Array<Record<string, unknown>>;
  sampleRows?: Array<Record<string, unknown>>;
  transformedColumns: Array<{ name: string; type: string }>;
  originalRowCount: number;
  transformedRowCount: number;
  sampleSize: number;
}

export interface ApplyTransformationResponse {
  mode: 'NEW_VERSION' | 'DERIVED_DATASET' | 'CREATE_NEW' | 'SAVE_VERSION';
  dataset: Record<string, unknown>;
  version?: Record<string, unknown>;
}

// ---- Versioning & lineage ----------------------------------------------------

export interface DatasetVersionItem {
  id: string;
  datasetId: string;
  versionNumber: number;
  changeSummary: string | null;
  rowCount: number;
  columnCount: number;
  schemaSnapshot: { columns: Array<{ name: string; type: string }> };
  transformationConfig: TransformationStep[] | null;
  createdAt: string;
  createdById: string;
  creator?: UserSummary & { avatarUrl: string | null };
}

export interface DatasetLineageResponse {
  dataset: { id: string; name: string; version: number; parentDatasetId: string | null };
  parent: { id: string; name: string } | null;
  derivedDatasets: Array<{ id: string; name: string; currentVersion: number }>;
  linkedVisualizations: Array<{
    id: string;
    title: string;
    type: string;
    dashboardId: string | null;
    dashboardTitle: string | null;
  }>;
  versionsCount: number;
}

// ---- Data quality ------------------------------------------------------------

export interface CategoricalValueDistribution {
  value: string;
  count: number;
  percentage: number;
}

export interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  cardinality?: number;
  sampleValues: unknown[];
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  mean?: number | null;
  median?: number | null;
  stdDev?: number | null;
  outliersCount?: number;
  outlierPercentage?: number;
  outliers?: number[];
  topValues?: CategoricalValueDistribution[];
  frequency?: Record<string, number>;
  distribution?: Record<string, number>;
  minDate?: string | null;
  maxDate?: string | null;
  invalidDates?: number;
  missingDates?: number;
  minLength?: number | null;
  maxLength?: number | null;
  blankCount?: number;
  invalidCount?: number;
  invalidPercentage?: number;
}

export interface DataQualityWarning {
  column?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  rule: string;
  message: string;
}

export interface QualityScoreBreakdown {
  completeness: number;
  validity: number;
  consistency: number;
  uniqueness: number;
  weights: {
    completeness: number;
    validity: number;
    consistency: number;
    uniqueness: number;
  };
  formula: string;
}

export interface DatasetQualitySummary {
  dataQualityScore: number;
  completenessPercentage?: number;
  missingDataCount: number;
  missingDataPercentage: number;
  duplicateRowsCount: number;
  duplicateRowsPercentage: number;
  typeIssuesCount: number;
  potentialOutliersCount: number;
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  scoreBreakdown?: QualityScoreBreakdown;
  dataTypeDistribution?: Record<string, number>;
}

export interface DatasetProfileResult {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  completenessPercentage?: number;
  dataTypeDistribution?: Record<string, number>;
  qualityScore: number;
  scoreBreakdown?: QualityScoreBreakdown;
  summary?: DatasetQualitySummary;
  columns: ColumnProfile[];
  warnings: DataQualityWarning[];
  evaluatedAt: string;
}

// ---- Row-level security ------------------------------------------------------

export type RlsOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS';

export interface RowLevelSecurityRule {
  id: string;
  name: string;
  description?: string | null;
  datasetId: string;
  organizationId: string;
  columnName: string;
  operator: RlsOperator;
  ruleValue: unknown;
  roleName?: string | null;
  userId?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}