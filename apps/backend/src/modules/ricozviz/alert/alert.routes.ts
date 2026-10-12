import type { FastifyInstance } from 'fastify';
import { alertController } from './alert.controller.js';
import { requireAuth, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('ALERT_CREATE', 'DATASET_CREATE', 'DATASET_EDIT')
      ]
    },
    alertController.create.bind(alertController)
  );

  app.get(
    '/',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_VIEW', 'DATASET_VIEW')] },
    alertController.list.bind(alertController)
  );

  // Registered before `/:id` so "workspace" is not captured as an alert id.
  app.post(
    '/workspace/:workspaceId/evaluate-all',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_VIEW', 'DATASET_VIEW')] },
    alertController.evaluateAll.bind(alertController)
  );

  app.get(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_VIEW', 'DATASET_VIEW')] },
    alertController.getOne.bind(alertController)
  );

  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_EDIT', 'DATASET_EDIT')] },
    alertController.update.bind(alertController)
  );

  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_DELETE', 'DATASET_DELETE')] },
    alertController.remove.bind(alertController)
  );

  app.post(
    '/:id/evaluate',
    { preHandler: [requireAuth, requireAnyPermission('ALERT_VIEW', 'DATASET_VIEW')] },
    alertController.evaluate.bind(alertController)
  );

  app.post(
    '/:id/clear',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('ALERT_EDIT', 'ALERT_VIEW', 'DATASET_VIEW')
      ]
    },
    alertController.clear.bind(alertController)
  );
}