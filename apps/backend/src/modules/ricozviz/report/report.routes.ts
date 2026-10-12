// ========================================
// Report Routes — /api/v1/dashboards/:id/reports + /schedule
// ========================================

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';
import { reportController } from './report.controller.js';

/**
 * GET /api/v1/dashboards/:id/reports
 * POST /api/v1/dashboards/:id/reports
 * POST /api/v1/dashboards/:id/reports/:reportId/run
 * GET /api/v1/dashboards/:id/reports/history
 */
export async function reportRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/dashboards/:id/reports/generate
   * Generate an on-demand or scheduled report snapshot reusing dashboard queries.
   * Permission: DASHBOARD_VIEW
   */
  app.post(
    '/generate',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    reportController.generate.bind(reportController)
  );

  /**
   * GET /api/v1/dashboards/:id/reports/history
   * List historical report executions.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/history',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    reportController.history.bind(reportController)
  );

  /**
   * POST /api/v1/dashboards/:id/reports/:reportId/run
   * Run an existing report manually.
   * Permission: DASHBOARD_VIEW
   */
  app.post(
    '/:reportId/run',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    reportController.run.bind(reportController)
  );

  /**
   * POST /api/v1/dashboards/:id/reports
   * Create a scheduled report for a dashboard.
   * Permission: DASHBOARD_EDIT
   */
  app.post(
    '/',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    reportController.create.bind(reportController)
  );
}

/**
 * GET /api/v1/dashboards/:id/schedule
 * POST /api/v1/dashboards/:id/schedule
 * DELETE /api/v1/dashboards/:id/schedule
 */
export async function reportScheduleRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/dashboards/:id/schedule
   * Retrieve scheduled report configuration for a dashboard.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    reportController.getSchedule.bind(reportController)
  );

  /**
   * POST /api/v1/dashboards/:id/schedule
   * Create or update scheduled report configuration for a dashboard.
   * Permission: DASHBOARD_EDIT
   */
  app.post(
    '/',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    reportController.upsertSchedule.bind(reportController)
  );

  /**
   * DELETE /api/v1/dashboards/:id/schedule
   * Delete scheduled report configuration for a dashboard.
   * Permission: DASHBOARD_EDIT
   */
  app.delete(
    '/',
    { preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    reportController.deleteSchedule.bind(reportController)
  );
}
