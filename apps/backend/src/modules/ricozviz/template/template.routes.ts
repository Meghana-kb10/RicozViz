import type { FastifyInstance } from 'fastify';
import { templateController } from './template.controller.js';
import { requireAuth, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    {
      preHandler: [requireAuth, requireAnyPermission('TEMPLATE_VIEW', 'DASHBOARD_VIEW')]
    },
    templateController.list.bind(templateController)
  );

  app.get(
    '/:id',
    {
      preHandler: [requireAuth, requireAnyPermission('TEMPLATE_VIEW', 'DASHBOARD_VIEW')]
    },
    templateController.getOne.bind(templateController)
  );

  app.post(
    '/from-dashboard',
    {
      preHandler: [requireAuth, requireAnyPermission('TEMPLATE_CREATE', 'DASHBOARD_EDIT')]
    },
    templateController.createFromDashboard.bind(templateController)
  );

  // Legacy route aliases: /:id/instantiate and /:id/apply share one handler.
  app.post(
    '/:id/instantiate',
    { preHandler: [requireAuth, requireAnyPermission('TEMPLATE_APPLY', 'DASHBOARD_CREATE')] },
    templateController.instantiate.bind(templateController)
  );
  app.post(
    '/:id/apply',
    { preHandler: [requireAuth, requireAnyPermission('TEMPLATE_APPLY', 'DASHBOARD_CREATE')] },
    templateController.instantiate.bind(templateController)
  );
}