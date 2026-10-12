// ========================================
// Dashboard Templates Service
// ========================================
// Manages system and workspace reusable dashboard templates.
// Enables browsing, previewing, saving existing dashboards as templates,
// and instantiating independent cloned dashboards from templates.
//
// MIGRATION NOTE
// --------------
// Workspace authorization helpers are inlined (verbatim port of the legacy
// `workspace-auth.helper.ts`) so this module never depends on the separately
// migrated workspace module.
// ========================================

import { z } from 'zod';
import type mongoose from 'mongoose';
import {
  ChartModel,
  DashboardModel,
  DashboardTemplateModel,
  DatasetModel,
  WorkspaceMemberModel,
  WorkspaceModel,
  serializeDoc,
  serializeDocs,
  toObjectId
} from '@repo/database';
import type {
  IDashboardTemplateDocument,
  IWorkspaceMemberDocument
} from '@repo/database';
import { DASHBOARD_STATUS, DASHBOARD_VISIBILITY } from '@repo/types';
import type { DashboardTemplateData, TemplateChartDef } from '@repo/types';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { logAuditEvent } from '../../ricozviz/audit/audit.service.js';

// ============================================================
// Validation schemas (messages are contractual)
// ============================================================

export const createFromDashboardSchema = z.object({
  dashboardId: z.string().uuid('Invalid dashboard ID'),
  name: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(1, 'Category is required'),
  workspaceId: z.string().optional()
});

export const instantiateSchema = z.object({
  name: z.string().min(1, 'Dashboard name is required').max(100),
  description: z.string().max(500).optional(),
  workspaceId: z.string().optional(),
  targetDatasetId: z.string().optional()
});

// ============================================================
// Types
// ============================================================

export interface SystemTemplateSeed {
  id: string;
  name: string;
  description: string;
  category: 'Sales' | 'Marketing' | 'Finance' | 'Operations' | 'Executive';
  thumbnailUrl?: string;
  layoutConfig: Record<string, unknown>;
  chartsConfig: TemplateChartDef[];
}

