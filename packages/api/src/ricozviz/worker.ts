import { apiFetch, toQueryString } from './client.js';

export interface WorkerRunItem {
  id: string;
  jobName: string;
  startedAt: string;
  finishedAt?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  attempt: number;
  itemsProcessed?: number;
  error?: string;
  durationMs?: number;
  createdAt: string;
}

export interface ListWorkerRunsParams {
  jobName?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListWorkerRunsResponse {
  runs: WorkerRunItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkerHealthResponse {
  status: 'UP' | 'DOWN';
  activeWorkers: number;
  activeLocks: Array<{
    jobName: string;
    owner: string;
    expiresAt: string;
    acquiredAt: string;
  }>;
  timestamp: string;
}

export interface TriggerWorkerJobResponse {
  success: boolean;
  jobName: string;
  message: string;
  dispatchedAt: string;
}

/** List historical and running worker executions */
export async function apiListWorkerRuns(
  params?: ListWorkerRunsParams
): Promise<ListWorkerRunsResponse> {
  const query = toQueryString({
    jobName: params?.jobName,
    status: params?.status,
    limit: params?.limit,
    offset: params?.offset,
  });
  return apiFetch<ListWorkerRunsResponse>(`/admin/workers/runs${query}`);
}

/** Trigger an on-demand background worker execution */
export async function apiTriggerWorkerJob(
  jobName: string
): Promise<TriggerWorkerJobResponse> {
  return apiFetch<TriggerWorkerJobResponse>('/admin/workers/trigger', {
    method: 'POST',
    body: JSON.stringify({ jobName }),
  });
}

/** Check background worker subsystem health and active leases */
export async function apiGetWorkerHealth(): Promise<WorkerHealthResponse> {
  return apiFetch<WorkerHealthResponse>('/admin/workers/health');
}
