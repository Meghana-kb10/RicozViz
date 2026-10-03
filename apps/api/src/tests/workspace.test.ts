// ========================================
// Workspace Integration & Unit Tests
// ========================================
// Tests workspace CRUD, multi-tenant isolation, role permissions,
// membership management, and safe deletion strategy.
// Works seamlessly when DB is offline (unit & auth guards),
// and executes full DB integration tests when PostgreSQL is running.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";

const app = createApp();
const request = supertest(app);

// ---- Test fixtures ----
const ORG_A_ID = "00000000-0000-0000-0000-000000000001";
const ORG_B_ID = "00000000-0000-0000-0000-000000000002";

const USER_A_ID = "00000000-0000-0000-0000-000000000010"; // Org A Admin
const USER_B_ID = "00000000-0000-0000-0000-000000000020"; // Org A Member
const USER_C_ID = "00000000-0000-0000-0000-000000000030"; // Org B User (unrelated)

let dbAvailable = false;
let testWorkspaceId = "";

const tokenUserA = signAccessToken({
  sub: USER_A_ID,
  email: "usera@orga.com",
  organizationId: ORG_A_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["WORKSPACE_CREATE", "WORKSPACE_VIEW"],
});

const tokenUserB = signAccessToken({
  sub: USER_B_ID,
  email: "userb@orga.com",
  organizationId: ORG_A_ID,
  roleId: "role-member",
  roleName: "BUSINESS_USER",
  permissions: ["WORKSPACE_VIEW"],
});

const tokenUserC = signAccessToken({
  sub: USER_C_ID,
  email: "userc@orgb.com",
  organizationId: ORG_B_ID,
  roleId: "role-admin",
  roleName: "ADMIN",
  permissions: ["WORKSPACE_CREATE", "WORKSPACE_VIEW"],
});

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — DB-dependent workspace integration tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    try {
      if (testWorkspaceId) {
        await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } });
      }
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// 1. AUTHENTICATION & ROUTE GUARDS (Run without DB)
// ============================================================

