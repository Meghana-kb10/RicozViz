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

export interface CategoricalValueDistribution {
  value: string;
  count: number;
  percentage: number;
}

export interface ColumnProfile {
  name: string;
  type: string;
  totalCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  cardinality?: number;
  sampleValues: unknown[];
  // Numeric statistics
  min?: number | null;
  max?: number | null;
  avg?: number | null;
  mean?: number | null;
  median?: number | null;
  stdDev?: number | null;
  outliersCount?: number;
  outlierPercentage?: number;
  outliers?: number[];
  // Categorical statistics
  topValues?: CategoricalValueDistribution[];
  frequency?: Record<string, number>;
  distribution?: Record<string, number>;
  // Date statistics
  minDate?: string | null;
  maxDate?: string | null;
  invalidDates?: number;
  missingDates?: number;
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

export interface QualityScoreBreakdown {
  completeness: number;
  validity: number;
  consistency: number;
  uniqueness: number;
  weights: {
    completeness: number;
    validity: number;
    consistency: number;
    uniqueness: number;
  };
  formula: string;
}

export interface DatasetQualitySummary {
  dataQualityScore: number; // 0 - 100
  completenessPercentage: number; // 0 - 100
  missingDataCount: number;
  missingDataPercentage: number;
  duplicateRowsCount: number;
  duplicateRowsPercentage: number;
  typeIssuesCount: number;
  potentialOutliersCount: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  scoreBreakdown: QualityScoreBreakdown;
  dataTypeDistribution: Record<string, number>;
}

export interface DatasetProfileResult {
  datasetId: string;
  datasetName: string;
  totalRows: number;
  totalColumns: number;
  duplicateRowsCount: number;
  completenessPercentage: number;
  dataTypeDistribution: Record<string, number>;
  qualityScore: number;
  scoreBreakdown: QualityScoreBreakdown;
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

  if (totalRows > 0 && rows[0]) {
    for (const row of rows) {
      Object.keys(row).forEach((k) => columnNames.add(k));
    }
    for (const col of columnNames) {
      if (!columnTypeMap.has(col)) {
        let inferred = "string";
        for (const r of rows) {
          const v = r[col];
          if (v === null || v === undefined) continue;
          if (typeof v === "number" && !isNaN(v)) {
            inferred = "number";
            break;
          } else if (typeof v === "boolean") {
            inferred = "boolean";
            break;
          } else if (typeof v === "string") {
            const trimmed = v.trim();
            if (
              trimmed.length >= 8 &&
              (trimmed.includes("-") || trimmed.includes("/") || trimmed.includes("T")) &&
              !isNaN(Date.parse(trimmed))
            ) {
              inferred = "date";
              break;
            }
          }
        }
        columnTypeMap.set(col, inferred);
      }
    }
  }

  const columnList = Array.from(columnNames);
  const totalColumns = columnList.length;

  // Data-type distribution
  const dataTypeDistribution: Record<string, number> = {};
  for (const colName of columnList) {
    const rawType = (columnTypeMap.get(colName) || "string").toLowerCase();
    dataTypeDistribution[rawType] = (dataTypeDistribution[rawType] || 0) + 1;
  }

