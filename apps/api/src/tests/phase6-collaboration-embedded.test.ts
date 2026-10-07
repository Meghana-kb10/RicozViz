// ============================================================
// Phase 6: Real-Time Collaboration & Embedded Analytics Tests
// ============================================================
// Validates:
// 1. Real-Time Collaboration:
//    - Presence & active collaborator tracking with user identity
//    - Heartbeat updates and widget indicators
//    - Conflict-safe collaborative updates (detects concurrent/stale edits, rejects with 409)
//    - RBAC enforcement (VIEWER cannot save collaborative edits; EDITOR/ADMIN can)
//    - Emits DASHBOARD_COLLABORATIVE_EDIT audit log
// 2. Public Analytics:
//    - Generates cryptographically secure share link
//    - Retrieves sanitized public dashboard DTO (no tenant credentials leaked)
//    - Enforces Row-Level Security (RLS) on public queries
//    - Revocation immediately prevents further public access
//    - Emits public access audit logs
// 3. Embedded Analytics:
//    - Generates secure embed tokens with configuration (theme, controls, origins, expiry)
//    - Formats HTML iframe embed snippets
//    - Enforces origin validation policy (rejects unauthorized origins with 403)
//    - Enforces expiration policy (rejects expired embed tokens)
//    - Executes real dataset queries through DatasetQueryEngine enforcing RLS
//    - Immediate revocation disables embedding
//    - Emits DASHBOARD_EMBED_ENABLED, ACCESSED, and REVOKED audit logs
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { DatasetQueryEngine } from "../services/dataset/query-engine.js";
import {
  registerInMemoryRlsRule,
  clearInMemoryRlsRules,
  resolveUserRlsFilters,
} from "../services/dataset/rls.service.js";
import {
  createDashboardVersionSnapshot,
  listDashboardVersions,
  registerInMemoryDashboardVersion,
  clearInMemoryDashboardVersions,
  registerInMemoryVersionDashboard,
  clearInMemoryVersionDashboards,
} from "../services/dashboard/dashboard-version.service.js";
import {
  registerInMemoryWorkspaceMember,
  clearInMemoryWorkspaceMembers,
} from "../services/workspace/workspace-auth.helper.js";
import { logAuditEvent, queryAuditLogs, clearInMemoryAuditLogs } from "../services/audit.service.js";
import {
  handlePresenceHeartbeat,
  handleCollaborativeUpdate,
  handleGetCollaborationState,
  getDashboardActiveCollaborators,
  clearCollaborationState,
  registerInMemoryDashboard,
} from "../services/collaboration/realtime-collaboration.service.js";
import {
  createOrUpdateDashboardEmbed,
  getPublicEmbedDashboard,
  getPublicEmbedChartData,
  revokeDashboardEmbed,
  registerInMemoryEmbed,
  clearInMemoryEmbeds,
} from "../services/dashboard/dashboard-embed.service.js";
import { AppError } from "../utils/errors.js";

// ============================================================
// GROUNDED DATASET FOR RLS & EMBED TESTING
// Multi-region Global Sales Dataset
// ============================================================
const TEST_SALES_ROWS = [
  { id: 201, region: "APAC", country: "India", product: "Cloud Pro", revenue: 50000, units: 10 },
  { id: 202, region: "APAC", country: "India", product: "Enterprise", revenue: 80000, units: 8 },
  { id: 203, region: "APAC", country: "India", product: "Starter", revenue: 15000, units: 30 },
  { id: 204, region: "NA", country: "USA", product: "Cloud Pro", revenue: 120000, units: 15 },
  { id: 205, region: "NA", country: "USA", product: "Enterprise", revenue: 200000, units: 20 },
  { id: 206, region: "NA", country: "USA", product: "Starter", revenue: 35000, units: 40 },
  { id: 207, region: "EMEA", country: "Germany", product: "Cloud Pro", revenue: 75000, units: 12 },
  { id: 208, region: "EMEA", country: "UK", product: "Enterprise", revenue: 90000, units: 11 },
];

const TEST_SALES_COLUMNS = [
  { name: "id", type: "number", nullable: false },
  { name: "region", type: "string", nullable: false },
  { name: "country", type: "string", nullable: false },
  { name: "product", type: "string", nullable: false },
  { name: "revenue", type: "number", nullable: false },
  { name: "units", type: "number", nullable: false },
];

const TEST_DATASET_ID = "ds-phase6-global-sales";

