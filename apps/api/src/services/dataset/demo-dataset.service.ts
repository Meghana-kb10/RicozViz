// ============================================================
// Demo Dataset Service & Controller
// ============================================================
// Provides curated demo datasets catalog retrieval, preview,
// and safe one-click import into workspaces with duplicate prevention
// and full source attribution/licensing retention.
// ============================================================

import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import {
  DEMO_DATASETS,
  type DemoCatalogItem,
} from "./demo-catalog.data.js";
import {
  buildSafeDataset,
  mapToPrismaColumnType,
} from "./dataset.service.js";
import {
  resolveTargetWorkspaceId,
} from "../workspace/workspace-auth.helper.js";
import type { Prisma } from "@prisma/client";

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const listDemoCatalogSchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const importDemoDatasetSchema = z.object({
  workspaceId: z.string().trim().min(1).max(100).optional().nullable(),
  customName: z.string().trim().min(1).max(100).optional(),
});

// ============================================================
// SERVICE LOGIC
// ============================================================

/**
 * Returns catalog items filtered by category and/or search term.
 * Omits heavy full record arrays from listing to minimize payload.
 */
export function getDemoCatalogList(filters?: { category?: string; search?: string }) {
  let list = DEMO_DATASETS;

  if (filters?.category && filters.category.toLowerCase() !== "all") {
    const cat = filters.category.toLowerCase();
    list = list.filter((item) => item.category.toLowerCase() === cat);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Strip full records array for catalog listing
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    sourceUrl: item.sourceUrl,
    license: item.license,
    sourceAttribution: item.sourceAttribution,
    fileName: item.fileName,
    sourceType: item.sourceType,
    rowCount: item.rowCount,
    columnCount: item.columnCount,
    tags: item.tags,
    columns: item.columns,
    sampleData: item.sampleData,
  }));
}

/**
 * Finds a specific demo dataset by ID.
 * Returns full metadata and records for preview.
 */
export function getDemoDatasetById(demoId: string): DemoCatalogItem {
  const item = DEMO_DATASETS.find((d) => d.id === demoId.trim());
  if (!item) {
    throw AppError.notFound(`Demo dataset '${demoId}' not found in catalog`);
  }
  return item;
}

/**
 * Imports a curated demo dataset into the target organization & workspace.
 * Reuses existing Dataset creation model, stores schemaMeta with source attribution,
 * creates DatasetColumns for query engine compatibility, and prevents duplicates.
 */
export async function importDemoDatasetRecord(
  demoId: string,
  options: {
    organizationId: string;
    userId: string;
    roleName?: string;
    workspaceId?: string | null;
    customName?: string;
  }
) {
  const demoItem = getDemoDatasetById(demoId);
  const targetName = (options.customName?.trim() || demoItem.name).trim();

  // Resolve target workspace
  const resolvedWorkspaceId = await resolveTargetWorkspaceId(
    options.workspaceId,
    options.userId,
    options.organizationId,
    options.roleName
  );

  // Check for duplicate in the same workspace & organization
  const existingInWorkspace = await prisma.dataset.findMany({
    where: {
      organizationId: options.organizationId,
      workspaceId: resolvedWorkspaceId,
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  const duplicate = existingInWorkspace.find((d) => {
    const meta = (d.schemaMeta || {}) as Record<string, unknown>;
    return (
      meta["demoCatalogId"] === demoItem.id ||
      d.name.toLowerCase() === targetName.toLowerCase()
    );
  });

  if (duplicate) {
    return {
      alreadyImported: true,
      dataset: buildSafeDataset(duplicate),
      message: `Demo dataset "${duplicate.name}" is already available in this workspace.`,
    };
  }

  // Schema metadata preserving source attribution and full records for queries
  const schemaMeta: Record<string, unknown> = {
    columns: demoItem.columns,
    sampleData: demoItem.records,
    rowCount: demoItem.rowCount,
    columnCount: demoItem.columnCount,
    sourceType: demoItem.sourceType,
    fileName: demoItem.fileName,
    isDemo: true,
    demoCatalogId: demoItem.id,
    license: demoItem.license,
    sourceAttribution: demoItem.sourceAttribution,
    sourceUrl: demoItem.sourceUrl,
    category: demoItem.category,
    tags: demoItem.tags,
  };

  const newDataset = await prisma.dataset.create({
    data: {
      organizationId: options.organizationId,
      workspaceId: resolvedWorkspaceId,
      name: targetName,
      description: demoItem.description,
      sourceType: demoItem.sourceType,
      fileName: demoItem.fileName,
      rowCount: demoItem.rowCount,
      columnCount: demoItem.columnCount,
      type: "UPLOADED",
      status: "ACTIVE",
      dataSourceId: null,
      schemaMeta: schemaMeta as Prisma.InputJsonValue,
      createdById: options.userId,
      columns: {
        create: demoItem.columns.map((col, idx) => ({
          name: col.name,
          dataType: mapToPrismaColumnType(col.type),
          nullable: col.nullable !== false,
          ordinalPosition: idx + 1,
        })),
      },
    },
    include: {
      dataSource: { select: { id: true, name: true, type: true } },
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  return {
    alreadyImported: false,
    dataset: buildSafeDataset(newDataset),
    message: `Demo dataset "${newDataset.name}" imported successfully.`,
  };
}

// ============================================================
// EXPRESS CONTROLLER HANDLERS
// ============================================================

/**
 * GET /api/v1/datasets/demo/catalog
 * Lists available curated demo datasets with optional filtering.
 */
export async function listDemoCatalogHandler(req: Request, res: Response): Promise<void> {
  const query = listDemoCatalogSchema.parse(req.query);
  const catalog = getDemoCatalogList(query);

  res.status(200).json({
    success: true,
    data: catalog,
    total: catalog.length,
  });
}

/**
 * GET /api/v1/datasets/demo/:demoId
 * Returns full details and sample records for a specific demo dataset.
 */
export async function getDemoDatasetDetailsHandler(req: Request, res: Response): Promise<void> {
  const demoId = req.params["demoId"];
  if (!demoId) {
    throw AppError.badRequest("Demo dataset ID is required");
  }

  const details = getDemoDatasetById(demoId);

  res.status(200).json({
    success: true,
    data: details,
  });
}

/**
 * POST /api/v1/datasets/demo/:demoId/import
 * Imports demo dataset into the active workspace.
 */
export async function importDemoDatasetHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, roleName } = req.user!;
  const demoId = req.params["demoId"];
  if (!demoId) {
    throw AppError.badRequest("Demo dataset ID is required");
  }

  const body = importDemoDatasetSchema.parse(req.body || {});
  const requestedWsId =
    body.workspaceId || (req.headers["x-workspace-id"] as string | undefined);

  const result = await importDemoDatasetRecord(demoId, {
    organizationId,
    userId,
    roleName,
    workspaceId: requestedWsId,
    customName: body.customName,
  });

  const statusCode = result.alreadyImported ? 200 : 201;

  res.status(statusCode).json({
    success: true,
    data: {
      ...result.dataset,
      alreadyImported: result.alreadyImported,
    },
    alreadyImported: result.alreadyImported,
    message: result.message,
  });
}
