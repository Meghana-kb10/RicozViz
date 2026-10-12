// ========================================
// Chart Routes — /api/v1/dashboards/:id/charts
// ========================================

import type { FastifyInstance } from 'fastify';
import { requireAuth, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';
import { chartController } from './chart.controller.js';

export async function chartRoutes(app: FastifyInstance): Promise<void> {
  // All chart endpoints require authentication
  const auth = { preHandler: [requireAuth] };

  /**
   * POST /api/v1/dashboards/:dashboardId/charts
   * Create a new chart in the dashboard.
   * Permission: CHART_CREATE or DASHBOARD_EDIT
   */
  app.post(
    '/',
    { ...auth, preHandler: [requireAuth, requireAnyPermission('CHART_CREATE', 'DASHBOARD_EDIT')] },
    chartController.create.bind(chartController)
  );

  /**
   * GET /api/v1/dashboards/:dashboardId/charts
   * List all charts configured in the dashboard.
   * Permission: CHART_VIEW or DASHBOARD_VIEW
   */
  app.get(
    '/',
    { ...auth, preHandler: [requireAuth, requireAnyPermission('CHART_VIEW', 'DASHBOARD_VIEW')] },
    chartController.list.bind(chartController)
  );

  /**
   * GET /api/v1/dashboards/:dashboardId/charts/:chartId
   * Retrieve a specific chart.
   * Permission: CHART_VIEW or DASHBOARD_VIEW
   */
  app.get(
    '/:chartId',
    { ...auth, preHandler: [requireAuth, requireAnyPermission('CHART_VIEW', 'DASHBOARD_VIEW')] },
    chartController.getOne.bind(chartController)
  );

  /**
   * PATCH /api/v1/dashboards/:dashboardId/charts/:chartId
   * Update chart configuration or details.
   * Permission: CHART_EDIT or DASHBOARD_EDIT
   */
  app.patch(
    '/:chartId',
    { ...auth, preHandler: [requireAuth, requireAnyPermission('CHART_EDIT', 'DASHBOARD_EDIT')] },
    chartController.update.bind(chartController)
  );

  /**
   * DELETE /api/v1/dashboards/:dashboardId/charts/:chartId
   * Delete a chart from the dashboard.
   * Permission: CHART_DELETE or DASHBOARD_DELETE
   */
  app.delete(
    '/:chartId',
    {
      ...auth,
      preHandler: [requireAuth, requireAnyPermission('CHART_DELETE', 'DASHBOARD_DELETE')]
    },
    chartController.remove.bind(chartController)
  );
}