  // 2. Handle empty dataset gracefully
  if (totalRows === 0) {
    const emptyBreakdown: QualityScoreBreakdown = {
      completeness: 100,
      validity: 100,
      consistency: 100,
      uniqueness: 100,
      weights: { completeness: 0.35, validity: 0.25, consistency: 0.2, uniqueness: 0.2 },
      formula: "Quality Score = (Completeness × 35%) + (Validity × 25%) + (Consistency × 20%) + (Uniqueness × 20%)",
    };

    const summary: DatasetQualitySummary = {
      dataQualityScore: 100,
      completenessPercentage: 100,
      missingDataCount: 0,
      missingDataPercentage: 0,
      duplicateRowsCount: 0,
      duplicateRowsPercentage: 0,
      typeIssuesCount: 0,
      potentialOutliersCount: 0,
      grade: "EXCELLENT",
      scoreBreakdown: emptyBreakdown,
      dataTypeDistribution,
    };

    return {
      datasetId: dataset.id,
      datasetName: dataset.name,
      totalRows: 0,
      totalColumns,
      duplicateRowsCount: 0,
      completenessPercentage: 100,
      dataTypeDistribution,
      qualityScore: 100,
      scoreBreakdown: emptyBreakdown,
      summary,
      columns: columnList.map((colName) => ({
        name: colName,
        type: columnTypeMap.get(colName) || "string",
        totalCount: 0,
        nullCount: 0,
        nullPercentage: 0,
        uniqueCount: 0,
        uniquePercentage: 0,
        cardinality: 0,
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
  let totalNullCells = 0;
  let totalTypeIssues = 0;
  let totalOutliersFound = 0;
  let inconsistentCategoricalCols = 0;

  const duplicatePercentage = Math.round((duplicateRowsCount / totalRows) * 1000) / 10;
  if (duplicateRowsCount > 0) {
    warnings.push({
      severity: duplicatePercentage > 10 ? "HIGH" : "MEDIUM",
      rule: "DUPLICATE_ROWS",
      message: `Detected ${duplicateRowsCount} duplicate record(s) (${duplicatePercentage}% of dataset sample).`,
    });
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

    // Value counts for categorical distribution
    const rawValueCounts = new Map<string, number>();
    // For case inconsistency detection: norm -> Map<raw, count>
    const casingVariantsMap = new Map<string, Map<string, number>>();

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

        // Categorical tracking
        const strVal = trimmed;
        rawValueCounts.set(strVal, (rawValueCounts.get(strVal) || 0) + 1);

        const normKey = strVal.toLowerCase();
        if (!casingVariantsMap.has(normKey)) {
          casingVariantsMap.set(normKey, new Map());
        }
        const vMap = casingVariantsMap.get(normKey)!;
        vMap.set(strVal, (vMap.get(strVal) || 0) + 1);
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
      cardinality: uniqueCount,
      sampleValues,
      blankCount: blankCount > 0 ? blankCount : undefined,
      minLength: minLength !== null ? minLength : undefined,
      maxLength: maxLength !== null ? maxLength : undefined,
      invalidCount,
      invalidPercentage,
    };

    // Date statistics
    if (isDate) {
      profile.invalidDates = invalidCount;
      profile.missingDates = nullCount;
      if (validDates.length > 0) {
        validDates.sort((a, b) => a - b);
        profile.minDate = new Date(validDates[0]!).toISOString();
        profile.maxDate = new Date(validDates[validDates.length - 1]!).toISOString();
      }
    }

    // Categorical statistics (Top values, Frequency & Distribution)
    if (!isNumeric && !isDate && rawValueCounts.size > 0) {
      const sortedValues = Array.from(rawValueCounts.entries()).sort((a, b) => b[1] - a[1]);
      const nonNullRowCount = totalRows - nullCount || 1;

      const topValues: CategoricalValueDistribution[] = sortedValues.slice(0, 10).map(([val, cnt]) => ({
        value: val,
        count: cnt,
        percentage: Math.round((cnt / nonNullRowCount) * 1000) / 10,
      }));

      const frequency: Record<string, number> = {};
      const distribution: Record<string, number> = {};
      sortedValues.slice(0, 15).forEach(([val, cnt]) => {
        frequency[val] = cnt;
        distribution[val] = Math.round((cnt / nonNullRowCount) * 1000) / 10;
      });

      profile.topValues = topValues;
      profile.frequency = frequency;
      profile.distribution = distribution;

      // Inconsistent categorical values detection (e.g. India / india / INDIA)
      const foundInconsistencies: string[] = [];
      for (const [, vMap] of casingVariantsMap.entries()) {
        if (vMap.size > 1) {
          const variantsStr = Array.from(vMap.entries())
            .map(([varName, count]) => `${varName} (${Math.round((count / nonNullRowCount) * 100)}%)`)
            .join(" / ");
          foundInconsistencies.push(variantsStr);
        }
      }

      if (foundInconsistencies.length > 0) {
        inconsistentCategoricalCols++;
        warnings.push({
          column: colName,
          severity: "MEDIUM",
          rule: "INCONSISTENT_CATEGORICAL_VALUES",
          message: `Potential casing/formatting inconsistency in "${colName}": ${foundInconsistencies
            .slice(0, 3)
            .join("; ")}. Standardize values to a consistent representation.`,
        });
      }

      // High-cardinality detection on categorical columns
      if (totalRows >= 20 && uniquePercentage > 95 && !/id|_id|uuid|key/i.test(colName)) {
        warnings.push({
          column: colName,
          severity: "LOW",
          rule: "HIGH_CARDINALITY",
          message: `Column "${colName}" has high cardinality (${uniquePercentage}% distinct values). Likely an identifier or freeform text rather than a categorizable attribute.`,
        });
      }
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

      const outlierValues: number[] = [];
      let outliersCount = 0;
      for (const num of numericValues) {
        if (num < lowerFence || num > upperFence) {
          outliersCount++;
          if (outlierValues.length < 10) outlierValues.push(num);
        }
      }

      totalOutliersFound += outliersCount;
      const outlierPercentage = Math.round((outliersCount / n) * 1000) / 10;

      profile.min = min;
      profile.max = max;
      profile.avg = avg;
      profile.mean = avg;
      profile.median = median;
      profile.stdDev = stdDev;
      profile.outliers = outlierValues;
      profile.outliersCount = outliersCount;
      profile.outlierPercentage = outlierPercentage;

      if (outliersCount > 0 && n >= 4) {
        if (outlierPercentage > 5) {
          warnings.push({
            column: colName,
            severity: "LOW",
            rule: "STATISTICAL_OUTLIERS",
            message: `Column "${colName}" has ${outliersCount} statistical outlier values (${outlierPercentage}%) outside 1.5x IQR range.`,
          });
        }
      }

      // Suspicious negative values in positive domains (price, amount, age, quantity, stock)
      const negativeValuesCount = numericValues.filter((v) => v < 0).length;
      if (
        negativeValuesCount > 0 &&
        /price|amount|age|quantity|count|stock|cost|revenue|sales/i.test(colName)
      ) {
        warnings.push({
          column: colName,
          severity: "HIGH",
          rule: "SUSPICIOUS_VALUES",
          message: `Column "${colName}" contains ${negativeValuesCount} suspicious negative value(s) in a domain where values should typically be non-negative.`,
        });
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

      if (isDate) {
        warnings.push({
          column: colName,
          severity: "HIGH",
          rule: "INVALID_DATES",
          message: `Column "${colName}" contains ${invalidCount} invalid date value(s) that could not be parsed.`,
        });
      }
    }

    // Warnings on nulls and empty columns
    if (nullPercentage >= 100) {
      warnings.push({
        column: colName,
        severity: "HIGH",
        rule: "COMPLETELY_EMPTY_COLUMN",
        message: `Column "${colName}" is 100% empty (contains no non-null records).`,
      });
    } else if (nullPercentage >= 40) {
      warnings.push({
        column: colName,
        severity: "HIGH",
        rule: "HIGH_NULL_RATE",
        message: `Column "${colName}" has ${nullPercentage}% missing values.`,
      });
    } else if (nullPercentage >= 15) {
      warnings.push({
        column: colName,
        severity: "MEDIUM",
        rule: "MODERATE_NULL_RATE",
        message: `Column "${colName}" has ${nullPercentage}% missing values.`,
      });
    }

    if (totalRows >= 10 && uniqueCount === 1) {
      warnings.push({
        column: colName,
        severity: "LOW",
        rule: "ZERO_VARIANCE",
        message: `Column "${colName}" contains only 1 constant value across all rows.`,
      });
    }

    columnProfiles.push(profile);
  }

  // 5. Deterministic Quality Score Calculation
  const totalCells = totalRows * totalColumns || 1;
  const missingDataPercentage = Math.round((totalNullCells / totalCells) * 1000) / 10;
  const completenessPercentage = Math.max(0, Math.min(100, Math.round(((totalCells - totalNullCells) / totalCells) * 1000) / 10));

  const nonNullCells = Math.max(1, totalCells - totalNullCells);
  const totalValidCells = Math.max(0, nonNullCells - totalTypeIssues);
  const validityPercentage = Math.max(0, Math.min(100, Math.round((totalValidCells / nonNullCells) * 1000) / 10));

  const uniquenessPercentage = Math.max(0, Math.min(100, Math.round((100 - duplicatePercentage) * 10) / 10));

  let consistencyDeductions = 0;
  if (inconsistentCategoricalCols > 0) consistencyDeductions += Math.min(30, inconsistentCategoricalCols * 10);
  if (totalOutliersFound > 0) consistencyDeductions += 10;
  const consistencyPercentage = Math.max(0, Math.min(100, 100 - consistencyDeductions));

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completenessPercentage * 0.35 +
        validityPercentage * 0.25 +
        uniquenessPercentage * 0.20 +
        consistencyPercentage * 0.20
      )
    )
  );

  const scoreBreakdown: QualityScoreBreakdown = {
    completeness: completenessPercentage,
    validity: validityPercentage,
    consistency: consistencyPercentage,
    uniqueness: uniquenessPercentage,
    weights: {
      completeness: 0.35,
      validity: 0.25,
      consistency: 0.20,
      uniqueness: 0.20,
    },
    formula: "Quality Score = (Completeness × 35%) + (Validity × 25%) + (Consistency × 20%) + (Uniqueness × 20%)",
  };

  const summary: DatasetQualitySummary = {
    dataQualityScore: qualityScore,
    completenessPercentage,
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
    scoreBreakdown,
    dataTypeDistribution,
  };

  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    totalRows,
    totalColumns,
    duplicateRowsCount,
    completenessPercentage,
    dataTypeDistribution,
    qualityScore,
    scoreBreakdown,
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
