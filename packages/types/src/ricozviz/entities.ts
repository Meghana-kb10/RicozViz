import type { UserSummary } from './common';
import type {
  DataSourceConnectorType,
  DataSourceDisplayStatus,
  MembershipStatus,
  OrganizationStatus,
  UserStatus,
  WorkspaceRole
} from './enums';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: UserStatus | string;
  createdAt: string;
}

/**
 * Legacy aliases. The migrated pages import these original names, so they must
 * keep resolving even though the domain layer renamed the concepts.
 */
export type UserData = UserProfile;

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  status?: OrganizationStatus | string;
}

/** Legacy alias — see `UserData`. */
export type OrganizationData = OrganizationProfile;

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export interface PermissionSummary {
  id: string;
  key: string;
  description: string | null;
}

export interface WorkspaceMemberData {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: string;
  user: UserProfile;
}

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberData {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  status: MembershipStatus;
  joinedAt: string;
  user: UserProfile;
}

export interface DataSourceData {
  id: string;
  workspaceId?: string | null;
  name: string;
  description: string | null;
  type: DataSourceConnectorType;
  status: DataSourceDisplayStatus;
  connection: Record<string, unknown>;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  success: boolean;
  status: 'CONNECTED' | 'FAILED';
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditLogItem {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  status: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  user?: UserProfile;
  workspace?: { id: string; name: string; slug: string } | null;
}

export interface QueryAuditLogsParams {
  workspaceId?: string;
  action?: string;
  resourceType?: string;
  userId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QueryAuditLogsResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditLogItem[];
}

export interface AuditLogStatsResponse {
  total: number;
  successCount: number;
  failureCount: number;
  recentLogs: AuditLogItem[];
}