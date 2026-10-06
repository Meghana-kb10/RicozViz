// ========================================
// Data Quality & Profiling Service (Phase 4)
// ========================================
// Safely profiles datasets without modifying data.
// Computes completeness, distinctness, statistical distributions,
// duplicate row counts, IQR outliers, invalid/type issues, and quality score.
// Persists profiling results into dataset.schemaMeta.dataQualityProfile.
// ========================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";
import { datasetQueryEngine } from "./query-engine.js";
import type { Dataset, DatasetColumn } from "@prisma/client";

export interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  sampleValues: unknown[];
  // Numeric statistics
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  median?: number | null;
  stdDev?: number | null;
  outliersCount?: number;
  outlierPercentage?: number;
  // Date statistics
  minDate?: string | null;
  maxDate?: string | null;
  // String statistics
  minLength?: number | null;
  maxLength?: number | null;
  blankCount?: number;
  // Type integrity & invalid values
  invalidCount?: number;
  invalidPercentage?: number;
}

export interface DataQualityWarning {
  column?: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  rule: string;
  message: string;
}

export interface DatasetQualitySummary {
  dataQualityScore: number; // 0 - 100
  missingDataCount: number;
  missingDataPercentage: number;
  duplicateRowsCount: number;
  duplicateRowsPercentage: number;
  typeIssuesCount: number;
  potentialOutliersCount: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
}

export interface DatasetProfileResult {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  qualityScore: number; // 0 - 100 (Backwards-compatible)
  summary: DatasetQualitySummary;
  columns: ColumnProfile[];
  warnings: DataQualityWarning[];
  evaluatedAt: string;
}

const MAX_PROFILE_SAMPLE_ROWS = 5000;

/**
 * Pure calculation function: Evaluates dataset columns and records
 * to produce a comprehensive profiling result.
 */
