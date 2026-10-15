/**
 * RicozViz web API surface.
 *
 * The implementation now lives in `@repo/api` (shared with the backend
 * contract) and the domain types live in `@repo/types`. This module is a
 * **facade**: every page imports from `../../lib/api`, so the export names
 * below are frozen by ~33k lines of unchanged UI code. Renaming anything here
 * breaks the app.
 *
 * Rules for this file:
 *  - explicit re-exports only (no `export *`, per repository policy)
 *  - never re-implement an endpoint here
 */

// ---- Transport ---------------------------------------------------------------
export {
  getApiBaseUrl,
  configureRicozVizApi,
  ApiError,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  apiFetch
} from '@repo/api';

// ---- Auth --------------------------------------------------------------------
export { apiRegister, apiLogin, apiMe, apiRefresh, apiLogout } from '@repo/api';

// ---- Workspaces ---------------------------------------------------------------
export {
  apiListWorkspaces,
  apiGetWorkspace,
  apiCreateWorkspace,
  apiUpdateWorkspace,
  apiDeleteWorkspace,
  apiListWorkspaceMembers,
  apiAddWorkspaceMember,
  apiRemoveWorkspaceMember,
  apiUpdateWorkspaceMemberRole
} from '@repo/api';

// ---- Data sources -------------------------------------------------------------
export {
  apiListDataSources,
  apiGetDataSource,
  apiCreateDataSource,
  apiUpdateDataSource,
  apiDeleteDataSource,
  apiTestDataSourceConnection,
  apiTestRawConnection
} from '@repo/api';

// ---- Datasets -----------------------------------------------------------------
export {
  apiListDatasets,
  apiGetDataset,
  apiCreateDataset,
  apiUploadDataset,
  apiUpdateDataset,
  apiDeleteDataset,
  apiPreviewDataset,
  apiPreviewCsvSchema,
  apiListSourceTables,
  apiGetSourceTableSchema,
  apiImportSourceTable,
  apiGetDatasetRefreshSchedule,
  apiSaveDatasetRefreshSchedule,
  apiDeleteDatasetRefreshSchedule,
  apiTriggerDatasetRefresh,
  apiGetDemoCatalog,
  apiGetDemoDataset,
  apiImportDemoDataset,
  apiPreviewDatasetBlend,
  apiCreateDatasetBlend,
  apiListDatasetBlends,
  apiGetDatasetBlend,
  apiDeleteDatasetBlend,
  apiPreviewCalculatedField,
  apiCreateCalculatedField,
  apiListCalculatedFields,
  apiUpdateCalculatedField,
  apiDeleteCalculatedField,
  apiQueryDataset,
  apiProfileDataset,
  apiPreviewTransformations,
  apiApplyTransformations,
  apiListDatasetVersions,
  apiGetDatasetVersion,
  apiRestoreDatasetVersion,
  apiGetDatasetLineage,
  apiListDatasetRlsRules,
  apiCreateRlsRule,
  apiUpdateRlsRule,
  apiDeleteRlsRule
} from '@repo/api';

// ---- Dashboards ----------------------------------------------------------------
export {
  apiListDashboards,
  apiGetDashboards,
  apiGetDashboard,
  apiCreateDashboard,
  apiUpdateDashboard,
  apiDeleteDashboard,
  apiCreateShareLink,
  apiGetShareLinkStatus,
  apiDisableShareLink,
  apiGetSharedDashboard,
  apiGetSharedChartData,
  apiListDashboardCollaborators,
  apiGrantDashboardCollaborator,
  apiRevokeDashboardCollaborator,
  apiGetCollaborationState,
  apiSendCollaborationPresence,
  apiCollaborativeUpdate,
  apiCreateDashboardEmbed,
  apiGetDashboardEmbed,
  apiRevokeDashboardEmbed,
  apiGetEmbeddedDashboard,
  apiGetEmbeddedChartData,
  apiListDashboardVersions,
  apiGetDashboardVersion,
  apiCompareDashboardVersions,
  apiRestoreDashboardVersion,
  apiGetDashboardSchedule,
  apiSaveDashboardSchedule,
  apiDeleteDashboardSchedule,
  apiGenerateDashboardReport,
  apiGetDashboardReportHistory,
  apiRunDashboardReport
} from '@repo/api';

// ---- Charts (nested under dashboards) --------------------------------------------
export {
  apiListCharts,
  apiGetChart,
  apiCreateChart,
  apiUpdateChart,
  apiDeleteChart
} from '@repo/api';

// ---- Visualizations ---------------------------------------------------------------
export {
  apiListVisualizations,
  apiGetVisualization,
  apiGetVisualizationData,
  apiCreateVisualization,
  apiUpdateVisualization,
  apiDeleteVisualization,
  apiShareVisualization,
  apiRevokeVisualizationShare,
  apiGetSharedVisualization,
  apiGetSharedVisualizationData
} from '@repo/api';

// ---- KPI / metrics ------------------------------------------------------------------
export {
  apiCreateMetric,
  apiListMetrics,
  apiGetMetric,
  apiUpdateMetric,
  apiDeleteMetric,
  apiCalculateMetric
} from '@repo/api';

// ---- Alerts ----------------------------------------------------------------------------
export {
  apiCreateAlert,
  apiListAlerts,
  apiGetAlert,
  apiUpdateAlert,
  apiDeleteAlert,
  apiEvaluateAlert,
  apiClearAlert,
  apiEvaluateAllWorkspaceAlerts
} from '@repo/api';

// ---- Exports ------------------------------------------------------------------------------
export { apiExportResource, apiListExportHistory } from '@repo/api';

// ---- Templates ------------------------------------------------------------------------------
export {
  apiListTemplates,
  apiGetTemplate,
  apiCreateTemplateFromDashboard,
  apiInstantiateDashboardFromTemplate
} from '@repo/api';