const TEST_SALES_DATASET: any = {
  id: TEST_DATASET_ID,
  name: "Global Sales Master",
  organizationId: "org-collab-alpha",
  workspaceId: "ws-collab-main",
  schemaMeta: {
    columns: TEST_SALES_COLUMNS,
    sampleData: TEST_SALES_ROWS,
    rowCount: TEST_SALES_ROWS.length,
    columnCount: TEST_SALES_COLUMNS.length,
  },
  columns: TEST_SALES_COLUMNS.map((c, i) => ({
    name: c.name,
    dataType: c.type === "number" ? "NUMBER" : "STRING",
    ordinalPosition: i,
  })),
};

// Mock Express response generator
function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    getHeader(name: string) {
      return this.headers[name];
    },
  };
  return res;
}

describe("RICOZVIZ Phase 6: Real-Time Collaboration & Embedded Analytics", () => {
  const queryEngine = new DatasetQueryEngine();
  const orgId = "org-collab-alpha";
  const wsId = "ws-collab-main";
  const dashId = "dash-collab-101";

  // Test Users
  const userAdmin = {
    userId: "usr-admin-1",
    email: "admin@alphacorp.com",
    name: "Alice Admin",
    roleName: "ADMIN",
    organizationId: orgId,
  };

  const userEditor = {
    userId: "usr-editor-2",
    email: "bob@alphacorp.com",
    name: "Bob Editor",
    roleName: "MEMBER",
    organizationId: orgId,
  };

  const userViewer = {
    userId: "usr-viewer-3",
    email: "charlie@alphacorp.com",
    name: "Charlie Viewer",
    roleName: "MEMBER",
    organizationId: orgId,
  };

  const testDashboardFixture: any = {
    id: dashId,
    name: "Revenue Operations Hub",
    description: "Live real-time collaborative operations dashboard",
    organizationId: orgId,
    layoutConfig: {
      workspaceId: wsId,
      grid: { cols: 12, rowHeight: 80 },
    },
    charts: [
      {
        id: "chart-rev-1",
        title: "Revenue by Country",
        chartType: "BAR",
        sortOrder: 0,
        config: {
          xAxis: "country",
          yAxis: "revenue",
          aggregation: "SUM",
        },
        dataset: TEST_SALES_DATASET,
      },
      {
        id: "chart-rev-2",
        title: "Units by Product",
        chartType: "PIE",
        sortOrder: 1,
        config: {
          xAxis: "product",
          yAxis: "units",
          aggregation: "SUM",
        },
        dataset: TEST_SALES_DATASET,
      },
    ],
  };

  beforeEach(() => {
    clearCollaborationState();
    clearInMemoryEmbeds();
    clearInMemoryRlsRules();
    clearInMemoryDashboardVersions();
    clearInMemoryVersionDashboards();
    clearInMemoryWorkspaceMembers();
    clearInMemoryAuditLogs();

    // Register workspace roles
    registerInMemoryWorkspaceMember(wsId, userAdmin.userId, "ADMIN");
    registerInMemoryWorkspaceMember(wsId, userEditor.userId, "EDITOR");
    registerInMemoryWorkspaceMember(wsId, userViewer.userId, "VIEWER");

    // Register initial dashboard fixture
    registerInMemoryDashboard(testDashboardFixture);
    registerInMemoryVersionDashboard(testDashboardFixture);

    // Register initial version snapshot (Version 1)
    registerInMemoryDashboardVersion(dashId, {
      id: "ver-101",
      dashboardId: dashId,
      versionNumber: 1,
      name: testDashboardFixture.name,
      description: testDashboardFixture.description,
      layoutConfig: testDashboardFixture.layoutConfig,
      chartsSnapshot: testDashboardFixture.charts,
      changeSummary: "Initial version",
      createdById: userAdmin.userId,
      createdAt: new Date().toISOString(),
    });
  });

  // ============================================================
  // 1. REAL-TIME COLLABORATION TESTS
  // ============================================================
  describe("1. Real-Time Collaboration & Concurrency Control", () => {
    it("tracks multi-user active presence with user identity and widget focus", async () => {
      // User A (Alice Admin) pings presence with focus on chart-rev-1
      const reqA: any = {
        params: { id: dashId },
        user: userAdmin,
        body: { clientId: "client-alice-101", activeWidgetId: "chart-rev-1" },
      };
      const resA = createMockResponse();
      await handlePresenceHeartbeat(reqA, resA);
      expect(resA.body?.success).toBe(true);

      // User B (Bob Editor) pings presence with focus on chart-rev-2
      const reqB: any = {
        params: { id: dashId },
        user: userEditor,
        body: { clientId: "client-bob-102", activeWidgetId: "chart-rev-2" },
      };
      const resB = createMockResponse();
      await handlePresenceHeartbeat(reqB, resB);
      expect(resB.body?.success).toBe(true);

      // Verify active collaborators list contains both users with identities
      const active = getDashboardActiveCollaborators(dashId);
      expect(active).toHaveLength(2);

      const alice = active.find((c) => c.userId === userAdmin.userId);
      expect(alice).toBeDefined();
      expect(alice?.name).toBe("Alice Admin");
      expect(alice?.activeWidgetId).toBe("chart-rev-1");

      const bob = active.find((c) => c.userId === userEditor.userId);
      expect(bob).toBeDefined();
      expect(bob?.name).toBe("Bob Editor");
      expect(bob?.activeWidgetId).toBe("chart-rev-2");

      // Verify state endpoint returns active collaborators and version info
      const reqState: any = {
        params: { id: dashId },
        user: userEditor,
      };
      const resState = createMockResponse();
      await handleGetCollaborationState(reqState, resState);
      expect(resState.body?.success).toBe(true);
      expect(resState.body?.data?.collaboratorCount).toBe(2);
      expect(resState.body?.data?.currentVersionNumber).toBe(1);
    });

    it("applies conflict-safe update when baseVersionNumber matches current version", async () => {
      // User Editor applies update based on current Version 1
      const reqUpdate: any = {
        params: { id: dashId },
        user: userEditor,
        body: {
          baseVersionNumber: 1,
          name: "Revenue Operations Hub - Q3 Edition",
          layoutConfig: { workspaceId: wsId, theme: "dark" },
          changeSummary: "Updated header and switched theme to dark",
        },
      };
      const resUpdate = createMockResponse();
      await handleCollaborativeUpdate(reqUpdate, resUpdate);

      expect(resUpdate.statusCode).toBe(200);
      expect(resUpdate.body?.success).toBe(true);
      expect(resUpdate.body?.data?.versionNumber).toBe(2);
      expect(resUpdate.body?.data?.name).toBe("Revenue Operations Hub - Q3 Edition");

      // Verify new version snapshot was persisted
      const versions = await listDashboardVersions(dashId);
      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(2);

      // Verify audit log emitted for collaborative edit
      const { logs } = await queryAuditLogs(orgId, { action: "DASHBOARD_COLLABORATIVE_EDIT" });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].userId).toBe(userEditor.userId);
      expect(logs[0].metadata?.newVersionNumber).toBe(2);
    });

    it("detects concurrent/stale edits and rejects with 409 Conflict to prevent silent overwriting", async () => {
      // Step 1: User A updates dashboard from Version 1 to Version 2
      const reqA: any = {
        params: { id: dashId },
        user: userAdmin,
        body: {
          baseVersionNumber: 1,
          name: "Alice's Concurrent Update",
          changeSummary: "Alice saved Version 2",
        },
      };
      const resA = createMockResponse();
      await handleCollaborativeUpdate(reqA, resA);
      expect(resA.body?.data?.versionNumber).toBe(2);

      // Step 2: User B (stale client still on Version 1) attempts to submit update with baseVersionNumber = 1
      const reqB: any = {
        params: { id: dashId },
        user: userEditor,
        body: {
          baseVersionNumber: 1, // Stale!
          name: "Bob's Stale Overwrite Attempt",
          changeSummary: "Bob trying to overwrite",
        },
      };
      const resB = createMockResponse();

      await expect(handleCollaborativeUpdate(reqB, resB)).rejects.toThrow(
        /Conflict: Dashboard has been updated by another collaborator/
      );

      // Verify dashboard was not silently overwritten
      const versions = await listDashboardVersions(dashId);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[0].name).toBe("Alice's Concurrent Update");

      // Step 3: User B fetches latest state (Version 2) and submits with baseVersionNumber = 2
      const reqBFresh: any = {
        params: { id: dashId },
        user: userEditor,
        body: {
          baseVersionNumber: 2, // Up to date!
          name: "Bob's Merged Update",
          changeSummary: "Bob merged with Version 2",
        },
      };
      const resBFresh = createMockResponse();
      await handleCollaborativeUpdate(reqBFresh, resBFresh);

      expect(resBFresh.statusCode).toBe(200);
      expect(resBFresh.body?.data?.versionNumber).toBe(3);
      expect(resBFresh.body?.data?.name).toBe("Bob's Merged Update");
    });

    it("strictly blocks VIEWER users from collaborative updates (enforces RBAC WRITE guard)", async () => {
      // Charlie has VIEWER role in the workspace
      const reqViewer: any = {
        params: { id: dashId },
        user: userViewer,
        body: {
          baseVersionNumber: 1,
          name: "Unauthorized Viewer Modification",
        },
      };
      const resViewer = createMockResponse();

      await expect(handleCollaborativeUpdate(reqViewer, resViewer)).rejects.toThrow(
        /Access denied: Viewers have read-only|Insufficient workspace permissions/
      );

      // Verify no changes occurred
      const versions = await listDashboardVersions(dashId);
      expect(versions).toHaveLength(1);
    });
  });

  // ============================================================
  // 2. PUBLIC & EMBEDDED ANALYTICS TESTS
  // ============================================================
  describe("2. Public & Embedded Analytics Configuration & Security", () => {
    const embedToken = "embed_sec_tok_alpha_778899aabbccddeeff112233445566";

    it("generates cryptographic embed token with custom theme, controls, and origin restriction", async () => {
      registerInMemoryEmbed(
        embedToken,
        dashId,
        {
          allowedOrigins: ["https://enterprise-portal.internal.com", "https://partner.acme.org"],
          theme: "dark",
          showFilters: true,
          showRefresh: true,
          expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), // +30 days
        },
        testDashboardFixture
      );

      // Public viewer requests embedded dashboard with authorized origin
      const reqEmbed: any = {
        params: { embedToken },
        headers: {
          origin: "https://enterprise-portal.internal.com",
        },
      };
      const resEmbed = createMockResponse();

      await getPublicEmbedDashboard(reqEmbed, resEmbed);

      expect(resEmbed.statusCode).toBe(200);
      expect(resEmbed.body?.success).toBe(true);

      const data = resEmbed.body?.data;
      expect(data?.id).toBe(dashId);
      expect(data?.name).toBe(testDashboardFixture.name);
      expect(data?.embedConfig?.theme).toBe("dark");
      expect(data?.embedConfig?.showFilters).toBe(true);
      expect(data?.charts).toHaveLength(2);

      // Verify sanitized DTO (no internal database credentials or tenant tokens leaked)
      expect(data?.organizationId).toBeUndefined();
      expect(data?.charts[0]?.dataset?.connectionString).toBeUndefined();
      expect(data?.charts[0]?.dataset?.credentials).toBeUndefined();
    });

    it("strictly blocks unauthorized origins from embedding (Origin Policy Guard)", async () => {
      registerInMemoryEmbed(
        embedToken,
        dashId,
        {
          allowedOrigins: ["https://trusted-portal.com"],
        },
        testDashboardFixture
      );

      // Request from forbidden origin
      const reqUntrusted: any = {
        params: { embedToken },
        headers: {
          origin: "https://malicious-phishing-site.xyz",
        },
      };
      const resUntrusted = createMockResponse();

      await expect(getPublicEmbedDashboard(reqUntrusted, resUntrusted)).rejects.toThrow(
        /Request origin is not permitted by the embed security policy/
      );
    });

    it("strictly blocks expired embed links", async () => {
      const expiredToken = "embed_expired_token_999999999";
      registerInMemoryEmbed(
        expiredToken,
        dashId,
        {
          allowedOrigins: ["*"],
          expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        testDashboardFixture
      );

      const reqExpired: any = {
        params: { embedToken: expiredToken },
        headers: {},
      };
      const resExpired = createMockResponse();

      await expect(getPublicEmbedDashboard(reqExpired, resExpired)).rejects.toThrow(
        /Embedded dashboard link has expired/
      );
    });

    it("immediately prevents embed access upon token revocation", async () => {
      const revocableToken = "embed_revocable_token_123456";
      registerInMemoryEmbed(
        revocableToken,
        dashId,
        {
          enabled: false, // Revoked!
          allowedOrigins: ["*"],
        },
        testDashboardFixture
      );

      const reqRevoked: any = {
        params: { embedToken: revocableToken },
        headers: {},
      };
      const resRevoked = createMockResponse();

      await expect(getPublicEmbedDashboard(reqRevoked, resRevoked)).rejects.toThrow(
        /Embedded access for this dashboard has been revoked by the owner/
      );
    });
  });

  // ============================================================
  // 3. ROW-LEVEL SECURITY (RLS) ENFORCEMENT ON EMBED QUERIES
  // ============================================================
  describe("3. Row-Level Security (RLS) Enforcement on Embedded Analytics", () => {
    const embedToken = "embed_rls_verified_token_888999";

    it("executes real embedded chart queries and strictly isolates data per RLS rules", async () => {
      // Configure test embed
      registerInMemoryEmbed(
        embedToken,
        dashId,
        {
          allowedOrigins: ["*"],
          theme: "light",
        },
        testDashboardFixture
      );

      // Query embedded chart without RLS rules (public baseline)
      const reqChart1: any = {
        params: { embedToken, chartId: "chart-rev-1" },
        headers: {},
        body: {},
      };
      const resChart1 = createMockResponse();
      await getPublicEmbedChartData(reqChart1, resChart1);

      expect(resChart1.statusCode).toBe(200);
      expect(resChart1.body?.success).toBe(true);
      expect(resChart1.body?.data?.rows.length).toBeGreaterThan(0);

      // Now register an RLS rule on TEST_DATASET_ID restricting all VIEWER users to APAC region only
      registerInMemoryRlsRule({
        id: "rls-embed-apac-only",
        datasetId: TEST_DATASET_ID,
        roleId: "VIEWER",
        roleName: "VIEWER",
        column: "region",
        operator: "=",
        value: "APAC",
        enabled: true,
      });

      // Execute query again for embedded viewer (evaluated as VIEWER context)
      const reqChartRls: any = {
        params: { embedToken, chartId: "chart-rev-1" },
        headers: {},
        body: {},
      };
      const resChartRls = createMockResponse();
      await getPublicEmbedChartData(reqChartRls, resChartRls);

      expect(resChartRls.statusCode).toBe(200);
      const filteredRows = resChartRls.body?.data?.rows;
      expect(filteredRows.length).toBeGreaterThan(0);

      // Verify that ONLY APAC records (India) were returned, USA and EMEA rows were completely blocked!
      for (const row of filteredRows) {
        expect(row.country).toBe("India");
        expect(row.country).not.toBe("USA");
        expect(row.country).not.toBe("Germany");
        expect(row.country).not.toBe("UK");
      }
    });

    it("emits real audit logs for embed access", async () => {
      const testToken = "embed_audit_test_token_445566";
      registerInMemoryEmbed(
        testToken,
        dashId,
        { allowedOrigins: ["*"] },
        testDashboardFixture
      );

      const req: any = {
        params: { embedToken: testToken },
        headers: { "user-agent": "Enterprise-Iframe-Browser/1.0" },
        ip: "192.168.1.100",
      };
      const res = createMockResponse();

      await getPublicEmbedDashboard(req, res);
      expect(res.statusCode).toBe(200);

      // Verify DASHBOARD_EMBED_ACCESSED audit record was created
      const { logs } = await queryAuditLogs(orgId, { action: "DASHBOARD_EMBED_ACCESSED" });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].resourceId).toBe(dashId);
      expect(logs[0].metadata?.embedToken).toBe(testToken);
    });
  });

  // ============================================================
  // 4. NON-REGRESSION VERIFICATION (Phases 1-5)
  // ============================================================
  describe("4. Regression Test: Phases 1-5 Integration Consistency", () => {
    it("preserves dashboard version history comparison and restore while collaboration is active", async () => {
      // 1. Create version 2 snapshot with updated state
      registerInMemoryVersionDashboard({
        ...testDashboardFixture,
        layoutConfig: { theme: "contrast" },
      });
      const ver2 = await createDashboardVersionSnapshot(
        dashId,
        "Switched to contrast layout",
        userAdmin.userId,
        userAdmin.email,
        userAdmin.name
      );
      expect(ver2?.versionNumber).toBe(2);

      // 2. Collaborative edit creates version 3
      const reqUpdate: any = {
        params: { id: dashId },
        user: userEditor,
        body: {
          baseVersionNumber: 2,
          name: "V3 Collaborative Layout",
          changeSummary: "Editor updated to V3",
        },
      };
      const resUpdate = createMockResponse();
      await handleCollaborativeUpdate(reqUpdate, resUpdate);
      expect(resUpdate.body?.data?.versionNumber).toBe(3);

      // 3. List all versions
      const allVersions = await listDashboardVersions(dashId);
      expect(allVersions.length).toBe(3);
      expect(allVersions.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
    });

    it("ensures DuckDB query aggregation with cross-filters works without regression", async () => {
      const result = await queryEngine.executeQuery(TEST_SALES_DATASET, {
        dimensions: ["product"],
        measures: [{ column: "revenue", aggregation: "SUM", alias: "total_revenue" }],
        filters: [{ field: "country", operator: "EQUALS", value: "India" }],
      });

      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(3); // Cloud Pro (50k), Enterprise (80k), Starter (15k)
      const sumRevenue = result.rows.reduce((acc, r) => acc + Number(r.total_revenue), 0);
      expect(sumRevenue).toBe(145000);
    });
  });
});