/** Shape returned for the built-in seeds in list responses. */
export interface SystemTemplateItem extends SystemTemplateSeed {
  isSystem: true;
  organizationId: null;
  workspaceId: null;
  createdById: null;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape returned for the built-in seeds when fetching a single template. */
export interface SystemTemplateDetail extends SystemTemplateSeed {
  isSystem: true;
  organizationId: null;
  workspaceId: null;
}

export type TemplateListItem = SystemTemplateItem | DashboardTemplateData;

export type TemplateDetail = SystemTemplateDetail | DashboardTemplateData;

/** The freshly cloned dashboard returned by `instantiateDashboardFromTemplate`. */
export interface InstantiatedDashboard {
  id: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  organizationId: string;
  ownerId: string;
  layoutConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateFromDashboardParams {
  dashboardId: string;
  name: string;
  description?: string;
  category: string;
  userId: string;
  organizationId: string;
  workspaceId?: string;
  userRoleName?: string;
}

export interface InstantiateDashboardFromTemplateParams {
  templateId: string;
  name: string;
  description?: string;
  workspaceId?: string;
  targetDatasetId?: string;
  userId: string;
  organizationId: string;
  userRoleName?: string;
}

// ============================================================
// Workspace authorization helpers
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
// System template seeds
// ============================================================

export const SYSTEM_TEMPLATES: SystemTemplateSeed[] = [
  {
    id: 'sys-tpl-sales-performance',
    name: 'Sales Performance Dashboard',
    description:
      'Track revenue trajectories, regional sales distribution, top performing sales reps, and deal pipeline conversion.',
    category: 'Sales',
    thumbnailUrl: '/thumbnails/sales-dashboard.png',
    layoutConfig: { columns: 12, rowHeight: 80, theme: 'dark' },
    chartsConfig: [
      {
        title: 'Total Revenue by Region',
        chartType: 'bar',
        description: 'Comparative regional performance overview',
        config: { xAxis: 'region', yAxis: 'revenue', aggregation: 'SUM', color: '#3B82F6' },
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Monthly Sales Trend',
        chartType: 'line',
        description: 'Month-over-month trajectory with target pacing',
        config: { xAxis: 'month', yAxis: 'sales', aggregation: 'SUM', color: '#10B981' },
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Product Category Share',
        chartType: 'pie',
        description: 'Revenue breakdown across primary product categories',
        config: { dimension: 'category', measure: 'revenue', aggregation: 'SUM' },
        position: { x: 0, y: 4, w: 6, h: 4 }
      },
      {
        title: 'Average Deal Size by Segment',
        chartType: 'bar',
        description: 'Order values grouped by Enterprise vs SMB segments',
        config: { xAxis: 'segment', yAxis: 'deal_size', aggregation: 'AVG', color: '#8B5CF6' },
        position: { x: 6, y: 4, w: 6, h: 4 }
      }
    ]
  },
  {
    id: 'sys-tpl-marketing-roi',
    name: 'Marketing & Growth Dashboard',
    description:
      'Analyze campaign return on ad spend (ROAS), acquisition funnels, cost per lead, and channel conversion velocity.',
    category: 'Marketing',
    thumbnailUrl: '/thumbnails/marketing-dashboard.png',
    layoutConfig: { columns: 12, rowHeight: 80, theme: 'dark' },
    chartsConfig: [
      {
        title: 'Acquisition Funnel by Stage',
        chartType: 'bar',
        description: 'Visitors to qualified leads to converted customers',
        config: { xAxis: 'stage', yAxis: 'count', aggregation: 'COUNT', color: '#F59E0B' },
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Customer Acquisition Cost (CAC) by Channel',
        chartType: 'bar',
        description: 'Paid Search, Social, Organic, and Referral channels',
        config: { xAxis: 'channel', yAxis: 'cac', aggregation: 'AVG', color: '#EF4444' },
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Campaign Conversion Rates',
        chartType: 'line',
        description: 'Weekly conversion efficiency across active ad campaigns',
        config: {
          xAxis: 'week',
          yAxis: 'conversion_rate',
          aggregation: 'AVG',
          color: '#06B6D4'
        },
        position: { x: 0, y: 4, w: 12, h: 4 }
      }
    ]
  },
  {
    id: 'sys-tpl-finance-pl',
    name: 'Finance & Cash Flow Dashboard',
    description:
      'Monitor operating margins, monthly recurring revenue (MRR), departmental expenses, and burn rate dynamics.',
    category: 'Finance',
    thumbnailUrl: '/thumbnails/finance-dashboard.png',
    layoutConfig: { columns: 12, rowHeight: 80, theme: 'dark' },
    chartsConfig: [
      {
        title: 'Gross Profit vs Operating Expenses',
        chartType: 'bar',
        description: 'Monthly operating margin balance and profitability',
        config: { xAxis: 'month', yAxis: 'amount', aggregation: 'SUM', color: '#10B981' },
        position: { x: 0, y: 0, w: 8, h: 4 }
      },
      {
        title: 'Expense Breakdown by Department',
        chartType: 'pie',
        description: 'R&D, Sales, Marketing, and G&A expense shares',
        config: { dimension: 'department', measure: 'expense', aggregation: 'SUM' },
        position: { x: 8, y: 0, w: 4, h: 4 }
      },
      {
        title: 'Net Cash Flow Runway',
        chartType: 'line',
        description: 'Cash inflows, outflows, and remaining cash runway projection',
        config: { xAxis: 'month', yAxis: 'net_cash', aggregation: 'SUM', color: '#6366F1' },
        position: { x: 0, y: 4, w: 12, h: 4 }
      }
    ]
  },
  {
    id: 'sys-tpl-operations-sla',
    name: 'Operations & Service Delivery Dashboard',
    description:
      'Track ticket resolution times, order fulfillment latency, SLA compliance percentages, and error rates.',
    category: 'Operations',
    thumbnailUrl: '/thumbnails/operations-dashboard.png',
    layoutConfig: { columns: 12, rowHeight: 80, theme: 'dark' },
    chartsConfig: [
      {
        title: 'Order Fulfillment Latency (Hours)',
        chartType: 'line',
        description: 'Warehouse pick, pack, and ship turnaround hours',
        config: {
          xAxis: 'date',
          yAxis: 'fulfillment_hours',
          aggregation: 'AVG',
          color: '#3B82F6'
        },
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        title: 'SLA Compliance Rate (%)',
        chartType: 'bar',
        description: 'Percentage of requests resolved within agreed turnaround',
        config: { xAxis: 'team', yAxis: 'sla_rate', aggregation: 'AVG', color: '#10B981' },
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Incident Volume by Severity',
        chartType: 'bar',
        description: 'P1 to P4 operational incidents recorded this quarter',
        config: { xAxis: 'severity', yAxis: 'incidents', aggregation: 'COUNT', color: '#EF4444' },
        position: { x: 0, y: 4, w: 12, h: 4 }
      }
    ]
  },
  {
    id: 'sys-tpl-executive-kpis',
    name: 'Executive Leadership KPI Dashboard',
    description:
      'High-level cockpit showing Annual Recurring Revenue (ARR), Net Revenue Retention (NRR), Churn, and EBITDA.',
    category: 'Executive',
    thumbnailUrl: '/thumbnails/executive-dashboard.png',
    layoutConfig: { columns: 12, rowHeight: 80, theme: 'dark' },
    chartsConfig: [
      {
        title: 'ARR Growth Trajectory',
        chartType: 'line',
        description: 'Quarterly ARR expansion and net new ARR',
        config: { xAxis: 'quarter', yAxis: 'arr', aggregation: 'SUM', color: '#8B5CF6' },
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Net Revenue Retention (NRR %)',
        chartType: 'line',
        description: 'Expansion vs contraction from existing customer cohorts',
        config: { xAxis: 'quarter', yAxis: 'nrr_pct', aggregation: 'AVG', color: '#10B981' },
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        title: 'Customer Churn Rate by Cohort',
        chartType: 'bar',
        description: 'Quarterly gross logo churn across customer tiers',
        config: { xAxis: 'tier', yAxis: 'churn_rate', aggregation: 'AVG', color: '#F43F5E' },
        position: { x: 0, y: 4, w: 6, h: 4 }
      },
      {
        title: 'EBITDA Margin Progression',
        chartType: 'bar',
        description: 'Operating leverage and profitability expansion',
        config: {
          xAxis: 'quarter',
          yAxis: 'ebitda_margin',
          aggregation: 'AVG',
          color: '#06B6D4'
        },
        position: { x: 6, y: 4, w: 6, h: 4 }
      }
    ]
  }
];

// ============================================================
// Service methods
// ============================================================

/**
 * GET /api/v1/templates
 * List system and custom dashboard templates.
 */
export async function listTemplates(
  organizationId: string,
  workspaceId?: string,
  category?: string,
  userId?: string,
  userRoleName?: string
): Promise<TemplateListItem[]> {
  if (workspaceId && userId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      'READ'
    );
  }
  // Query custom templates from DB
  let customTemplates: DashboardTemplateData[] = [];
  try {
    const organizationObjectId = toObjectId(organizationId);
    const where: mongoose.QueryFilter<IDashboardTemplateDocument> = {
      $or: [
        { isSystem: true },
        {
          organizationId: organizationObjectId,
          ...(workspaceId ? { workspaceId: toObjectId(workspaceId) } : {})
        }
      ]
    };
    if (category && category !== 'All') {
      where.category = category;
    }
    const docs = await DashboardTemplateModel.find(where)
      .sort({ createdAt: -1 })
      .lean();
    customTemplates = serializeDocs<DashboardTemplateData>(docs as unknown[]);
  } catch (error) {
    // If DB read fails, fall back to the in-memory system templates.
    logger.warn('Failed to load dashboard templates from database', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Combine system seeds with DB templates
  const systemItems: SystemTemplateItem[] = SYSTEM_TEMPLATES.filter((tpl) => {
    if (category && category !== 'All' && tpl.category !== category) return false;
    return true;
  }).map((tpl) => ({
    ...tpl,
    isSystem: true,
    organizationId: null,
    workspaceId: null,
    createdById: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01')
  }));

  // Merge unique by ID
  const map = new Map<string, TemplateListItem>();
  for (const item of systemItems) map.set(item.id, item);
  for (const item of customTemplates) map.set(item.id, item);

  return Array.from(map.values());
}

/**
 * GET /api/v1/templates/:id
 * Retrieve a single template with layout and widget configuration.
 */
export async function getTemplateById(
  templateId: string,
  organizationId: string,
  userId?: string,
  userRoleName?: string
): Promise<TemplateDetail> {
  // Check system templates first
  const sys = SYSTEM_TEMPLATES.find((t) => t.id === templateId);
  if (sys) {
    return {
      ...sys,
      isSystem: true,
      organizationId: null,
      workspaceId: null
    };
  }

  const templateObjectId = toObjectId(templateId);
  const organizationObjectId = toObjectId(organizationId);

  const doc = templateObjectId
    ? await DashboardTemplateModel.findOne({
        _id: templateObjectId,
        $or: [{ isSystem: true }, { organizationId: organizationObjectId }]
      }).lean()
    : null;

  if (!doc) {
    throw AppError.notFound(`Dashboard template with ID "${templateId}" not found`);
  }

  const template = serializeDoc<DashboardTemplateData>(doc);

  if (template.workspaceId && userId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: template.workspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      'READ'
    );
  }

  return template;
}

/**
 * POST /api/v1/templates/from-dashboard
 * Save an existing dashboard as a reusable template.
 */
export async function createTemplateFromDashboard(
  params: CreateTemplateFromDashboardParams
): Promise<DashboardTemplateData> {
  const { dashboardId, name, description, category, userId, organizationId, userRoleName } =
    params;

  const dashboardObjectId = toObjectId(dashboardId);
  const organizationObjectId = toObjectId(organizationId);

  const dashboard =
    dashboardObjectId && organizationObjectId
      ? await DashboardModel.findOne({
          _id: dashboardObjectId,
          organizationId: organizationObjectId
        }).lean()
      : null;

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const dashboardWorkspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  // Check the source dashboard's actual workspace, never a caller-supplied label.
  await verifyResourceWorkspaceAccess(
    { workspaceId: dashboardWorkspaceId ?? null, organizationId: dashboard.organizationId.toString() },
    userId,
    organizationId,
    userRoleName,
    'READ'
  );

  const charts = await ChartModel.find({ dashboardId: dashboardObjectId }).lean();

  const chartsConfig: TemplateChartDef[] = charts.map((c) => ({
    title: c.title,
    chartType: c.chartType,
    description: c.description ?? undefined,
    config: (c.config as Record<string, unknown>) || {},
    position: (c.position as unknown as TemplateChartDef['position']) || { x: 0, y: 0, w: 6, h: 4 }
  }));

  const template = await DashboardTemplateModel.create({
    name,
    description: description ?? null,
    category,
    layoutConfig: dashboard.layoutConfig,
    chartsConfig,
    isSystem: false,
    organizationId: organizationObjectId,
    workspaceId: dashboardWorkspaceId ? toObjectId(dashboardWorkspaceId) : null,
    createdById: toObjectId(userId)
  });

  await logAuditEvent({
    organizationId,
    workspaceId: dashboardWorkspaceId,
    userId,
    action: 'TEMPLATE_CREATED',
    resourceType: 'DashboardTemplate',
    resourceId: template._id.toString(),
    metadata: { templateName: name, category, sourceDashboardId: dashboardId }
  });

  return serializeDoc<DashboardTemplateData>(template);
}

/**
 * POST /api/v1/templates/:id/instantiate
 * Create a new, independent dashboard cloned from a template.
 */
export async function instantiateDashboardFromTemplate(
  params: InstantiateDashboardFromTemplateParams
): Promise<InstantiatedDashboard> {
  const {
    templateId,
    name,
    description,
    workspaceId,
    targetDatasetId,
    userId,
    organizationId,
    userRoleName
  } = params;

  const template = await getTemplateById(templateId, organizationId, userId, userRoleName);

  const templateWorkspaceId = template.workspaceId ?? undefined;
  let resolvedWorkspaceId = workspaceId ?? templateWorkspaceId;

  // Validate workspace access if workspaceId provided
  if (resolvedWorkspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: resolvedWorkspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      'WRITE'
    );
  }

