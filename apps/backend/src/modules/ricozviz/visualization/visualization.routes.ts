import type { FastifyInstance } from 'fastify';
import { visualizationController } from './visualization.controller.js';
import { requireAuth, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';

export async function visualizationRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Public Shared Visualization Routes (No Authentication Required)
  // ============================================================
  app.get('/shared/:shareToken', visualizationController.getShared.bind(visualizationController));
  app.post(
    '/shared/:shareToken/data',
    visualizationController.getSharedData.bind(visualizationController)
  );

  // All subsequent visualization endpoints require authentication
  app.post(
    '/',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('CHART_CREATE', 'DASHBOARD_EDIT', 'DATASET_CREATE')
      ]
    },
    visualizationController.create.bind(visualizationController)
  );

  app.get(
    '/',
    {
      preHandler: [requireAuth, requireAnyPermission('CHART_VIEW', 'DASHBOARD_VIEW', 'DATASET_VIEW')]
    },
    visualizationController.list.bind(visualizationController)
  );

  app.get(
    '/:id',
    {
      preHandler: [requireAuth, requireAnyPermission('CHART_VIEW', 'DASHBOARD_VIEW', 'DATASET_VIEW')]
    },
    visualizationController.getOne.bind(visualizationController)
  );

  app.get(
    '/:id/data',
    {
      preHandler: [requireAuth, requireAnyPermission('CHART_VIEW', 'DASHBOARD_VIEW', 'DATASET_VIEW')]
    },
    visualizationController.getData.bind(visualizationController)
  );

  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('CHART_EDIT', 'DASHBOARD_EDIT')] },
    visualizationController.update.bind(visualizationController)
  );

  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('CHART_DELETE', 'DASHBOARD_DELETE')] },
    visualizationController.remove.bind(visualizationController)
  );

  app.post(
    '/:id/share',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('CHART_SHARE', 'CHART_EDIT', 'DASHBOARD_EDIT')
      ]
    },
    visualizationController.share.bind(visualizationController)
  );

  app.delete(
    '/:id/share',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('CHART_SHARE', 'CHART_EDIT', 'DASHBOARD_EDIT')
      ]
    },
    visualizationController.revokeShare.bind(visualizationController)
  );
}