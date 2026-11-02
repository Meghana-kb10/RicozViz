// ============================================================
// Worker Job Runner with Retries & Exponential Backoff
// ============================================================

import crypto from 'crypto';
import mongoose from 'mongoose';
import { WorkerRunModel } from '@repo/database';
import type { WorkerRunStatus, TriggerJobResult } from '@repo/types';
import { logger } from '../../utils/logger.js';
import {
  acquireWorkerLock,
  createLockHeartbeat,
  releaseWorkerLock
} from './worker-lock.service.js';

export interface JobExecutionOptions {
  leaseDurationMs?: number;
  maxAttempts?: number;
  initialBackoffMs?: number;
  backoffFactor?: number;
  owner?: string;
}

export interface InMemoryWorkerRunRecord {
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: WorkerRunStatus;
  attempt: number;
  itemsProcessed: number;
  error: string | null;
  durationMs: number | null;
}

const inMemoryRuns: InMemoryWorkerRunRecord[] = [];

export function getInMemoryRuns(): InMemoryWorkerRunRecord[] {
  return [...inMemoryRuns];
}

export function clearInMemoryRuns(): void {
  inMemoryRuns.length = 0;
}

/**
 * Runs a background task protected by a distributed lease.
 * Supports exponential backoff retries and writes an audit log in WorkerRun.
 */
export async function runJobWithDistributedLock<T = unknown>(
  jobName: string,
  handler: (attempt: number) => Promise<{ itemsProcessed?: number; result?: T }>,
  options: JobExecutionOptions = {}
): Promise<TriggerJobResult> {
  const {
    leaseDurationMs = 30_000,
    maxAttempts = 3,
    initialBackoffMs = 500,
    backoffFactor = 2,
    owner = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`
  } = options;

  // 1. Try to acquire the lease
  const acquired = await acquireWorkerLock(jobName, owner, leaseDurationMs);
  if (!acquired) {
    logger.debug('[WorkerRunner] Lock acquisition skipped (already running by another instance)', {
      jobName,
      owner
    });
    return {
      jobName,
      status: 'SKIPPED',
      attempt: 0,
      itemsProcessed: 0
    };
  }

  // Start heartbeat renewal
  const cancelHeartbeat = createLockHeartbeat(jobName, owner, leaseDurationMs);

  const startedAt = new Date();
  let workerRunDocId: mongoose.Types.ObjectId | null = null;
  let inMemoryRunIndex = -1;

  // Create initial RUNNING record
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await WorkerRunModel.create({
        jobName,
        startedAt,
        status: 'RUNNING',
        attempt: 1,
        itemsProcessed: 0,
        error: null,
        durationMs: null
      });
      workerRunDocId = doc._id;
    } catch (err) {
      logger.warn('[WorkerRunner] Failed to persist initial WorkerRun', {
        jobName,
        error: String(err)
      });
    }
  } else {
    inMemoryRunIndex = inMemoryRuns.length;
    inMemoryRuns.push({
      jobName,
      startedAt,
      finishedAt: null,
      status: 'RUNNING',
      attempt: 1,
      itemsProcessed: 0,
      error: null,
      durationMs: null
    });
  }

  try {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { itemsProcessed = 0 } = await handler(attempt);
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();

        // Update run as SUCCESS
        if (workerRunDocId) {
          await WorkerRunModel.findByIdAndUpdate(workerRunDocId, {
            status: 'SUCCESS',
            finishedAt,
            durationMs,
            itemsProcessed,
            attempt
          });
        }
        if (inMemoryRunIndex >= 0 && inMemoryRuns[inMemoryRunIndex]) {
          inMemoryRuns[inMemoryRunIndex] = {
            ...inMemoryRuns[inMemoryRunIndex],
            status: 'SUCCESS',
            finishedAt,
            durationMs,
            itemsProcessed,
            attempt
          };
        }

        return {
          jobName,
          status: 'SUCCESS',
          attempt,
          itemsProcessed,
          durationMs
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn('[WorkerRunner] Job attempt failed', {
          jobName,
          attempt,
          maxAttempts,
          error: lastError.message
        });

        if (attempt < maxAttempts) {
          // Exponential backoff with small random jitter
          const jitter = Math.floor(Math.random() * 100);
          const backoffDelay = Math.floor(initialBackoffMs * Math.pow(backoffFactor, attempt - 1)) + jitter;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retry attempts exhausted — mark as FAILED
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const errorMessage = lastError?.message || 'Unknown worker job failure';

    if (workerRunDocId) {
      await WorkerRunModel.findByIdAndUpdate(workerRunDocId, {
        status: 'FAILED',
        finishedAt,
        durationMs,
        attempt: maxAttempts,
        error: errorMessage
      });
    }
    if (inMemoryRunIndex >= 0 && inMemoryRuns[inMemoryRunIndex]) {
      inMemoryRuns[inMemoryRunIndex] = {
        ...inMemoryRuns[inMemoryRunIndex],
        status: 'FAILED',
        finishedAt,
        durationMs,
        attempt: maxAttempts,
        error: errorMessage
      };
    }

    return {
      jobName,
      status: 'FAILED',
      attempt: maxAttempts,
      itemsProcessed: 0,
      durationMs,
      error: errorMessage
    };
  } finally {
    // Stop heartbeat and release distributed lock
    cancelHeartbeat();
    await releaseWorkerLock(jobName, owner);
  }
}
