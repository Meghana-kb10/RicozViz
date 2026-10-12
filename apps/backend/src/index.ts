import { connectDatabase, disconnectDatabase, ensureSystemRolesAndPermissions } from '@repo/database';
import { logger } from '@repo/utils';
import { config } from './config/env.js';
import { buildApp } from './app.js';

const { port, host, mongodbUri, mongodbDbName, env } = config;

// Background automation & monitoring workers (ported from the legacy server.ts).
import { scheduledReportWorker } from './modules/ricozviz/report/index.js';
import { scheduledAlertWorker } from './modules/ricozviz/alert/index.js';
import { scheduledRefreshWorker } from './modules/ricozviz/dataset/index.js';

const WORKER_INTERVAL_MS = 60_000;

async function bootstrap() {
  try {
    // Attempt database connection with configured URI and database name
    try {
      await connectDatabase({ uri: mongodbUri, dbName: mongodbDbName });
      logger.info('Connected to MongoDB via Mongoose');
    } catch (dbError) {
      logger.warn(
        `MongoDB connection warning: ${dbError instanceof Error ? dbError.message : dbError}. Continuing with server startup.`
      );
    }

    // Seed system roles/permissions when the catalogue is empty or partial.
    void ensureSystemRolesAndPermissions().catch((err) => {
      logger.error('Failed to initialize system roles and permissions at boot', {
        error: err instanceof Error ? err.message : String(err)
      });
    });

    const app = await buildApp();

    await app.listen({ port, host });
    logger.info(`[${env}] RicozViz Fastify backend running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);

    // Start background automation & monitoring workers
    scheduledReportWorker.start(WORKER_INTERVAL_MS);
    scheduledAlertWorker.start(WORKER_INTERVAL_MS);
    scheduledRefreshWorker.start(WORKER_INTERVAL_MS);

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        try {
          scheduledReportWorker.stop();
          scheduledAlertWorker.stop();
          scheduledRefreshWorker.stop();
          await app.close();
          await disconnectDatabase();
          logger.info('Closed HTTP server and disconnected database.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during graceful shutdown', err);
          process.exit(1);
        }
      });
    }

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', { reason: String(reason) });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start backend server', error);
    process.exit(1);
  }
}

bootstrap();