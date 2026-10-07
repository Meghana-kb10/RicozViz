// ========================================
// Dashboard Templates Service
// ========================================
// Manages system and workspace reusable dashboard templates.
// Enables browsing, previewing, saving existing dashboards as templates,
// and instantiating independent cloned dashboards from templates.
// ========================================

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { logAuditEvent } from "../audit.service.js";
import { getDashboardWorkspaceId, verifyResourceWorkspaceAccess } from "../workspace/workspace-auth.helper.js";

export interface TemplateChartDef {
  title: string;
  chartType: string;
  description?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface SystemTemplateSeed {
  id: string;
  name: string;
  description: string;
  category: "Sales" | "Marketing" | "Finance" | "Operations" | "Executive";
  thumbnailUrl?: string;
  layoutConfig: Record<string, unknown>;
  chartsConfig: TemplateChartDef[];
}

export const SYSTEM_TEMPLATES: SystemTemplateSeed[] = [
  {
    id: "sys-tpl-sales-performance",
    name: "Sales Performance Dashboard",
    description: "Track revenue trajectories, regional sales distribution, top performing sales reps, and deal pipeline conversion.",
    category: "Sales",
    thumbnailUrl: "/thumbnails/sales-dashboard.png",
    layoutConfig: { columns: 12, rowHeight: 80, theme: "dark" },
    chartsConfig: [
      {
        title: "Total Revenue by Region",
        chartType: "bar",
        description: "Comparative regional performance overview",
        config: { xAxis: "region", yAxis: "revenue", aggregation: "SUM", color: "#3B82F6" },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        title: "Monthly Sales Trend",
        chartType: "line",
        description: "Month-over-month trajectory with target pacing",
        config: { xAxis: "month", yAxis: "sales", aggregation: "SUM", color: "#10B981" },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        title: "Product Category Share",
        chartType: "pie",
        description: "Revenue breakdown across primary product categories",
        config: { dimension: "category", measure: "revenue", aggregation: "SUM" },
        position: { x: 0, y: 4, w: 6, h: 4 },
      },
      {
        title: "Average Deal Size by Segment",
        chartType: "bar",
        description: "Order values grouped by Enterprise vs SMB segments",
        config: { xAxis: "segment", yAxis: "deal_size", aggregation: "AVG", color: "#8B5CF6" },
        position: { x: 6, y: 4, w: 6, h: 4 },
      },
    ],
  },
  {
    id: "sys-tpl-marketing-roi",
    name: "Marketing & Growth Dashboard",
    description: "Analyze campaign return on ad spend (ROAS), acquisition funnels, cost per lead, and channel conversion velocity.",
    category: "Marketing",
    thumbnailUrl: "/thumbnails/marketing-dashboard.png",
    layoutConfig: { columns: 12, rowHeight: 80, theme: "dark" },
    chartsConfig: [
      {
        title: "Acquisition Funnel by Stage",
        chartType: "bar",
        description: "Visitors to qualified leads to converted customers",
        config: { xAxis: "stage", yAxis: "count", aggregation: "COUNT", color: "#F59E0B" },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        title: "Customer Acquisition Cost (CAC) by Channel",
        chartType: "bar",
        description: "Paid Search, Social, Organic, and Referral channels",
        config: { xAxis: "channel", yAxis: "cac", aggregation: "AVG", color: "#EF4444" },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        title: "Campaign Conversion Rates",
        chartType: "line",
        description: "Weekly conversion efficiency across active ad campaigns",
        config: { xAxis: "week", yAxis: "conversion_rate", aggregation: "AVG", color: "#06B6D4" },
        position: { x: 0, y: 4, w: 12, h: 4 },
      },
    ],
  },
  {
    id: "sys-tpl-finance-pl",
    name: "Finance & Cash Flow Dashboard",
    description: "Monitor operating margins, monthly recurring revenue (MRR), departmental expenses, and burn rate dynamics.",
    category: "Finance",
    thumbnailUrl: "/thumbnails/finance-dashboard.png",
    layoutConfig: { columns: 12, rowHeight: 80, theme: "dark" },
    chartsConfig: [
      {
        title: "Gross Profit vs Operating Expenses",
        chartType: "bar",
        description: "Monthly operating margin balance and profitability",
        config: { xAxis: "month", yAxis: "amount", aggregation: "SUM", color: "#10B981" },
        position: { x: 0, y: 0, w: 8, h: 4 },
      },
      {
        title: "Expense Breakdown by Department",
        chartType: "pie",
        description: "R&D, Sales, Marketing, and G&A expense shares",
        config: { dimension: "department", measure: "expense", aggregation: "SUM" },
        position: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        title: "Net Cash Flow Runway",
        chartType: "line",
        description: "Cash inflows, outflows, and remaining cash runway projection",
        config: { xAxis: "month", yAxis: "net_cash", aggregation: "SUM", color: "#6366F1" },
        position: { x: 0, y: 4, w: 12, h: 4 },
      },
    ],
  },
  {
    id: "sys-tpl-operations-sla",
    name: "Operations & Service Delivery Dashboard",
    description: "Track ticket resolution times, order fulfillment latency, SLA compliance percentages, and error rates.",
    category: "Operations",
    thumbnailUrl: "/thumbnails/operations-dashboard.png",
    layoutConfig: { columns: 12, rowHeight: 80, theme: "dark" },
    chartsConfig: [
      {
        title: "Order Fulfillment Latency (Hours)",
        chartType: "line",
        description: "Warehouse pick, pack, and ship turnaround hours",
        config: { xAxis: "date", yAxis: "fulfillment_hours", aggregation: "AVG", color: "#3B82F6" },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        title: "SLA Compliance Rate (%)",
        chartType: "bar",
        description: "Percentage of requests resolved within agreed turnaround",
        config: { xAxis: "team", yAxis: "sla_rate", aggregation: "AVG", color: "#10B981" },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        title: "Incident Volume by Severity",
        chartType: "bar",
        description: "P1 to P4 operational incidents recorded this quarter",
        config: { xAxis: "severity", yAxis: "incidents", aggregation: "COUNT", color: "#EF4444" },
        position: { x: 0, y: 4, w: 12, h: 4 },
      },
    ],
  },
  {
    id: "sys-tpl-executive-kpis",
    name: "Executive Leadership KPI Dashboard",
    description: "High-level cockpit showing Annual Recurring Revenue (ARR), Net Revenue Retention (NRR), Churn, and EBITDA.",
    category: "Executive",
    thumbnailUrl: "/thumbnails/executive-dashboard.png",
    layoutConfig: { columns: 12, rowHeight: 80, theme: "dark" },
    chartsConfig: [
      {
        title: "ARR Growth Trajectory",
        chartType: "line",
        description: "Quarterly ARR expansion and net new ARR",
        config: { xAxis: "quarter", yAxis: "arr", aggregation: "SUM", color: "#8B5CF6" },
        position: { x: 0, y: 0, w: 6, h: 4 },
      },
      {
        title: "Net Revenue Retention (NRR %)",
        chartType: "line",
        description: "Expansion vs contraction from existing customer cohorts",
        config: { xAxis: "quarter", yAxis: "nrr_pct", aggregation: "AVG", color: "#10B981" },
        position: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        title: "Customer Churn Rate by Cohort",
        chartType: "bar",
        description: "Quarterly gross logo churn across customer tiers",
        config: { xAxis: "tier", yAxis: "churn_rate", aggregation: "AVG", color: "#F43F5E" },
        position: { x: 0, y: 4, w: 6, h: 4 },
      },
      {
        title: "EBITDA Margin Progression",
        chartType: "bar",
        description: "Operating leverage and profitability expansion",
        config: { xAxis: "quarter", yAxis: "ebitda_margin", aggregation: "AVG", color: "#06B6D4" },
        position: { x: 6, y: 4, w: 6, h: 4 },
      },
    ],
  },
];

export async function listTemplates(
  organizationId: string,
  workspaceId?: string,
  category?: string,
  userId?: string,
  userRoleName?: string
) {
  if (workspaceId && userId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      "READ"
    );
  }
  // Query custom templates from DB
  let customTemplates: any[] = [];
  try {
    const where: any = {
      OR: [{ isSystem: true }, { organizationId, ...(workspaceId ? { workspaceId } : {}) }],
    };
    if (category && category !== "All") {
      where.category = category;
    }
    customTemplates = await prisma.dashboardTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // If DB table empty, use system templates in-memory
  }

