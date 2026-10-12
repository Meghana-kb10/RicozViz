import type { FastifyInstance } from 'fastify';
import { dataSourceController } from './data-source.controller.js';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';

export async function dataSourceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/data-sources/test-connection
   * Test connection credentials before saving.
   * Permissions: DATA_SOURCE_TEST
   */
  app.post(
    '/test-connection',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_TEST')] },
    dataSourceController.testRaw.bind(dataSourceController)
  );

  /**
   * POST /api/v1/data-sources
   * Create a new data source.
   * Permissions: DATA_SOURCE_CREATE
   */
  app.post(
    '/',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_CREATE')] },
    dataSourceController.create.bind(dataSourceController)
  );

  /**
   * GET /api/v1/data-sources
   * List organization data sources.
   * Permissions: DATA_SOURCE_VIEW
   */
  app.get(
    '/',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_VIEW')] },
    dataSourceController.list.bind(dataSourceController)
  );

  /**
   * GET /api/v1/data-sources/:id
   * Retrieve a single data source by ID.
   * Permissions: DATA_SOURCE_VIEW
   */
  app.get(
    '/:id',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_VIEW')] },
    dataSourceController.getOne.bind(dataSourceController)
  );

  /**
   * PATCH /api/v1/data-sources/:id
   * Update an existing data source.
   * Permissions: DATA_SOURCE_EDIT
   */
  app.patch(
    '/:id',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_EDIT')] },
    dataSourceController.update.bind(dataSourceController)
  );

  /**
   * DELETE /api/v1/data-sources/:id
   * Delete a data source.
   * Permissions: DATA_SOURCE_DELETE
   */
  app.delete(
    '/:id',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_DELETE')] },
    dataSourceController.remove.bind(dataSourceController)
  );

  /**
   * POST /api/v1/data-sources/:id/test-connection
   * Test connection to an existing data source.
   * Permissions: DATA_SOURCE_TEST
   */
  app.post(
    '/:id/test-connection',
    { preHandler: [requireAuth, requirePermission('DATA_SOURCE_TEST')] },
    dataSourceController.testConnection.bind(dataSourceController)
  );
}
