import type { DashboardStatus, DashboardVisibility, ReportExecutionStatus, ReportFormat, ReportFrequency, ReportDeliveryType, DashboardAccessLevel } from './enums';
import type { DatasetColumn, DatasetQueryResult } from './dataset';
import type { UserSummary } from './common';

// ---- Chart primitives --------------------------------------------------------

export type ChartType =
  | 'BAR'
  | 'LINE'
  | 'AREA'
  | 'PIE'
  | 'DONUT'
  | 'SCATTER'
  | 'TABLE'
  | 'KPI'
  | 'RADAR'
  | 'FUNNEL'
  | 'HEATMAP'
  | 'GAUGE'
  | 'BUBBLE'
  | 'TREEMAP'
  | 'MAP';

export interface ChartPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartMeasure {
  column: string;
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'DISTINCT_COUNT';
  alias?: string;
}

export interface ChartFilter {
  column: string;
  operator: string;
  value?: unknown;
}

export interface ChartSort {
  column: string;
  direction: 'asc' | 'desc' | 'ASC' | 'DESC';
}

export interface ChartConfig {
  dimensions?: string[];
  measures?: ChartMeasure[];
  xAxis?: string;
  category?: string;
  yAxis?: string | string[];
  value?: string | string[];
  secondaryValueCol?: string;
  groupCol?: string;
  aggregation?: string;
  filters?: ChartFilter[];
  sort?: ChartSort;
  columns?: string[];
  colorPalette?: string;
  customColors?: string[];
  legend?: { show?: boolean; position?: 'top' | 'bottom' | 'left' | 'right' };
  xAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    labelRotation?: number;
    showLabels?: boolean;
  };
  yAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    min?: number | null;
    max?: number | null;
    format?: string;
  };
  dataLabels?: { show?: boolean; position?: 'inside' | 'outside' | 'top' };
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    compact?: boolean;
    formatType?: 'number' | 'currency' | 'percentage';
  };
  chartOptions?: {
    stacked?: boolean;
    smooth?: boolean;
    fillOpacity?: number;
    donutHoleSize?: number;
    showTotal?: boolean;
  };
  options?: Record<string, unknown>;
}

export type VisualizationConfig = ChartConfig & {
  xAxis?: string;
  category?: string;
  yAxis?: string | string[];
  value?: string | string[];
  aggregation?: string;
  series?: string;
  group?: string;
  groupBy?: string[];
  aggregations?: Array<{ column: string; function?: string; aggregation?: string; alias?: string }>;
  columns?: string[];
};

export type ThemePreset = 'default' | 'dark' | 'light' | 'professional' | 'minimal' | 'custom';

export interface DashboardThemeConfig {
  preset: ThemePreset;
  mode: 'light' | 'dark';
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  textMutedColor: string;
  borderColor: string;
  cardRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  cardShadow: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  fontFamily: 'inter' | 'sans' | 'serif' | 'mono';
  chartPalette: string[];
}

export interface DashboardBrandingConfig {
  logoUrl?: string;
  title?: string;
  description?: string;
  brandColor?: string;
  faviconUrl?: string;
  typography?: 'inter' | 'sans' | 'serif' | 'mono';
}

export interface AdvancedCustomizationConfig {
  colorPalette?: string;
  customColors?: string[];
  legend?: { show: boolean; position: 'top' | 'bottom' | 'left' | 'right' };
  xAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    labelRotation?: number;
    showLabels?: boolean;
  };
  yAxisConfig?: {
    title?: string;
    showGrid?: boolean;
    min?: number | null;
    max?: number | null;
    format?: string;
  };
  dataLabels?: { show?: boolean; position?: 'inside' | 'outside' | 'top' };
  numberFormat?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    compact?: boolean;
    formatType?: 'number' | 'currency' | 'percentage';
  };
  chartOptions?: {
    stacked?: boolean;
    smooth?: boolean;
    fillOpacity?: number;
    donutHoleSize?: number;
    showTotal?: boolean;
  };
}

// ---- Charts (nested under a dashboard) ---------------------------------------