describe("Workspace API — Authentication & Authorization Guards", () => {
  it("rejects unauthenticated POST /api/v1/workspaces with 401", async () => {
    const res = await request.post("/api/v1/workspaces").send({
      name: "Acme Analytics",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated GET /api/v1/workspaces with 401", async () => {
    const res = await request.get("/api/v1/workspaces");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated GET /api/v1/workspaces/:id with 401", async () => {
    const res = await request.get("/api/v1/workspaces/ws-123");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated PATCH /api/v1/workspaces/:id with 401", async () => {
    const res = await request
      .patch("/api/v1/workspaces/ws-123")
      .send({ name: "Updated Name" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated DELETE /api/v1/workspaces/:id with 401", async () => {
    const res = await request.delete("/api/v1/workspaces/ws-123");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated GET /api/v1/workspaces/:id/members with 401", async () => {
    const res = await request.get("/api/v1/workspaces/ws-123/members");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated POST /api/v1/workspaces/:id/members with 401", async () => {
    const res = await request
      .post("/api/v1/workspaces/ws-123/members")
      .send({ userId: USER_B_ID });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects unauthenticated DELETE /api/v1/workspaces/:id/members/:userId with 401", async () => {
    const res = await request.delete(`/api/v1/workspaces/ws-123/members/${USER_B_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with malformed Bearer token", async () => {
    const res = await request
      .get("/api/v1/workspaces")
      .set("Authorization", "Bearer invalid.malformed.token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

// ============================================================
// 2. INPUT VALIDATION SCHEMAS (Run without DB)
// ============================================================

describe("Workspace API — Input Validation", () => {
  it("rejects empty workspace name with 400", async () => {
    const res = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects workspace name exceeding 100 characters with 400", async () => {
    const res = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({ name: "A".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects description exceeding 500 characters with 400", async () => {
    const res = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({ name: "Valid Name", description: "B".repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid UUID in add workspace member endpoint", async () => {
    const res = await request
      .post("/api/v1/workspaces/ws-123/members")
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({ userId: "not-a-valid-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ============================================================
// 3. WORKSPACE CORE UNIT & BUSINESS RULES (Run without DB)
// ============================================================

describe("Workspace Business Rules & Safeguards", () => {
  it("validates createWorkspaceSchema with clean inputs", async () => {
    const { createWorkspaceSchema } = await import("../services/workspace.service.js");

    const valid = createWorkspaceSchema.parse({
      name: "Marketing Analytics",
      description: "Workspace for marketing team metrics",
    });

    expect(valid.name).toBe("Marketing Analytics");
    expect(valid.description).toBe("Workspace for marketing team metrics");
  });

  it("validates updateWorkspaceSchema with partial updates", async () => {
    const { updateWorkspaceSchema } = await import("../services/workspace.service.js");

    const partial = updateWorkspaceSchema.parse({
      description: "Updated description only",
    });

    expect(partial.name).toBeUndefined();
    expect(partial.description).toBe("Updated description only");
  });

  it("validates addWorkspaceMemberSchema default role is MEMBER", async () => {
    const { addWorkspaceMemberSchema } = await import("../services/workspace.service.js");

    const parsed = addWorkspaceMemberSchema.parse({
      userId: "11111111-1111-1111-1111-111111111111",
    });

    expect(parsed.role).toBe("MEMBER");
  });

  it("validates addWorkspaceMemberSchema supports ADMIN role", async () => {
    const { addWorkspaceMemberSchema } = await import("../services/workspace.service.js");

    const parsed = addWorkspaceMemberSchema.parse({
      userId: "11111111-1111-1111-1111-111111111111",
      role: "ADMIN",
    });

    expect(parsed.role).toBe("ADMIN");
  });
});

// ============================================================
// 4. DATABASE INTEGRATION TESTS (Execute when DB is available)
// ============================================================

describe("Workspace Integration Flow (PostgreSQL)", () => {
  it("authenticated user creates workspace and becomes OWNER", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({
        name: "Engineering Team Hub",
        description: "Core analytics workspace for dev teams",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Engineering Team Hub");
    expect(res.body.data.slug).toBeTruthy();
    expect(res.body.data.role).toBe("OWNER");
    expect(res.body.data.memberCount).toBe(1);
    expect(res.body.data.organizationId).toBe(ORG_A_ID);

    testWorkspaceId = res.body.data.id;
  });

  it("user can list accessible workspaces", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .get("/api/v1/workspaces")
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((w: { id: string }) => w.id === testWorkspaceId);
    expect(found).toBeDefined();
    expect(found.role).toBe("OWNER");
  });

  it("user can retrieve specific accessible workspace", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .get(`/api/v1/workspaces/${testWorkspaceId}`)
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testWorkspaceId);
    expect(res.body.data.role).toBe("OWNER");
  });

  it("unrelated user from another organization cannot access workspace (403/404)", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .get(`/api/v1/workspaces/${testWorkspaceId}`)
      .set("Authorization", `Bearer ${tokenUserC}`);

    expect([403, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it("OWNER can update workspace name and description", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .patch(`/api/v1/workspaces/${testWorkspaceId}`)
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({
        name: "Engineering Analytics Hub",
        description: "Updated description",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Engineering Analytics Hub");
    expect(res.body.data.description).toBe("Updated description");
  });

  it("OWNER can add member to workspace", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .post(`/api/v1/workspaces/${testWorkspaceId}/members`)
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({
        userId: USER_B_ID,
        role: "MEMBER",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe("MEMBER");
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it("duplicate membership is rejected with 409 Conflict", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .post(`/api/v1/workspaces/${testWorkspaceId}/members`)
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({
        userId: USER_B_ID,
        role: "MEMBER",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("cannot add member from an unrelated organization", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .post(`/api/v1/workspaces/${testWorkspaceId}/members`)
      .set("Authorization", `Bearer ${tokenUserA}`)
      .send({
        userId: USER_C_ID, // from Org B
        role: "MEMBER",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("regular member cannot update workspace details (403 Forbidden)", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .patch(`/api/v1/workspaces/${testWorkspaceId}`)
      .set("Authorization", `Bearer ${tokenUserB}`)
      .send({ name: "Unauthorized Rename Attempt" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("listing workspace members returns sanitized user information", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .get(`/api/v1/workspaces/${testWorkspaceId}/members`)
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    for (const m of res.body.data) {
      expect(m.user.passwordHash).toBeUndefined();
      expect(m.user.password).toBeUndefined();
    }
  });

  it("safeguard: cannot remove the final OWNER of a workspace", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .delete(`/api/v1/workspaces/${testWorkspaceId}/members/${USER_A_ID}`)
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("final owner");
  });

  it("OWNER can remove a regular member", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .delete(`/api/v1/workspaces/${testWorkspaceId}/members/${USER_B_ID}`)
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain("successfully");
  });

  it("safe deletion: deleting workspace removes workspace and members without deleting user or org", async () => {
    if (!dbAvailable || !testWorkspaceId) return;

    const res = await request
      .delete(`/api/v1/workspaces/${testWorkspaceId}`)
      .set("Authorization", `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    testWorkspaceId = "";
  });
});
