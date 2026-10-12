// ========================================
// Dashboard Routes — /api/v1/dashboards
// ========================================

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';
import { dashboardController } from './dashboard.controller.js';
import { chartRoutes } from '../chart/chart.routes.js';
import { collaborationRoutes } from '../collaboration/collaboration.routes.js';
import { reportRoutes, reportScheduleRoutes } from '../report/report.routes.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Public Shared & Embedded Dashboard Routes (No Authentication Required)
  // ============================================================
  app.get('/shared/:shareToken', dashboardController.getSharedDashboard.bind(dashboardController));
  app.post(
    '/shared/:shareToken/charts/:chartId/data',
    dashboardController.getSharedChartData.bind(dashboardController)
  );
  app.get('/embed/:embedToken', dashboardController.getPublicEmbedDashboard.bind(dashboardController));
  app.post(
    '/embed/:embedToken/charts/:chartId/data',
    dashboardController.getPublicEmbedChartData.bind(dashboardController)
  );

  // Subrouter for charts nested under a dashboard: /api/v1/dashboards/:id/charts
  // (the segment is named `id` everywhere so find-my-way keeps a single
  //  parametrised node for the dashboard path parameter)
  await app.register(chartRoutes, { prefix: '/:id/charts' });

  // Real-Time Collaboration SSE Stream (authenticates token from Authorization header or ?token query)
  await app.register(collaborationRoutes, { prefix: '/:id/collaboration' });

  // Report schedule CRUD: GET|POST|DELETE /api/v1/dashboards/:id/schedule
  await app.register(reportScheduleRoutes, { prefix: '/:id/schedule' });

  // Report generation / execution: /api/v1/dashboards/:id/reports...
  await app.register(reportRoutes, { prefix: '/:id/reports' });

  // All subsequent dashboard management endpoints require authentication
  const auth = { preHandler: [requireAuth] };

  /**
   * POST /api/v1/dashboards/:id/share
   * Generate or activate a public share link for a dashboard.
   * Permission: DASHBOARD_EDIT
   */
  app.post(
    '/:id/share',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.createShareLink.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards/:id/share
   * Check share link status.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id/share',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.getShareLinkStatus.bind(dashboardController)
  );

  /**
   * DELETE /api/v1/dashboards/:id/share
   * Deactivate a dashboard share link.
   * Permission: DASHBOARD_EDIT
   */
  app.delete(
    '/:id/share',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.disableShareLink.bind(dashboardController)
  );

  // ============================================================
  // PHASE 6: EMBEDDED ANALYTICS
  // ============================================================

  /**
   * POST /api/v1/dashboards/:id/embed
   * Enable or update embedded analytics configuration.
   */
  app.post(
    '/:id/embed',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.createEmbed.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards/:id/embed
   * Retrieve embed status and configuration.
   */
  app.get(
    '/:id/embed',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.getEmbed.bind(dashboardController)
  );

  /**
   * DELETE /api/v1/dashboards/:id/embed
   * Revoke and deactivate embedded analytics.
   */
  app.delete(
    '/:id/embed',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.revokeEmbed.bind(dashboardController)
  );

  // ============================================================
  // FEATURE 15: WORKSPACE COLLABORATION & RESOURCE SHARING
  // ============================================================

  /**
   * GET /api/v1/dashboards/:id/collaborators
   * List collaborators and access levels for a dashboard.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id/collaborators',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.listCollaborators.bind(dashboardController)
  );

  /**
   * POST /api/v1/dashboards/:id/collaborators
   * Grant access to a workspace member.
   * Permission: DASHBOARD_SHARE or COLLABORATION_MANAGE
   */
  app.post(
    '/:id/collaborators',
    {
      ...auth,
      preHandler: [
        requireAuth,
        requireAnyPermission('DASHBOARD_SHARE', 'COLLABORATION_MANAGE', 'DASHBOARD_EDIT')
      ]
    },
    dashboardController.grantCollaborator.bind(dashboardController)
  );

  /**
   * DELETE /api/v1/dashboards/:id/collaborators/:accessId
   * Revoke collaborator access.
   * Permission: DASHBOARD_SHARE or COLLABORATION_MANAGE
   */
  app.delete(
    '/:id/collaborators/:accessId',
    {
      ...auth,
      preHandler: [
        requireAuth,
        requireAnyPermission('DASHBOARD_SHARE', 'COLLABORATION_MANAGE', 'DASHBOARD_EDIT')
      ]
    },
    dashboardController.revokeCollaborator.bind(dashboardController)
  );

  /**
   * POST /api/v1/dashboards
   * Create a new dashboard.
   * Permission: DASHBOARD_CREATE
   */
  app.post(
    '/',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_CREATE')] },
    dashboardController.create.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards
   * List dashboards belonging to the user's organization.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.list.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards/:id
   * Retrieve a single dashboard with layout and charts.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.getOne.bind(dashboardController)
  );

  /**
   * PATCH /api/v1/dashboards/:id
   * Update dashboard metadata, layout configuration, or status.
   * Permission: DASHBOARD_EDIT
   */
  app.patch(
    '/:id',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.update.bind(dashboardController)
  );

  /**
   * DELETE /api/v1/dashboards/:id
   * Delete a dashboard.
   * Permission: DASHBOARD_DELETE (ADMIN only)
   */
  app.delete(
    '/:id',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_DELETE')] },
    dashboardController.remove.bind(dashboardController)
  );

  // ============================================================
  // PHASE 5: DASHBOARD VERSION HISTORY ROUTES
  // ============================================================

  /**
   * GET /api/v1/dashboards/:id/versions
   * List all historical versions for a dashboard.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id/versions',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.listVersions.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards/:id/versions/compare
   * Compare two historical versions of a dashboard.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id/versions/compare',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.compareVersions.bind(dashboardController)
  );

  /**
   * GET /api/v1/dashboards/:id/versions/:versionNumber
   * Retrieve a specific historical version snapshot.
   * Permission: DASHBOARD_VIEW
   */
  app.get(
    '/:id/versions/:versionNumber',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_VIEW')] },
    dashboardController.getVersion.bind(dashboardController)
  );

  /**
   * POST /api/v1/dashboards/:id/versions/:versionNumber/restore
   * Restore an earlier dashboard version snapshot.
   * Permission: DASHBOARD_EDIT
   */
  app.post(
    '/:id/versions/:versionNumber/restore',
    { ...auth, preHandler: [requireAuth, requirePermission('DASHBOARD_EDIT')] },
    dashboardController.restoreVersion.bind(dashboardController)
  );
}
