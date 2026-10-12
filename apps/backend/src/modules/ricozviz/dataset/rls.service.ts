// ========================================
// Row-Level Security (RLS) Service
// ========================================
// Ported from the legacy Express API
// (`RicozViz_old/apps/api/src/services/dataset/rls.service.ts`).
//
// Enforces granular row-level data access restrictions based on user identity,
// email and role. Rules persist in MongoDB with an in-memory
// `schemaMeta.rlsRules` fallback for offline and sample environments, so the
// module keeps working while the database is unreachable.
//
// RLS conditions are strictly validated — the operators are a closed allowlist
// and values are stored as JSON strings, never interpolated into a query.
// ========================================

import { z } from 'zod';
import {
  DatasetModel,
  RowLevelSecurityRuleModel,
  toObjectId,
  serializeDoc
} from '@repo/database';
import type { DatasetQueryFilter, RlsOperator, RowLevelSecurityRule } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../audit/audit.service.js';
import { readSchemaMeta, asMixed, verifyResourceWorkspaceAccess } from './data-quality.service.js';

// ============================================================
// TYPES
// ============================================================

/** Serialised dataset projection the RLS rules are validated against. */
export interface RlsTargetDataset {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  type?: string;
  schemaMeta?: Record<string, unknown> | null;
  columns?: Array<{ name: string; dataType?: string | null }> | null;
}

/** Identity the RLS rules are resolved against. */
export interface UserSecurityContext {
  userId: string;
  email: string;
  organizationId: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  isOrgAdmin?: boolean;
}

/** Persisted / in-memory shape of a rule (mirrors `RowLevelSecurityRuleModel`). */
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

/** Closed set of persisted operators. */
export const RLS_OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'in'] as const;
export type RlsOperatorSymbol = (typeof RLS_OPERATORS)[number];

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const rlsValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()]))
]);

/**
 * Accept both the stored field names (`column`, `value`, `enabled`) and the
 * names the web client sends (`columnName`, `ruleValue`, `isEnabled`), and map
 * every operator alias onto the persisted symbol form.
 */
function normalizeRlsInput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...input };

  if (out.column === undefined && typeof input.columnName === 'string') {
    out.column = input.columnName;
    delete out.columnName;
  }
  if (out.value === undefined && input.ruleValue !== undefined) {
    out.value = input.ruleValue;
    delete out.ruleValue;
  }
  if (out.enabled === undefined && input.isEnabled !== undefined) {
    out.enabled = input.isEnabled;
    delete out.isEnabled;
  }
  if (out.operator === undefined && input.operator !== undefined) {
    out.operator = input.operator;
  }
  if (typeof out.operator === 'string') {
    out.operator = mapOperatorAlias(out.operator);
  }

  return out;
}

export const createRlsRuleSchema = z.preprocess(
  normalizeRlsInput,
  z.object({
    name: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    userId: z.string().min(1, 'Invalid user ID format').optional().nullable(),
    userEmail: z.string().email('Invalid user email format').optional().nullable(),
    roleId: z.string().optional().nullable(),
    roleName: z.string().optional().nullable(),
    column: z.string().min(1, 'Column name is required'),
    operator: z.enum(RLS_OPERATORS).default('='),
    value: rlsValueSchema,
    enabled: z.boolean().default(true).optional()
  })
);

export const updateRlsRuleSchema = z.preprocess(
  normalizeRlsInput,
  z.object({
    name: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    userId: z.string().min(1, 'Invalid user ID format').optional().nullable(),
    userEmail: z.string().email('Invalid user email format').optional().nullable(),
    roleId: z.string().optional().nullable(),
    roleName: z.string().optional().nullable(),
    column: z.string().min(1, 'Column name cannot be empty').optional(),
    operator: z.enum(RLS_OPERATORS).optional(),
    value: rlsValueSchema.optional(),
    enabled: z.boolean().optional()
  })
);

