// ========================================
// Advanced Export Center Service
// ========================================
// Centralized, multi-resource export engine supporting:
// - CSV (RFC 4180 compliant)
// - Excel (.xlsx multi-sheet workbooks via xlsx)
// - PDF / PNG export descriptors and snapshots
// - Scopes: Datasets, Visualizations, Dashboards
// - Strict workspace isolation & RBAC enforcement (DATA_EXPORT)
// - Persistent ExportJob tracking and Audit Logging
//
// MIGRATION NOTE
// --------------
// The legacy service delegated row retrieval to the shared
// `datasetQueryEngine`. That engine is being ported by the dataset module, so
// this file carries a *small self-contained raw row reader* that reads the
// stored rows straight out of the Dataset document's `schemaMeta` Mixed field
// (`sampleData` -> `previewRows` -> `rows`). The export path only ever issues
// raw, unfiltered, paginated queries, so nothing else is needed here.
// ========================================

import * as XLSX from 'xlsx';
import { deflateSync } from 'node:zlib';
import { z } from 'zod';
import type mongoose from 'mongoose';
import {
  ChartModel,
  DashboardModel,
  DatasetModel,
  ExportJobModel,
  WorkspaceMemberModel,
  WorkspaceModel,
  serializeDocs,
  toObjectId
} from '@repo/database';
import type { IExportJobDocument, IWorkspaceMemberDocument } from '@repo/database';
import { EXPORT_STATUS } from '@repo/types';
import type { ExportFormat, ExportJobData, ExportResourceType, ExportResult } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';

// ============================================================
// Validation schemas (messages are contractual)
// ============================================================

export const exportRequestSchema = z.object({
  resourceType: z.enum(['DATASET', 'VISUALIZATION', 'DASHBOARD']),
  resourceId: z.string().min(1, 'Resource ID is required'),
  format: z.enum(['CSV', 'EXCEL', 'PDF', 'PNG']),
  workspaceId: z.string().optional(),
  rowLimit: z.number().int().positive().max(25000).optional(),
  options: z
    .object({
      includeHeaders: z.boolean().optional(),
      rowLimit: z.number().int().positive().max(25000).optional(),
      title: z.string().optional()
    })
    .optional()
});

// ============================================================
// Types
// ============================================================

export interface ExportRequestParams {
  resourceType: ExportResourceType;
  resourceId: string;
  format: ExportFormat;
  options?: {
    includeHeaders?: boolean;
    rowLimit?: number;
    title?: string;
  };
  userId: string;
  organizationId: string;
  workspaceId?: string;
  userRoleName?: string;
}

// ============================================================
// Workspace authorization helpers
//
// Verbatim port of the legacy `workspace-auth.helper.ts` guards. They are kept
// local (rather than imported) because the workspace module is migrated by a
// separate workstream and this module must stay self-contained.
// ============================================================

export type WorkspaceAction = 'READ' | 'WRITE' | 'DELETE' | 'ADMIN' | 'SHARE';

export interface WorkspaceAccessContext {
  userRole: string;
  isOrgAdmin: boolean;
}

const inMemoryWorkspaceRoleStore = new Map<string, string>();

export function registerInMemoryWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: string
): void {
  inMemoryWorkspaceRoleStore.set(`${workspaceId}:${userId}`, role);
}

export function clearInMemoryWorkspaceMembers(): void {
  inMemoryWorkspaceRoleStore.clear();
}

/**
 * Dashboards predate the first-class workspace relation and keep their
 * workspace binding in layoutConfig. Keep the extraction in one place so all
 * dashboard-adjacent features apply the same tenant boundary.
 */
export function getDashboardWorkspaceId(layoutConfig: unknown): string | undefined {
  if (!layoutConfig || typeof layoutConfig !== 'object' || Array.isArray(layoutConfig)) {
    return undefined;
  }

  const workspaceId = (layoutConfig as Record<string, unknown>).workspaceId;
  return typeof workspaceId === 'string' && workspaceId.trim() ? workspaceId : undefined;
}

