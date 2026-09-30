// ========================================
// Data Source Routes — /api/v1/data-sources
// ========================================

import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../middleware/auth.middleware.js";
import {
  createDataSource,
  listDataSources,
  getDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
} from "../services/data-source/data-source.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/**
 * All data-source endpoints require authentication.
 */
router.use(requireAuth);

/**
 * POST /api/v1/data-sources
 * Create a new data source.
 * Permissions: DATA_SOURCE_CREATE
 */
router.post(
  "/",
  requirePermission("DATA_SOURCE_CREATE"),
  asyncHandler(createDataSource)
);

/**
 * GET /api/v1/data-sources
 * List organization data sources.
 * Permissions: DATA_SOURCE_VIEW
 */
router.get(
  "/",
  requirePermission("DATA_SOURCE_VIEW"),
  asyncHandler(listDataSources)
);

/**
 * GET /api/v1/data-sources/:id
 * Retrieve a single data source by ID.
 * Permissions: DATA_SOURCE_VIEW
 */
router.get(
  "/:id",
  requirePermission("DATA_SOURCE_VIEW"),
  asyncHandler(getDataSource)
);

/**
 * PATCH /api/v1/data-sources/:id
 * Update an existing data source.
 * Permissions: DATA_SOURCE_EDIT
 */
router.patch(
  "/:id",
  requirePermission("DATA_SOURCE_EDIT"),
  asyncHandler(updateDataSource)
);

/**
 * DELETE /api/v1/data-sources/:id
 * Delete a data source.
 * Permissions: DATA_SOURCE_DELETE (ADMIN only)
 */
router.delete(
  "/:id",
  requirePermission("DATA_SOURCE_DELETE"),
  asyncHandler(deleteDataSource)
);

/**
 * POST /api/v1/data-sources/:id/test-connection
 * Test connection to the data source.
 * Permissions: DATA_SOURCE_TEST
 */
router.post(
  "/:id/test-connection",
  requirePermission("DATA_SOURCE_TEST"),
  asyncHandler(testDataSourceConnection)
);

export default router;
