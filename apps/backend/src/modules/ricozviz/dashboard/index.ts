export { dashboardRoutes } from './dashboard.routes.js';
export { DashboardController, dashboardController } from './dashboard.controller.js';

export {
  createDashboardSchema,
  updateDashboardSchema,
  listDashboardsQuerySchema,
  buildSafeDashboard,
  createDashboard,
  listDashboards,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
  createShareLink,
  getShareLinkStatus,
  disableShareLink,
  getSharedDashboard,
  getSharedChartData,
  generateDashboardReportSnapshot,
  // Local dataset row reader / query evaluator (used by chart data endpoints,
  // the embed service, the collaboration share links and report snapshots).
  QUERY_LIMITS,
  ALLOWED_FILTER_OPERATORS,
  FILTER_OPERATOR_ALIASES,
  ALLOWED_AGGREGATIONS,
  validateSqlIdentifier,
  getDatasetRows,
  getDatasetColumns,
  resolveUserRlsFilters,
  executeLocalDatasetQuery,
  loadDatasetForQuery
} from './dashboard.service.js';
export type {
  DashboardRequestContext,
  SafeDashboardSource,
  DashboardReportSnapshot,
  DatasetSecurityContext,
  DatasetQuerySource,
  LocalFilterOperator,
  LocalAggregationFunction
} from './dashboard.service.js';

export {
  createDashboardAccessSchema,
  updateDashboardAccessSchema,
  searchRecipientsQuerySchema,
  idIdentifierSchema,
  getDashboardWorkspaceId,
  resolveWorkspaceAccess,
  resolveTargetWorkspaceId,
  verifyResourceWorkspaceAccess,
  evaluateEffectiveAccess,
  listDashboardAccess,
  createDashboardAccess,
  updateDashboardAccess,
  revokeDashboardAccess,
  getAvailableRecipients,
  registerInMemoryWorkspaceMember,
  clearInMemoryWorkspaceMembers
} from './dashboard-access.service.js';
export type {
  WorkspaceAction,
  WorkspaceAccessContext,
  EffectiveAccess,
  DashboardAuthContext,
  AuditTrail,
  DashboardAccessListResult,
  AvailableRecipientsResult
} from './dashboard-access.service.js';

export {
  createDashboardVersionSnapshot,
  listDashboardVersions,
  getDashboardVersion,
  compareDashboardVersions,
  restoreDashboardVersion,
  resolveDashboardForVersioning,
  registerInMemoryVersionDashboard,
  clearInMemoryVersionDashboards,
  registerInMemoryDashboardVersion,
  clearInMemoryDashboardVersions
} from './dashboard-version.service.js';
export type {
  DashboardVersionRecord,
  VersionComparisonResult,
  DashboardChartSnapshot,
  RestoreDashboardVersionResult,
  ResolvedDashboardForVersioning,
  VersionAuthor
} from './dashboard-version.service.js';

export {
  createEmbedConfigSchema,
  createOrUpdateDashboardEmbed,
  getDashboardEmbedStatus,
  revokeDashboardEmbed,
  resolveEmbedTokenDashboard,
  getPublicEmbedDashboard,
  getPublicEmbedChartData,
  registerInMemoryEmbed,
  clearInMemoryEmbeds,
  findDatasetById
} from './dashboard-embed.service.js';
export type {
  StoredEmbedConfig,
  EmbedRequestHeaders,
  EmbedUpsertResult,
  EmbedStatusPayload,
  ResolvedEmbedDashboard
} from './dashboard-embed.service.js';
