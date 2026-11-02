/**
 * Platform Admin System Governance & Feature Flags API
 */

import { adminApiFetch } from './admin-client.js';
import type { AdminFeatureFlagUpsertInput } from '@repo/validation';

export interface AdminSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    status: string;
    readyState: number;
  };
  worker: {
    status: string;
    locksHeld: number;
    activeJobs: string[];
    uptimeSeconds: number;
  };
  uptime: number;
  timestamp: string;
}

export interface AdminAiUsageSummary {
  totalRequests: number;
  totalTokens: number;
  estimatedCostUsd: number;
  byTenant: Array<{
    tenantId: string;
    requestCount: number;
    totalTokens: number;
    costUsd: number;
  }>;
}

export interface AdminFeatureFlag {
  id: string;
  key: string;
  description?: string;
  enabled: boolean;
  tenantOverrides?: Array<{
    tenantId: string;
    enabled: boolean;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export async function apiAdminGetSystemHealth(): Promise<AdminSystemHealth> {
  return adminApiFetch<AdminSystemHealth>('/admin/system/health', {
    method: 'GET'
  });
}

export async function apiAdminGetAiUsageSummary(): Promise<AdminAiUsageSummary> {
  return adminApiFetch<AdminAiUsageSummary>('/admin/system/ai-usage', {
    method: 'GET'
  });
}

export async function apiAdminListFeatureFlags(): Promise<AdminFeatureFlag[]> {
  return adminApiFetch<AdminFeatureFlag[]>('/admin/system/flags', {
    method: 'GET'
  });
}

export async function apiAdminUpsertFeatureFlag(
  input: AdminFeatureFlagUpsertInput
): Promise<AdminFeatureFlag> {
  return adminApiFetch<AdminFeatureFlag>('/admin/system/flags', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiAdminDeleteFeatureFlag(key: string): Promise<{ message: string }> {
  return adminApiFetch<{ message: string }>(`/admin/system/flags/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
}
