/**
 * Platform Admin Tenants API
 */

import { adminApiFetch } from './admin-client.js';
import type {
  AdminTenantListQueryInput,
  AdminTenantPlanUpdateInput,
  AdminTenantSuspendInput
} from '@repo/validation';

export interface AdminTenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  memberCount: number;
  workspaceCount: number;
  datasetCount: number;
  dashboardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTenantListResponse {
  tenants: AdminTenantItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function apiAdminListTenants(
  query: Partial<AdminTenantListQueryInput> = {}
): Promise<AdminTenantListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  return adminApiFetch<AdminTenantListResponse>(`/admin/tenants${qs ? `?${qs}` : ''}`, {
    method: 'GET'
  });
}

export async function apiAdminGetTenant(id: string): Promise<AdminTenantItem> {
  return adminApiFetch<AdminTenantItem>(`/admin/tenants/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
}

export async function apiAdminSuspendTenant(
  id: string,
  input: AdminTenantSuspendInput
): Promise<{ message: string; tenant: AdminTenantItem }> {
  return adminApiFetch<{ message: string; tenant: AdminTenantItem }>(
    `/admin/tenants/${encodeURIComponent(id)}/suspend`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export async function apiAdminUnsuspendTenant(
  id: string,
  input: AdminTenantSuspendInput
): Promise<{ message: string; tenant: AdminTenantItem }> {
  return adminApiFetch<{ message: string; tenant: AdminTenantItem }>(
    `/admin/tenants/${encodeURIComponent(id)}/unsuspend`,
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
}

export async function apiAdminUpdateTenantPlan(
  id: string,
  input: AdminTenantPlanUpdateInput
): Promise<{ message: string; tenant: AdminTenantItem }> {
  return adminApiFetch<{ message: string; tenant: AdminTenantItem }>(
    `/admin/tenants/${encodeURIComponent(id)}/plan`,
    {
      method: 'PUT',
      body: JSON.stringify(input)
    }
  );
}
