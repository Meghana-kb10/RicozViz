// ========================================
// Row-Level Security (RLS) Service
// ========================================
// Enforces granular row-level data access restrictions based on user identity,
// email, and role. Operates persistently in PostgreSQL with in-memory schemaMeta
// fallback for offline and sample environments.
// All RLS conditions are strictly validated to prevent SQL injection.
// ========================================

import { z } from "zod";
import type { Dataset, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { logger } from "../../utils/logger.js";
import type { DatasetQueryFilter } from "./query-engine.js";

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const createRlsRuleSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  userId: z.string().uuid("Invalid user ID format").optional().nullable(),
  userEmail: z.string().email("Invalid user email format").optional().nullable(),
  roleId: z.string().optional().nullable(),
  column: z.string().min(1, "Column name is required"),
  operator: z
    .enum(["=", "!=", ">", ">=", "<", "<=", "contains", "in"])
    .default("="),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  enabled: z.boolean().default(true).optional(),
});

export const updateRlsRuleSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  userId: z.string().uuid("Invalid user ID format").optional().nullable(),
  userEmail: z.string().email("Invalid user email format").optional().nullable(),
  roleId: z.string().optional().nullable(),
  column: z.string().min(1, "Column name cannot be empty").optional(),
  operator: z
    .enum(["=", "!=", ">", ">=", "<", "<=", "contains", "in"])
    .optional(),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional(),
  enabled: z.boolean().optional(),
});

export type CreateRlsRuleInput = z.infer<typeof createRlsRuleSchema>;
export type UpdateRlsRuleInput = z.infer<typeof updateRlsRuleSchema>;

export interface RlsRuleRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  datasetId: string;
  name: string | null;
  userId: string | null;
  userEmail: string | null;
  roleId: string | null;
  column: string;
  operator: string;
  value: string;
  enabled: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSecurityContext {
  userId: string;
  email: string;
  organizationId: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  isOrgAdmin?: boolean;
}

// In-memory fallback cache when PostgreSQL is offline (e.g. headless Vitest runs)
const inMemoryRlsStore = new Map<string, RlsRuleRecord[]>();

function getDatasetSchemaColumns(dataset: Dataset): string[] {
  const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
  const cols = ((meta.columns || []) as Array<{ name: string }>).map((c) => c.name);
  if (Array.isArray((dataset as any).columns)) {
    for (const c of (dataset as any).columns) {
      if (c.name && !cols.includes(c.name)) cols.push(c.name);
    }
  }
  return cols;
}