export function computeDatasetProfile(
  dataset: { id: string; name: string; schemaMeta?: unknown; columns?: DatasetColumn[] },
  rows: Record<string, unknown>[]
): DatasetProfileResult {
  const totalRows = rows.length;

  // 1. Identify schema columns and column types
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

  // 2. Handle empty dataset gracefully
  if (totalRows === 0) {
    const summary: DatasetQualitySummary = {
      dataQualityScore: 100,
      missingDataCount: 0,
      missingDataPercentage: 0,
      duplicateRowsCount: 0,
      duplicateRowsPercentage: 0,
      typeIssuesCount: 0,
      potentialOutliersCount: 0,
      grade: "EXCELLENT",
    };

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalRows: 0,
      totalColumns,
      duplicateRowsCount: 0,
      qualityScore: 100,
      summary,
      columns: columnList.map((colName) => ({
        name: colName,
        type: columnTypeMap.get(colName) || "string",
        totalCount: 0,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 0,
        uniquePercentage: 0,
        sampleValues: [],
        invalidCount: 0,
        invalidPercentage: 0,
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
  }

  // 3. Compute duplicate rows
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

  // 4. Profile each column
  const columnProfiles: ColumnProfile[] = [];
  const warnings: DataQualityWarning[] = [];
  let scoreDeductions = 0;
  let totalNullCells = 0;
  let totalTypeIssues = 0;
  let totalOutliersFound = 0;

  const duplicatePercentage = Math.round((duplicateRowsCount / totalRows) * 1000) / 10;
  if (duplicateRowsCount > 0) {
    warnings.push({
      severity: duplicatePercentage > 10 ? "HIGH" : "MEDIUM",
      rule: "DUPLICATE_ROWS",
      message: `Detected ${duplicateRowsCount} duplicate record(s) (${duplicatePercentage}% of dataset sample).`,
    });
    scoreDeductions += duplicatePercentage > 10 ? 15 : 6;
  }

  for (const colName of columnList) {
    const rawType = (columnTypeMap.get(colName) || "string").toLowerCase();
    const isNumeric =
      rawType === "number" ||
      rawType === "integer" ||
      rawType === "float" ||
      rawType === "decimal";
    const isDate =
      rawType === "date" ||
      rawType === "datetime" ||
      rawType === "timestamp";
    const isBoolean = rawType === "boolean" || rawType === "bool";

    let nullCount = 0;
    let blankCount = 0;
    let invalidCount = 0;
    const distinctSet = new Set<string>();
    const sampleValues: unknown[] = [];
    const numericValues: number[] = [];
    const validDates: number[] = [];
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

      // Type integrity validation
      if (isNumeric) {
        if (typeof val === "number") {
          if (isNaN(val)) {
            invalidCount++;
          } else {
            numericValues.push(val);
          }
        } else {
          const parsedNum = Number(val);
          if (isNaN(parsedNum)) {
            invalidCount++;
          } else {
            numericValues.push(parsedNum);
          }
        }
      } else if (isDate) {
        const parsedTimestamp = Date.parse(String(val));
        if (isNaN(parsedTimestamp)) {
          invalidCount++;
        } else {
          validDates.push(parsedTimestamp);
        }
      } else if (isBoolean) {
        const lower = String(val).toLowerCase().trim();
        if (
          lower !== "true" &&
          lower !== "false" &&
          lower !== "1" &&
          lower !== "0" &&
          typeof val !== "boolean"
        ) {
          invalidCount++;
        }
      }
    }

    totalNullCells += nullCount;
    totalTypeIssues += invalidCount;

    const nullPercentage = Math.round((nullCount / totalRows) * 1000) / 10;
    const invalidPercentage = Math.round((invalidCount / totalRows) * 1000) / 10;
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
      invalidCount,
      invalidPercentage,
    };

    // Date statistics
    if (isDate && validDates.length > 0) {
      validDates.sort((a, b) => a - b);
      profile.minDate = new Date(validDates[0]!).toISOString();
      profile.maxDate = new Date(validDates[validDates.length - 1]!).toISOString();
    }

    // Numeric statistics & Outlier detection
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

      totalOutliersFound += outliersCount;
      const outlierPercentage = Math.round((outliersCount / n) * 1000) / 10;

      profile.min = min;
      profile.max = max;
      profile.avg = avg;
      profile.median = median;
      profile.stdDev = stdDev;
      profile.outliersCount = outliersCount;
      profile.outlierPercentage = outlierPercentage;

      if (outliersCount > 0 && n >= 20) {
        if (outlierPercentage > 5) {
          warnings.push({
            column: colName,
            severity: "LOW",
            rule: "STATISTICAL_OUTLIERS",
            message: `Column "${colName}" has ${outliersCount} statistical outlier values (${outlierPercentage}%) outside 1.5x IQR range.`,
          });
          scoreDeductions += 3;
        }
      }
    }

    // Type issues warning
    if (invalidCount > 0) {
      warnings.push({
        column: colName,
        severity: invalidPercentage > 10 ? "HIGH" : "MEDIUM",
        rule: "TYPE_INCONSISTENCY",
        message: `Column "${colName}" contains ${invalidCount} value(s) (${invalidPercentage}%) that do not conform to expected type "${rawType}".`,
      });
      scoreDeductions += invalidPercentage > 10 ? 10 : 5;
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
      scoreDeductions += 4;
    }

    if (totalRows >= 10 && uniqueCount === 1) {
      warnings.push({
        column: colName,
        severity: "LOW",
        rule: "ZERO_VARIANCE",
        message: `Column "${colName}" contains only 1 constant value across all rows.`,
      });
      scoreDeductions += 3;
    }

    columnProfiles.push(profile);
  }

  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - scoreDeductions)));

  const totalCells = totalRows * totalColumns || 1;
  const missingDataPercentage = Math.round((totalNullCells / totalCells) * 1000) / 10;

  const summary: DatasetQualitySummary = {
    dataQualityScore: qualityScore,
    missingDataCount: totalNullCells,
    missingDataPercentage,
    duplicateRowsCount,
    duplicateRowsPercentage: duplicatePercentage,
    typeIssuesCount: totalTypeIssues,
    potentialOutliersCount: totalOutliersFound,
    grade:
      qualityScore >= 90
        ? "EXCELLENT"
        : qualityScore >= 75
          ? "GOOD"
          : qualityScore >= 50
            ? "FAIR"
            : "POOR",
  };

  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    totalRows,
    totalColumns,
    duplicateRowsCount,
    qualityScore,
    summary,
    columns: columnProfiles,
    warnings,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Profiles a dataset, enforcing workspace RBAC, computing all quality metrics,
 * and persisting the resulting profile in dataset.schemaMeta.dataQualityProfile.
 */