export type CreateRlsRuleInput = z.infer<typeof createRlsRuleSchema>;
export type UpdateRlsRuleInput = z.infer<typeof updateRlsRuleSchema>;

// ============================================================
// OPERATOR / VALUE NORMALISATION
// ============================================================

/** Map every accepted operator alias onto the persisted symbol form. */
function mapOperatorAlias(rawOp: string): string {
  const upper = String(rawOp).trim().toUpperCase();
  if (upper === 'EQUALS' || upper === 'EQUAL' || upper === '==') return '=';
  if (upper === 'NOT_EQUALS' || upper === 'NOT_EQUAL' || upper === '<>') return '!=';
  if (upper === 'GREATER_THAN' || upper === 'GT') return '>';
  if (upper === 'GREATER_THAN_OR_EQUAL' || upper === 'GTE') return '>=';
  if (upper === 'LESS_THAN' || upper === 'LT') return '<';
  if (upper === 'LESS_THAN_OR_EQUAL' || upper === 'LTE') return '<=';
  if (upper === 'CONTAINS') return 'contains';
  if (upper === 'IN') return 'in';
  return rawOp;
}

/** Map a persisted symbol back onto the `RlsOperator` vocabulary of the API. */
function toContractOperator(operator: string): RlsOperator {
  switch (mapOperatorAlias(operator)) {
    case '!=':
      return 'NOT_EQUALS';
    case '>':
      return 'GREATER_THAN';
    case '>=':
      return 'GREATER_THAN';
    case '<':
      return 'LESS_THAN';
    case '<=':
      return 'LESS_THAN';
    case 'contains':
      return 'CONTAINS';
    case 'in':
      return 'IN';
    case '=':
    default:
      return 'EQUALS';
  }
}

function stringifyValue(val: unknown): string {
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

function parseStoredValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ============================================================
// IN-MEMORY FALLBACK STORE
// ============================================================

/** Keeps governance rules assertable in tests and usable while Mongo is down. */
const inMemoryRlsStore = new Map<string, RlsRuleRecord[]>();

/** Register an in-memory RLS rule without touching the database. */
export function registerInMemoryRlsRule(rule: Record<string, unknown>): void {
  const normalized = normalizeRlsRuleRecord(rule);
  const list = inMemoryRlsStore.get(normalized.datasetId) || [];
  inMemoryRlsStore.set(
    normalized.datasetId,
    [normalized, ...list.filter((r) => r.id !== normalized.id)]
  );
}

/** Clear every in-memory RLS rule. */
export function clearInMemoryRlsRules(): void {
  inMemoryRlsStore.clear();
}

/**
 * Normalises an RLS rule record across database schemas, API inputs and
 * in-memory test objects.
 */
export function normalizeRlsRuleRecord(rule: Record<string, unknown>): RlsRuleRecord {
  const col =
    (rule.column as string) ??
    (rule.columnName as string) ??
    (rule.column_name as string) ??
    '';

  const op = mapOperatorAlias(String(rule.operator ?? '=').trim());

  const rawVal = rule.value ?? rule.ruleValue ?? rule.rule_value ?? '';
  const valStr = typeof rawVal === 'string' ? rawVal : JSON.stringify(rawVal);

  const isEnabled =
    rule.enabled !== undefined
      ? Boolean(rule.enabled)
      : rule.isEnabled !== undefined
        ? Boolean(rule.isEnabled)
        : rule.is_enabled !== undefined
          ? Boolean(rule.is_enabled)
          : true;

  return {
    id: (rule.id as string) ?? `rls-${Math.random().toString(36).substring(2, 9)}`,
    organizationId: (rule.organizationId as string) ?? (rule.organization_id as string) ?? 'org-default',
    workspaceId: ((rule.workspaceId ?? rule.workspace_id) as string | null) ?? null,
    datasetId: (rule.datasetId as string) ?? (rule.dataset_id as string) ?? '',
    name: (rule.name as string | null) ?? null,
    userId: ((rule.userId ?? rule.user_id) as string | null) ?? null,
    userEmail: ((rule.userEmail ?? rule.user_email) as string | null) ?? null,
    roleId: ((rule.roleId ?? rule.role_id ?? rule.roleName) as string | null) ?? null,
    column: col,
    operator: op,
    value: valStr,
    enabled: isEnabled,
    createdById: ((rule.createdById ?? rule.created_by_id) as string | null) ?? null,
    createdAt: rule.createdAt ? new Date(rule.createdAt as string) : new Date(),
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt as string) : new Date()
  };
}

