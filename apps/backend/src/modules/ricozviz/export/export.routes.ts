import type { FastifyInstance } from 'fastify';
import { exportController } from './export.controller.js';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.create.bind(exportController)
  );

  app.get(
    '/history',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.history.bind(exportController)
  );

  /**
   * POST /api/v1/exports/reports/:id/execute
   * Manually trigger/test a scheduled report execution with Puppeteer PDF generation and email delivery.
   * Permission: DATA_EXPORT
   */
  app.post(
    '/reports/:id/execute',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.executeReport.bind(exportController)
  );

  /**
   * GET /api/v1/exports/reports/:id/executions
   * List execution history for a scheduled report.
   * Permission: DATA_EXPORT
   */
  app.get(
    '/reports/:id/executions',
    { preHandler: [requireAuth, requirePermission('DATA_EXPORT')] },
    exportController.reportExecutions.bind(exportController)
  );
}