/** Load the workspace plus the caller's membership role. */
async function resolveWorkspaceAccess(
  workspaceId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<WorkspaceAccessContext> {
  const workspaceObjectId = toObjectId(workspaceId);
  const organizationObjectId = toObjectId(organizationId);
  const userObjectId = toObjectId(userId);

  const workspace = workspaceObjectId
    ? await WorkspaceModel.findOne({
        _id: workspaceObjectId,
        organizationId: organizationObjectId
      }).lean()
    : null;

  if (!workspace) {
    throw AppError.notFound('Workspace not found');
  }

  const isOrgAdmin = userRoleName === 'ADMIN';

  const membership =
    userObjectId && workspaceObjectId
      ? await WorkspaceMemberModel.findOne({
          workspaceId: workspaceObjectId,
          userId: userObjectId
        })
          .select('role')
          .lean<Pick<IWorkspaceMemberDocument, 'role'>>()
      : null;

  if (!membership && !isOrgAdmin) {
    throw AppError.forbidden('Access denied: You do not have access to this workspace');
  }

  return { userRole: membership?.role ?? 'ADMIN', isOrgAdmin };
}

/**
 * Verifies that the authenticated user has access to the workspace of the given
 * resource. Organization admins bypass workspace restrictions; every other
 * caller must hold a membership whose role satisfies `requiredAction`.
 */
export async function verifyResourceWorkspaceAccess(
  resource: { workspaceId?: string | null; organizationId: string },
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: WorkspaceAction = 'READ'
): Promise<void> {
  // 1. Organization tenant isolation
  if (resource.organizationId !== organizationId) {
    throw AppError.forbidden('Access denied: resource belongs to a different organization');
  }

  // 2. Organization admins bypass workspace restrictions
  if (userRoleName === 'ADMIN') {
    return;
  }

  // 3. Workspace scoping
  if (resource.workspaceId) {
    let userRole = inMemoryWorkspaceRoleStore.get(`${resource.workspaceId}:${userId}`);

    if (!userRole) {
      try {
        const access = await resolveWorkspaceAccess(
          resource.workspaceId,
          userId,
          organizationId,
          userRoleName
        );
        if (access.isOrgAdmin) {
          return; // Organization admins bypass workspace restrictions
        }
        userRole = access.userRole;
      } catch (err) {
        if (err instanceof AppError) throw err;
        return;
      }
    }

    if (requiredAction === 'READ') {
      // All workspace members (OWNER, ADMIN, MEMBER, EDITOR, VIEWER) can read
      return;
    }

    if (requiredAction === 'WRITE') {
      if (userRole === 'VIEWER') {
        throw AppError.forbidden('Access denied: Viewers have read-only access to this workspace');
      }
      return;
    }

    if (requiredAction === 'DELETE') {
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins can delete this resource'
        );
      }
      return;
    }

    if (requiredAction === 'SHARE') {
      if (userRole === 'VIEWER') {
        throw AppError.forbidden('Access denied: Viewers cannot share workspace resources');
      }
      return;
    }

    if (requiredAction === 'ADMIN') {
      if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
        throw AppError.forbidden(
          'Access denied: Only workspace owners and admins have administrative permissions'
        );
      }
      return;
    }
  }
}

// ============================================================
// Self-contained dataset row reader
// ============================================================

/** Minimum shape this reader needs from a stored dataset document. */
export interface ReadableDataset {
  name: string;
  schemaMeta?: unknown;
}

/** Column name / type pairs stored inside `schemaMeta.columns`. */
interface SchemaColumn {
  name: string;
  type: string;
}

function getSchemaMeta(schemaMeta: unknown): Record<string, unknown> {
  if (!schemaMeta || typeof schemaMeta !== 'object' || Array.isArray(schemaMeta)) {
    return {};
  }
  return schemaMeta as Record<string, unknown>;
}