/** Column names known to a dataset (relational columns + `schemaMeta.columns`). */
function getDatasetSchemaColumns(dataset: RlsTargetDataset): string[] {
  const meta = readSchemaMeta(dataset.schemaMeta);
  const cols = ((meta.columns || []) as Array<{ name: string }>).map((c) => c.name);
  if (Array.isArray(dataset.columns)) {
    for (const c of dataset.columns) {
      if (c.name && !cols.includes(c.name)) cols.push(c.name);
    }
  }
  return cols;
}

/** Map a stored record onto the API contract (`RowLevelSecurityRule`). */
export function toRlsRuleContract(rule: RlsRuleRecord): RowLevelSecurityRule {
  return {
    id: rule.id,
    name: rule.name ?? '',
    description: null,
    datasetId: rule.datasetId,
    organizationId: rule.organizationId,
    columnName: rule.column,
    operator: toContractOperator(rule.operator),
    ruleValue: parseStoredValue(rule.value),
    roleName: rule.roleId,
    userId: rule.userId,
    isEnabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString()
  };
}

// ============================================================
// SERVICE METHODS
// ============================================================

/**
 * Tenant-scoped dataset lookup used by the RLS endpoints.
 *
 * Reproduces the legacy `resolveDatasetForRls` route helper:
 * `dataset.findFirst({ where: { id, organizationId }, include: { columns: true } })`
 * followed by `verifyResourceWorkspaceAccess`.
 */
export async function resolveRlsDataset(
  datasetId: string,
  userId: string,
  organizationId: string,
  userRoleName?: string,
  requiredAction: 'READ' | 'WRITE' = 'READ'
): Promise<RlsTargetDataset> {
  const datasetObjectId = toObjectId(datasetId);
  const organizationObjectId = toObjectId(organizationId);

  const doc =
    datasetObjectId && organizationObjectId
      ? await DatasetModel.findOne({
          _id: datasetObjectId,
          organizationId: organizationObjectId
        })
          .populate<{ columns: Array<{ name: string; dataType: string }> }>('columns', 'name dataType')
          .exec()
      : null;

  if (!doc) {
    throw AppError.notFound(`Dataset with ID "${datasetId}" not found`);
  }

  const serialized = serializeDoc<RlsTargetDataset>(doc, { virtuals: true });

  await verifyResourceWorkspaceAccess(
    { workspaceId: serialized.workspaceId, organizationId: serialized.organizationId },
    userId,
    organizationId,
    userRoleName,
    requiredAction
  );

  return serialized;
}

/** List all RLS rules defined for a dataset. */
export async function listRlsRules(
  datasetId: string,
  organizationId: string
): Promise<RowLevelSecurityRule[]> {
  try {
    const rules = await RowLevelSecurityRuleModel.find({
      datasetId: toObjectId(datasetId),
      organizationId: toObjectId(organizationId)
    })
      .sort({ createdAt: -1 })
      .exec();

    if (rules.length > 0) {
      return rules.map((rule) =>
        toRlsRuleContract(
          normalizeRlsRuleRecord({ ...serializeDoc<Record<string, unknown>>(rule), id: rule._id.toString() })
        )
      );
    }

    // Fallback: in-memory cache, then `dataset.schemaMeta.rlsRules`
    const inMemory = inMemoryRlsStore.get(datasetId) || [];
    if (inMemory.length > 0) {
      return inMemory.map(toRlsRuleContract);
    }

    return await readSchemaMetaRlsRules(datasetId);
  } catch (err) {
    logger.warn('Database offline while listing RLS rules, using in-memory cache', {
      datasetId,
      error: err instanceof Error ? err.message : String(err)
    });
    const fallback = inMemoryRlsStore.get(datasetId) || [];
    return fallback.map(toRlsRuleContract);
  }
}

