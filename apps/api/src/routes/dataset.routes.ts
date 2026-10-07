// ========================================
// Dataset Routes — /api/v1/datasets
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requirePermission,
  requireAnyPermission,
} from "../middleware/auth.middleware.js";
import { sendSuccess } from "../utils/response.js";
import { profileDataset } from "../services/dataset/data-quality.service.js";
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
  importSourceTable,
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
import {
  PreviewTransformationSchema,
  ApplyTransformationSchema,
  previewDatasetTransformations,
  applyDatasetTransformations,
} from "../services/dataset/transformation.service.js";
import {
  listDatasetVersions,
  getDatasetVersion,
  restoreDatasetVersion,
  getDatasetLineage,
} from "../services/dataset/versioning.service.js";
import {
  getDatasetRefreshSchedule,
  configureDatasetRefreshSchedule,
  deleteDatasetRefreshSchedule,
  executeDatasetRefresh,
} from "../services/dataset/dataset-refresh.service.js";
import {
  createRlsRuleSchema,
  updateRlsRuleSchema,
  listDatasetRlsRules,
  createRlsRule,
  updateRlsRule,
  deleteRlsRule,
} from "../services/dataset/rls.service.js";
import { prisma } from "../lib/prisma.js";
import { verifyResourceWorkspaceAccess } from "../services/workspace/workspace-auth.helper.js";
import { AppError } from "../utils/errors.js";
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
 * POST /api/v1/datasets/source/:dataSourceId/import
 * Import a discovered table or sheet as a Dataset.
 * Permission: DATASET_CREATE
 */
router.post(
  "/source/:dataSourceId/import",
  requirePermission("DATASET_CREATE"),
  asyncHandler(importSourceTable)
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
 * GET /api/v1/datasets/:id/profile
 * Data Quality & Profiling endpoint.
 * Returns completeness, duplicate rows, IQR outliers, distinct counts, sample values, and warnings.
 * Permission: DATASET_VIEW or DATASET_PROFILE
 */
router.get(
  "/:id/profile",
  requireAnyPermission("DATASET_VIEW", "DATASET_PROFILE"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const datasetId = req.params.id as string;
    const forceRefresh = req.query.refresh === "true" || req.query.force === "true";
    const profile = await profileDataset(
      datasetId,
      user.userId,
      user.organizationId,
      user.roleName,
      forceRefresh
    );
    sendSuccess(res, profile, 200);
  })
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

// ============================================================
// FEATURE 13: DATA TRANSFORMATION PIPELINE
// ============================================================

/**
 * POST /api/v1/datasets/:id/transform/preview
 * Previews execution of transformation pipeline on dataset sample.
 * Permission: DATASET_VIEW
 */
router.post(
  "/:id/transform/preview",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = PreviewTransformationSchema.parse(req.body);
    const result = await previewDatasetTransformations(
      req.params.id as string,
      parsed.steps,
      parsed.limit,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

/**
 * POST /api/v1/datasets/:id/transform/apply
 * Applies transformation pipeline to produce new derived dataset or new version.
 * Permission: DATASET_EDIT or DATASET_TRANSFORM
 */
router.post(
  "/:id/transform/apply",
  requireAnyPermission("DATASET_EDIT", "DATASET_TRANSFORM"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsed = ApplyTransformationSchema.parse(req.body);
    const result = await applyDatasetTransformations({
      datasetId: req.params.id as string,
      steps: parsed.steps,
      mode: parsed.mode,
      newDatasetName: parsed.newDatasetName,
      changeSummary: parsed.changeSummary,
      workspaceId: parsed.workspaceId,
      userId: user.userId,
      organizationId: user.organizationId,
      userRoleName: user.roleName,
    });
    sendSuccess(res, result, 201);
  })
);

// ============================================================
// FEATURE 14: DATASET VERSIONING & LINEAGE
// ============================================================

/**
 * GET /api/v1/datasets/:id/versions
 * List all versions of a dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/versions",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const versions = await listDatasetVersions(
      req.params.id as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, versions, 200);
  })
);

/**
 * GET /api/v1/datasets/:id/versions/:versionNumber
 * Retrieve a specific version snapshot.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/versions/:versionNumber",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const vNum = parseInt(req.params.versionNumber as string, 10);
    const version = await getDatasetVersion(
      req.params.id as string,
      vNum,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, version, 200);
  })
);

/**
 * POST /api/v1/datasets/:id/versions/:versionNumber/restore
 * Restore dataset to an earlier version.
 * Permission: DATASET_EDIT or DATASET_VERSION_MANAGE
 */
router.post(
  "/:id/versions/:versionNumber/restore",
  requireAnyPermission("DATASET_EDIT", "DATASET_VERSION_MANAGE"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const vNum = parseInt(req.params.versionNumber as string, 10);
    const restored = await restoreDatasetVersion(
      req.params.id as string,
      vNum,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, restored, 200);
  })
);

/**
 * GET /api/v1/datasets/:id/lineage
 * Retrieve upstream/downstream lineage graph for a dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/lineage",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const lineage = await getDatasetLineage(
      req.params.id as string,
      user.userId,
      user.organizationId,
      user.roleName
    );
    sendSuccess(res, lineage, 200);
  })
);

// ============================================================
// PHASE 3: SCHEDULED DATA REFRESH
// ============================================================

/**
 * GET /api/v1/datasets/:id/refresh-schedule
 * Retrieve scheduled refresh configuration & history.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/refresh-schedule",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const schedule = await getDatasetRefreshSchedule(
      req.params.id as string,
      user.organizationId,
      user.userId,
      user.roleName
    );
    sendSuccess(res, schedule, 200);
  })
);

/**
 * POST /api/v1/datasets/:id/refresh-schedule
 * Configure or update scheduled refresh for a dataset.
 * Permission: DATASET_EDIT
 */
router.post(
  "/:id/refresh-schedule",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const schedule = await configureDatasetRefreshSchedule(
      req.params.id as string,
      user.organizationId,
      user.userId,
      user.roleName,
      req.body
    );
    sendSuccess(res, schedule, 200);
  })
);