  // Combine system seeds with DB templates
  const systemItems = SYSTEM_TEMPLATES.filter((tpl) => {
    if (category && category !== "All" && tpl.category !== category) return false;
    return true;
  }).map((tpl) => ({
    ...tpl,
    isSystem: true,
    organizationId: null,
    workspaceId: null,
    createdById: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }));

  // Merge unique by ID
  const map = new Map<string, any>();
  for (const item of systemItems) map.set(item.id, item);
  for (const item of customTemplates) map.set(item.id, item);

  return Array.from(map.values());
}

export async function getTemplateById(
  templateId: string,
  organizationId: string,
  userId?: string,
  userRoleName?: string
) {
  // Check system templates first
  const sys = SYSTEM_TEMPLATES.find((t) => t.id === templateId);
  if (sys) {
    return {
      ...sys,
      isSystem: true,
      organizationId: null,
      workspaceId: null,
    };
  }

  const template = await prisma.dashboardTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ isSystem: true }, { organizationId }],
      },
  });

  if (!template) {
    throw AppError.notFound(`Dashboard template with ID "${templateId}" not found`);
  }

  if (template.workspaceId && userId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: template.workspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      "READ"
    );
  }

  return template;
}

export async function createTemplateFromDashboard(params: {
  dashboardId: string;
  name: string;
  description?: string;
  category: string;
  userId: string;
  organizationId: string;
  workspaceId?: string;
  userRoleName?: string;
}) {
  const { dashboardId, name, description, category, userId, organizationId, userRoleName } =
    params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, organizationId },
    include: { charts: true },
  });

  if (!dashboard) {
    throw AppError.notFound(`Dashboard with ID "${dashboardId}" not found`);
  }

  const dashboardWorkspaceId = getDashboardWorkspaceId(dashboard.layoutConfig);

  // Check the source dashboard's actual workspace, never a caller-supplied label.
  await verifyResourceWorkspaceAccess(
    { workspaceId: dashboardWorkspaceId, organizationId: dashboard.organizationId },
    userId,
    organizationId,
    userRoleName,
    "READ"
  );

  const chartsConfig: TemplateChartDef[] = dashboard.charts.map((c) => ({
    title: c.title,
    chartType: c.chartType,
    description: c.description ?? undefined,
    config: (c.config as Record<string, unknown>) || {},
    position: (c.position as any) || { x: 0, y: 0, w: 6, h: 4 },
  }));

  const template = await prisma.dashboardTemplate.create({
    data: {
      name,
      description,
      category,
      layoutConfig: dashboard.layoutConfig as any,
      chartsConfig: chartsConfig as any,
      isSystem: false,
      organizationId,
      workspaceId: dashboardWorkspaceId ?? null,
      createdById: userId,
    },
  });

  await logAuditEvent({
    organizationId,
    workspaceId: dashboardWorkspaceId,
    userId,
    action: "TEMPLATE_CREATED",
    resourceType: "DashboardTemplate",
    resourceId: template.id,
    metadata: { templateName: name, category, sourceDashboardId: dashboardId },
  });

  return template;
}

