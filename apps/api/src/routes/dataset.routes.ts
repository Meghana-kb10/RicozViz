// ========================================
// Dataset Routes — /api/v1/datasets
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import {
  createDataset,
  listDatasets,
  getDataset,
  updateDataset,
  deleteDataset,
  previewDataset,
  queryDataset,
  previewCsvSchemaHandler,
  listSourceTables,
  getSourceTableSchema,
} from "../services/dataset/dataset.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// All dataset endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/datasets
 * Create a new dataset.
 * Permission: DATASET_CREATE
 */
router.post(
  "/",
  requirePermission("DATASET_CREATE"),
  asyncHandler(createDataset)
);

/**
 * GET /api/v1/datasets
 * List organization datasets with search & pagination.
 * Permission: DATASET_VIEW
 */
router.get(
  "/",
  requirePermission("DATASET_VIEW"),
  asyncHandler(listDatasets)
);

/**
 * POST /api/v1/datasets/csv/preview-schema
 * Ingest/parse CSV and preview inferred schema.
 * Permission: DATASET_CREATE
 */
router.post(
  "/csv/preview-schema",
  requirePermission("DATASET_CREATE"),
  asyncHandler(previewCsvSchemaHandler)
);

/**
 * GET /api/v1/datasets/source/:dataSourceId/tables
 * List public tables in PostgreSQL data source.
 * Permission: DATASET_CREATE
 */
router.get(
  "/source/:dataSourceId/tables",
  requirePermission("DATASET_CREATE"),
  asyncHandler(listSourceTables)
);

/**
 * GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema
 * Discover column schema for a specific table.
 * Permission: DATASET_CREATE
 */
router.get(
  "/source/:dataSourceId/tables/:tableName/schema",
  requirePermission("DATASET_CREATE"),
  asyncHandler(getSourceTableSchema)
);

/**
 * GET /api/v1/datasets/:id
 * Retrieve a single dataset with schema metadata.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id",
  requirePermission("DATASET_VIEW"),
  asyncHandler(getDataset)
);

/**
 * PATCH /api/v1/datasets/:id
 * Update dataset name or description.
 * Permission: DATASET_EDIT
 */
router.patch(
  "/:id",
  requirePermission("DATASET_EDIT"),
  asyncHandler(updateDataset)
);

/**
 * DELETE /api/v1/datasets/:id
 * Delete a dataset.
 * Permission: DATASET_DELETE (ADMIN only)
 */
router.delete(
  "/:id",
  requirePermission("DATASET_DELETE"),
  asyncHandler(deleteDataset)
);

/**
 * GET /api/v1/datasets/:id/preview
 * Return sample rows (max 100).
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/preview",
  requirePermission("DATASET_VIEW"),
  asyncHandler(previewDataset)
);

/**
 * POST /api/v1/datasets/:id/query
 * Safe query foundation.
 * Permission: DATASET_VIEW
 */
router.post(
  "/:id/query",
  requirePermission("DATASET_VIEW"),
  asyncHandler(queryDataset)
);

export default router;
