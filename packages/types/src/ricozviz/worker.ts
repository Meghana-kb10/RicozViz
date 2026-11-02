// ============================================================
// Worker Subsystem Domain Types
// ============================================================

export type WorkerRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface WorkerLock {
  id?: string;
  jobName: string;
  owner: string;
  acquiredAt: string | Date;
  expiresAt: string | Date;
  lastHeartbeatAt?: string | Date;
}

export interface WorkerRun {
  id?: string;
  jobName: string;
  startedAt: string | Date;
  finishedAt?: string | Date | null;
  status: WorkerRunStatus;
  attempt: number;
  itemsProcessed: number;
  error?: string | null;
  durationMs?: number | null;
}

export interface WorkerRunFilter {
  jobName?: string;
  status?: WorkerRunStatus;
  limit?: number;
  skip?: number;
}

export interface TriggerJobResult {
  jobName: string;
  status: WorkerRunStatus;
  attempt: number;
  itemsProcessed: number;
  durationMs?: number;
  error?: string;
}

export interface WorkerHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  workerId: string;
  activeJobs: string[];
  uptimeSeconds: number;
  lastHeartbeat: string;
  locksHeld: number;
}
