// ============================================================
// Worker Administration & Management Service
// ============================================================

import mongoose from 'mongoose';
import { WorkerRunModel, WorkerLockModel } from '@repo/database';
import type {
  WorkerRunFilter,
  TriggerJobResult,
  WorkerHealthStatus
} from '@repo/types';
import {
  runJobWithDistributedLock,
  getInMemoryRuns,
  type JobExecutionOptions
} from './worker-runner.service.js';

type JobHandler = (attempt: number) => Promise<{ itemsProcessed?: number }>;

interface RegisteredJob {
  handler: JobHandler;
  options?: JobExecutionOptions;
}

const jobRegistry = new Map<string, RegisteredJob>();
let workerStartTime = Date.now();
let currentWorkerId = `worker-${process.pid}`;

export function setWorkerIdentity(workerId: string): void {
  currentWorkerId = workerId;
  workerStartTime = Date.now();
}

/**
 * Register a job handler that can be executed on-schedule or triggered via API.
 */
export function registerWorkerJob(
  jobName: string,
  handler: JobHandler,
  options?: JobExecutionOptions
): void {
  jobRegistry.set(jobName, { handler, options });
}

export function getRegisteredJobNames(): string[] {
  return Array.from(jobRegistry.keys());
}

/**
 * Lists historical worker runs with pagination and filtering.
 */
export async function listWorkerRuns(
  filter: WorkerRunFilter = {}
): Promise<{ runs: unknown[]; total: number }> {
  const { jobName, status, limit = 50, skip = 0 } = filter;

  if (mongoose.connection.readyState !== 1) {
    let runs = getInMemoryRuns();
    if (jobName) {
      runs = runs.filter((r) => r.jobName === jobName);
    }
    if (status) {
      runs = runs.filter((r) => r.status === status);
    }
    const total = runs.length;
    const paginated = runs.slice(skip, skip + limit);
    return { runs: paginated, total };
  }

  const query: Record<string, unknown> = {};
  if (jobName) {
    query.jobName = jobName;
  }
  if (status) {
    query.status = status;
  }

  const [runs, total] = await Promise.all([
    WorkerRunModel.find(query)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WorkerRunModel.countDocuments(query)
  ]);

  return { runs, total };
}

/**
 * Triggers execution of a registered job immediately through distributed locking.
 */
export async function triggerJob(
  jobName: string,
  owner?: string
): Promise<TriggerJobResult> {
  const registered = jobRegistry.get(jobName);
  if (!registered) {
    throw new Error(`Worker job '${jobName}' is not registered`);
  }

  return runJobWithDistributedLock(
    jobName,
    registered.handler,
    {
      ...registered.options,
      ...(owner ? { owner } : {})
    }
  );
}

/**
 * Inspects worker health, active locks, and registration state.
 */
export async function getWorkerHealthStatus(): Promise<WorkerHealthStatus> {
  const activeJobs = getRegisteredJobNames();
  let locksHeld = 0;

  if (mongoose.connection.readyState === 1) {
    try {
      locksHeld = await WorkerLockModel.countDocuments({
        expiresAt: { $gt: new Date() }
      });
    } catch {
      // Ignore
    }
  }

  return {
    status: 'healthy',
    workerId: currentWorkerId,
    activeJobs,
    uptimeSeconds: Math.floor((Date.now() - workerStartTime) / 1000),
    lastHeartbeat: new Date().toISOString(),
    locksHeld
  };
}
