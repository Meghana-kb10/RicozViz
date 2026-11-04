/**
 * Platform Admin API client barrel
 */

export {
  configureAdminApi,
  getAdminApiBaseUrl,
  getAdminSessionCookieName,
  AdminApiError,
  getAdminAccessToken,
  setAdminAccessToken,
  clearAdminAccessToken,
  setAdminRefreshHandler,
  adminApiFetch,
  apiAdminLogin,
  apiAdminRefresh,
  apiAdminLogout,
  apiAdminEnrollTotp,
  apiAdminVerifyTotp,
  apiAdminRegenerateBackupCodes,
  apiAdminListSessions,
  apiAdminRevokeSession,
  apiAdminChangePassword,
  type AdminAuthUser,
  type AdminAuthResult,
  type AdminSessionItem
} from './admin-client.js';

export {
  apiAdminListTenants,
  apiAdminGetTenant,
  apiAdminSuspendTenant,
  apiAdminUnsuspendTenant,
  apiAdminUpdateTenantPlan,
  type AdminTenantItem,
  type AdminTenantListResponse
} from './tenants.js';

export {
  apiAdminListUsers,
  apiAdminGetUser,
  apiAdminDisableUser,
  apiAdminEnableUser,
  apiAdminSetUserStatus,
  apiAdminForceLogoutUser,
  apiAdminImpersonateUser,
  type AdminUserItem,
  type AdminUserListResponse,
  type ImpersonationResult
} from './users.js';

export {
  apiAdminListWorkerRuns,
  apiAdminGetWorkerHealth,
  apiAdminTriggerWorkerJob,
  type AdminWorkerRunsResponse
} from './workers.js';

export {
  apiAdminListAuditLogs,
  apiAdminVerifyAuditChain,
  type AdminAuditLogEntry,
  type AdminAuditListResponse,
  type AdminAuditVerifyResponse
} from './audit.js';

export {
  apiAdminGetSystemHealth,
  apiAdminGetAiUsageSummary,
  apiAdminListFeatureFlags,
  apiAdminUpsertFeatureFlag,
  apiAdminDeleteFeatureFlag,
  type AdminSystemHealth,
  type AdminAiUsageSummary,
  type AdminFeatureFlag
} from './system.js';
