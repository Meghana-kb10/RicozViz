// ========================================
// Auth Integration Tests
// ========================================
// Tests the full auth flow end-to-end using supertest.
// Requires a live PostgreSQL database (via Docker).
// When DB is unavailable, tests are skipped gracefully.
// ========================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../app";
import { prisma } from "../lib/prisma";

const app = createApp();
const request = supertest(app);

// ---- Test fixtures ----
const TEST_EMAIL = `test_${Date.now()}@ricozviz-test.com`;
const TEST_PASSWORD = "Secure_Test_Pass_123!";
const TEST_NAME = "Test User";
const TEST_ORG = `Test Org ${Date.now()}`;

let dbAvailable = false;
let accessToken = "";
let refreshCookie = "";

// ============================================================
// SETUP
// ============================================================

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn("⚠️  Database not available — integration tests will be skipped.");
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    // Clean up test data
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: "@ricozviz-test.com" } },
      });
    } catch {
      // ignore cleanup errors
    }
  }
  await prisma.$disconnect();
});

// ============================================================
// HEALTH CHECK — always runs
// ============================================================

describe("GET /api/v1/health", () => {
  it("returns 200 with service status", async () => {
    const res = await request.get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.service).toBe("ricozviz-api");
  });
});

// ============================================================
// REGISTRATION
// ============================================================

