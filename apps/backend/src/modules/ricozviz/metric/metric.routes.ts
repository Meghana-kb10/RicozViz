import type { FastifyInstance } from 'fastify';
import { metricController } from './metric.controller.js';
import { requireAuth, requireAnyPermission } from '../../../plugins/ricozviz-auth.js';

export async function metricRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/',
    {
      preHandler: [
        requireAuth,
        requireAnyPermission('METRIC_CREATE', 'DATASET_CREATE', 'DATASET_EDIT')
      ]
    },
    metricController.create.bind(metricController)
  );

  app.get(
    '/',
    { preHandler: [requireAuth, requireAnyPermission('METRIC_VIEW', 'DATASET_VIEW')] },
    metricController.list.bind(metricController)
  );

  app.get(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('METRIC_VIEW', 'DATASET_VIEW')] },
    metricController.getOne.bind(metricController)
  );

  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('METRIC_EDIT', 'DATASET_EDIT')] },
    metricController.update.bind(metricController)
  );

  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireAnyPermission('METRIC_DELETE', 'DATASET_DELETE')] },
    metricController.remove.bind(metricController)
  );

  app.post(
    '/:id/calculate',
    { preHandler: [requireAuth, requireAnyPermission('METRIC_VIEW', 'DATASET_VIEW')] },
    metricController.calculate.bind(metricController)
  );
}