/** Read `dataset.schemaMeta.rlsRules` (last-resort fallback). */
async function readSchemaMetaRlsRules(datasetId: string): Promise<RowLevelSecurityRule[]> {
  const datasetObjectId = toObjectId(datasetId);
  if (!datasetObjectId) return [];

  const doc = await DatasetModel.findOne({ _id: datasetObjectId })
    .select('schemaMeta')
    .lean()
    .exec();

  const meta = readSchemaMeta(doc?.schemaMeta);
  if (!Array.isArray(meta.rlsRules)) return [];

  return (meta.rlsRules as Array<Record<string, unknown>>)
    .map(normalizeRlsRuleRecord)
    .map(toRlsRuleContract);
}

/**
 * Create a new Row-Level Security rule for a dataset.
 */
export async function createRlsRule(
  dataset: RlsTargetDataset,
  input: CreateRlsRuleInput,
  user: UserSecurityContext
): Promise<RowLevelSecurityRule> {
  // Validate that the target column exists in the dataset schema
  const knownColumns = getDatasetSchemaColumns(dataset);
  const matchedCol = knownColumns.find((c) => c.toLowerCase() === input.column.toLowerCase());
  if (!matchedCol && knownColumns.length > 0) {
    throw AppError.badRequest(
      `Column "${input.column}" does not exist in dataset schema. Valid columns: ${knownColumns.join(', ')}`
    );
  }

  const normalizedColumn = matchedCol || input.column;
  const stringVal = stringifyValue(input.value);

  const ruleData: RlsRuleRecord = {
    id: `rls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? null,
    datasetId: dataset.id,
    name: input.name ?? null,
    userId: input.userId ?? null,
    userEmail: input.userEmail?.toLowerCase() ?? null,
    roleId: input.roleId ?? input.roleName ?? null,
    column: normalizedColumn,
    operator: input.operator,
    value: stringVal,
    enabled: input.enabled ?? true,
    createdById: user.userId,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  let savedRule: RlsRuleRecord = ruleData;

  try {
    const organizationId = toObjectId(dataset.organizationId);
    const datasetRef = toObjectId(dataset.id);
    if (!organizationId || !datasetRef) {
      throw AppError.badRequest('Invalid dataset identifier');
    }

    const created = await RowLevelSecurityRuleModel.create({
      organizationId,
      workspaceId: toObjectId(dataset.workspaceId),
      datasetId: datasetRef,
      name: ruleData.name,
      userId: toObjectId(ruleData.userId),
      userEmail: ruleData.userEmail,
      roleId: toObjectId(ruleData.roleId),
      column: ruleData.column,
      operator: ruleData.operator,
      value: ruleData.value,
      enabled: ruleData.enabled,
      createdById: toObjectId(ruleData.createdById)
    });

    savedRule = normalizeRlsRuleRecord({
      ...serializeDoc<Record<string, unknown>>(created),
      id: created._id.toString(),
      organizationId: dataset.organizationId,
      workspaceId: dataset.workspaceId,
      datasetId: dataset.id,
      userId: ruleData.userId,
      roleId: ruleData.roleId,
      createdById: ruleData.createdById
    });
  } catch (err) {
    logger.warn('Database offline during RLS create, saving to in-memory/schema store', {
      datasetId: dataset.id,
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Sync to in-memory registry for resilience
  const existingList = inMemoryRlsStore.get(dataset.id) || [];
  inMemoryRlsStore.set(dataset.id, [savedRule, ...existingList]);

  // Persist to dataset.schemaMeta as backup
  try {
    await persistRuleToSchemaMeta(dataset.id, (meta) => {
      const rlsList = (Array.isArray(meta.rlsRules) ? meta.rlsRules : []) as unknown[];
      meta.rlsRules = [savedRule, ...rlsList];
    });
  } catch {
    // Non-fatal
  }

  // Audit log
  void logAuditEvent({
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    userId: user.userId,
    action: 'RLS_RULE_CREATED',
    resourceType: 'RLS_RULE',
    resourceId: savedRule.id,
    metadata: {
      datasetId: dataset.id,
      column: savedRule.column,
      operator: savedRule.operator,
      value: input.value,
      targetUserId: savedRule.userId,
      targetUserEmail: savedRule.userEmail,
      enabled: savedRule.enabled
    }
  });

  return toRlsRuleContract(savedRule);
}

/**
 * Update an existing RLS rule.
 */
export async function updateRlsRule(
  dataset: RlsTargetDataset,
  ruleId: string,
  input: UpdateRlsRuleInput,
  user: UserSecurityContext
): Promise<RowLevelSecurityRule> {
  let existing: RlsRuleRecord | null = null;

  try {
    const doc = await RowLevelSecurityRuleModel.findOne({
      _id: toObjectId(ruleId),
      datasetId: toObjectId(dataset.id),
      organizationId: toObjectId(dataset.organizationId)
    }).exec();

    if (doc) {
      existing = normalizeRlsRuleRecord({
        ...serializeDoc<Record<string, unknown>>(doc),
        id: doc._id.toString(),
        organizationId: dataset.organizationId,
        workspaceId: dataset.workspaceId,
        datasetId: dataset.id
      });
    }
  } catch {
    const memList = inMemoryRlsStore.get(dataset.id) || [];
    existing = memList.find((r) => r.id === ruleId) ?? null;
  }

  if (!existing) {
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
    userEmail:
      input.userEmail !== undefined
        ? input.userEmail
          ? input.userEmail.toLowerCase()
          : null
        : existing.userEmail,
    roleId: input.roleId !== undefined ? input.roleId : existing.roleId,
    column: normalizedColumn,
    operator: input.operator ?? existing.operator,
    value: stringVal,
    enabled: input.enabled !== undefined ? input.enabled : existing.enabled,
    updatedAt: new Date()
  };

  let updatedRule: RlsRuleRecord = {
    ...existing,
    ...updateData
  };

  try {
    const doc = await RowLevelSecurityRuleModel.findOneAndUpdate(
      { _id: toObjectId(ruleId) },
      {
        $set: {
          name: updateData.name,
          userId: toObjectId(updateData.userId),
          userEmail: updateData.userEmail,
          roleId: toObjectId(updateData.roleId),
          column: updateData.column,
          operator: updateData.operator,
          value: updateData.value,
          enabled: updateData.enabled,
          updatedAt: updateData.updatedAt
        }
      },
      { new: true }
    ).exec();

    if (doc) {
      updatedRule = normalizeRlsRuleRecord({
        ...serializeDoc<Record<string, unknown>>(doc),
        id: doc._id.toString(),
        organizationId: dataset.organizationId,
        workspaceId: dataset.workspaceId,
        datasetId: dataset.id
      });
    }
  } catch (err) {
    logger.warn('Database offline during RLS update, saving to in-memory store', { ruleId });
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
    action: 'RLS_RULE_UPDATED',
    resourceType: 'RLS_RULE',
    resourceId: ruleId,
    metadata: {
      datasetId: dataset.id,
      changes: input as Record<string, unknown>
    }
  });

  return toRlsRuleContract(updatedRule);
}

/**
 * Delete an RLS rule.
 */
export async function deleteRlsRule(
  dataset: RlsTargetDataset,
  ruleId: string,
  user: UserSecurityContext
): Promise<void> {
  try {
    await RowLevelSecurityRuleModel.deleteOne({ _id: toObjectId(ruleId) }).exec();
  } catch (err) {
    logger.warn('Database offline during RLS delete, cleaning in-memory store', { ruleId });
  }

  const memList = inMemoryRlsStore.get(dataset.id) || [];
  inMemoryRlsStore.set(
    dataset.id,
    memList.filter((r) => r.id !== ruleId)
  );

  try {
    await persistRuleToSchemaMeta(dataset.id, (meta) => {
      const rlsList = Array.isArray(meta.rlsRules) ? (meta.rlsRules as Array<Record<string, unknown>>) : [];
      meta.rlsRules = rlsList.filter((r) => r.id !== ruleId);
    });
  } catch {
    // Non-fatal
  }

  void logAuditEvent({
    organizationId: dataset.organizationId,
    workspaceId: dataset.workspaceId ?? undefined,
    userId: user.userId,
    action: 'RLS_RULE_DELETED',
    resourceType: 'RLS_RULE',
    resourceId: ruleId,
    metadata: { datasetId: dataset.id }
  });
}

/**
 * Resolve all applicable Row-Level Security filters for a user against a target
 * dataset.
 *
 * Logic:
 * 1. No user context -> no filters (system tasks).
 * 2. Rules explicitly targeting the caller's `userId` / `userEmail` ALWAYS apply,
 *    even for organization admins.
 * 3. Organization admins bypass every other rule.
 * 4. Everyone else is subject to role-targeted rules (matching `roleId` or
 *    `roleName`) and dataset-wide rules (no `userId`, `userEmail` or `roleId`).
 */
export async function resolveUserRlsFilters(
  dataset: RlsTargetDataset,
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
      const docs = await RowLevelSecurityRuleModel.find({
        datasetId: toObjectId(dataset.id),
        organizationId: toObjectId(dataset.organizationId),
        enabled: true
      }).exec();

      allRules = docs.map((doc) =>
        normalizeRlsRuleRecord({
          ...serializeDoc<Record<string, unknown>>(doc),
          id: doc._id.toString(),
          organizationId: dataset.organizationId,
          workspaceId: dataset.workspaceId,
          datasetId: dataset.id
        })
      );
    } catch {
      allRules = [];
    }
  }

  // Also check dataset.schemaMeta.rlsRules if empty
  if (allRules.length === 0) {
    const meta = readSchemaMeta(dataset.schemaMeta);
    if (Array.isArray(meta.rlsRules)) {
      allRules = (meta.rlsRules as Array<Record<string, unknown>>)
        .map(normalizeRlsRuleRecord)
        .filter((r) => r.enabled);
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

  // Determine admin bypass
  const isOrgAdmin = user.roleName === 'ADMIN' || Boolean(user.isOrgAdmin);
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
    filters.push({
      column: rule.column,
      operator: rule.operator as DatasetQueryFilter['operator'],
      value: parseStoredValue(rule.value)
    });
  }

  return filters;
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

/** Merge a mutation into `dataset.schemaMeta` without clobbering sibling keys. */
async function persistRuleToSchemaMeta(
  datasetId: string,
  mutate: (meta: Record<string, unknown>) => void
): Promise<void> {
  const datasetObjectId = toObjectId(datasetId);
  if (!datasetObjectId) return;

  const doc = await DatasetModel.findOne({ _id: datasetObjectId })
    .select('schemaMeta')
    .lean()
    .exec();

  const meta = { ...readSchemaMeta(doc?.schemaMeta) };
  mutate(meta);

  await DatasetModel.updateOne({ _id: datasetObjectId }, { $set: { schemaMeta: asMixed(meta) } })
    .exec()
    .catch(() => null);
}