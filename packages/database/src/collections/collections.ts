/**
 * MongoDB collection names.
 *
 * Values match the `@@map(...)` names used by the legacy Prisma schema so any
 * existing RicozViz dataset can be imported without renaming documents.
 */
export const COLLECTIONS = {
  // ---- Core template collections ----
  USERS: 'users',
  PRODUCTS: 'products',
  SESSIONS: 'sessions',

  // ---- Identity & tenancy ----
  ORGANIZATIONS: 'organizations',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  ROLE_PERMISSIONS: 'role_permissions',
  ORGANIZATION_MEMBERS: 'organization_members',
  WORKSPACES: 'workspaces',
  WORKSPACE_MEMBERS: 'workspace_members',
  REFRESH_TOKENS: 'refresh_tokens',
  CREDENTIAL_VAULT: 'credential_vault',

  // ---- Data layer ----
  DATA_SOURCES: 'data_sources',
  DATASETS: 'datasets',
  DATASET_COLUMNS: 'dataset_columns',
  DATASET_VERSIONS: 'dataset_versions',
  ROW_LEVEL_SECURITY_RULES: 'row_level_security_rules',

  // ---- Presentation layer ----
  DASHBOARDS: 'dashboards',
  DASHBOARD_VERSIONS: 'dashboard_versions',
  DASHBOARD_ACCESS: 'dashboard_access',
  CHARTS: 'charts',
  DASHBOARD_TEMPLATES: 'dashboard_templates',

  // ---- Automation & governance ----
  REPORTS: 'reports',
  REPORT_EXECUTIONS: 'report_executions',
  METRICS: 'metrics',
  ALERTS: 'alerts',
  ALERT_HISTORY: 'alert_history',
  EXPORT_JOBS: 'export_jobs',
  AUDIT_LOGS: 'audit_logs',
  AI_USAGE: 'ai_usage',
  WORKER_LOCKS: 'worker_locks',
  WORKER_RUNS: 'worker_runs',
  WS_TICKETS: 'ws_tickets'
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Every RicozViz collection name in a stable order (used by seed + health checks). */
export const RICOZVIZ_COLLECTIONS: readonly CollectionName[] = [
  COLLECTIONS.ORGANIZATIONS,
  COLLECTIONS.ROLES,
  COLLECTIONS.PERMISSIONS,
  COLLECTIONS.ROLE_PERMISSIONS,
  COLLECTIONS.ORGANIZATION_MEMBERS,
  COLLECTIONS.WORKSPACES,
  COLLECTIONS.WORKSPACE_MEMBERS,
  COLLECTIONS.DATA_SOURCES,
  COLLECTIONS.DATASETS,
  COLLECTIONS.DATASET_COLUMNS,
  COLLECTIONS.DATASET_VERSIONS,
  COLLECTIONS.ROW_LEVEL_SECURITY_RULES,
  COLLECTIONS.DASHBOARDS,
  COLLECTIONS.DASHBOARD_VERSIONS,
  COLLECTIONS.DASHBOARD_ACCESS,
  COLLECTIONS.CHARTS,
  COLLECTIONS.DASHBOARD_TEMPLATES,
  COLLECTIONS.REPORTS,
  COLLECTIONS.REPORT_EXECUTIONS,
  COLLECTIONS.METRICS,
  COLLECTIONS.ALERTS,
  COLLECTIONS.ALERT_HISTORY,
  COLLECTIONS.EXPORT_JOBS,
  COLLECTIONS.AUDIT_LOGS,
  COLLECTIONS.AI_USAGE,
  COLLECTIONS.WORKER_LOCKS,
  COLLECTIONS.WORKER_RUNS,
  COLLECTIONS.WS_TICKETS
] as const;
