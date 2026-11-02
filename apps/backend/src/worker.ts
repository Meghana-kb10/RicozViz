// ============================================================
// RicozViz Standalone Background Worker Daemon
// ============================================================
// Runs background tasks (dataset refreshes, smart data alerts,
// scheduled PDF reports) with distributed MongoDB lease locking.
// The main API server no longer runs background cron timers.
// ============================================================

import http from 'http';
import crypto from 'crypto';
import { connectDatabase, disconnectDatabase } from '@repo/database';
import { logger } from '@repo/utils';
import { config } from './config/env.js';
import { scheduledReportWorker } from './modules/ricozviz/report/index.js';
import { scheduledAlertWorker } from './modules/ricozviz/alert/index.js';
import { scheduledRefreshWorker } from './modules/ricozviz/dataset/index.js';
import {
  registerWorkerJob,
  setWorkerIdentity,
  getWorkerHealthStatus
} from './modules/worker/index.js';

const { mongodbUri, mongodbDbName, env } = config;
const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS || 60_000);
const WORKER_HEALTH_PORT = Number(process.env.WORKER_HEALTH_PORT || 3010);

const workerId = `worker-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
setWorkerIdentity(workerId);

let healthServer: http.Server | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

async function bootstrapWorker(): Promise<void> {
  logger.info(`[Worker] Starting RicozViz background worker [${workerId}] (env: ${env})`);

  try {
    // 1. Connect database
    try {
      await connectDatabase({ uri: mongodbUri, dbName: mongodbDbName });
      logger.info('[Worker] Connected to MongoDB via Mongoose');
    } catch (dbError) {
      logger.warn(
        `[Worker] MongoDB connection warning: ${dbError instanceof Error ? dbError.message : dbError}`
      );
    }

    // 2. Register runnable jobs in worker job registry (for triggerJob / admin API)
    registerWorkerJob('scheduled-dataset-refresh', async () => {
      const summary = await scheduledRefreshWorker.executeDueRefreshes();
      return { itemsProcessed: summary.processed };
    });

    registerWorkerJob('scheduled-smart-alerts', async () => {
      const summary = await scheduledAlertWorker.executeDueAlerts();
      return { itemsProcessed: summary.processed };
    });

    registerWorkerJob('scheduled-reports', async () => {
      const summary = await scheduledReportWorker.executeDueReports();
      return { itemsProcessed: summary.processed };
    });

    // 3. Start workers with distributed locking lease
    scheduledRefreshWorker.start(WORKER_INTERVAL_MS);
    scheduledAlertWorker.start(WORKER_INTERVAL_MS);
    scheduledReportWorker.start(WORKER_INTERVAL_MS);
    logger.info(`[Worker] Background automation & monitoring workers started (interval: ${WORKER_INTERVAL_MS}ms)`);

    // 4. Start lightweight HTTP health server
    try {
      healthServer = http.createServer(async (req, res) => {
        if (req.url === '/health' || req.url === '/') {
          try {
            const health = await getWorkerHealthStatus();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health));
          } catch {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', workerId }));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      healthServer.listen(WORKER_HEALTH_PORT, () => {
        logger.info(`[Worker] Health listener online at http://localhost:${WORKER_HEALTH_PORT}/health`);
      });

      healthServer.on('error', (err) => {
        logger.warn(`[Worker] Health server port ${WORKER_HEALTH_PORT} unavailable (${err.message}). Continuing.`);
        healthServer = null;
      });
    } catch (err) {
      logger.warn('[Worker] Could not initialize health server', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // 5. Periodic worker heartbeat log
    heartbeatTimer = setInterval(async () => {
      try {
        const health = await getWorkerHealthStatus();
        logger.info(`[Worker Heartbeat] ${health.workerId} - activeJobs: ${health.activeJobs.length}, uptime: ${health.uptimeSeconds}s`);
      } catch {
        // Ignore
      }
    }, 60_000);

    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }

    // 6. Graceful shutdown handler
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`[Worker] Received ${signal}, initiating graceful shutdown...`);
        try {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          scheduledReportWorker.stop();
          scheduledAlertWorker.stop();
          scheduledRefreshWorker.stop();

          if (healthServer) {
            await new Promise<void>((resolve) => healthServer?.close(() => resolve()));
          }

          await disconnectDatabase();
          logger.info('[Worker] Graceful shutdown completed cleanly');
          process.exit(0);
        } catch (err) {
          logger.error('[Worker] Error during shutdown', {
            error: err instanceof Error ? err.message : String(err)
          });
          process.exit(1);
        }
      });
    }

    process.on('unhandledRejection', (reason) => {
      logger.error('[Worker] Unhandled promise rejection', { reason: String(reason) });
    });

    process.on('uncaughtException', (error) => {
      logger.error('[Worker] Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error('[Worker] Fatal error during bootstrap', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

void bootstrapWorker();
