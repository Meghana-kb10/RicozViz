// ============================================================
// Worker Distributed Lease Locking Service
// ============================================================
// Uses MongoDB atomic updates with TTL/expiration check and
// heartbeat extension so multiple worker instances never execute
// the same job concurrently.
// ============================================================

import mongoose from 'mongoose';
import { WorkerLockModel } from '@repo/database';
import { logger } from '../../utils/logger.js';

interface InMemoryLock {
  owner: string;
  expiresAt: number;
  acquiredAt: number;
  lastHeartbeatAt: number;
}

// In-memory fallback if Mongoose is offline / during isolated unit tests
const inMemoryLocks = new Map<string, InMemoryLock>();

export function clearInMemoryLocks(): void {
  inMemoryLocks.clear();
}

/**
 * Atomically acquires a distributed lease for `jobName`.
 * Returns true if the lease was acquired by `owner`, false otherwise.
 */
export async function acquireWorkerLock(
  jobName: string,
  owner: string,
  leaseDurationMs = 30_000
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);

  // Fallback if MongoDB is not connected
  if (mongoose.connection.readyState !== 1) {
    const existing = inMemoryLocks.get(jobName);
    if (!existing || existing.expiresAt <= now.getTime()) {
      inMemoryLocks.set(jobName, {
        owner,
        expiresAt: expiresAt.getTime(),
        acquiredAt: now.getTime(),
        lastHeartbeatAt: now.getTime()
      });
      return true;
    }
    return existing.owner === owner;
  }

  try {
    // 1. Try atomic update if existing lock has expired
    const updated = await WorkerLockModel.findOneAndUpdate(
      {
        jobName,
        expiresAt: { $lte: now }
      },
      {
        $set: {
          owner,
          acquiredAt: now,
          expiresAt,
          lastHeartbeatAt: now
        }
      },
      { new: true }
    );

    if (updated) {
      return true;
    }

    // 2. Try creating the lock document if none exists yet
    try {
      await WorkerLockModel.create({
        jobName,
        owner,
        acquiredAt: now,
        expiresAt,
        lastHeartbeatAt: now
      });
      return true;
    } catch (insertErr: unknown) {
      // Code 11000 = duplicate key error (another worker holds active lease)
      const errObj = insertErr as { code?: number; name?: string };
      if (errObj?.code === 11000 || errObj?.name === 'MongoServerError') {
        return false;
      }
      throw insertErr;
    }
  } catch (err) {
    logger.error('Failed to acquire worker lock', {
      jobName,
      owner,
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

/**
 * Renews an existing lease for `owner`, pushing `expiresAt` forward.
 */
export async function renewWorkerLock(
  jobName: string,
  owner: string,
  leaseDurationMs = 30_000
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);

  if (mongoose.connection.readyState !== 1) {
    const existing = inMemoryLocks.get(jobName);
    if (existing && existing.owner === owner) {
      existing.expiresAt = expiresAt.getTime();
      existing.lastHeartbeatAt = now.getTime();
      return true;
    }
    return false;
  }

  try {
    const res = await WorkerLockModel.updateOne(
      { jobName, owner },
      {
        $set: {
          expiresAt,
          lastHeartbeatAt: now
        }
      }
    );
    return (res.matchedCount ?? 0) > 0;
  } catch (err) {
    logger.warn('Failed to renew worker lock', {
      jobName,
      owner,
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

/**
 * Releases the distributed lease, allowing other workers to acquire immediately.
 */
export async function releaseWorkerLock(jobName: string, owner: string): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    const existing = inMemoryLocks.get(jobName);
    if (existing && existing.owner === owner) {
      inMemoryLocks.delete(jobName);
    }
    return;
  }

  try {
    await WorkerLockModel.deleteOne({ jobName, owner });
  } catch (err) {
    logger.warn('Failed to release worker lock', {
      jobName,
      owner,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * Starts a background interval to renew the lock until cancelled.
 */
export function createLockHeartbeat(
  jobName: string,
  owner: string,
  leaseDurationMs = 30_000
): () => void {
  const intervalMs = Math.max(1000, Math.floor(leaseDurationMs / 3));
  let isCancelled = false;

  const timer = setInterval(() => {
    if (isCancelled) return;
    void renewWorkerLock(jobName, owner, leaseDurationMs).catch(() => {});
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return () => {
    isCancelled = true;
    clearInterval(timer);
  };
}