  const targetDatasetObjectId = toObjectId(targetDatasetId);
  const organizationObjectId = toObjectId(organizationId);

  if (targetDatasetId) {
    const dataset =
      targetDatasetObjectId && organizationObjectId
        ? await DatasetModel.findOne({
            _id: targetDatasetObjectId,
            organizationId: organizationObjectId
          })
            .select('workspaceId organizationId')
            .lean()
        : null;
    if (!dataset) throw AppError.notFound('Target dataset');

    const datasetWorkspaceId = dataset.workspaceId ? dataset.workspaceId.toString() : null;

    await verifyResourceWorkspaceAccess(
      {
        workspaceId: datasetWorkspaceId,
        organizationId: dataset.organizationId.toString()
      },
      userId,
      organizationId,
      userRoleName,
      'READ'
    );
    if (!resolvedWorkspaceId) resolvedWorkspaceId = datasetWorkspaceId ?? undefined;
    if (resolvedWorkspaceId && datasetWorkspaceId !== resolvedWorkspaceId) {
      throw AppError.badRequest('Target dataset must belong to the selected workspace');
    }
  }

  if (resolvedWorkspaceId && !workspaceId && !templateWorkspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: resolvedWorkspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      'WRITE'
    );
  }

  // Create an independent Dashboard
  const ownerObjectId = toObjectId(userId);
  if (!organizationObjectId || !ownerObjectId) {
    throw AppError.badRequest('Invalid dashboard owner');
  }

