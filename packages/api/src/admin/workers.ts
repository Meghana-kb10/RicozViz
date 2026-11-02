/**
 * Platform Admin Workers API
 */

import { adminApiFetch } from './admin-client.js';
import type {
  WorkerRun,
  WorkerHealthStatus,
  TriggerJobResult,
  WorkerRunStatus
} from '@repo/types';

export interface AdminWorkerRunsResponse {
  runs: WorkerRun[];
  total: number;
}

export async function apiAdminListWorkerRuns(query: {
  jobName?: string;
  status?: WorkerRunStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminWorkerRunsResponse> {
  const params = new URLSearchParams();
  if (query.jobName) params.set('jobName', query.jobName);
  if (query.status) params.set('status', query.status);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));

  const qs = params.toString();
  return adminApiFetch<AdminWorkerRunsResponse>(`/admin/workers/runs${qs ? `?${qs}` : ''}`, {
    method: 'GET'
  });
}

export async function apiAdminGetWorkerHealth(): Promise<WorkerHealthStatus> {
  return adminApiFetch<WorkerHealthStatus>('/admin/workers/health', {
    method: 'GET'
  });
}

export async function apiAdminTriggerWorkerJob(jobName: string): Promise<TriggerJobResult> {
  return adminApiFetch<TriggerJobResult>('/admin/workers/trigger', {
    method: 'POST',
    body: JSON.stringify({ jobName })
  });
}
