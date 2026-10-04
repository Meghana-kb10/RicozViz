// ========================================
// System Seed Service
// ========================================
// Ensures core system roles, permissions, and role-permission
// mappings exist in the database.
//
// Safe to run at server startup and during registration (idempotent).
// Resolves unseeded production database errors automatically.
// ========================================

import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";

// ---- System Roles ----
export const SYSTEM_ROLES = [
  {
    name: "ADMIN",
    description:
      "Full organizational administrator. Can manage users, data sources, dashboards, and settings.",
    isSystem: true,
  },
  {
    name: "ANALYST",
    description:
      "Data analyst. Can create and edit dashboards, manage data sources and datasets.",
    isSystem: true,
  },
  {
    name: "BUSINESS_USER",
    description:
      "Business consumer. Can view published dashboards and run reports.",
    isSystem: true,
  },
  {
    name: "EDITOR",
    description:
      "Content editor. Can create and edit dashboards, manage datasets, metrics, alerts, and templates.",
    isSystem: true,
  },
  {
    name: "VIEWER",
    description:
      "Read-only viewer. Can view dashboards, charts, metrics, alerts, reports, and export allowed views.",
    isSystem: true,
  },
] as const;

// ---- Initial Permissions ----
export const PERMISSIONS = [
  // User management
  { key: "USER_MANAGE", description: "Create, update, deactivate, and invite users" },
  { key: "USER_VIEW", description: "View user profiles and membership lists" },

  // Data source management
  { key: "DATA_SOURCE_CREATE", description: "Register a new data source connection" },
  { key: "DATA_SOURCE_VIEW", description: "View data source configuration (non-secret)" },
  { key: "DATA_SOURCE_EDIT", description: "Update data source configuration" },
  { key: "DATA_SOURCE_DELETE", description: "Remove a data source" },
  { key: "DATA_SOURCE_TEST", description: "Test a data source connection" },

  // Dataset management
  { key: "DATASET_CREATE", description: "Define a new dataset from a data source" },
  { key: "DATASET_VIEW", description: "Browse and preview datasets" },
  { key: "DATASET_EDIT", description: "Modify dataset schema or configuration" },
  { key: "DATASET_DELETE", description: "Remove a dataset" },
  { key: "DATASET_PROFILE", description: "Profile dataset schema, statistics and data quality" },

  // Dashboard management
  { key: "DASHBOARD_CREATE", description: "Create a new dashboard" },
  { key: "DASHBOARD_VIEW", description: "View a dashboard" },
  { key: "DASHBOARD_EDIT", description: "Add and configure charts on a dashboard" },
  { key: "DASHBOARD_DELETE", description: "Delete a dashboard" },
  { key: "DASHBOARD_PUBLISH", description: "Publish a dashboard to the organization" },
  { key: "DASHBOARD_SHARE", description: "Share a dashboard with specific users or roles" },

  // Chart management
  { key: "CHART_CREATE", description: "Create a new chart in a dashboard" },
  { key: "CHART_VIEW", description: "View charts in a dashboard" },
  { key: "CHART_EDIT", description: "Edit chart configuration" },
  { key: "CHART_DELETE", description: "Delete a chart from a dashboard" },

  // Report management
  { key: "REPORT_CREATE", description: "Schedule or generate a report" },
  { key: "REPORT_VIEW", description: "View scheduled reports and their history" },
  { key: "REPORT_DELETE", description: "Delete a report schedule" },

  // KPI / Metrics layer
  { key: "METRIC_CREATE", description: "Create business metrics and KPIs" },
  { key: "METRIC_VIEW", description: "View metrics and their values" },
  { key: "METRIC_EDIT", description: "Update metric configuration or targets" },
  { key: "METRIC_DELETE", description: "Delete a metric" },

  // Smart data alerts
  { key: "ALERT_CREATE", description: "Create threshold alerts for metrics" },
  { key: "ALERT_VIEW", description: "View alerts and alert trigger history" },
  { key: "ALERT_EDIT", description: "Update alert thresholds and conditions" },
  { key: "ALERT_DELETE", description: "Delete an alert" },

  // Templates
  { key: "TEMPLATE_VIEW", description: "Browse and preview dashboard templates" },
  { key: "TEMPLATE_CREATE", description: "Save a dashboard as a template" },
  { key: "TEMPLATE_APPLY", description: "Create a dashboard from a template" },

  // Exports
  { key: "DATA_EXPORT", description: "Export datasets, charts, and dashboards" },

  // Transformations & Versioning
  { key: "DATASET_TRANSFORM", description: "Clean, transform, and derive datasets" },
  { key: "DATASET_VERSION_MANAGE", description: "Manage dataset versions and rollback" },

  // Collaboration
  { key: "COLLABORATION_MANAGE", description: "Manage workspace collaborators and resource sharing permissions" },
  { key: "CHART_SHARE", description: "Share individual charts and visualizations" },

  // Audit log
  { key: "AUDIT_LOG_VIEW", description: "View the organization audit log" },
  { key: "AUDIT_LOG_EXPORT", description: "Export audit log records" },
] as const;

export const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key);