function getSchemaColumns(schemaMeta: unknown): SchemaColumn[] {
  const meta = getSchemaMeta(schemaMeta);
  if (!Array.isArray(meta.columns)) {
    return [];
  }
  const columns: SchemaColumn[] = [];
  for (const entry of meta.columns as unknown[]) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const column = entry as { name?: unknown; type?: unknown; dataType?: unknown };
    if (typeof column.name !== 'string' || column.name.length === 0) {
      continue;
    }
    const type = column.dataType ?? column.type;
    columns.push({
      name: column.name,
      type: typeof type === 'string' && type ? type.toLowerCase() : 'string'
    });
  }
  return columns;
}

/**
 * Ordered column names for a dataset. Falls back to the union of the keys
 * present on the stored rows when the schema declares no columns, mirroring
 * the legacy CSV writer's own `Object.keys(rows[0])` fallback.
 */
export function getDatasetColumnNames(schemaMeta: unknown): string[] {
  const declared = getSchemaColumns(schemaMeta).map((column) => column.name);
  if (declared.length > 0) {
    return declared;
  }

  const meta = getSchemaMeta(schemaMeta);
  const raw = (meta.sampleData || meta.previewRows || meta.rows || []) as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }

  const names: string[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    for (const key of Object.keys(row)) {
      if (!names.includes(key)) {
        names.push(key);
      }
    }
  }
  return names;
}

/** Rows persisted on the dataset document (`sampleData` -> `previewRows` -> `rows`). */
export function readDatasetRows(schemaMeta: unknown): Record<string, unknown>[] {
  const meta = getSchemaMeta(schemaMeta);
  const raw = (meta.sampleData || meta.previewRows || meta.rows || []) as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object'
  );
}

export interface RawDatasetPage {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

/**
 * Raw (non-aggregated) page of dataset rows, projected onto the known columns
 * exactly like the legacy in-memory query engine's RAW branch.
 */
export function queryRawDatasetPage(
  dataset: ReadableDataset,
  params: { limit?: number; offset?: number } = {}
): RawDatasetPage {
  const columns = getDatasetColumnNames(dataset.schemaMeta);
  const allRows = readDatasetRows(dataset.schemaMeta);

  const offset = Math.max(params.offset ?? 0, 0);
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000);

  const rows = allRows.slice(offset, offset + limit).map((row) => {
    const projected: Record<string, unknown> = {};
    for (const column of columns) {
      projected[column] = row[column] ?? null;
    }
    return projected;
  });

  return { columns, rows, total: allRows.length };
}

// ============================================================
// Format writers
// ============================================================

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str: string;
  if (typeof val === 'object') {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(
  columns: string[],
  rows: Record<string, unknown>[],
  includeHeaders = true
): string {
  let resolvedColumns = columns;
  if (resolvedColumns.length === 0 && rows.length > 0 && rows[0]) {
    resolvedColumns = Object.keys(rows[0]);
  }
  const header = resolvedColumns.map(escapeCsvValue).join(',');
  const data = rows.map((r) => resolvedColumns.map((col) => escapeCsvValue(r[col])).join(','));
  return (includeHeaders ? [header, ...data] : data).join('\r\n');
}

function pdfEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/[()]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
}

