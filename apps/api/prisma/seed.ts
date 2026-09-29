// ========================================
// RicozViz — Database Seed Script
// ========================================
// Seeds safe development data only:
//   - System Roles
//   - Initial Permissions
//   - Role-Permission assignments
//
// Does NOT create users or organizations.
// Does NOT insert plaintext passwords.
// Safe to run in development environments.
//
// Run: cd apps/api && npx prisma db seed
// ========================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---- System Roles ----
const SYSTEM_ROLES = [
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
] as const;

// ---- Initial Permissions ----
const PERMISSIONS = [
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

  // Dashboard management
  { key: "DASHBOARD_CREATE", description: "Create a new dashboard" },
  { key: "DASHBOARD_VIEW", description: "View a dashboard" },
  { key: "DASHBOARD_EDIT", description: "Add and configure charts on a dashboard" },
  { key: "DASHBOARD_DELETE", description: "Delete a dashboard" },
  { key: "DASHBOARD_PUBLISH", description: "Publish a dashboard to the organization" },
  { key: "DASHBOARD_SHARE", description: "Share a dashboard with specific users or roles" },

  // Report management
  { key: "REPORT_CREATE", description: "Schedule or generate a report" },
  { key: "REPORT_VIEW", description: "View scheduled reports and their history" },
  { key: "REPORT_DELETE", description: "Delete a report schedule" },

  // Audit log
  { key: "AUDIT_LOG_VIEW", description: "View the organization audit log" },
] as const;

// ---- Role → Permission assignments ----
// ADMIN  → all permissions
// ANALYST → data, dashboard, report permissions (no user management)
// BUSINESS_USER → view-only permissions

const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key);

const ANALYST_PERMISSIONS = [
  "USER_VIEW",
  "DATA_SOURCE_CREATE",
  "DATA_SOURCE_VIEW",
  "DATA_SOURCE_EDIT",
  "DATA_SOURCE_TEST",
  "DATASET_CREATE",
  "DATASET_VIEW",
  "DATASET_EDIT",
  "DASHBOARD_CREATE",
  "DASHBOARD_VIEW",
  "DASHBOARD_EDIT",
  "DASHBOARD_DELETE",
  "DASHBOARD_PUBLISH",
  "DASHBOARD_SHARE",
  "REPORT_CREATE",
  "REPORT_VIEW",
  "REPORT_DELETE",
] as const;

const BUSINESS_USER_PERMISSIONS = [
  "DASHBOARD_VIEW",
  "DATASET_VIEW",
  "REPORT_VIEW",
] as const;

async function main() {
  console.log("🌱 Starting RicozViz database seed...");

  // ---- Upsert permissions ----
  console.log("  → Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: { key: perm.key, description: perm.description },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} permissions seeded`);

  // ---- Upsert system roles ----
  console.log("  → Seeding roles...");
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: role.isSystem },
      create: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });
  }
  console.log(`  ✓ ${SYSTEM_ROLES.length} roles seeded`);

  // ---- Assign permissions to roles ----
  console.log("  → Assigning permissions to roles...");

  const rolePermissionMap: Record<string, readonly string[]> = {
    ADMIN: ADMIN_PERMISSIONS,
    ANALYST: ANALYST_PERMISSIONS,
    BUSINESS_USER: BUSINESS_USER_PERMISSIONS,
  };

  for (const [roleName, permKeys] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      console.warn(`  ⚠ Role ${roleName} not found — skipping permission assignment`);
      continue;
    }

    for (const key of permKeys) {
      const permission = await prisma.permission.findUnique({ where: { key } });
      if (!permission) {
        console.warn(`  ⚠ Permission ${key} not found — skipping`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(`  ✓ ${roleName}: ${permKeys.length} permissions assigned`);
  }

  console.log("\n✅ Seed complete.");
  console.log("   Roles:       ADMIN, ANALYST, BUSINESS_USER");
  console.log(`   Permissions: ${PERMISSIONS.length} total`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
