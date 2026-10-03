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
  uploadDataset,
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
import {
  previewDatasetBlend,
  createDatasetBlend,
  listDatasetBlends,
  getDatasetBlend,
  deleteDatasetBlend,
} from "../services/dataset/dataset-blend.service.js";
import {
  previewCalculatedField,
  createCalculatedField,
  listCalculatedFields,
  updateCalculatedField,
  deleteCalculatedField,
} from "../services/dataset/calculated-field.service.js";
import {
  listDemoCatalogHandler,
  getDemoDatasetDetailsHandler,
  importDemoDatasetHandler,
} from "../services/dataset/demo-dataset.service.js";
import { multipartUpload } from "../middleware/upload.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// All dataset endpoints require authentication
router.use(requireAuth);

/**
 * POST /api/v1/datasets/upload
 * Multipart CSV/JSON file upload with schema inference and DatasetColumn persistence.
 * Permission: DATASET_CREATE
 */
router.post(
  "/upload",
  requirePermission("DATASET_CREATE"),
  multipartUpload(),
  asyncHandler(uploadDataset)
);

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
 * POST /api/v1/datasets/blends/preview
 * Preview a blend between two datasets (INNER or LEFT join).
 * Permission: DATASET_VIEW
 */
router.post(
  "/blends/preview",
  requirePermission("DATASET_VIEW"),
  asyncHandler(previewDatasetBlend)
);

/**
 * POST /api/v1/datasets/blends
 * Create and persist a blended dataset (DERIVED).
 * Permission: DATASET_CREATE
 */
router.post(
  "/blends",
  requirePermission("DATASET_CREATE"),
  asyncHandler(createDatasetBlend)
);

/**
 * GET /api/v1/datasets/blends
 * List blended datasets.
 * Permission: DATASET_VIEW
 */
router.get(
  "/blends",
  requirePermission("DATASET_VIEW"),
  asyncHandler(listDatasetBlends)
);

/**
 * GET /api/v1/datasets/blends/:id
 * Retrieve details of a blended dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/blends/:id",
  requirePermission("DATASET_VIEW"),
  asyncHandler(getDatasetBlend)
);

/**
 * DELETE /api/v1/datasets/blends/:id
 * Delete a blended dataset.
 * Permission: DATASET_DELETE
 */
router.delete(
  "/blends/:id",
  requirePermission("DATASET_DELETE"),
  asyncHandler(deleteDatasetBlend)
);

/**
 * GET /api/v1/datasets/demo/catalog
 * List curated demo datasets with filters.
 * Permission: DATASET_VIEW
 */
router.get(
  "/demo/catalog",
  requirePermission("DATASET_VIEW"),
  asyncHandler(listDemoCatalogHandler)
);

/**
 * GET /api/v1/datasets/demo/:demoId
 * Retrieve detailed info and preview rows for a demo dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/demo/:demoId",
  requirePermission("DATASET_VIEW"),
  asyncHandler(getDemoDatasetDetailsHandler)
);

/**
 * POST /api/v1/datasets/demo/:demoId/import
 * Import a curated demo dataset into the active workspace.
 * Permission: DATASET_CREATE
 */
router.post(
  "/demo/:demoId/import",
  requirePermission("DATASET_CREATE"),
  asyncHandler(importDemoDatasetHandler)
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

/**
 * POST /api/v1/datasets/:id/calculated-fields/preview
 * Previews evaluation of calculated expression.
 * Permission: DATASET_VIEW
 */
router.post(
  "/:id/calculated-fields/preview",
  requirePermission("DATASET_VIEW"),
  asyncHandler(previewCalculatedField)
);

/**
 * POST /api/v1/datasets/:id/calculated-fields
 * Creates a calculated field on the dataset.
 * Permission: DATASET_EDIT
 */
router.post(
  "/:id/calculated-fields",
  requirePermission("DATASET_EDIT"),
  asyncHandler(createCalculatedField)
);

/**
 * GET /api/v1/datasets/:id/calculated-fields
 * Lists all calculated fields for a dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/calculated-fields",
  requirePermission("DATASET_VIEW"),
  asyncHandler(listCalculatedFields)
);

/**
 * PATCH /api/v1/datasets/:id/calculated-fields/:fieldId
 * Updates a calculated field on the dataset.
 * Permission: DATASET_EDIT
 */
router.patch(
  "/:id/calculated-fields/:fieldId",
  requirePermission("DATASET_EDIT"),
  asyncHandler(updateCalculatedField)
);

/**
 * DELETE /api/v1/datasets/:id/calculated-fields/:fieldId
 * Deletes a calculated field from a dataset.
 * Permission: DATASET_EDIT
 */
router.delete(
  "/:id/calculated-fields/:fieldId",
  requirePermission("DATASET_EDIT"),
  asyncHandler(deleteCalculatedField)
);

export default router;