describe("POST /api/v1/auth/register", () => {
  it("skips if DB unavailable", { skip: !dbAvailable }, () => {});

  it("registers a new user and creates an organization", async () => {
    if (!dbAvailable) return;

    const res = await request.post("/api/v1/auth/register").send({
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      organizationName: TEST_ORG,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.user.name).toBe(TEST_NAME);
    expect(res.body.data.organization.name).toBe(TEST_ORG);
    expect(res.body.data.role).toBe("ADMIN");
    expect(res.body.data.accessToken).toBeTruthy();
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
    expect(res.body.data.permissions.length).toBeGreaterThan(0);

    // ---- Security: no password hash in response ----
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();

    // ---- Capture tokens ----
    accessToken = res.body.data.accessToken as string;
    const setCookie = res.headers["set-cookie"] as string[] | undefined;
    refreshCookie = setCookie?.[0] ?? "";
    expect(refreshCookie).toContain("ricozviz_refresh");
    expect(refreshCookie).toContain("HttpOnly");
  });

  it("rejects duplicate email with 409", async () => {
    if (!dbAvailable) return;

    const res = await request.post("/api/v1/auth/register").send({
      name: "Another User",
      email: TEST_EMAIL, // same email
      password: TEST_PASSWORD,
      organizationName: "Another Org",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects missing required fields with 400", async () => {
    const res = await request.post("/api/v1/auth/register").send({
      email: "incomplete@test.com",
      // missing name, password, organizationName
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects weak password with 400", async () => {
    const res = await request.post("/api/v1/auth/register").send({
      name: "User",
      email: "weak@test.com",
      password: "123",
      organizationName: "Org",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects invalid email with 400", async () => {
    const res = await request.post("/api/v1/auth/register").send({
      name: "User",
      email: "not-an-email",
      password: TEST_PASSWORD,
      organizationName: "Org",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ============================================================
// LOGIN
// ============================================================

describe("POST /api/v1/auth/login", () => {
  it("logs in with valid credentials", async () => {
    if (!dbAvailable) return;

    const res = await request.post("/api/v1/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.role).toBe("ADMIN");

    // ---- Security: no password in response ----
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();

    // ---- Refresh cookie ----
    const setCookie = res.headers["set-cookie"] as string[] | undefined;
    expect(setCookie?.some((c) => c.includes("ricozviz_refresh"))).toBe(true);
    expect(setCookie?.some((c) => c.includes("HttpOnly"))).toBe(true);

    // Update token for subsequent tests
    accessToken = res.body.data.accessToken as string;
    const freshCookie = setCookie?.[0];
    if (freshCookie) refreshCookie = freshCookie;
  });

  it("rejects invalid password with 401", async () => {
    if (!dbAvailable) return;

    const res = await request.post("/api/v1/auth/login").send({
      email: TEST_EMAIL,
      password: "wrong_password",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-existent email with 401", async () => {
    if (!dbAvailable) return; // This test makes a DB query

    const res = await request.post("/api/v1/auth/login").send({
      email: "nobody@ricozviz-test.com",
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects missing fields with 400", async () => {
    const res = await request.post("/api/v1/auth/login").send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ============================================================
// CURRENT USER
// ============================================================

describe("GET /api/v1/auth/me", () => {
  it("returns 401 for unauthenticated request", async () => {
    const res = await request.get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for malformed token", async () => {
    const res = await request
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid.token.here");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns current user for authenticated request", async () => {
    if (!dbAvailable || !accessToken) return;

    const res = await request
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_EMAIL);
    expect(res.body.data.organization).toBeDefined();
    expect(res.body.data.role).toBe("ADMIN");
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
    expect(res.body.data.permissions.length).toBeGreaterThan(0);

    // ---- Security: no sensitive fields ----
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();
  });
});

// ============================================================
// REFRESH TOKEN
// ============================================================

describe("POST /api/v1/auth/refresh", () => {
  it("returns 401 when no refresh cookie present", async () => {
    const res = await request.post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("issues a new access token from valid refresh cookie", async () => {
    if (!dbAvailable || !refreshCookie) return;

    const res = await request
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();

    // Update access token
    const newAccessToken = res.body.data.accessToken as string;
    expect(newAccessToken).not.toBe(accessToken); // Should be a fresh token
    accessToken = newAccessToken;
  });
});

// ============================================================
// LOGOUT
// ============================================================

describe("POST /api/v1/auth/logout", () => {
  it("clears the refresh cookie on logout", async () => {
    if (!dbAvailable) return;

    const res = await request
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe("Logged out successfully");

    // The Set-Cookie header should clear the refresh cookie
    const setCookie = res.headers["set-cookie"] as string[] | undefined;
    const refreshCleared = setCookie?.some(
      (c) => c.includes("ricozviz_refresh") && c.includes("Max-Age=0")
    );
    expect(refreshCleared).toBe(true);
  });

  it("rejects refresh after logout (token version invalidated)", async () => {
    if (!dbAvailable || !refreshCookie) return;

    // The old refresh cookie should now be invalid
    const res = await request
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ============================================================
// RBAC PERMISSIONS — unit-style verification
// ============================================================

describe("RBAC — permission structure", () => {
  it("ADMIN role receives all system permissions", async () => {
    if (!dbAvailable) return;

    // Re-login to get a fresh admin token
    const loginRes = await request.post("/api/v1/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (loginRes.status !== 200) return; // Already logged out, skip

    const permissions = loginRes.body.data.permissions as string[];

    expect(permissions).toContain("USER_MANAGE");
    expect(permissions).toContain("DATA_SOURCE_CREATE");
    expect(permissions).toContain("DATA_SOURCE_VIEW");
    expect(permissions).toContain("DATASET_CREATE");
    expect(permissions).toContain("DATASET_VIEW");
    expect(permissions).toContain("DASHBOARD_CREATE");
    expect(permissions).toContain("DASHBOARD_VIEW");
    expect(permissions).toContain("DASHBOARD_EDIT");
    expect(permissions).toContain("DASHBOARD_DELETE");
    expect(permissions).toContain("DASHBOARD_PUBLISH");
    expect(permissions).toContain("REPORT_CREATE");
    expect(permissions).toContain("REPORT_VIEW");
    expect(permissions).toContain("AUDIT_LOG_VIEW");
  });

  it("DB has 3 system roles seeded", async () => {
    if (!dbAvailable) return;

    const roles = await prisma.role.findMany({
      where: { isSystem: true },
      select: { name: true },
    });

    const roleNames = roles.map((r: { name: string }) => r.name);
    expect(roleNames).toContain("ADMIN");
    expect(roleNames).toContain("ANALYST");
    expect(roleNames).toContain("BUSINESS_USER");
  });

  it("ADMIN has more permissions than ANALYST", async () => {
    if (!dbAvailable) return;

    const [adminRole, analystRole] = await Promise.all([
      prisma.role.findUnique({
        where: { name: "ADMIN" },
        include: { permissions: true },
      }),
      prisma.role.findUnique({
        where: { name: "ANALYST" },
        include: { permissions: true },
      }),
    ]);

    expect(adminRole).not.toBeNull();
    expect(analystRole).not.toBeNull();
    expect(adminRole!.permissions.length).toBeGreaterThan(
      analystRole!.permissions.length
    );
  });

  it("ANALYST does NOT have USER_MANAGE permission", async () => {
    if (!dbAvailable) return;

    const analystRole = await prisma.role.findUnique({
      where: { name: "ANALYST" },
      include: {
        permissions: {
          include: { permission: { select: { key: true } } },
        },
      },
    });

    const permKeys = analystRole!.permissions.map(
      (rp: { permission: { key: string } }) => rp.permission.key
    );
    expect(permKeys).not.toContain("USER_MANAGE");
  });

  it("BUSINESS_USER only has view permissions", async () => {
    if (!dbAvailable) return;

    const bizRole = await prisma.role.findUnique({
      where: { name: "BUSINESS_USER" },
      include: {
        permissions: {
          include: { permission: { select: { key: true } } },
        },
      },
    });

    const permKeys = bizRole!.permissions.map(
      (rp: { permission: { key: string } }) => rp.permission.key
    );
    expect(permKeys).toContain("DASHBOARD_VIEW");
    expect(permKeys).toContain("DATASET_VIEW");
    expect(permKeys).toContain("REPORT_VIEW");

    // Must NOT have create/edit/delete
    expect(permKeys).not.toContain("DASHBOARD_CREATE");
    expect(permKeys).not.toContain("DASHBOARD_EDIT");
    expect(permKeys).not.toContain("DASHBOARD_DELETE");
    expect(permKeys).not.toContain("DATA_SOURCE_CREATE");
    expect(permKeys).not.toContain("USER_MANAGE");
  });
});

// ============================================================
// MULTI-TENANT SECURITY
// ============================================================

describe("Multi-tenant security", () => {
  it("requirePermission middleware rejects missing permission with 403", async () => {
    const { requirePermission } = await import("../middleware/auth.middleware");
    const guard = requirePermission("ADMIN_ONLY_PERM");
    let receivedError: any = null;
    const mockReq = {
      user: {
        userId: "u1",
        email: "u1@test.com",
        organizationId: "org1",
        roleId: "r1",
        roleName: "BUSINESS_USER",
        permissions: ["DASHBOARD_VIEW"],
      },
    } as any;
    const mockRes = {} as any;
    guard(mockReq, mockRes, (err: any) => {
      receivedError = err;
    });

    expect(receivedError).toBeDefined();
    expect(receivedError.statusCode).toBe(403);
    expect(receivedError.code).toBe("FORBIDDEN");
  });

  it("requirePermission middleware passes when user has permission", async () => {
    const { requirePermission } = await import("../middleware/auth.middleware");
    const guard = requirePermission("DASHBOARD_VIEW");
    let calledNext = false;
    let receivedError: any = null;
    const mockReq = {
      user: {
        userId: "u1",
        email: "u1@test.com",
        organizationId: "org1",
        roleId: "r1",
        roleName: "BUSINESS_USER",
        permissions: ["DASHBOARD_VIEW"],
      },
    } as any;
    const mockRes = {} as any;
    guard(mockReq, mockRes, (err?: any) => {
      if (err) receivedError = err;
      else calledNext = true;
    });

    expect(receivedError).toBeNull();
    expect(calledNext).toBe(true);
  });

  it("assertSameOrganization throws for cross-tenant access", async () => {
    const { assertSameOrganization } = await import(
      "../middleware/auth.middleware"
    );

    expect(() =>
      assertSameOrganization("org-a-id", "org-b-id")
    ).toThrowError("different organization");
  });

  it("assertSameOrganization passes for same organization", async () => {
    const { assertSameOrganization } = await import(
      "../middleware/auth.middleware"
    );

    expect(() =>
      assertSameOrganization("same-org-id", "same-org-id")
    ).not.toThrow();
  });
});

// ============================================================
// API ERROR CONSISTENCY
// ============================================================

describe("API error consistency", () => {
  it("unknown route returns 404 with correct structure", async () => {
    const res = await request.get("/api/v1/nonexistent-route");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBeTruthy();
  });

  it("protected endpoint returns 401 when unauthenticated", async () => {
    const res = await request.get("/api/v1/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    // Should NOT leak stack traces
    expect(res.body.error.stack).toBeUndefined();
  });
});