export const ANALYST_PERMISSIONS = [
  "USER_VIEW",
  "DATA_SOURCE_CREATE",
  "DATA_SOURCE_VIEW",
  "DATA_SOURCE_EDIT",
  "DATA_SOURCE_TEST",
  "DATASET_CREATE",
  "DATASET_VIEW",
  "DATASET_EDIT",
  "DATASET_PROFILE",
  "DATASET_TRANSFORM",
  "DATASET_VERSION_MANAGE",
  "COLLABORATION_MANAGE",
  "CHART_SHARE",
  "DASHBOARD_CREATE",
  "DASHBOARD_VIEW",
  "DASHBOARD_EDIT",
  "DASHBOARD_DELETE",
  "DASHBOARD_PUBLISH",
  "DASHBOARD_SHARE",
  "CHART_CREATE",
  "CHART_VIEW",
  "CHART_EDIT",
  "CHART_DELETE",
  "REPORT_CREATE",
  "REPORT_VIEW",
  "REPORT_DELETE",
  "METRIC_CREATE",
  "METRIC_VIEW",
  "METRIC_EDIT",
  "METRIC_DELETE",
  "ALERT_CREATE",
  "ALERT_VIEW",
  "ALERT_EDIT",
  "ALERT_DELETE",
  "TEMPLATE_VIEW",
  "TEMPLATE_CREATE",
  "TEMPLATE_APPLY",
  "DATA_EXPORT",
] as const;

export const EDITOR_PERMISSIONS = ANALYST_PERMISSIONS;

export const BUSINESS_USER_PERMISSIONS = [
  "DASHBOARD_VIEW",
  "CHART_VIEW",
  "DATASET_VIEW",
  "REPORT_VIEW",
  "METRIC_VIEW",
  "ALERT_VIEW",
  "TEMPLATE_VIEW",
  "DATA_EXPORT",
] as const;

export const VIEWER_PERMISSIONS = BUSINESS_USER_PERMISSIONS;

const ROLE_PERMISSION_MAP: Record<string, readonly string[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  ANALYST: ANALYST_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  BUSINESS_USER: BUSINESS_USER_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
};

let initPromise: Promise<void> | null = null;

/**
 * Ensures all system roles and permissions exist in the database.
 * Thread-safe and idempotent.
 */
export async function ensureSystemRolesAndPermissions(
  client?: PrismaClient | Prisma.TransactionClient
): Promise<void> {
  const db = (client ?? defaultPrisma) as PrismaClient;

  // Single in-flight initialization promise to prevent race conditions during rapid concurrent requests
  if (!client && initPromise) {
    return initPromise;
  }

  const run = async () => {
    try {
      // 1. Fast check: Do all 5 system roles exist with permissions?
      const existingRoles = await db.role.findMany({
        where: { name: { in: ["ADMIN", "ANALYST", "BUSINESS_USER", "EDITOR", "VIEWER"] } },
        include: { _count: { select: { permissions: true } } },
      });

      const adminRole = existingRoles.find((r) => r.name === "ADMIN");
      const analystRole = existingRoles.find((r) => r.name === "ANALYST");
      const businessUserRole = existingRoles.find((r) => r.name === "BUSINESS_USER");
      const editorRole = existingRoles.find((r) => r.name === "EDITOR");
      const viewerRole = existingRoles.find((r) => r.name === "VIEWER");

      if (
        existingRoles.length === 5 &&
        adminRole &&
        adminRole._count.permissions >= ADMIN_PERMISSIONS.length &&
        analystRole &&
        analystRole._count.permissions >= ANALYST_PERMISSIONS.length &&
        businessUserRole &&
        businessUserRole._count.permissions >= BUSINESS_USER_PERMISSIONS.length &&
        editorRole &&
        editorRole._count.permissions >= EDITOR_PERMISSIONS.length &&
        viewerRole &&
        viewerRole._count.permissions >= VIEWER_PERMISSIONS.length
      ) {
        return; // All roles and permissions are already properly initialized
      }

      logger.info("Initializing system permissions and roles...");

      // 2. Upsert permissions
      for (const perm of PERMISSIONS) {
        await db.permission.upsert({
          where: { key: perm.key },
          update: { description: perm.description },
          create: { key: perm.key, description: perm.description },
        });
      }

      // 3. Upsert roles
      for (const role of SYSTEM_ROLES) {
        await db.role.upsert({
          where: { name: role.name },
          update: { description: role.description, isSystem: role.isSystem },
          create: {
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
          },
        });
      }

      // 4. Fetch updated roles & permissions
      const allRoles = await db.role.findMany({
        where: { name: { in: ["ADMIN", "ANALYST", "BUSINESS_USER", "EDITOR", "VIEWER"] } },
      });
      const allPermissions = await db.permission.findMany();
      const permMap = new Map(allPermissions.map((p) => [p.key, p.id]));

      // 5. Upsert role-permission mappings
      for (const role of allRoles) {
        const keys = ROLE_PERMISSION_MAP[role.name] || [];
        for (const key of keys) {
          const permId = permMap.get(key);
          if (!permId) continue;

          await db.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permId,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permId,
            },
          });
        }
      }

      logger.info("System permissions and roles successfully initialized");
    } catch (err) {
      logger.error("Error ensuring system roles and permissions", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  if (!client) {
    initPromise = run().finally(() => {
      initPromise = null;
    });
    return initPromise;
  }

  return run();
}
