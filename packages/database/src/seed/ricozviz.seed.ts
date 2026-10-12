import { PermissionModel } from '../models/organization.model';
import { RoleModel } from '../models/organization.model';
import { RolePermissionModel } from '../models/organization.model';
import type { IRolePermissionDocument } from '../models/organization.model';
import { dbLogger } from '../logger';

// ---- System roles -----------------------------------------------------------

const SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    description:
      'Full organizational administrator. Can manage users, data sources, dashboards, and settings.',
    isSystem: true
  },
  {
    name: 'ANALYST',
    description:
      'Data analyst. Can create and edit dashboards, manage data sources and datasets.',
    isSystem: true
  },
  {
    name: 'BUSINESS_USER',
    description: 'Business consumer. Can view published dashboards and run reports.',
    isSystem: true
  }
] as const;

// ---- Permissions -------------------------------------------------------------

const PERMISSIONS = [
  { key: 'USER_MANAGE', description: 'Create, update, deactivate, and invite users' },
  { key: 'USER_VIEW', description: 'View user profiles and membership lists' },

  { key: 'DATA_SOURCE_CREATE', description: 'Register a new data source connection' },
  { key: 'DATA_SOURCE_VIEW', description: 'View data source configuration (non-secret)' },
  { key: 'DATA_SOURCE_EDIT', description: 'Update data source configuration' },
  { key: 'DATA_SOURCE_DELETE', description: 'Remove a data source' },
  { key: 'DATA_SOURCE_TEST', description: 'Test a data source connection' },

  { key: 'DATASET_CREATE', description: 'Define a new dataset from a data source' },
  { key: 'DATASET_VIEW', description: 'Browse and preview datasets' },
  { key: 'DATASET_EDIT', description: 'Modify dataset schema or configuration' },
  { key: 'DATASET_DELETE', description: 'Remove a dataset' },

  { key: 'DASHBOARD_CREATE', description: 'Create a new dashboard' },
  { key: 'DASHBOARD_VIEW', description: 'View a dashboard' },
  { key: 'DASHBOARD_EDIT', description: 'Add and configure charts on a dashboard' },
  { key: 'DASHBOARD_DELETE', description: 'Delete a dashboard' },
  { key: 'DASHBOARD_PUBLISH', description: 'Publish a dashboard to the organization' },
  { key: 'DASHBOARD_SHARE', description: 'Share a dashboard with specific users or roles' },

  { key: 'CHART_CREATE', description: 'Create a new chart in a dashboard' },
  { key: 'CHART_VIEW', description: 'View charts in a dashboard' },
  { key: 'CHART_EDIT', description: 'Edit chart configuration' },
  { key: 'CHART_DELETE', description: 'Delete a chart from a dashboard' },

  { key: 'REPORT_CREATE', description: 'Schedule or generate a report' },
  { key: 'REPORT_VIEW', description: 'View scheduled reports and their history' },
  { key: 'REPORT_DELETE', description: 'Delete a report schedule' },

  { key: 'AUDIT_LOG_VIEW', description: 'View the organization audit log' }
] as const;

// ---- Role -> permission matrix ------------------------------------------------

const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key);

const ANALYST_PERMISSIONS = [
  'USER_VIEW',
  'DATA_SOURCE_CREATE',
  'DATA_SOURCE_VIEW',
  'DATA_SOURCE_EDIT',
  'DATA_SOURCE_TEST',
  'DATASET_CREATE',
  'DATASET_VIEW',
  'DATASET_EDIT',
  'DASHBOARD_CREATE',
  'DASHBOARD_VIEW',
  'DASHBOARD_EDIT',
  'DASHBOARD_DELETE',
  'DASHBOARD_PUBLISH',
  'DASHBOARD_SHARE',
  'CHART_CREATE',
  'CHART_VIEW',
  'CHART_EDIT',
  'REPORT_CREATE',
  'REPORT_VIEW',
  'REPORT_DELETE'
] as const;

const BUSINESS_USER_PERMISSIONS = [
  'DASHBOARD_VIEW',
  'CHART_VIEW',
  'DATASET_VIEW',
  'REPORT_VIEW'
] as const;

const ROLE_PERMISSION_MAP: Record<string, readonly string[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  ANALYST: ANALYST_PERMISSIONS,
  BUSINESS_USER: BUSINESS_USER_PERMISSIONS
};

/**
 * Idempotently upsert the three system roles, the permission catalogue and the
 * role/permission joins. Never creates users, organizations or passwords.
 */
export async function ensureSystemRolesAndPermissions(): Promise<void> {
  try {
    // ---- Permissions (upsert by unique `key`) ----
    for (const permission of PERMISSIONS) {
      await PermissionModel.updateOne(
        { key: permission.key },
        { $set: { description: permission.description }, $setOnInsert: { key: permission.key } },
        { upsert: true }
      );
    }

    // ---- Roles (upsert by unique `name`) ----
    for (const role of SYSTEM_ROLES) {
      await RoleModel.updateOne(
        { name: role.name },
        {
          $set: { description: role.description, isSystem: role.isSystem },
          $setOnInsert: { name: role.name }
        },
        { upsert: true }
      );
    }

    // ---- Role/permission joins ----
    const roles = await RoleModel.find({ name: { $in: Object.keys(ROLE_PERMISSION_MAP) } }).lean();
    const permissions = await PermissionModel.find().lean();

    const roleByName = new Map<string, (typeof roles)[number]>(roles.map((role) => [role.name, role]));
    const permissionByKey = new Map<string, (typeof permissions)[number]>(
      permissions.map((permission) => [permission.key, permission])
    );

    for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
      const role = roleByName.get(roleName);
      if (!role) {
        dbLogger.warn(`[Seed] Role ${roleName} not found — skipping permission assignment`);
        continue;
      }

      for (const key of permissionKeys) {
        const permission = permissionByKey.get(key);
        if (!permission) {
          dbLogger.warn(`[Seed] Permission ${key} not found — skipping`);
          continue;
        }
        await RolePermissionModel.updateOne(
          { roleId: role._id, permissionId: permission._id },
          { $setOnInsert: { roleId: role._id, permissionId: permission._id } },
          { upsert: true }
        );
      }
    }
  } catch (error) {
    dbLogger.warn(
      `[Seed] System roles/permissions unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/** Permission keys granted to a role name (empty when the role is unknown). */
export async function getPermissionsForRole(roleName: string): Promise<string[]> {
  const role = await RoleModel.findOne({ name: roleName }).lean();
  if (!role) {
    return [];
  }
  const joins = await RolePermissionModel.find({ roleId: role._id }).lean();
  if (joins.length === 0) {
    return [];
  }
  const permissionIds = joins.map((join) => join.permissionId);
  const permissions = await PermissionModel.find({ _id: { $in: permissionIds } }).lean();
  return permissions.map((permission) => permission.key);
}

export const SYSTEM_ROLE_NAMES = SYSTEM_ROLES.map((role) => role.name);
export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);