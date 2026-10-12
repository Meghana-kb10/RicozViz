// ============================================================
// Demo Dataset Service
// ============================================================
// Provides curated demo datasets catalog retrieval, preview,
// and safe one-click import into workspaces with duplicate prevention
// and full source attribution/licensing retention.
// ============================================================

import { z } from 'zod';
import mongoose from 'mongoose';
import { DatasetModel, DatasetColumnModel, toObjectId } from '@repo/database';
import { DATASET_STATUS, DATASET_TYPE } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { DEMO_DATASETS, type DemoCatalogItem } from './demo-catalog.data.js';
import {
  buildSafeDataset,
  mapToColumnType,
  requireObjectId,
  resolveTargetWorkspaceId,
  listDatasetColumns,
  type SafeDataset
} from './dataset.service.js';

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const listDemoCatalogSchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional()
});

export const importDemoDatasetSchema = z.object({
  workspaceId: z.string().trim().min(1).max(100).optional().nullable(),
  customName: z.string().trim().min(1).max(100).optional()
});

// ============================================================
// SERVICE LOGIC
// ============================================================

/** Catalog listing projection: the heavy `records` array is stripped. */
export interface DemoCatalogListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceUrl: string;
  license: string;
  sourceAttribution: string;
  fileName: string;
  sourceType: string;
  rowCount: number;
  columnCount: number;
  tags: string[];
  columns: DemoCatalogItem['columns'];
  sampleData: Array<Record<string, unknown>>;
}

/**
 * Returns catalog items filtered by category and/or search term.
 * Omits heavy full record arrays from listing to minimize payload.
 */
export function getDemoCatalogList(filters?: {
  category?: string;
  search?: string;
}): DemoCatalogListItem[] {
  let list = DEMO_DATASETS;

  if (filters?.category && filters.category.toLowerCase() !== 'all') {
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
    sampleData: item.sampleData
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

export interface ImportDemoDatasetOptions {
  organizationId: string;
  userId: string;
  roleName?: string;
  workspaceId?: string | null;
  customName?: string;
}

export interface ImportDemoDatasetResult {
  alreadyImported: boolean;
  dataset: SafeDataset;
  message: string;
}

/** Mongoose `populate` cannot sort a nested relation, so columns are hydrated separately. */
interface PopulatedDataSource {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: string;
}

/**
 * Imports a curated demo dataset into the target organization & workspace.
 * Reuses existing Dataset creation model, stores schemaMeta with source attribution,
 * creates DatasetColumns for query engine compatibility, and prevents duplicates.
 */
export async function importDemoDatasetRecord(
  demoId: string,
  options: ImportDemoDatasetOptions
): Promise<ImportDemoDatasetResult> {
  const demoItem = getDemoDatasetById(demoId);
  const targetName = (options.customName?.trim() || demoItem.name).trim();

  // Resolve target workspace
  const resolvedWorkspaceId = await resolveTargetWorkspaceId(
    options.workspaceId ?? null,
    options.userId,
    options.organizationId,
    options.roleName
  );

  // Check for duplicate in the same workspace & organization
  const existingInWorkspace = await DatasetModel.find({
    organizationId: toObjectId(options.organizationId),
    workspaceId: resolvedWorkspaceId ? toObjectId(resolvedWorkspaceId) : null
  })
    .populate<{ dataSource: PopulatedDataSource }>('dataSource', 'name type')
    .exec();

  const columnsByDataset = await listDatasetColumns(
    existingInWorkspace.map((doc) => doc._id.toString())
  );

  const serializedExisting = existingInWorkspace.map((doc) =>
    buildSafeDataset({
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      workspaceId: doc.workspaceId,
      dataSourceId: doc.dataSourceId,
      name: doc.name,
      description: doc.description,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      rowCount: doc.rowCount,
      columnCount: doc.columnCount,
      type: doc.type,
      status: doc.status,
      schemaMeta: (doc.schemaMeta || {}) as unknown as Record<string, unknown>,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      dataSource: doc.dataSource ?? null,
      columns: columnsByDataset.get(doc._id.toString()) ?? []
    })
  );

  const duplicate = serializedExisting.find((d) => {
    const meta = (d.schemaMeta || {}) as Record<string, unknown>;
    return meta['demoCatalogId'] === demoItem.id || d.name.toLowerCase() === targetName.toLowerCase();
  });

  if (duplicate) {
    return {
      alreadyImported: true,
      dataset: duplicate,
      message: `Demo dataset "${duplicate.name}" is already available in this workspace.`
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
    tags: demoItem.tags
  };

  const dataset = await DatasetModel.create({
    organizationId: requireObjectId(options.organizationId, 'Organization'),
    workspaceId: resolvedWorkspaceId ? toObjectId(resolvedWorkspaceId) : null,
    name: targetName,
    description: demoItem.description,
    sourceType: demoItem.sourceType,
    fileName: demoItem.fileName,
    rowCount: demoItem.rowCount,
    columnCount: demoItem.columnCount,
    type: DATASET_TYPE.UPLOADED,
    status: DATASET_STATUS.ACTIVE,
    dataSourceId: null,
    schemaMeta,
    createdById: requireObjectId(options.userId, 'User')
  });

  await DatasetColumnModel.insertMany(
    demoItem.columns.map((col, idx) => ({
      datasetId: dataset._id,
      name: col.name,
      dataType: mapToColumnType(col.type),
      nullable: col.nullable !== false,
      ordinalPosition: idx + 1
    }))
  );

  const createdColumns = await listDatasetColumns([dataset._id.toString()]);

  const safeDataset = buildSafeDataset({
    id: dataset._id.toString(),
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId,
    dataSourceId: dataset.dataSourceId,
    name: dataset.name,
    description: dataset.description,
    sourceType: dataset.sourceType,
    fileName: dataset.fileName,
    fileSize: dataset.fileSize,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    type: dataset.type,
    status: dataset.status,
    schemaMeta: (dataset.schemaMeta || {}) as unknown as Record<string, unknown>,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
    dataSource: null,
    columns: createdColumns.get(dataset._id.toString()) ?? []
  });

  return {
    alreadyImported: false,
    dataset: safeDataset,
    message: `Demo dataset "${dataset.name}" imported successfully.`
  };
}