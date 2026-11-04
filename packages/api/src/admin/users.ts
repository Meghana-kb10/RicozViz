/**
 * Platform Admin Users API
 */

import { adminApiFetch } from './admin-client.js';
import type { AdminUserListQueryInput, AdminUserStatusUpdateInput } from '@repo/validation';

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
  organizationCount?: number;
  memberships?: Array<{
    organizationId: string;
    status: string;
    roleId?: string;
  }>;
}

export interface AdminUserListResponse {
  users: AdminUserItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImpersonationResult {
  impersonationToken: string;
  readOnly: boolean;
  expiresInMinutes: number;
  targetUser: {
    id: string;
    email: string;
    name: string;
  };
}

export async function apiAdminListUsers(
  query: Partial<AdminUserListQueryInput> = {}
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.status) params.set('status', query.status);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  return adminApiFetch<AdminUserListResponse>(`/admin/users${qs ? `?${qs}` : ''}`, {
    method: 'GET'
  });
}

export async function apiAdminGetUser(id: string): Promise<AdminUserItem> {
  return adminApiFetch<AdminUserItem>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
}

export async function apiAdminDisableUser(
  id: string,
  input?: { reason?: string }
): Promise<{ message: string; user: AdminUserItem }> {
  return adminApiFetch<{ message: string; user: AdminUserItem }>(
    `/admin/users/${encodeURIComponent(id)}/disable`,
    {
      method: 'POST',
      body: JSON.stringify(input || {})
    }
  );
}

export async function apiAdminEnableUser(
  id: string,
  input?: { reason?: string }
): Promise<{ message: string; user: AdminUserItem }> {
  return adminApiFetch<{ message: string; user: AdminUserItem }>(
    `/admin/users/${encodeURIComponent(id)}/enable`,
    {
      method: 'POST',
      body: JSON.stringify(input || {})
    }
  );
}

export async function apiAdminSetUserStatus(
  id: string,
  input: AdminUserStatusUpdateInput
): Promise<{ message: string; user: AdminUserItem }> {
  const endpoint = input.status === 'ACTIVE' ? 'enable' : 'disable';
  return adminApiFetch<{ message: string; user: AdminUserItem }>(
    `/admin/users/${encodeURIComponent(id)}/${endpoint}`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export async function apiAdminForceLogoutUser(id: string): Promise<{ message: string }> {
  return adminApiFetch<{ message: string }>(
    `/admin/users/${encodeURIComponent(id)}/force-logout`,
    {
      method: 'POST'
    }
  );
}

export async function apiAdminImpersonateUser(
  id: string,
  input?: { reason?: string }
): Promise<ImpersonationResult> {
  return adminApiFetch<ImpersonationResult>(
    `/admin/users/${encodeURIComponent(id)}/impersonate`,
    {
      method: 'POST',
      body: JSON.stringify(input || {})
    }
  );
}