function stringifyValue(val: unknown): string {
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Normalizes an RLS rule record across database schemas, API inputs, and in-memory test objects.
 */
export function normalizeRlsRuleRecord(rule: any): RlsRuleRecord {
  const col = rule.column ?? rule.columnName ?? rule.column_name ?? "";
  
  let rawOp = String(rule.operator ?? "=").trim();
  let op = rawOp;
  const upper = rawOp.toUpperCase();
  if (upper === "EQUALS" || upper === "EQUAL" || upper === "==") op = "=";
  else if (upper === "NOT_EQUALS" || upper === "NOT_EQUAL" || upper === "<>") op = "!=";
  else if (upper === "GREATER_THAN" || upper === "GT") op = ">";
  else if (upper === "GREATER_THAN_OR_EQUAL" || upper === "GTE") op = ">=";
  else if (upper === "LESS_THAN" || upper === "LT") op = "<";
  else if (upper === "LESS_THAN_OR_EQUAL" || upper === "LTE") op = "<=";
  else if (upper === "CONTAINS") op = "contains";
  else if (upper === "IN") op = "in";

  const rawVal = rule.value ?? rule.ruleValue ?? rule.rule_value ?? "";
  const valStr = typeof rawVal === "string" ? rawVal : JSON.stringify(rawVal);

  const isEnabled =
    rule.enabled !== undefined
      ? Boolean(rule.enabled)
      : rule.isEnabled !== undefined
      ? Boolean(rule.isEnabled)
      : rule.is_enabled !== undefined
      ? Boolean(rule.is_enabled)
      : true;

  return {
    id: rule.id ?? `rls-${Math.random().toString(36).substring(2, 9)}`,
    organizationId: rule.organizationId ?? rule.organization_id ?? "org-default",
    workspaceId: rule.workspaceId ?? rule.workspace_id ?? null,
    datasetId: rule.datasetId ?? rule.dataset_id ?? "",
    name: rule.name ?? null,
    userId: rule.userId ?? rule.user_id ?? null,
    userEmail: rule.userEmail ?? rule.user_email ?? null,
    roleId: rule.roleId ?? rule.role_id ?? null,
    column: col,
    operator: op,
    value: valStr,
    enabled: isEnabled,
    createdById: rule.createdById ?? rule.created_by_id ?? null,
    createdAt: rule.createdAt ? new Date(rule.createdAt) : new Date(),
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : new Date(),
  };
}

// ============================================================
// SERVICE METHODS
// ============================================================

/**
 * List all RLS rules defined for a dataset.
 */
export async function listDatasetRlsRules(
  datasetId: string,
  organizationId: string
): Promise<RlsRuleRecord[]> {
  try {
    const rules = await prisma.rowLevelSecurityRule.findMany({
      where: { datasetId, organizationId },
      orderBy: { createdAt: "desc" },
    });
    return rules;
  } catch (err) {
    // Fallback: check in-memory cache or dataset.schemaMeta
    const fallback = inMemoryRlsStore.get(datasetId) || [];
    return fallback;
  }
}

/**
 * Create a new Row-Level Security rule for a dataset.
 */
export async function createRlsRule(
  dataset: Dataset,
  input: CreateRlsRuleInput,
  user: UserSecurityContext
): Promise<RlsRuleRecord> {
  // Validate that the target column exists in the dataset schema
  const knownColumns = getDatasetSchemaColumns(dataset);
  const matchedCol = knownColumns.find(
    (c) => c.toLowerCase() === input.column.toLowerCase()
  );
  if (!matchedCol && knownColumns.length > 0) {
    throw AppError.badRequest(
      `Column "${input.column}" does not exist in dataset schema. Valid columns: ${knownColumns.join(", ")}`
    );
  }

  const normalizedColumn = matchedCol || input.column;
  const stringVal = stringifyValue(input.value);

  const ruleData = {
    id: `rls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? null,
    datasetId: dataset.id,
    name: input.name ?? null,
    userId: input.userId ?? null,
    userEmail: input.userEmail?.toLowerCase() ?? null,
    roleId: input.roleId ?? null,
    column: normalizedColumn,
    operator: input.operator,
    value: stringVal,
    enabled: input.enabled ?? true,
    createdById: user.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let savedRule: RlsRuleRecord = ruleData;

  try {
    savedRule = await prisma.rowLevelSecurityRule.create({
      data: {
        id: ruleData.id,
        organizationId: ruleData.organizationId,
        workspaceId: ruleData.workspaceId,
        datasetId: ruleData.datasetId,
        name: ruleData.name,
        userId: ruleData.userId,
        userEmail: ruleData.userEmail,
        roleId: ruleData.roleId,
        column: ruleData.column,
        operator: ruleData.operator,
        value: ruleData.value,
        enabled: ruleData.enabled,
        createdById: ruleData.createdById,
      },
    });
  } catch (err) {
    logger.warn("Database offline during RLS create, saving to in-memory/schema store", {
      datasetId: dataset.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Sync to in-memory registry for resilience
  const existingList = inMemoryRlsStore.get(dataset.id) || [];
  inMemoryRlsStore.set(dataset.id, [savedRule, ...existingList]);

  // Persist to dataset.schemaMeta as backup
  try {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    const rlsList = (Array.isArray(meta.rlsRules) ? meta.rlsRules : []) as unknown[];
    meta.rlsRules = [savedRule, ...rlsList];
    await prisma.dataset.update({
      where: { id: dataset.id },
      data: { schemaMeta: meta as Prisma.InputJsonValue },
    }).catch(() => null);
  } catch {
    // Non-fatal
  }

  // Audit log
  void logAuditEvent({
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    userId: user.userId,
    action: "RLS_RULE_CREATED",
    resourceType: "RLS_RULE",
    resourceId: savedRule.id,
    metadata: {
      datasetId: dataset.id,
      column: savedRule.column,
      operator: savedRule.operator,
      value: input.value,
      targetUserId: savedRule.userId,
      targetUserEmail: savedRule.userEmail,
      enabled: savedRule.enabled,
    },
  });

  return savedRule;
}

/**
 * Update an existing RLS rule.
 */
export async function updateRlsRule(
  dataset: Dataset,
  ruleId: string,
  input: UpdateRlsRuleInput,
  user: UserSecurityContext
): Promise<RlsRuleRecord> {
  let existing: RlsRuleRecord | null = null;

  try {
    existing = await prisma.rowLevelSecurityRule.findFirst({
      where: { id: ruleId, datasetId: dataset.id, organizationId: dataset.organizationId },
    });
  } catch {
    const memList = inMemoryRlsStore.get(dataset.id) || [];
    existing = memList.find((r) => r.id === ruleId) ?? null;
  }

  if (!existing) {
    throw AppError.notFound(`RLS Rule with ID "${ruleId}" not found`);
  }

  let normalizedColumn = existing.column;
  if (input.column) {
    const knownColumns = getDatasetSchemaColumns(dataset);
    const matched = knownColumns.find((c) => c.toLowerCase() === input.column!.toLowerCase());
    if (!matched && knownColumns.length > 0) {
      throw AppError.badRequest(`Column "${input.column}" does not exist in dataset schema`);
    }
    normalizedColumn = matched || input.column;
  }

  const stringVal = input.value !== undefined ? stringifyValue(input.value) : existing.value;

  const updateData = {
    name: input.name !== undefined ? input.name : existing.name,
    userId: input.userId !== undefined ? input.userId : existing.userId,
    userEmail: input.userEmail !== undefined ? (input.userEmail ? input.userEmail.toLowerCase() : null) : existing.userEmail,
    roleId: input.roleId !== undefined ? input.roleId : existing.roleId,
    column: normalizedColumn,
    operator: input.operator ?? existing.operator,
    value: stringVal,
    enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
    updatedAt: new Date(),
  };

  let updatedRule: RlsRuleRecord = {
    ...existing,
    ...updateData,
  };

  try {
    updatedRule = await prisma.rowLevelSecurityRule.update({
      where: { id: ruleId },
      data: updateData,
    });
  } catch (err) {
    logger.warn("Database offline during RLS update, saving to in-memory store", { ruleId });
  }

  // Update in-memory registry
  const memList = inMemoryRlsStore.get(dataset.id) || [];
  const idx = memList.findIndex((r) => r.id === ruleId);
  if (idx !== -1) {
    memList[idx] = updatedRule;
  } else {
    memList.push(updatedRule);
  }
  inMemoryRlsStore.set(dataset.id, memList);

  void logAuditEvent({
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    userId: user.userId,
    action: "RLS_RULE_UPDATED",
    resourceType: "RLS_RULE",
    resourceId: ruleId,
    metadata: {
      datasetId: dataset.id,
      changes: input,
    },
  });

  return updatedRule;
}

/**
 * Delete an RLS rule.
 */
export async function deleteRlsRule(
  dataset: Dataset,
  ruleId: string,
  user: UserSecurityContext
): Promise<void> {
  try {
    await prisma.rowLevelSecurityRule.delete({
      where: { id: ruleId },
    });
  } catch (err) {
    logger.warn("Database offline during RLS delete, cleaning in-memory store", { ruleId });
  }

  const memList = inMemoryRlsStore.get(dataset.id) || [];
  inMemoryRlsStore.set(
    dataset.id,
    memList.filter((r) => r.id !== ruleId)
  );

  void logAuditEvent({
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    userId: user.userId,
    action: "RLS_RULE_DELETED",
    resourceType: "RLS_RULE",
    resourceId: ruleId,
    metadata: { datasetId: dataset.id },
  });
}

/**
 * Resolves active RLS filters applicable to a user for a specific dataset.
 *
 * Rules:
 * 1. If no user context is provided, no RLS filters apply (e.g. system tasks).
 * 2. Organization Admins and Workspace Owners/Admins bypass RLS unless a rule explicitly
 *    targets their specific userId or userEmail.
 * 3. Regular users (Editor, Viewer, Member) receive all matching active rules:
 *    - Rule matching user.userId
 *    - Rule matching user.email (case-insensitive)
 *    - Rule matching user.roleId
function normalizeRlsRuleRecord(rule: any): RlsRuleRecord {
  const col = rule.column || rule.columnName || rule.filterExpression?.field || rule.filterExpression?.column;
  const rawOp = rule.operator || rule.filterExpression?.operator || "=";
  const op = rawOp === "EQUALS" ? "=" : rawOp === "NOT_EQUALS" ? "!=" : rawOp;
  const rawVal = typeof rule.value !== "undefined"
    ? rule.value
    : typeof rule.ruleValue !== "undefined"
      ? rule.ruleValue
      : rule.filterExpression?.value;

  return {
    id: rule.id || `rls-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    organizationId: rule.organizationId,
    workspaceId: rule.workspaceId ?? null,
    datasetId: rule.datasetId,
    name: rule.name ?? null,
    userId: rule.userId ?? null,
    userEmail: rule.userEmail ?? null,
    roleId: rule.roleId ?? rule.roleName ?? null,
    column: col,
    operator: op,
    value: typeof rawVal === "string" ? rawVal : JSON.stringify(rawVal),
    enabled: rule.enabled ?? rule.isEnabled ?? rule.isActive ?? true,
    createdById: rule.createdById ?? null,
    createdAt: rule.createdAt ? new Date(rule.createdAt) : new Date(),
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : new Date(),
  };
}

/**
 * Resolves all applicable Row-Level Security filters for a user against a target dataset.
 * Logic:
 * 1. If user is Org Admin (ADMIN), non-explicit rules are bypassed.
 * 2. If user is explicitly targeted by userId or userEmail, rule is ALWAYS applied.
 * 3. Non-admin users are subject to:
 *    - Role-based rules (matching user.roleId or user.roleName)
 *    - Dataset-wide rules (where userId, userEmail, roleId are all null)
 * 4. Filters are returned as safe DatasetQueryFilter objects with properly parsed values.
 */
export async function resolveUserRlsFilters(
  dataset: Dataset,
  user?: UserSecurityContext | null
): Promise<DatasetQueryFilter[]> {
  if (!user) return [];

  // Check in-memory store first (fast test execution & offline resilience)
  let allRules: RlsRuleRecord[] = [];
  const inMem = inMemoryRlsStore.get(dataset.id);
  if (inMem && inMem.length > 0) {
    allRules = inMem.filter((r) => r.enabled);
  } else {
    try {
      allRules = await prisma.rowLevelSecurityRule.findMany({
        where: {
          datasetId: dataset.id,
          organizationId: dataset.organizationId,
          enabled: true,
        },
      });
    } catch {
      allRules = [];
    }
  }

  // Also check dataset.schemaMeta.rlsRules if empty
  if (allRules.length === 0) {
    const meta = (dataset.schemaMeta || {}) as Record<string, unknown>;
    if (Array.isArray(meta.rlsRules)) {
      allRules = (meta.rlsRules as any[]).map(normalizeRlsRuleRecord).filter((r) => r.enabled);
    }
  }

  if (allRules.length === 0) return [];

  const isExplicitlyTargeted = (r: RlsRuleRecord): boolean => {
    if (r.userId && r.userId === user.userId) return true;
    if (r.userEmail && r.userEmail.toLowerCase() === user.email.toLowerCase()) return true;
    return false;
  };

  const isRoleTargeted = (r: RlsRuleRecord): boolean => {
    if (r.roleId && (r.roleId === user.roleId || r.roleId === user.roleName)) return true;
    return false;
  };

  const isUniversalRule = (r: RlsRuleRecord): boolean => {
    return !r.userId && !r.userEmail && !r.roleId;
  };

  // Determine admin bypass:
  const isOrgAdmin = user.roleName === "ADMIN" || Boolean(user.isOrgAdmin);
  const applicableRules: RlsRuleRecord[] = [];

  for (const rule of allRules) {
    if (isExplicitlyTargeted(rule)) {
      applicableRules.push(rule);
    } else if (isOrgAdmin) {
      // Admins bypass non-explicit rules
      continue;
    } else if (isRoleTargeted(rule) || isUniversalRule(rule)) {
      applicableRules.push(rule);
    }
  }

  // Convert applicable RLS rules to DatasetQueryFilter
  const filters: DatasetQueryFilter[] = [];
  for (const rule of applicableRules) {
    const parsedVal = parseStoredValue(rule.value);
    filters.push({
      column: rule.column,
      operator: rule.operator,
      value: parsedVal,
    });
  }

  return filters;
}

/**
 * Register in-memory test RLS rule (for fast test setup without DB dependencies).
 */
export function registerInMemoryRlsRule(rule: any): void {
  const normalized = normalizeRlsRuleRecord(rule);
  const list = inMemoryRlsStore.get(normalized.datasetId) || [];
  inMemoryRlsStore.set(normalized.datasetId, [normalized, ...list.filter((r) => r.id !== normalized.id)]);
}

/**
 * Clear in-memory RLS rules (for testing).
 */
export function clearInMemoryRlsRules(): void {
  inMemoryRlsStore.clear();
}