export interface DashboardChart {
  id: string;
  title: string;
  description: string | null;
  chartType: string;
  config: Record<string, unknown>;
  position: Record<string, unknown>;
  sortOrder: number;
  datasetId: string | null;
}

export interface ChartData {
  id: string;
  dashboardId: string;
  datasetId: string | null;
  datasetName: string | null;
  datasetType: string | null;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: ChartConfig;
  position: ChartPosition;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChartInput {
  title: string;
  description?: string | null;
  chartType: ChartType;
  datasetId?: string | null;
  config?: ChartConfig;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

export interface UpdateChartInput {
  title?: string;
  description?: string | null;
  chartType?: ChartType;
  datasetId?: string | null;
  config?: ChartConfig;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

// ---- Standalone visualizations ----------------------------------------------

export interface VisualizationData {
  id: string;
  dashboardId: string;
  datasetId: string | null;
  datasetName: string | null;
  datasetType: string | null;
  workspaceId: string | null;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: VisualizationConfig;
  position: ChartPosition;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  data?: Record<string, unknown>[];
  columns?: QueryResultColumnLite[];
  rowCount?: number;
  total?: number;
}

export interface QueryResultColumnLite {
  name: string;
  type: string;
}

export interface CreateVisualizationInput {
  title: string;
  description?: string | null;
  chartType: ChartType;
  datasetId?: string | null;
  dashboardId?: string | null;
  config?: VisualizationConfig & Record<string, unknown>;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

export interface UpdateVisualizationInput {
  title?: string;
  description?: string | null;
  chartType?: ChartType;
  datasetId?: string | null;
  config?: VisualizationConfig & Record<string, unknown>;
  position?: Partial<ChartPosition>;
  sortOrder?: number;
}

// ---- Dashboards --------------------------------------------------------------

export interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  status: DashboardStatus;
  visibility: DashboardVisibility;
  organizationId: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  layoutConfig: Record<string, unknown>;
  chartCount: number;
  charts: DashboardChart[];
  shareToken?: string | null;
  shareTokenActive?: boolean;
  sharedAt?: string | null;
  shareExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DashboardItem = DashboardData;

export interface DashboardListResponse {
  dashboards: DashboardData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateDashboardInput {
  name: string;
  description?: string | null;
  status?: DashboardStatus;
  visibility?: DashboardVisibility;
  layoutConfig?: Record<string, unknown>;
  workspaceId?: string | null;
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string | null;
  status?: DashboardStatus;
  visibility?: DashboardVisibility;
  layoutConfig?: Record<string, unknown>;
}

// ---- Sharing -----------------------------------------------------------------

export interface SharedDashboardChart {
  id: string;
  title: string;
  description: string | null;
  chartType: ChartType;
  config: ChartConfig;
  position: ChartPosition;
  sortOrder: number;
  datasetId: string | null;
  datasetName: string | null;
  datasetColumns?: DatasetColumn[];
}

export interface SharedDashboardData {
  id: string;
  name: string;
  description: string | null;
  layoutConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  charts: SharedDashboardChart[];
}

export interface ShareLinkStatusResponse {
  shareToken: string | null;
  shareTokenActive: boolean;
  sharedAt: string | null;
  active?: boolean;
  token?: string | null;
  shareUrl?: string | null;
  shareExpiresAt?: string | null;
}

// ---- Collaboration -----------------------------------------------------------

export interface DashboardCollaboratorData {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  accessLevel: DashboardAccessLevel;
  grantedAt: string;
  user?: UserProfileLite;
}

export interface UserProfileLite {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface DashboardCollaboratorsResponse {
  dashboardId?: string;
  dashboardTitle?: string;
  isOwner?: boolean;
  owner: { id: string; name: string; email: string };
  collaborators: DashboardCollaboratorData[];
  workspaceMembers: Array<{
    userId: string;
    roleName: string;
    user: UserProfileLite;
  }>;
}

export interface CollaboratorPresence {
  clientId: string;
  userId: string;
  name: string;
  email: string;
  userName?: string;
  userEmail?: string;
  role: string;
  joinedAt: string;
  lastPing: string;
  activeWidgetId?: string | null;
}

export interface CollaborationStateResult {
  dashboardId: string;
  currentVersionNumber: number;
  activeCollaborators: CollaboratorPresence[];
  collaboratorCount: number;
}

export interface MultiplayerCursorIndicator {
  id: string;
  name: string;
  role: string;
  color: string;
  avatarInitials: string;
  xPercent: number;
  yPercent: number;
  targetWidgetId?: string;
  targetLabel?: string;
  actionText?: string;
  isSelecting?: boolean;
  selectionBox?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  status: "idle" | "inspecting" | "selecting" | "commenting" | "filtering" | "editing" | "locked";
  lastActive: string;
}

export interface MultiplayerCanvasEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  type: "CURSOR_MOVE" | "POINT_INSPECT" | "WIDGET_LOCK" | "FILTER_APPLIED" | "COMMENT_PINNED" | "OPTIMISTIC_MERGE";
  description: string;
  latencyMs: number;
}


// ---- Embedded analytics ------------------------------------------------------

export interface EmbedConfig {
  enabled?: boolean;
  token?: string;
  allowedOrigins?: string[];
  expiresAt?: string | null;
  theme?: 'light' | 'dark' | 'system';
  showTitle?: boolean;
  showFilters?: boolean;
  showRefresh?: boolean;
  showControls?: boolean;
  createdAt?: string;
  createdById?: string;
}

export interface EmbedStatusResult {
  enabled: boolean;
  embedToken: string | null;
  embedUrl: string | null;
  iframeCode: string | null;
  embedCode?: string | null;
  expiresAt?: string | null;
  config: EmbedConfig | null;
}

// ---- Report scheduling -------------------------------------------------------

export interface DashboardScheduleData {
  id: string;
  dashboardId: string;
  frequency: ReportFrequency;
  format?: ReportFormat;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  recipients?: string[];
  webhookUrl?: string | null;
  deliveryType?: ReportDeliveryType;
  lastDeliveryStatus?: 'SUCCESS' | 'FAILED' | null;
  lastDeliveryAt?: string | null;
  lastDeliveryError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportExecutionData {
  id: string;
  reportId: string;
  dashboardId: string;
  status: ReportExecutionStatus;
  executedAt: string;
  durationMs: number;
  chartCount: number;
  totalRecords: number;
  summary: Record<string, unknown>;
  errorMessage?: string | null;
  format?: string;
  triggeredBy?: string;
  snapshotUrl?: string;
}

export interface DashboardReportSnapshot {
  reportId: string;
  dashboardId: string;
  dashboardName: string;
  generatedAt: string;
  chartCount: number;
  charts: Array<{
    chartId: string;
    title: string;
    chartType: string;
    rowCount: number;
    columns: Array<{ name: string; type: string }>;
    data: Record<string, unknown>[];
  }>;
  summary: {
    totalCharts: number;
    totalRecords: number;
    executionTimeMs: number;
  };
}

// ---- Dashboard version history ------------------------------------------------

export interface DashboardChartSnapshot {
  id: string;
  title: string;
  description?: string | null;
  chartType: string;
  config: unknown;
  position: unknown;
  sortOrder?: number;
  datasetId?: string | null;
}

export interface DashboardVersionRecord {
  id: string;
  dashboardId: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  layoutConfig: Record<string, unknown>;
  chartsSnapshot: DashboardChartSnapshot[];
  changeSummary?: string | null;
  createdById: string;
  createdBy?: UserSummary | null;
  createdAt: string;
}

export interface VersionComparisonResult {
  dashboardId: string;
  baseVersion: number;
  targetVersion: number;
  nameChanged: boolean;
  baseName: string;
  targetName: string;
  descriptionChanged: boolean;
  baseDescription: string | null;
  targetDescription: string | null;
  layoutChanged: boolean;
  addedCharts: DashboardChartSnapshot[];
  removedCharts: DashboardChartSnapshot[];
  modifiedCharts: Array<{ id: string; title: string; changes: string[] }>;
  totalChanges: number;
}

export type EmbeddedChartDataResult = DatasetQueryResult;