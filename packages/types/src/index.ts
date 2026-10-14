export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  database?: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
}

// ---- RicozViz domain layer ------------------------------------------------
// Explicit re-export (no `export *` anywhere in this repository).
export {
  USER_STATUS,
  ORGANIZATION_STATUS,
  MEMBERSHIP_STATUS,
  WORKSPACE_ROLE,
  DATA_SOURCE_TYPE,
  DATA_SOURCE_STATUS,
  DATA_SOURCE_DISPLAY_STATUS,
  DATA_SOURCE_CONNECTOR_TYPE,
  DATASET_COLUMN_TYPE,
  DATASET_TYPE,
  DATASET_SOURCE_TYPE,
  DATASET_STATUS,
  BLEND_JOIN_TYPE,
  FILTER_LOGIC,
  DASHBOARD_STATUS,
  DASHBOARD_VISIBILITY,
  DASHBOARD_ACCESS_LEVEL,
  REPORT_STATUS,
  REPORT_FORMAT,
  REPORT_FREQUENCY,
  REPORT_DELIVERY_TYPE,
  REPORT_EXECUTION_STATUS,
  METRIC_FORMAT,
  METRIC_AGGREGATION,
  AGGREGATION_FUNCTION,
  ALERT_CONDITION,
  ALERT_CONDITION_EXTENDED,
  ALERT_STATUS,
  EXPORT_FORMAT,
  EXPORT_STATUS,
  EXPORT_RESOURCE_TYPE,
  AUDIT_STATUS,
  SECURITY_BADGE_CATEGORY,
  SECURITY_BADGE_STATUS,
  RLS_SIMULATION_ROLE,
  RLS_POLICY_CATEGORY
} from './ricozviz/index';

export type {
  UserStatus,
  OrganizationStatus,
  MembershipStatus,
  WorkspaceRole,
  DataSourceType,
  DataSourceStatus,
  DataSourceDisplayStatus,
  DataSourceConnectorType,
  DatasetColumnType,
  DatasetType,
  DatasetSourceType,
  DatasetStatus,
  BlendJoinType,
  FilterLogic,
  DashboardStatus,
  DashboardVisibility,
  DashboardAccessLevel,
  ReportStatus,
  ReportFormat,
  ReportFrequency,
  ReportDeliveryType,
  ReportExecutionStatus,
  MetricFormat,
  MetricAggregation,
  AggregationFunction,
  AlertCondition,
  AlertConditionExtended,
  AlertStatus,
  ExportFormat,
  ExportStatus,
  ExportResourceType,
  AuditStatus,
  ApiErrorDetail,
  ApiMeta,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiSuccess,
  ApiFailure,
  RicozVizApiResponse,
  UserSummary,
  UserProfile,
  UserData,
  OrganizationProfile,
  OrganizationData,
  RoleSummary,
  PermissionSummary,
  WorkspaceMemberData,
  WorkspaceData,
  OrganizationMemberData,
  DataSourceData,
  ConnectionTestResult,
  AuditLogItem,
  QueryAuditLogsParams,
  QueryAuditLogsResponse,
  AuditLogStatsResponse,
  RicozVizAuthResponse,
  RicozVizMeResponse,
  RicozVizRefreshResponse,
  RicozVizRegisterInput,
  RicozVizLoginInput,
  AccessTokenPayload,
  AuthenticatedUser,
  DatasetColumn,
  SourceTable,
  DatasetBlendConfig,
  DatasetData,
  CreateDatasetInput,
  UpdateDatasetInput,
  DatasetPreviewResult,
  CsvPreviewSchemaResult,
  DemoDatasetColumn,
  DemoDatasetCatalogItem,
  ImportedDatasetData,
  DatasetBlendPreviewRequest,
  DatasetBlendPreviewResult,
  CreateDatasetBlendRequest,
  CalculatedFieldConfig,
  PreviewCalculatedFieldRequest,
  PreviewCalculatedFieldResult,
  CreateCalculatedFieldRequest,
  UpdateCalculatedFieldRequest,
  FilterOperator,
  DatasetQueryFilter,
  DatasetQueryMeasure,
  DatasetSortSpec,
  DatasetQueryParams,
  QueryResultColumn,
  DatasetQueryResult,
  DatasetRefreshSchedule,
  TransformationStep,
  TransformationPreviewResponse,
  ApplyTransformationResponse,
  DatasetVersionItem,
  DatasetLineageResponse,
  CategoricalValueDistribution,
  ColumnProfile,
  DataQualityWarning,
  QualityScoreBreakdown,
  DatasetQualitySummary,
  DatasetProfileResult,
  RlsOperator,
  RowLevelSecurityRule,
  ChartType,
  ChartPosition,
  ChartMeasure,
  ChartFilter,
  ChartSort,
  ChartConfig,
  VisualizationConfig,
  ThemePreset,
  DashboardThemeConfig,
  DashboardBrandingConfig,
  AdvancedCustomizationConfig,
  DashboardChart,
  ChartData,
  CreateChartInput,
  UpdateChartInput,
  VisualizationData,
  QueryResultColumnLite,
  CreateVisualizationInput,
  UpdateVisualizationInput,
  DashboardData,
  DashboardItem,
  DashboardListResponse,
  CreateDashboardInput,
  UpdateDashboardInput,
  SharedDashboardChart,
  SharedDashboardData,
  ShareLinkStatusResponse,
  DashboardCollaboratorData,
  UserProfileLite,
  DashboardCollaboratorsResponse,
  CollaboratorPresence,
  CollaborationStateResult,
  EmbedConfig,
  EmbedStatusResult,
  DashboardScheduleData,
  ReportExecutionData,
  DashboardReportSnapshot,
  DashboardChartSnapshot,
  DashboardVersionRecord,
  VersionComparisonResult,
  EmbeddedChartDataResult,
  MultiplayerCursorIndicator,
  MultiplayerCanvasEvent,
  MetricData,
  CreateMetricPayload,
  CalculatedMetricResult,
  MetricCalculationResult,
  CalculateMetricOptions,
  AlertHistoryEntry,
  AlertHistoryData,
  AlertData,
  CreateAlertPayload,
  AlertEvaluationResult,
  ExportRequestPayload,
  ExportResult,
  ExportJobData,
  TemplateChartDef,
  DashboardTemplateData,
  CreateTemplateFromDashboardPayload,
  InstantiateDashboardPayload,
  InstantiateDashboardResult,
  AnalystQueryResponse,
  AskDataAnalystParams,
  NlToChartResponse,
  NlToChartParams,
  AutoInsightType,
  AutoInsight,
  InsightsParams,
  InsightsResponse,
  DashboardSummaryResponse,
  DashboardSummaryParams,
  SecurityBadgeCategory,
  SecurityBadgeStatus,
  SecurityBadge,
  GovernancePosture,
  VerifyBadgeResult,
  RlsSimulationRole,
  RlsPolicyCategory,
  RlsPolicyDefinition,
  RlsRoleDefinition,
  RlsSimulatedRecord,
  RlsSimulationRequest,
  RlsSimulationResult,
  RlsPoliciesCatalogResponse,
  CisoAccreditationItem,
  CisoTrustOverview,
  CisoAttestationDossier,
  ImmutableQueryLog,
  UserSessionPresence,
  CryptographicTokenRevocation,
  LedgerIntegritySummary,
  AuditTrailPreviewData,
  RevokeTokenPayload,
  RevokeTokenResult
} from './ricozviz/index';



