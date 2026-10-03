// ========================================
// Test Setup
// ========================================
// Loads test environment variables and mocks.
// This file runs before every test suite.
// ========================================

import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root (two levels up from apps/api)
config({ path: resolve(process.cwd(), "../../.env") });
// Also try current directory for CI environments
config({ path: resolve(process.cwd(), ".env") });

// Override / set test-specific values
process.env["NODE_ENV"] = "test";
process.env["JWT_ACCESS_SECRET"] =
  "test_access_secret_min_32_characters_for_tests_abc";
process.env["JWT_REFRESH_SECRET"] =
  "test_refresh_secret_min_32_characters_for_tests_xyz";
process.env["JWT_ACCESS_EXPIRES_IN"] = "15m";
process.env["JWT_REFRESH_EXPIRES_IN"] = "7d";

// Provide a fallback DATABASE_URL so env.ts doesn't crash on parse.
// The actual DB availability is checked at runtime in beforeAll.
if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] =
    "postgresql://ricozviz:ricozviz_dev_password@localhost:5432/ricozviz_db?schema=public";
}

import { beforeAll } from "vitest";
import { prisma } from "../lib/prisma.js";

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    // 1. Ensure test organizations
    const testOrgs = [
      { id: "org-test-admin-1", name: "Test Admin Organization", slug: "test-admin-org" },
      { id: "org-other-tenant-99", name: "Other Tenant Organization", slug: "other-tenant-org" },
      { id: "00000000-0000-0000-0000-000000000001", name: "Test Org A", slug: "test-org-a" },
      { id: "00000000-0000-0000-0000-000000000002", name: "Test Org B", slug: "test-org-b" },
    ];

    for (const org of testOrgs) {
      await prisma.organization.upsert({
        where: { id: org.id },
        update: {},
        create: org,
      });
    }

    // 2. Ensure admin role
    let adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          name: "ADMIN",
          description: "System Administrator",
          isSystem: true,
        },
      });
    }

    // 3. Ensure test users
    const testUsers = [
      { id: "user-admin-1", email: "admin@ricozviz.test", name: "Test Admin", orgId: "org-test-admin-1" },
      { id: "user-analyst-1", email: "analyst@ricozviz.test", name: "Test Analyst", orgId: "org-test-admin-1" },
      { id: "user-business-1", email: "business@ricozviz.test", name: "Test Business", orgId: "org-test-admin-1" },
      { id: "user-no-perms", email: "noperms@ricozviz.test", name: "Test No Perms", orgId: "org-test-admin-1" },
      { id: "user-other-org", email: "other@other-org.test", name: "Test Other Org", orgId: "org-other-tenant-99" },
      { id: "00000000-0000-0000-0000-000000000010", email: "usera@orga.com", name: "User A", orgId: "00000000-0000-0000-0000-000000000001" },
      { id: "00000000-0000-0000-0000-000000000020", email: "userb@orga.com", name: "User B", orgId: "00000000-0000-0000-0000-000000000001" },
      { id: "00000000-0000-0000-0000-000000000030", email: "userc@orgb.com", name: "User C", orgId: "00000000-0000-0000-0000-000000000002" },
    ];

    for (const u of testUsers) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          passwordHash: "$2b$12$e8869hXm5z7wQ6R0UaJ6beXQ2O853d9eM5Z9jW5Y0g9zNqFkXjFvK",
          status: "ACTIVE",
        },
      });

      await prisma.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: u.id,
            organizationId: u.orgId,
          },
        },
        update: {},
        create: {
          userId: u.id,
          organizationId: u.orgId,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
      });
    }

    // 4. Ensure test workspaces
    const testWorkspaces = [
      { id: "ws-test-alpha-1", organizationId: "org-test-admin-1", name: "Alpha Workspace", slug: "alpha-workspace" },
      { id: "ws-test-beta-2", organizationId: "org-test-admin-1", name: "Beta Workspace", slug: "beta-workspace" },
      { id: "ws-test-other-99", organizationId: "org-other-tenant-99", name: "Other Org Workspace", slug: "other-org-workspace" },
    ];

    for (const ws of testWorkspaces) {
      await prisma.workspace.upsert({
        where: { id: ws.id },
        update: {},
        create: ws,
      });
    }

    // 5. Ensure workspace memberships
    const wsMembers = [
      { workspaceId: "ws-test-alpha-1", userId: "user-admin-1", role: "OWNER" as const },
      { workspaceId: "ws-test-alpha-1", userId: "user-analyst-1", role: "MEMBER" as const },
      { workspaceId: "ws-test-beta-2", userId: "user-admin-1", role: "OWNER" as const },
      { workspaceId: "ws-test-other-99", userId: "user-other-org", role: "OWNER" as const },
    ];

    for (const wm of wsMembers) {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: wm.workspaceId,
            userId: wm.userId,
          },
        },
        update: {},
        create: wm,
      });
    }
  } catch (err) {
    console.error("Test setup error in setup.ts:", err);
  }
});