  const newDashboard = await DashboardModel.create({
    name,
    description: description || template.description || null,
    organizationId: organizationObjectId,
    ownerId: ownerObjectId,
    status: DASHBOARD_STATUS.DRAFT,
    visibility: DASHBOARD_VISIBILITY.PRIVATE,
    layoutConfig: {
      ...((template.layoutConfig as Record<string, unknown>) || {}),
      ...(resolvedWorkspaceId ? { workspaceId: resolvedWorkspaceId } : {})
    }
  });

  // Clone charts into the new dashboard completely independent from template
  const chartsToCreate = (template.chartsConfig as unknown as TemplateChartDef[]) || [];
  for (let i = 0; i < chartsToCreate.length; i++) {
    const c = chartsToCreate[i];
    if (!c) continue;
    await ChartModel.create({
      dashboardId: newDashboard._id,
      title: c.title,
      description: c.description ?? null,
      chartType: c.chartType,
      config: c.config as Record<string, unknown>,
      position: c.position as Record<string, unknown>,
      sortOrder: i,
      datasetId: targetDatasetObjectId
    });
  }

  await logAuditEvent({
    organizationId,
    workspaceId: resolvedWorkspaceId,
    userId,
    action: 'TEMPLATE_APPLIED',
    resourceType: 'Dashboard',
    resourceId: newDashboard._id.toString(),
    metadata: {
      templateId,
      templateName: template.name,
      newDashboardName: name,
      chartsCount: chartsToCreate.length
    }
  });

  return serializeDoc<InstantiatedDashboard>(newDashboard);
}