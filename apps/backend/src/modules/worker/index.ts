// ============================================================
// Worker Module Barrel
// ============================================================

export {
  acquireWorkerLock,
  renewWorkerLock,
  releaseWorkerLock,
  createLockHeartbeat,
  clearInMemoryLocks
} from './worker-lock.service.js';

export {
  runJobWithDistributedLock,
  getInMemoryRuns,
  clearInMemoryRuns,
  type JobExecutionOptions,
  type InMemoryWorkerRunRecord
} from './worker-runner.service.js';

export {
  registerWorkerJob,
  getRegisteredJobNames,
  listWorkerRuns,
  triggerJob,
  getWorkerHealthStatus,
  setWorkerIdentity
} from './worker-admin.service.js';