// ---- Audit logs ------------------------------------------------------------------------------
export {
  apiQueryAuditLogs,
  apiGetAuditLogStats,
  apiGetAuditTrailPreview,
  apiRevokeToken,
  apiVerifyLedgerChain
} from '@repo/api';

// ---- AI analytics -----------------------------------------------------------------------------
export {
  apiAskDataAnalyst,
  apiNlToChart,
  apiGetInsights,
  apiGetDashboardSummary
} from '@repo/api';

// ---- Governance & Security Badges -------------------------------------------------------------
export {
  apiGetGovernanceBadges,
  apiGetGovernanceBadge,
  apiVerifyGovernanceBadge,
  apiGetGovernancePosture,
  apiGetRlsPolicies,
  apiSimulateRls,
  apiGetCisoAccreditations,
  apiGetCisoTrustPack
} from '@repo/api';

// ---- Domain types --------------------------------------------------------------------------------
// Re-exported so pages can keep importing types from the same module as the functions.
export type {
  // Auth
  AuthResponse,
  UserData,
  OrganizationData,
  // Workspaces
  WorkspaceData,
  WorkspaceMemberData,
  WorkspaceRole,
  // Data sources
  DataSourceData,
  DataSourceStatus,
  ConnectionTestResult,
  // Datasets
  DatasetData,
  DatasetType,
  DatasetStatus,
  DatasetSourceType,
  DatasetColumn,
  DatasetPreviewResult,
  CsvPreviewSchemaResult,
  SourceTable,
  DatasetRefreshSchedule,
  DemoDatasetColumn,
  DemoDatasetCatalogItem,
  ImportedDatasetData,
  BlendJoinType,
  DatasetBlendPreviewRequest,
  DatasetBlendPreviewResult,
  CreateDatasetBlendRequest,
  CalculatedFieldConfig,
  PreviewCalculatedFieldRequest,
  PreviewCalculatedFieldResult,
  CreateCalculatedFieldRequest,
  UpdateCalculatedFieldRequest,
  FilterOperator,
  AggregationFunction,
  DatasetQueryFilter,
  DatasetQueryMeasure,
  DatasetQueryParams,
  QueryResultColumn,
  DatasetQueryResult,
  ColumnProfile,
  CategoricalValueDistribution,
  DataQualityWarning,
  QualityScoreBreakdown,
  DatasetQualitySummary,
  DatasetProfileResult,
  TransformationStep,
  TransformationPreviewResponse,
  ApplyTransformationResponse,
  DatasetVersionItem,
  DatasetLineageResponse,
  RlsOperator,
  RowLevelSecurityRule,
  // Dashboards
  DashboardData,
  DashboardItem,
  DashboardListResponse,
  DashboardStatus,
  DashboardVisibility,
  DashboardChart,
  SharedDashboardChart,
  SharedDashboardData,
  ShareLinkStatusResponse,
  DashboardCollaboratorData,
  DashboardCollaboratorsResponse,
  CollaboratorPresence,
  CollaborationStateResult,
  MultiplayerCursorIndicator,
  MultiplayerCanvasEvent,
  EmbedConfig,
  EmbedStatusResult,
  DashboardScheduleData,
  ReportFrequency,
  ReportExecutionData,
  DashboardReportSnapshot,
  DashboardVersionRecord,
  DashboardChartSnapshot,
  VersionComparisonResult,
  // Charts & visualization config
  ChartType,
  ChartData,
  ChartPosition,
  ChartMeasure,
  ChartFilter,
  ChartSort,
  ChartConfig,
  CreateChartInput,
  UpdateChartInput,
  VisualizationData,
  CreateVisualizationInput,
  UpdateVisualizationInput,
  ThemePreset,
  DashboardThemeConfig,
  DashboardBrandingConfig,
  AdvancedCustomizationConfig,
  // Metrics & alerts
  MetricData,
  MetricAggregation,
  MetricFormat,
  MetricCalculationResult,
  CreateMetricPayload,
  AlertData,
  AlertStatus,
  AlertHistoryData,
  AlertEvaluationResult,
  CreateAlertPayload,
  // Exports & templates
  ExportFormat,
  ExportResourceType,
  ExportJobData,
  ExportRequestPayload,
  ExportResult,
  DashboardTemplateData,
  TemplateChartDef,
  // Audit
  AuditLogItem,
  QueryAuditLogsParams,
  QueryAuditLogsResponse,
  AuditLogStatsResponse,
  // AI
  AnalystQueryResponse,
  NlToChartResponse,
  AutoInsight,
  DashboardSummaryResponse,
  // Governance
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
} from '@repo/types';

/**
 * The legacy client exposed a single 9-value `AlertCondition` covering both the
 * persisted 5-value enum and the percent-delta conditions the evaluation engine
 * also understands. Pages type their state with that union, so the name is
 * aliased to the extended set here to keep them compiling unchanged.
 */
export type { AlertConditionExtended as AlertCondition } from '@repo/types';

/**
 * Legacy alias for the `/auth/me` and `/auth/refresh` payloads. The domain
 * layer prefixes them to avoid clashing with the template's own `AuthResponse`.
 */
export type {
  RicozVizMeResponse as MeResponse,
  RicozVizRefreshResponse as RefreshResponse
} from '@repo/types';

/**
 * Connector types offered by the data-source screen.
 *
 * This is deliberately NOT the persisted `DataSourceType` enum: that one mirrors
 * the database (11 values, `CSV_UPLOAD`, `GOOGLE_SHEETS`, ...), while the UI
 * selects the concrete file/DB connectors below. The API layer accepts both.
 */
export type { DataSourceConnectorType as DataSourceType } from '@repo/types';