export async function profileDataset(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string,
  forceRefresh = false
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

  const existingMeta = (dataset.schemaMeta || {}) as Record<string, unknown>;

  // 3. Check cached profile if not forcing refresh
  if (!forceRefresh && existingMeta.dataQualityProfile) {
    const cached = existingMeta.dataQualityProfile as DatasetProfileResult;
    if (cached.datasetId === dataset.id && Array.isArray(cached.columns) && cached.columns.length > 0) {
      return cached;
    }
  }

  // 4. Safely obtain rows
  let rows: Record<string, unknown>[] = [];
  try {
    const queryResult = await datasetQueryEngine.executeQuery(dataset, {
      limit: MAX_PROFILE_SAMPLE_ROWS,
      offset: 0,
    });
    rows = queryResult.rows || [];
  } catch {
    // If query engine fails, fallback to sampleData in metadata safely
    rows = (existingMeta.sampleData || existingMeta.previewRows || []) as Record<string, unknown>[];
  }

  // 5. Compute comprehensive profile
  const profileResult = computeDatasetProfile(dataset, rows);

  // 6. Persist profile in dataset.schemaMeta.dataQualityProfile
  try {
    const updatedMeta = {
      ...existingMeta,
      dataQualityProfile: profileResult,
    };
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { schemaMeta: updatedMeta as any },
    });
  } catch {
    // Non-blocking persistence in case DB is read-only
  }

  // 7. Audit log
  await logAuditEvent({
    organizationId,
    userId,
    action: "DATASET_PROFILED",
    resourceType: "Dataset",
    resourceId: datasetId,
    metadata: {
      totalRows: profileResult.totalRows,
      totalColumns: profileResult.totalColumns,
      duplicateRowsCount: profileResult.duplicateRowsCount,
      qualityScore: profileResult.qualityScore,
      warningsCount: profileResult.warnings.length,
      grade: profileResult.summary.grade,
    },
  });

  return profileResult;
}

/**
 * Automatically generates and persists profile on dataset creation, upload, or refresh.
 */
export async function generateAndSaveDatasetProfile(
  datasetId: string,
  organizationId: string
): Promise<DatasetProfileResult | null> {
  try {
    const dataset = await prisma.dataset.findFirst({
      where: { id: datasetId, organizationId },
      include: { columns: true },
    });

    if (!dataset) return null;

    const existingMeta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    let rows: Record<string, unknown>[] = [];
    try {
      const queryResult = await datasetQueryEngine.executeQuery(dataset, {
        limit: MAX_PROFILE_SAMPLE_ROWS,
        offset: 0,
      });
      rows = queryResult.rows || [];
    } catch {
      rows = (existingMeta.sampleData || existingMeta.previewRows || []) as Record<string, unknown>[];
    }

    const profileResult = computeDatasetProfile(dataset, rows);

    const updatedMeta = {
      ...existingMeta,
      dataQualityProfile: profileResult,
    };

    await prisma.dataset.update({
      where: { id: datasetId },
      data: { schemaMeta: updatedMeta as any },
    });

    return profileResult;
  } catch {
    return null;
  }
}
