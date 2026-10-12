/**
 * Governance and Security Badges API client.
 *
 * Provides typed endpoints for querying enterprise security attestations,
 * cryptographic verification proofs, and platform compliance posture.
 */

import { apiFetch } from './client.js';
import type {
  SecurityBadge,
  GovernancePosture,
  VerifyBadgeResult,
  RlsPoliciesCatalogResponse,
  RlsSimulationRequest,
  RlsSimulationResult
} from '@repo/types';

export async function apiGetGovernanceBadges(params?: { category?: string }): Promise<SecurityBadge[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  const qs = q.toString();
  return apiFetch<SecurityBadge[]>(`/api/v1/governance/badges${qs ? `?${qs}` : ''}`);
}

export async function apiGetGovernanceBadge(badgeId: string): Promise<SecurityBadge> {
  return apiFetch<SecurityBadge>(`/api/v1/governance/badges/${badgeId}`);
}

export async function apiVerifyGovernanceBadge(badgeId: string): Promise<VerifyBadgeResult> {
  return apiFetch<VerifyBadgeResult>(`/api/v1/governance/badges/${badgeId}/verify`);
}

export async function apiGetGovernancePosture(): Promise<GovernancePosture> {
  return apiFetch<GovernancePosture>('/api/v1/governance/posture');
}

export async function apiGetRlsPolicies(): Promise<RlsPoliciesCatalogResponse> {
  return apiFetch<RlsPoliciesCatalogResponse>('/api/v1/governance/rls/policies');
}

export async function apiSimulateRls(params: RlsSimulationRequest): Promise<RlsSimulationResult> {
  return apiFetch<RlsSimulationResult>('/api/v1/governance/rls/simulate', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

