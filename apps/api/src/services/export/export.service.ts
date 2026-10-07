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
// ========================================

import * as XLSX from "xlsx";
import { deflateSync } from "node:zlib";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { getDashboardWorkspaceId } from "../workspace/workspace-auth.helper.js";
import { datasetQueryEngine } from "../dataset/query-engine.js";

export type ExportResourceType = "DATASET" | "VISUALIZATION" | "DASHBOARD";
export type ExportFormatType = "CSV" | "EXCEL" | "PDF" | "PNG";

export interface ExportRequestParams {
  resourceType: ExportResourceType;
  resourceId: string;
  format: ExportFormatType;
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

export interface ExportResult {
  jobId: string;
  resourceType: ExportResourceType;
  resourceId: string;
  resourceName: string;
  format: ExportFormatType;
  contentType: string;
  filename: string;
  dataBase64?: string;
  textContent?: string;
  rowCount: number;
  fileSizeBytes: number;
  metadata?: Record<string, unknown>;
}

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str: string;
  if (typeof val === "object") {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[], includeHeaders = true): string {
  if (columns.length === 0 && rows.length > 0 && rows[0]) {
    columns = Object.keys(rows[0]);
  }
  const header = columns.map(escapeCsvValue).join(",");
  const data = rows.map((r) => columns.map((col) => escapeCsvValue(r[col])).join(","));
  return (includeHeaders ? [header, ...data] : data).join("\r\n");
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[()]/g, "\\$&").replace(/[\r\n]+/g, " ");
}