/** Build a small, valid PDF report without requiring a native renderer. */
function createPdfReport(
  title: string,
  columns: string[],
  rows: Record<string, unknown>[]
): Buffer {
  const lines = [
    title,
    `Generated ${new Date().toISOString()}`,
    `Rows exported: ${rows.length}`,
    columns.length ? `Columns: ${columns.join(', ')}` : 'Columns: none',
    ...rows
      .slice(0, 35)
      .map(
        (row, index) =>
          `${index + 1}. ${columns.map((column) => String(row[column] ?? '')).join(' | ')}`
      )
  ];
  const stream = [
    'BT',
    '/F1 9 Tf',
    '50 760 Td',
    ...lines.map(
      (line, index) => `${index ? '0 -16 Td ' : ''}(${pdfEscape(line.slice(0, 180))}) Tj`
    ),
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([length, body, checksum]);
}

/** Create a valid dashboard snapshot PNG with a lightweight bar summary. */
function createPngSnapshot(rowCount: number, title: string): Buffer {
  const width = 1200;
  const height = 630;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 3 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const offset = rowOffset + 1 + x * 3;
      const panel = x > 40 && x < 1160 && y > 40 && y < 590;
      raw[offset] = panel ? 15 + Math.floor((x / width) * 10) : 7;
      raw[offset + 1] = panel ? 28 + Math.floor((y / height) * 12) : 17;
      raw[offset + 2] = panel ? 50 + Math.floor((x / width) * 18) : 31;
      if (panel && y > 360 && y < 540) {
        const barWidth = Math.max(24, Math.min(180, rowCount ? Math.ceil(rowCount / 8) : 24));
        const barIndex = Math.floor((x - 80) / 220);
        const barX = 80 + barIndex * 220;
        const barHeight = Math.min(150, 30 + ((rowCount + barIndex * 17) % 120));
        if (x >= barX && x < barX + barWidth && y >= 540 - barHeight) {
          raw[offset] = 56;
          raw[offset + 1] = 189;
          raw[offset + 2] = 248;
        }
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const text = Buffer.from(`${title.slice(0, 120)} | rows=${rowCount}`, 'utf8');
  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.concat([Buffer.from('Description\0', 'ascii'), text])),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ============================================================
// Service methods
// ============================================================

/** Load a chart's owning dashboard projection. */
async function loadChartDashboard(
  dashboardId: mongoose.Types.ObjectId
): Promise<{ organizationId: mongoose.Types.ObjectId; name: string } | null> {
  return DashboardModel.findById(dashboardId).select('organizationId name').lean();
}

/**
 * POST /api/v1/exports
 * Execute a bounded export for a dataset, visualization, or dashboard.
 */
export async function exportResource(params: ExportRequestParams): Promise<ExportResult> {
  const { resourceType, resourceId, format, options, userId, organizationId, userRoleName } =
    params;

  let resourceName = 'export';
  let targetWorkspaceId = params.workspaceId;
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  const sheets: Array<{ name: string; rows: Record<string, unknown>[] }> = [];

  const maxRows = Math.min(Math.max(options?.rowLimit ?? 5000, 1), 25000);

  const resourceObjectId = toObjectId(resourceId);
  const organizationObjectId = toObjectId(organizationId);
  const userObjectId = toObjectId(userId);

  // 1. Resolve & validate resource
  if (resourceType === 'DATASET') {
    const dataset =
      resourceObjectId && organizationObjectId
        ? await DatasetModel.findOne({
            _id: resourceObjectId,
            organizationId: organizationObjectId
          }).lean()
        : null;

    if (!dataset) {
      throw AppError.notFound(`Dataset with ID "${resourceId}" not found`);
    }

    targetWorkspaceId = dataset.workspaceId ? dataset.workspaceId.toString() : undefined;
    await verifyResourceWorkspaceAccess(
      {
        workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
        organizationId
      },
      userId,
      organizationId,
      userRoleName,
      'READ'
    );

    resourceName = dataset.name;
    columns = getDatasetColumnNames(dataset.schemaMeta);

    let currentOffset = 0;
    while (rows.length < maxRows) {
      const batchLimit = Math.min(1000, maxRows - rows.length);
      const page = queryRawDatasetPage(dataset, { limit: batchLimit, offset: currentOffset });
      const batchRows = page.rows || [];
      if (batchRows.length === 0) break;
      rows.push(...batchRows);
      currentOffset += batchRows.length;
      if (columns.length === 0 && page.columns.length > 0) {
        columns = page.columns;
      }
      if (batchRows.length < batchLimit) break;
    }
    sheets.push({ name: dataset.name.slice(0, 31), rows });
  } else if (resourceType === 'VISUALIZATION') {
    const chart = resourceObjectId ? await ChartModel.findById(resourceObjectId).lean() : null;

    const chartDashboard = chart ? await loadChartDashboard(chart.dashboardId) : null;

    if (!chart || !chartDashboard || chartDashboard.organizationId.toString() !== organizationId) {
      throw AppError.notFound(`Visualization with ID "${resourceId}" not found`);
    }

    resourceName = chart.title || 'Chart';

    const dataset = chart.datasetId ? await DatasetModel.findById(chart.datasetId).lean() : null;

    if (dataset) {
      targetWorkspaceId = dataset.workspaceId ? dataset.workspaceId.toString() : undefined;
      await verifyResourceWorkspaceAccess(
        {
          workspaceId: dataset.workspaceId ? dataset.workspaceId.toString() : null,
          organizationId
        },
        userId,
        organizationId,
        userRoleName,
        'READ'
      );

      columns = getDatasetColumnNames(dataset.schemaMeta);
      let currentOffset = 0;
      while (rows.length < maxRows) {
        const batchLimit = Math.min(1000, maxRows - rows.length);
        const page = queryRawDatasetPage(dataset, { limit: batchLimit, offset: currentOffset });
        const batchRows = page.rows || [];
        if (batchRows.length === 0) break;
        rows.push(...batchRows);
        currentOffset += batchRows.length;
        if (columns.length === 0 && page.columns.length > 0) {
          columns = page.columns;
        }
        if (batchRows.length < batchLimit) break;
      }
    } else {
      // In-memory or synthetic config rows
      rows = [];
    }
    sheets.push({ name: (chart.title || 'Visualization').slice(0, 31), rows });
  } else if (resourceType === 'DASHBOARD') {
    const dashboard =
      resourceObjectId && organizationObjectId
        ? await DashboardModel.findOne({
            _id: resourceObjectId,
            organizationId: organizationObjectId
          }).lean()
        : null;

    if (!dashboard) {
      throw AppError.notFound(`Dashboard with ID "${resourceId}" not found`);
    }

    resourceName = dashboard.name;
    targetWorkspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
    await verifyResourceWorkspaceAccess(
      {
        workspaceId: targetWorkspaceId ?? null,
        organizationId: dashboard.organizationId.toString()
      },
      userId,
      organizationId,
      userRoleName,
      'READ'
    );

    const dashboardCharts = await ChartModel.find({ dashboardId: dashboard._id }).lean();

    for (let i = 0; i < dashboardCharts.length; i++) {
      const c = dashboardCharts[i];
      if (!c) continue;
      let chartRows: Record<string, unknown>[] = [];
      const chartDataset = c?.datasetId
        ? await DatasetModel.findById(c.datasetId).lean()
        : null;

      if (chartDataset) {
        await verifyResourceWorkspaceAccess(
          {
            workspaceId: chartDataset.workspaceId ? chartDataset.workspaceId.toString() : null,
            organizationId: chartDataset.organizationId.toString()
          },
          userId,
          organizationId,
          userRoleName,
          'READ'
        );
        try {
          const res = queryRawDatasetPage(chartDataset, { limit: 1000, offset: 0 });
          chartRows = res.rows || [];
        } catch {
          chartRows = [];
        }
      }
      const sheetTitle = (c.title || `Chart_${i + 1}`).replace(/[\\/:*?[\]]/g, '_').slice(0, 31);
      sheets.push({ name: sheetTitle, rows: chartRows });
      if (i === 0) {
        rows = chartRows;
        if (chartDataset) {
          columns = getDatasetColumnNames(chartDataset.schemaMeta);
        }
      }
    }
  } else {
    throw AppError.badRequest(`Unsupported export resource type: ${String(resourceType)}`);
  }

  // 2. Generate export content based on requested format
  const sanitizedTitle = resourceName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  let contentType = 'text/plain';
  let filename = `${sanitizedTitle}-${timestamp}.txt`;
  let textContent: string | undefined;
  let dataBase64: string | undefined;
  let fileSizeBytes = 0;

  if (format === 'CSV') {
    contentType = 'text/csv;charset=utf-8;';
    filename = `${sanitizedTitle}-${timestamp}.csv`;
    textContent = rowsToCsv(columns, rows, options?.includeHeaders !== false);
    fileSizeBytes = Buffer.byteLength(textContent, 'utf8');
  } else if (format === 'EXCEL') {
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    filename = `${sanitizedTitle}-${timestamp}.xlsx`;

    const wb = XLSX.utils.book_new();
    if (sheets.length === 0) {
      sheets.push({ name: 'Export', rows: [] });
    }

    for (const sheet of sheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
    }

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    dataBase64 = excelBuffer.toString('base64');
    fileSizeBytes = excelBuffer.length;
  } else if (format === 'PDF') {
    contentType = 'application/pdf';
    filename = `${sanitizedTitle}-${timestamp}.pdf`;
    const pdfBuffer = createPdfReport(options?.title || resourceName, columns, rows);
    dataBase64 = pdfBuffer.toString('base64');
    fileSizeBytes = pdfBuffer.length;
  } else if (format === 'PNG') {
    contentType = 'image/png';
    filename = `${sanitizedTitle}-${timestamp}.png`;
    const pngBuffer = createPngSnapshot(rows.length, options?.title || resourceName);
    dataBase64 = pngBuffer.toString('base64');
    fileSizeBytes = pngBuffer.length;
  } else {
    throw AppError.badRequest(`Unsupported export format: ${String(format)}`);
  }

  // 3. Persist ExportJob record
  let exportJobId = 'job-' + Date.now();
  if (targetWorkspaceId) {
    try {
      const workspaceObjectId = toObjectId(targetWorkspaceId);
      const job =
        workspaceObjectId && organizationObjectId && userObjectId && resourceObjectId
          ? await ExportJobModel.create({
              organizationId: organizationObjectId,
              workspaceId: workspaceObjectId,
              userId: userObjectId,
              resourceType,
              resourceId: resourceObjectId,
              resourceName,
              format,
              status: EXPORT_STATUS.COMPLETED,
              rowCount: rows.length,
              fileSize: fileSizeBytes,
              metadata: { filename, contentType },
              completedAt: new Date()
            })
          : null;
      if (job) {
        exportJobId = job._id.toString();
      }
    } catch (error) {
      // Non-fatal if exportJob tracking is unavailable
      logger.warn('Failed to persist ExportJob record', {
        resourceType,
        resourceId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 4. Audit Log
  await logAuditEvent({
    organizationId,
    workspaceId: targetWorkspaceId,
    userId,
    action: 'DATA_EXPORTED',
    resourceType,
    resourceId,
    metadata: {
      format,
      rowCount: rows.length,
      fileSize: fileSizeBytes,
      filename
    }
  });

  return {
    jobId: exportJobId,
    resourceType,
    resourceId,
    resourceName,
    format,
    contentType,
    filename,
    textContent,
    dataBase64,
    rowCount: rows.length,
    fileSizeBytes,
    metadata: { filename, timestamp }
  };
}

/**
 * GET /api/v1/exports/history
 * List recent export executions for the current workspace / organization.
 */
export async function listExportHistory(
  organizationId: string,
  workspaceId?: string,
  limit = 50
): Promise<ExportJobData[]> {
  try {
    const filter: mongoose.QueryFilter<IExportJobDocument> = {
      organizationId: toObjectId(organizationId)
    };
    if (workspaceId) {
      filter.workspaceId = toObjectId(workspaceId);
    }
    const jobs = await ExportJobModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .populate('user', 'name email')
      .exec();

    return serializeDocs<ExportJobData>(jobs, { virtuals: true });
  } catch (error) {
    logger.warn('Failed to list export history', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}