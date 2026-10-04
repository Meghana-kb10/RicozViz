// ========================================
// Data Quality & Profiling Service
// ========================================
// Safely profiles datasets without modifying data.
// Computes completeness, distinctness, statistical distributions,
// duplicate row counts, IQR outliers, and quality warnings.
// ========================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { datasetQueryEngine } from "./query-engine.js";

export interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  sampleValues: unknown[];
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  median?: number | null;
  stdDev?: number | null;
  outliersCount?: number;
  minLength?: number | null;
  maxLength?: number | null;
  blankCount?: number;
}

export interface DataQualityWarning {
  column?: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  rule: string;
  message: string;
}

export interface DatasetProfileResult {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  qualityScore: number; // 0 - 100
  columns: ColumnProfile[];
  warnings: DataQualityWarning[];
  evaluatedAt: string;
}

const MAX_PROFILE_SAMPLE_ROWS = 5000;

export async function profileDataset(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string
): Promise<DatasetProfileResult> {
  // 1. Fetch dataset
  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, organizationId },
    include: { columns: true },
  });

  if (!dataset) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  // 2. Authorize workspace access
  await verifyResourceWorkspaceAccess(
    { workspaceId: dataset.workspaceId, organizationId: dataset.organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  // 3. Safely obtain rows
  let rows: Record<string, unknown>[] = [];
  try {
    const queryResult = await datasetQueryEngine.executeQuery(dataset, {
      limit: MAX_PROFILE_SAMPLE_ROWS,
      offset: 0,
    });
    rows = queryResult.rows || [];
  } catch {
    // If query engine fails, fallback to sampleData in metadata safely
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    rows = (meta.sampleData || meta.previewRows || []) as Record<string, unknown>[];
  }

  const totalRows = rows.length;

  // 4. Identify columns
  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const schemaCols = (meta.columns || []) as Array<{ name: string; type?: string }>;
  const dbCols = dataset.columns || [];

  const columnNames = new Set<string>();
  const columnTypeMap = new Map<string, string>();

  for (const c of dbCols) {
    columnNames.add(c.name);
    columnTypeMap.set(c.name, (c.dataType || "STRING").toLowerCase());
  }

  for (const c of schemaCols) {
    columnNames.add(c.name);
    if (!columnTypeMap.has(c.name)) {
      columnTypeMap.set(c.name, (c.type || "string").toLowerCase());
    }
  }

  if (totalRows > 0 && columnNames.size === 0 && rows[0]) {
    Object.keys(rows[0]).forEach((k) => {
      columnNames.add(k);
      columnTypeMap.set(k, "string");
    });
  }

  const columnList = Array.from(columnNames);
  const totalColumns = columnList.length;

  // 5. Handle empty dataset gracefully
  if (totalRows === 0) {
    const emptyResult: DatasetProfileResult = {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalRows: 0,
      totalColumns,
      duplicateRowsCount: 0,
      qualityScore: 100,
      columns: columnList.map((colName) => ({
        name: colName,
        type: columnTypeMap.get(colName) || "string",
        totalCount: 0,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 0,
        uniquePercentage: 0,
        sampleValues: [],
      })),
      warnings: [
        {
          severity: "INFO",
          rule: "EMPTY_DATASET",
          message: "The dataset currently contains no records.",
        },
      ],
      evaluatedAt: new Date().toISOString(),
    };

    await logAuditEvent({
      organizationId,
      userId,
      action: "DATASET_PROFILED",
      resourceType: "Dataset",
      resourceId: datasetId,
      metadata: { totalRows: 0, qualityScore: 100 },
    });

    return emptyResult;
  }

  // 6. Compute duplicate rows
  const seenRowSignatures = new Set<string>();
  let duplicateRowsCount = 0;

  for (const row of rows) {
    const signature = JSON.stringify(row);
    if (seenRowSignatures.has(signature)) {
      duplicateRowsCount++;
    } else {
      seenRowSignatures.add(signature);
    }
  }

  // 7. Profile each column
  const columnProfiles: ColumnProfile[] = [];
  const warnings: DataQualityWarning[] = [];
  let scoreDeductions = 0;

  if (duplicateRowsCount > 0) {
    const dupPct = Math.round((duplicateRowsCount / totalRows) * 100);
    warnings.push({
      severity: dupPct > 10 ? "HIGH" : "MEDIUM",
      rule: "DUPLICATE_ROWS",
      message: `Detected ${duplicateRowsCount} duplicate record(s) (${dupPct}% of dataset sample).`,
    });
    scoreDeductions += dupPct > 10 ? 15 : 8;
  }

  for (const colName of columnList) {
    const rawType = (columnTypeMap.get(colName) || "string").toLowerCase();
    const isNumeric =
      rawType === "number" ||
      rawType === "integer" ||
      rawType === "float" ||
      rawType === "decimal";

    let nullCount = 0;
    let blankCount = 0;
    const distinctSet = new Set<string>();
    const sampleValues: unknown[] = [];
    const numericValues: number[] = [];
    let minLength: number | null = null;
    let maxLength: number | null = null;

    for (const row of rows) {
      const val = row[colName];

      if (val === null || val === undefined) {
        nullCount++;
        continue;
      }

      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed.length === 0) {
          blankCount++;
          nullCount++;
          continue;
        }
        if (minLength === null || trimmed.length < minLength) minLength = trimmed.length;
        if (maxLength === null || trimmed.length > maxLength) maxLength = trimmed.length;
      }

      const stringVal = String(val);
      if (!distinctSet.has(stringVal)) {
        distinctSet.add(stringVal);
        if (sampleValues.length < 5) {
          sampleValues.push(val);
        }
      }

      if (isNumeric) {
        const num = Number(val);
        if (!isNaN(num)) {
          numericValues.push(num);
        }
      }
    }

    const nullPercentage = Math.round((nullCount / totalRows) * 1000) / 10;
    const uniqueCount = distinctSet.size;
    const uniquePercentage = Math.round((uniqueCount / totalRows) * 1000) / 10;

    const profile: ColumnProfile = {
      name: colName,
      type: rawType,
      totalCount: totalRows,
      nullCount,
      nullPercentage,
      uniqueCount,
      uniquePercentage,
      sampleValues,
      blankCount: blankCount > 0 ? blankCount : undefined,
      minLength: minLength !== null ? minLength : undefined,
      maxLength: maxLength !== null ? maxLength : undefined,
    };

    // Numeric statistics
    if (isNumeric && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b);
      const n = numericValues.length;
      const min = numericValues[0]!;
      const max = numericValues[n - 1]!;
      const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
      const avg = Math.round((sum / n) * 100) / 100;

      // Median
      const mid = Math.floor(n / 2);
      const median =
        n % 2 !== 0
          ? numericValues[mid]!
          : Math.round(((numericValues[mid - 1]! + numericValues[mid]!) / 2) * 100) / 100;

      // Standard Deviation
      const variance =
        numericValues.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / n;
      const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

      // Outlier detection using 1.5 * IQR rule
      const q1Index = Math.floor(n * 0.25);
      const q3Index = Math.floor(n * 0.75);
      const q1 = numericValues[q1Index] ?? min;
      const q3 = numericValues[q3Index] ?? max;
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;

      let outliersCount = 0;
      for (const num of numericValues) {
        if (num < lowerFence || num > upperFence) {
          outliersCount++;
        }
      }

      profile.min = min;
      profile.max = max;
      profile.avg = avg;
      profile.median = median;
      profile.stdDev = stdDev;
      profile.outliersCount = outliersCount;

      if (outliersCount > 0 && n >= 20) {
        const outlierPct = Math.round((outliersCount / n) * 100);
        if (outlierPct > 5) {
          warnings.push({
            column: colName,
            severity: "LOW",
            rule: "STATISTICAL_OUTLIERS",
            message: `Column "${colName}" has ${outliersCount} outlier values outside 1.5x IQR range.`,
          });
          scoreDeductions += 3;
        }
      }
    }

    // Warnings on nulls and variance
    if (nullPercentage >= 100) {
      warnings.push({
        column: colName,
        severity: "HIGH",
        rule: "COMPLETELY_EMPTY_COLUMN",
        message: `Column "${colName}" is 100% null/empty.`,
      });
      scoreDeductions += 15;
    } else if (nullPercentage >= 40) {
      warnings.push({
        column: colName,
        severity: "HIGH",
        rule: "HIGH_NULL_RATE",
        message: `Column "${colName}" has ${nullPercentage}% missing values.`,
      });
      scoreDeductions += 10;
    } else if (nullPercentage >= 15) {
      warnings.push({
        column: colName,
        severity: "MEDIUM",
        rule: "MODERATE_NULL_RATE",
        message: `Column "${colName}" has ${nullPercentage}% missing values.`,
      });
      scoreDeductions += 5;
    }

    if (totalRows >= 10 && uniqueCount === 1) {
      warnings.push({
        column: colName,
        severity: "LOW",
        rule: "ZERO_VARIANCE",
        message: `Column "${colName}" contains only 1 constant value across all rows.`,
      });
      scoreDeductions += 4;
    }

    columnProfiles.push(profile);
  }

  const qualityScore = Math.max(0, Math.min(100, 100 - scoreDeductions));

  const result: DatasetProfileResult = {
    datasetId: dataset.id,
    datasetName: dataset.name,
    totalRows,
    totalColumns,
    duplicateRowsCount,
    qualityScore,
    columns: columnProfiles,
    warnings,
    evaluatedAt: new Date().toISOString(),
  };

  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_PROFILED",
    resourceType: "Dataset",
    resourceId: datasetId,
    metadata: {
      totalRows,
      totalColumns,
      duplicateRowsCount,
      qualityScore,
      warningsCount: warnings.length,
    },
  });

  return result;
}