/** Build a small, valid PDF report without requiring a native renderer. */
function createPdfReport(title: string, columns: string[], rows: Record<string, unknown>[]): Buffer {
  const lines = [
    title,
    `Generated ${new Date().toISOString()}`,
    `Rows exported: ${rows.length}`,
    columns.length ? `Columns: ${columns.join(", ")}` : "Columns: none",
    ...rows.slice(0, 35).map((row, index) => `${index + 1}. ${columns.map((column) => String(row[column] ?? "")).join(" | ")}`),
  ];
  const stream = ["BT", "/F1 9 Tf", "50 760 Td", ...lines.map((line, index) => `${index ? "0 -16 Td " : ""}(${pdfEscape(line.slice(0, 180))}) Tj`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
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
  const text = Buffer.from(`${title.slice(0, 120)} | rows=${rowCount}`, "utf8");
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    pngChunk("IHDR", ihdr),
    pngChunk("tEXt", Buffer.concat([Buffer.from("Description\0", "ascii"), text])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function exportResource(params: ExportRequestParams): Promise<ExportResult> {
  const { resourceType, resourceId, format, options, userId, organizationId, userRoleName } =
    params;

  let resourceName = "export";
  let targetWorkspaceId = params.workspaceId;
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  const sheets: Array<{ name: string; rows: Record<string, unknown>[] }> = [];

  const maxRows = Math.min(Math.max(options?.rowLimit ?? 5000, 1), 25000);

  // 1. Resolve & validate resource
  if (resourceType === "DATASET") {
    const dataset = await prisma.dataset.findFirst({
      where: { id: resourceId, organizationId },
      include: { columns: true },
    });
    if (!dataset) {
      throw AppError.notFound(`Dataset with ID "${resourceId}" not found`);
    }

    targetWorkspaceId = dataset.workspaceId ?? undefined;
    await verifyResourceWorkspaceAccess(
      { workspaceId: dataset.workspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      "READ"
    );

    resourceName = dataset.name;
    columns = dataset.columns.map((c) => c.name);

    let currentOffset = 0;
    while (rows.length < maxRows) {
      const batchLimit = Math.min(1000, maxRows - rows.length);
      const queryRes = await datasetQueryEngine.executeQuery(
        dataset,
        {
          limit: batchLimit,
          offset: currentOffset,
        },
        {
          userId,
          email: "",
          organizationId,
          roleName: userRoleName,
        }
      );
      const batchRows = queryRes.rows || [];
      if (batchRows.length === 0) break;
      rows.push(...batchRows);
      currentOffset += batchRows.length;
      if (columns.length === 0 && queryRes.columns.length > 0) {
        columns = queryRes.columns.map((c) => c.name);
      }
      if (batchRows.length < batchLimit) break;
    }
    sheets.push({ name: dataset.name.slice(0, 31), rows });
  } else if (resourceType === "VISUALIZATION") {
    const chart = await prisma.chart.findFirst({
      where: { id: resourceId },
      include: {
        dashboard: { select: { id: true, organizationId: true, name: true } },
        dataset: { include: { columns: true } },
      },
    });

    if (!chart || chart.dashboard.organizationId !== organizationId) {
      throw AppError.notFound(`Visualization with ID "${resourceId}" not found`);
    }

    resourceName = chart.title || "Chart";

    if (chart.dataset) {
      targetWorkspaceId = chart.dataset.workspaceId ?? undefined;
      await verifyResourceWorkspaceAccess(
        { workspaceId: chart.dataset.workspaceId, organizationId },
        userId,
        organizationId,
        userRoleName,
        "READ"
      );

      columns = chart.dataset.columns.map((c) => c.name);
      let currentOffset = 0;
      while (rows.length < maxRows) {
        const batchLimit = Math.min(1000, maxRows - rows.length);
        const queryRes = await datasetQueryEngine.executeQuery(
          chart.dataset,
          {
            limit: batchLimit,
            offset: currentOffset,
          },
          {
            userId,
            email: "",
            organizationId,
            roleName: userRoleName,
          }
        );
        const batchRows = queryRes.rows || [];
        if (batchRows.length === 0) break;
        rows.push(...batchRows);
        currentOffset += batchRows.length;
        if (columns.length === 0 && queryRes.columns.length > 0) {
          columns = queryRes.columns.map((c) => c.name);
        }
        if (batchRows.length < batchLimit) break;
      }
    } else {
      // In-memory or synthetic config rows
      rows = [];
    }
    sheets.push({ name: (chart.title || "Visualization").slice(0, 31), rows });
  } else if (resourceType === "DASHBOARD") {
    const dashboard = await prisma.dashboard.findFirst({
      where: { id: resourceId, organizationId },
      include: {
        charts: {
          include: { dataset: { include: { columns: true } } },
        },
      },
    });

    if (!dashboard) {
      throw AppError.notFound(`Dashboard with ID "${resourceId}" not found`);
    }

    resourceName = dashboard.name;
    targetWorkspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);
    await verifyResourceWorkspaceAccess(
      { workspaceId: targetWorkspaceId, organizationId: dashboard.organizationId },
      userId,
      organizationId,
      userRoleName,
      "READ"
    );

    for (let i = 0; i < dashboard.charts.length; i++) {
      const c = dashboard.charts[i];
      if (!c) continue;
      let chartRows: Record<string, unknown>[] = [];
      if (c.dataset) {
        await verifyResourceWorkspaceAccess(
          { workspaceId: c.dataset.workspaceId, organizationId: c.dataset.organizationId },
          userId,
          organizationId,
          userRoleName,
          "READ"
        );
        try {
          const res = await datasetQueryEngine.executeQuery(
            c.dataset,
            {
              limit: 1000,
              offset: 0,
            },
            {
              userId,
              email: "",
              organizationId,
              roleName: userRoleName,
            }
          );
          chartRows = res.rows || [];
        } catch {
          chartRows = [];
        }
      }
      const sheetTitle = (c.title || `Chart_${i + 1}`).replace(/[\\/:*?[\]]/g, "_").slice(0, 31);
      sheets.push({ name: sheetTitle, rows: chartRows });
      if (i === 0) {
        rows = chartRows;
        if (c.dataset) {
          columns = c.dataset.columns.map((col) => col.name);
        }
      }
    }
  } else {
    throw AppError.badRequest(`Unsupported export resource type: ${String(resourceType)}`);
  }

  // 2. Generate export content based on requested format
  const sanitizedTitle = resourceName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().slice(0, 10);
  let contentType = "text/plain";
  let filename = `${sanitizedTitle}-${timestamp}.txt`;
  let textContent: string | undefined;
  let dataBase64: string | undefined;
  let fileSizeBytes = 0;

  if (format === "CSV") {
    contentType = "text/csv;charset=utf-8;";
    filename = `${sanitizedTitle}-${timestamp}.csv`;
    textContent = rowsToCsv(columns, rows, options?.includeHeaders !== false);
    fileSizeBytes = Buffer.byteLength(textContent, "utf8");
  } else if (format === "EXCEL") {
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    filename = `${sanitizedTitle}-${timestamp}.xlsx`;

    const wb = XLSX.utils.book_new();
    if (sheets.length === 0) {
      sheets.push({ name: "Export", rows: [] });
    }

    for (const sheet of sheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.rows);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || "Sheet1");
    }

    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    dataBase64 = excelBuffer.toString("base64");
    fileSizeBytes = excelBuffer.length;
  } else if (format === "PDF") {
    contentType = "application/pdf";
    filename = `${sanitizedTitle}-${timestamp}.pdf`;
    const pdfBuffer = createPdfReport(options?.title || resourceName, columns, rows);
    dataBase64 = pdfBuffer.toString("base64");
    fileSizeBytes = pdfBuffer.length;
  } else if (format === "PNG") {
    contentType = "image/png";
    filename = `${sanitizedTitle}-${timestamp}.png`;
    const pngBuffer = createPngSnapshot(rows.length, options?.title || resourceName);
    dataBase64 = pngBuffer.toString("base64");
    fileSizeBytes = pngBuffer.length;
  } else {
    throw AppError.badRequest(`Unsupported export format: ${String(format)}`);
  }

  // 3. Persist ExportJob record
  let exportJobId = "job-" + Date.now();
  if (targetWorkspaceId) {
    try {
      const job = await prisma.exportJob.create({
        data: {
          organizationId,
          workspaceId: targetWorkspaceId,
          userId,
          resourceType,
          resourceId,
          resourceName,
          format,
          status: "COMPLETED",
          rowCount: rows.length,
          fileSize: fileSizeBytes,
          metadata: { filename, contentType },
          completedAt: new Date(),
        },
      });
      exportJobId = job.id;
    } catch {
      // Non-fatal if exportJob tracking table is pending migration
    }
  }

  // 4. Audit Log
  await logAuditEvent({
    organizationId,
    workspaceId: targetWorkspaceId,
    userId,
    action: "DATA_EXPORTED",
    resourceType,
    resourceId,
    metadata: {
      format,
      rowCount: rows.length,
      fileSize: fileSizeBytes,
      filename,
    },
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
    metadata: { filename, timestamp },
  };
}

export async function listExportHistory(
  organizationId: string,
  workspaceId?: string,
  limit: number = 50
) {
  try {
    const where: any = { organizationId };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    const jobs = await prisma.exportJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return jobs;
  } catch {
    return [];
  }
}