export async function instantiateDashboardFromTemplate(params: {
  templateId: string;
  name: string;
  description?: string;
  workspaceId?: string;
  targetDatasetId?: string;
  userId: string;
  organizationId: string;
  userRoleName?: string;
}) {
  const { templateId, name, description, workspaceId, targetDatasetId, userId, organizationId, userRoleName } =
    params;

  const template = await getTemplateById(templateId, organizationId, userId, userRoleName);

  let resolvedWorkspaceId = workspaceId ?? (template as { workspaceId?: string | null }).workspaceId ?? undefined;

  // Validate workspace access if workspaceId provided
  if (resolvedWorkspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: resolvedWorkspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      "WRITE"
    );
  }

  if (targetDatasetId) {
    const dataset = await prisma.dataset.findFirst({
      where: { id: targetDatasetId, organizationId },
      select: { workspaceId: true, organizationId: true },
    });
    if (!dataset) throw AppError.notFound("Target dataset");
    await verifyResourceWorkspaceAccess(
      { workspaceId: dataset.workspaceId, organizationId: dataset.organizationId },
      userId,
      organizationId,
      userRoleName,
      "READ"
    );
    if (!resolvedWorkspaceId) resolvedWorkspaceId = dataset.workspaceId ?? undefined;
    if (resolvedWorkspaceId && dataset.workspaceId !== resolvedWorkspaceId) {
      throw AppError.badRequest("Target dataset must belong to the selected workspace");
    }
  }

  if (resolvedWorkspaceId && !workspaceId && !(template as { workspaceId?: string | null }).workspaceId) {
    await verifyResourceWorkspaceAccess(
      { workspaceId: resolvedWorkspaceId, organizationId },
      userId,
      organizationId,
      userRoleName,
      "WRITE"
    );
  }

  // Create an independent Dashboard
  const newDashboard = await prisma.dashboard.create({
    data: {
      name,
      description: description || template.description,
      organizationId,
      ownerId: userId,
      status: "DRAFT",
      visibility: "PRIVATE",
      layoutConfig: {
        ...((template.layoutConfig as Record<string, unknown>) || {}),
        ...(resolvedWorkspaceId ? { workspaceId: resolvedWorkspaceId } : {}),
      } as any,
    },
  });

  // Clone charts into the new dashboard completely independent from template
  const chartsToCreate = (template.chartsConfig as unknown as TemplateChartDef[]) || [];
  for (let i = 0; i < chartsToCreate.length; i++) {
    const c = chartsToCreate[i];
    if (!c) continue;
    await prisma.chart.create({
      data: {
        dashboardId: newDashboard.id,
        title: c.title,
        description: c.description,
        chartType: c.chartType,
        config: c.config as any,
        position: c.position as any,
        sortOrder: i,
        datasetId: targetDatasetId ?? null,
      },
    });
  }

  await logAuditEvent({
    organizationId,
    workspaceId: resolvedWorkspaceId,
    userId,
    action: "TEMPLATE_APPLIED",
    resourceType: "Dashboard",
    resourceId: newDashboard.id,
    metadata: {
      templateId,
      templateName: template.name,
      newDashboardName: name,
      chartsCount: chartsToCreate.length,
    },
  });

  return newDashboard;
}
