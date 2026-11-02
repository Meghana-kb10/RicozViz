import { createApiResponse, createApiError, HttpClient } from './http.js';
import { BrowserTokenStorage, MemoryTokenStorage, defaultTokenStorage } from './storage.js';
import { AuthClient } from './modules/auth.js';
import { UsersClient } from './modules/users.js';
import { ProductsClient } from './modules/products.js';
import { HealthClient } from './modules/health.js';
import { ApiClient, createApiClient } from './client.js';

export const API_ROUTES = {
  HEALTH: '/api/health',
  USERS: '/api/users',
  PRODUCTS: '/api/products',
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout'
  }
} as const;

// Explicit named exports for Node.js ESM / tsx static resolution
export {
  createApiResponse,
  createApiError,
  HttpClient,
  BrowserTokenStorage,
  MemoryTokenStorage,
  defaultTokenStorage,
  AuthClient,
  UsersClient,
  ProductsClient,
  HealthClient,
  ApiClient,
  createApiClient
};

// Explicit named type exports re-exported from './types'
export type {
  TokenStorage,
  RequestOptions,
  ApiClientOptions,
  ApiResponse,
  HealthStatus,
  Product,
  User,
  AuthTokens,
  AuthResponse,
  RegisterRequestInput,
  LoginRequestInput,
  ForgotPasswordRequestInput,
  CreateUserRequestInput,
  UpdateUserRequestInput,
  UserQueryInput,
  CreateProductRequestInput,
  ProductQueryInput
} from './types.js';

export const api = createApiClient();

// ============================================================================
// RicozViz API surface
// ============================================================================
// The migrated RicozViz client. Unlike the template demo client above (which
// speaks the generic `{ success, data, timestamp }` envelope through
// `ApiClient`), these functions speak the RicozViz contract directly and
// unwrap `{ success, data }` for the caller.

// ---- Transport ----
export {
  getApiBaseUrl,
  configureRicozVizApi,
  ApiError,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  apiFetch,
  toQueryString,
  setOnAuthFailure,
  triggerAuthFailure,
  executeRicozVizRefresh,
  type AuthFailureHandler
} from './ricozviz/client.js';

// ---- Endpoints ----
export {
  apiRegister,
  apiLogin,
  apiMe,
  apiRefresh,
  apiLogout
} from './ricozviz/auth.js';

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
} from './ricozviz/workspace.js';

export {
  apiListDataSources,
  apiGetDataSource,
  apiCreateDataSource,
  apiUpdateDataSource,
  apiDeleteDataSource,
  apiTestDataSourceConnection,
  apiTestRawConnection
} from './ricozviz/data-source.js';

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
} from './ricozviz/dataset.js';

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
  apiGetDashboardWsTicket,
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
} from './ricozviz/dashboard.js';

export {
  apiListCharts,
  apiGetChart,
  apiCreateChart,
  apiUpdateChart,
  apiDeleteChart
} from './ricozviz/chart.js';

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
} from './ricozviz/visualization.js';

export {
  apiCreateMetric,
  apiListMetrics,
  apiGetMetric,
  apiUpdateMetric,
  apiDeleteMetric,
  apiCalculateMetric
} from './ricozviz/metric.js';

export {
  apiCreateAlert,
  apiListAlerts,
  apiGetAlert,
  apiUpdateAlert,
  apiDeleteAlert,
  apiEvaluateAlert,
  apiClearAlert,
  apiEvaluateAllWorkspaceAlerts
} from './ricozviz/alert.js';

export { apiExportResource, apiListExportHistory } from './ricozviz/export.js';

export {
  apiListTemplates,
  apiGetTemplate,
  apiCreateTemplateFromDashboard,
  apiInstantiateDashboardFromTemplate
} from './ricozviz/template.js';

export {
  apiQueryAuditLogs,
  apiGetAuditLogStats,
  apiGetAuditTrailPreview,
  apiRevokeToken,
  apiVerifyLedgerChain
} from './ricozviz/audit.js';

export {
  apiAskDataAnalyst,
  apiNlToChart,
  apiGetInsights,
  apiGetDashboardSummary
} from './ricozviz/ai.js';

export {
  apiGetGovernanceBadges,
  apiGetGovernanceBadge,
  apiVerifyGovernanceBadge,
  apiGetGovernancePosture,
  apiGetRlsPolicies,
  apiSimulateRls,
  apiGetCisoAccreditations,
  apiGetCisoTrustPack
} from './ricozviz/governance.js';