/**
 * DELETE /api/v1/datasets/:id/refresh-schedule
 * Disable/delete scheduled refresh for a dataset.
 * Permission: DATASET_EDIT
 */
router.delete(
  "/:id/refresh-schedule",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await deleteDatasetRefreshSchedule(
      req.params.id as string,
      user.organizationId,
      user.userId,
      user.roleName
    );
    sendSuccess(res, result, 200);
  })
);

/**
 * POST /api/v1/datasets/:id/refresh
 * Execute on-demand or scheduled dataset refresh.
 * Permission: DATASET_EDIT
 */
router.post(
  "/:id/refresh",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const result = await executeDatasetRefresh(
      req.params.id as string,
      user.organizationId,
      "MANUAL",
      { userId: user.userId, roleName: user.roleName }
    );
    sendSuccess(res, result, 200);
  })
);

// ============================================================
// ROW-LEVEL SECURITY (RLS) ROUTES
// ============================================================

async function resolveDatasetForRls(datasetId: string, user: any, requiredAction: "READ" | "WRITE" = "READ") {
  let dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId: user.organizationId },
    include: { columns: true },
  });
  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }
  await verifyResourceWorkspaceAccess(dataset, user.userId, user.organizationId, user.roleName, requiredAction);
  return dataset;
}

/**
 * GET /api/v1/datasets/:id/rls
 * List all Row-Level Security rules configured for this dataset.
 * Permission: DATASET_VIEW
 */
router.get(
  "/:id/rls",
  requirePermission("DATASET_VIEW"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dataset = await resolveDatasetForRls(req.params.id as string, user, "READ");
    const rules = await listDatasetRlsRules(dataset.id, user.organizationId);
    sendSuccess(res, rules, 200);
  })
);

/**
 * POST /api/v1/datasets/:id/rls
 * Create a new Row-Level Security rule on this dataset.
 * Permission: DATASET_EDIT
 */
router.post(
  "/:id/rls",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dataset = await resolveDatasetForRls(req.params.id as string, user, "WRITE");
    const parsed = createRlsRuleSchema.parse(req.body);
    const rule = await createRlsRule(dataset, parsed, user);
    sendSuccess(res, rule, 201);
  })
);

/**
 * PATCH /api/v1/datasets/:id/rls/:ruleId
 * Update an existing Row-Level Security rule.
 * Permission: DATASET_EDIT
 */
router.patch(
  "/:id/rls/:ruleId",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dataset = await resolveDatasetForRls(req.params.id as string, user, "WRITE");
    const parsed = updateRlsRuleSchema.parse(req.body);
    const updated = await updateRlsRule(dataset, req.params.ruleId as string, parsed, user);
    sendSuccess(res, updated, 200);
  })
);

/**
 * DELETE /api/v1/datasets/:id/rls/:ruleId
 * Delete a Row-Level Security rule.
 * Permission: DATASET_EDIT
 */
router.delete(
  "/:id/rls/:ruleId",
  requirePermission("DATASET_EDIT"),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const dataset = await resolveDatasetForRls(req.params.id as string, user, "WRITE");
    await deleteRlsRule(dataset, req.params.ruleId as string, user);
    sendSuccess(res, { message: "RLS rule deleted successfully" }, 200);
  })
);

export default router;
