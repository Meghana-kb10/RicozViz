import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { datasetController } from './dataset.controller.js';
import { requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';

/**
 * Dataset routes — mounted under `/api/v1/datasets`.
 *
 * Core CRUD, ingestion, preview and refresh routes live here.
 * Blend, calculated-field, transformation, versioning/lineage, RLS and
 * profiling routes are registered by `advancedDatasetRoutes` at the same prefix.
 */
export async function datasetRoutes(app: FastifyInstance): Promise<void> {
  // All dataset endpoints require authentication
  const guard = (...permissions: preHandlerHookHandler[]): preHandlerHookHandler[] => [
    requireAuth,
    ...permissions
  ];

  const viewGuard = guard(requirePermission('DATASET_VIEW'));
  const createGuard = guard(requirePermission('DATASET_CREATE'));
  const editGuard = guard(requirePermission('DATASET_EDIT'));
  const deleteGuard = guard(requirePermission('DATASET_DELETE'));

  /**
   * POST /api/v1/datasets/upload
   * Multipart CSV/JSON/XLSX file upload with schema inference and DatasetColumn persistence.
   * Permission: DATASET_CREATE
   */
  app.post(
    '/upload',
    { preHandler: createGuard },
    datasetController.upload.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets
   * Create a new dataset.
   * Permission: DATASET_CREATE
   */
  app.post('/', { preHandler: createGuard }, datasetController.create.bind(datasetController));

  /**
   * GET /api/v1/datasets
   * List organization datasets with search & pagination.
   * Permission: DATASET_VIEW
   */
  app.get('/', { preHandler: viewGuard }, datasetController.list.bind(datasetController));

  /**
   * POST /api/v1/datasets/csv/preview-schema
   * Ingest/parse CSV and preview inferred schema.
   * Permission: DATASET_CREATE
   */
  app.post(
    '/csv/preview-schema',
    { preHandler: createGuard },
    datasetController.previewCsv.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/source/:dataSourceId/tables
   * List tables/views exposed by a connected data source.
   * Permission: DATASET_CREATE
   */
  app.get(
    '/source/:dataSourceId/tables',
    { preHandler: createGuard },
    datasetController.listSourceTables.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema
   * Discover column schema for a specific table.
   * Permission: DATASET_CREATE
   */
  app.get(
    '/source/:dataSourceId/tables/:tableName/schema',
    { preHandler: createGuard },
    datasetController.getSourceTableSchema.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets/source/:dataSourceId/import
   * Import a discovered table or sheet as a Dataset.
   * Permission: DATASET_CREATE
   */
  app.post(
    '/source/:dataSourceId/import',
    { preHandler: createGuard },
    datasetController.importSourceTable.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/demo/catalog
   * List curated demo datasets with filters.
   * Permission: DATASET_VIEW
   */
  app.get(
    '/demo/catalog',
    { preHandler: viewGuard },
    datasetController.listDemoCatalog.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/demo/:demoId
   * Retrieve detailed info and preview rows for a demo dataset.
   * Permission: DATASET_VIEW
   */
  app.get(
    '/demo/:demoId',
    { preHandler: viewGuard },
    datasetController.getDemoDataset.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets/demo/:demoId/import
   * Import a curated demo dataset into the active workspace.
   * Permission: DATASET_CREATE
   */
  app.post(
    '/demo/:demoId/import',
    { preHandler: createGuard },
    datasetController.importDemoDataset.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/:id
   * Retrieve a single dataset with schema metadata.
   * Permission: DATASET_VIEW
   */
  app.get(
    '/:id',
    { preHandler: viewGuard },
    datasetController.getOne.bind(datasetController)
  );

  /**
   * PATCH /api/v1/datasets/:id
   * Update dataset name or description.
   * Permission: DATASET_EDIT
   */
  app.patch(
    '/:id',
    { preHandler: editGuard },
    datasetController.update.bind(datasetController)
  );

  /**
   * DELETE /api/v1/datasets/:id
   * Delete a dataset.
   * Permission: DATASET_DELETE
   */
  app.delete(
    '/:id',
    { preHandler: deleteGuard },
    datasetController.remove.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/:id/preview
   * Return sample rows (max 100).
   * Permission: DATASET_VIEW
   */
  app.get(
    '/:id/preview',
    { preHandler: viewGuard },
    datasetController.preview.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets/:id/query
   * Safe query foundation.
   * Permission: DATASET_VIEW
   */
  app.post(
    '/:id/query',
    { preHandler: viewGuard },
    datasetController.query.bind(datasetController)
  );

  /**
   * GET /api/v1/datasets/:id/refresh-schedule
   * Retrieve scheduled refresh configuration & history.
   * Permission: DATASET_VIEW
   */
  app.get(
    '/:id/refresh-schedule',
    { preHandler: viewGuard },
    datasetController.getRefreshSchedule.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets/:id/refresh-schedule
   * Configure or update scheduled refresh for a dataset.
   * Permission: DATASET_EDIT
   */
  app.post(
    '/:id/refresh-schedule',
    { preHandler: editGuard },
    datasetController.saveRefreshSchedule.bind(datasetController)
  );

  /**
   * DELETE /api/v1/datasets/:id/refresh-schedule
   * Disable/delete scheduled refresh for a dataset.
   * Permission: DATASET_EDIT
   */
  app.delete(
    '/:id/refresh-schedule',
    { preHandler: editGuard },
    datasetController.removeRefreshSchedule.bind(datasetController)
  );

  /**
   * POST /api/v1/datasets/:id/refresh
   * Execute on-demand or scheduled dataset refresh.
   * Permission: DATASET_EDIT
   */
  app.post(
    '/:id/refresh',
    { preHandler: editGuard },
    datasetController.triggerRefresh.bind(datasetController)
  );
}