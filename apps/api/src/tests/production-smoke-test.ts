/**
 * Comprehensive Production Smoke Test for RicozViz
 * Hits the live deployed Render environment: https://ricozviz-api.onrender.com
 */

const API_BASE = (process.env.API_URL || "https://ricozviz-api.onrender.com/api/v1").trim();

interface TestContext {
  token: string;
  workspaceId: string;
  datasetId: string;
  chartId: string;
  dashboardId: string;
  shareToken: string;
}

async function runProductionSmokeTest() {
  console.log("==================================================");
  console.log("🚀 STARTING PRODUCTION SMOKE TEST ON RENDER");
  console.log(`Target: ${API_BASE}`);
  console.log("==================================================\n");

  const runId = Date.now().toString().slice(-6);
  const email = `prodtest_${runId}@ricozviz.test`;
  const password = "ProductionSecurePassword123!";
  const name = `Prod Tester ${runId}`;

  const ctx: Partial<TestContext> = {};

  // Step 1: Health Check
  console.log("1. Checking Live Health Endpoint...");
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthJson = await healthRes.json();
  if (healthRes.status !== 200 || !healthJson.success) {
    throw new Error(`Health check failed: ${JSON.stringify(healthJson)}`);
  }
  console.log(`   ✅ API Health OK: uptime=${healthJson.data?.uptime}s, version=${healthJson.data?.version}`);

  // Step 2: Register New User
  console.log(`2. Registering Fresh User: ${email}...`);
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, organizationName: `Prod Org ${runId}` }),
  });
  const regJson = await regRes.json();
  if (regRes.status !== 201 || !regJson.success) {
    throw new Error(`Registration failed (${regRes.status}): ${JSON.stringify(regJson)}`);
  }
  ctx.token = regJson.data.accessToken || regJson.data.tokens?.accessToken;
  const user = regJson.data.user;
  console.log(`   ✅ Registered successfully: User ID=${user.id}, Org=${user.organizationId}`);

  // Step 3: Verify Duplicate Registration Rejection (Security check)
  console.log("3. Verifying Duplicate Registration Prevention (409 Conflict)...");
  const dupRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, organizationName: `Prod Org ${runId}` }),
  });
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 for duplicate registration, got ${dupRes.status}`);
  }
  console.log("   ✅ Duplicate registration properly rejected with 409 Conflict");

  // Step 4: Login with New Credentials
  console.log("4. Logging in with credentials...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  if (loginRes.status !== 200 || !loginJson.success) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginJson)}`);
  }
  ctx.token = loginJson.data.accessToken || loginJson.data.tokens?.accessToken;
  console.log("   ✅ Login successful, JWT access token retrieved");

  // Step 5: Check Current User Profile & Permissions
  console.log("5. Fetching /auth/me profile & workspace membership...");
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  const meJson = await meRes.json();
  if (meRes.status !== 200) {
    throw new Error(`/auth/me failed: ${JSON.stringify(meJson)}`);
  }
  const perms = meJson.data.permissions || [];
  console.log(`   ✅ Profile verified: ${perms.length} system permissions granted`);

  // Step 6: Workspace Retrieval
  console.log("6. Verifying Workspace Creation...");
  const wsRes = await fetch(`${API_BASE}/workspaces`, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  });
  const wsJson = await wsRes.json();
  if (wsRes.status !== 200 || !wsJson.data || wsJson.data.length === 0) {
    throw new Error(`No workspace found: ${JSON.stringify(wsJson)}`);
  }
  ctx.workspaceId = wsJson.data[0].id;
  console.log(`   ✅ Default Workspace loaded: ID=${ctx.workspaceId}, Name="${wsJson.data[0].name}"`);

  // Step 7: Import Demo Dataset
  console.log("7. Importing Demo Dataset (Cereals 80)...");
  const importRes = await fetch(`${API_BASE}/datasets/demo/cereals-80/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
  });
  const importJson = await importRes.json();
  if (!importRes.ok || !importJson.success) {
    throw new Error(`Dataset import failed: ${JSON.stringify(importJson)}`);
  }
  ctx.datasetId = importJson.data.id;
  console.log(`   ✅ Demo dataset imported: ID=${ctx.datasetId}, Name="${importJson.data.name}", Rows=${importJson.data.rowCount || importJson.data.metadata?.rowCount}`);

  // Step 8: Dataset Preview
  console.log("8. Fetching Dataset Preview...");
  const prevRes = await fetch(`${API_BASE}/datasets/${ctx.datasetId}/preview`, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
    },
  });
  const prevJson = await prevRes.json();
  if (prevRes.status !== 200 || !prevJson.data) {
    throw new Error(`Dataset preview failed: ${JSON.stringify(prevJson)}`);
  }
  const previewRows = Array.isArray(prevJson.data) ? prevJson.data : prevJson.data.rows || [];
  console.log(`   ✅ Dataset preview verified: ${previewRows.length} sample rows returned`);

  // Step 9: Query Engine Aggregation
  console.log("9. Executing Real Query Engine Query (AGGREGATE mode)...");
  const queryRes = await fetch(`${API_BASE}/datasets/${ctx.datasetId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      groupBy: ["mfr"],
      aggregations: [
        { column: "calories", function: "AVG", alias: "avg_calories" },
        { column: "rating", function: "AVG", alias: "avg_rating" },
      ],
      orderBy: { column: "avg_calories", direction: "desc" },
      limit: 10,
    }),
  });
  const queryJson = await queryRes.json();
  if (queryRes.status !== 200 || !queryJson.success) {
    throw new Error(`Query failed: ${JSON.stringify(queryJson)}`);
  }
  const queryRows = queryJson.data.rows || [];
  console.log(`   ✅ Real query returned ${queryRows.length} aggregated groups:`);
  console.log(`      First group: ${JSON.stringify(queryRows[0])}`);

  // Step 10: Create Visualization
  console.log("10. Creating Saved Visualization...");
  const vizRes = await fetch(`${API_BASE}/visualizations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Cereal Calories by Manufacturer",
      description: "Average calories per cereal maker",
      chartType: "BAR",
      datasetId: ctx.datasetId,
      workspaceId: ctx.workspaceId,
      config: {
        dimensions: ["mfr"],
        measures: [{ column: "calories", aggregation: "AVG" }],
      },
    }),
  });
  const vizJson = await vizRes.json();
  if (vizRes.status !== 201 || !vizJson.success) {
    throw new Error(`Visualization creation failed: ${JSON.stringify(vizJson)}`);
  }
  const vizId = vizJson.data.id;
  console.log(`   ✅ Saved Visualization created: ID=${vizId}`);

  // Step 11: Create Dashboard
  console.log("11. Creating Dashboard...");
  const dashRes = await fetch(`${API_BASE}/dashboards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Executive Nutrition Overview ${runId}`,
      description: "Live aggregated dashboard for nutrition analysis",
      workspaceId: ctx.workspaceId,
    }),
  });
  const dashJson = await dashRes.json();
  if (dashRes.status !== 201 || !dashJson.success) {
    throw new Error(`Dashboard creation failed: ${JSON.stringify(dashJson)}`);
  }
  ctx.dashboardId = dashJson.data.id;
  console.log(`   ✅ Dashboard created: ID=${ctx.dashboardId}, Title="${dashJson.data.name}"`);

  // Step 12: Add Chart to Dashboard
  console.log("12. Adding Chart to Dashboard...");
  const chartRes = await fetch(`${API_BASE}/dashboards/${ctx.dashboardId}/charts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Avg Calories by Brand",
      chartType: "BAR",
      datasetId: ctx.datasetId,
      queryConfig: {
        dimensions: ["mfr"],
        measures: [{ field: "calories", aggregation: "AVG" }],
      },
      position: { x: 0, y: 0, w: 6, h: 4 },
    }),
  });
  const chartJson = await chartRes.json();
  if (chartRes.status !== 201 || !chartJson.success) {
    throw new Error(`Chart addition failed: ${JSON.stringify(chartJson)}`);
  }
  ctx.chartId = chartJson.data.id;
  console.log(`   ✅ Chart added to Dashboard: ID=${ctx.chartId}`);

  // Step 13: Update Dashboard Layout
  console.log("13. Updating Dashboard Layout...");
  const layoutRes = await fetch(`${API_BASE}/dashboards/${ctx.dashboardId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      layoutConfig: {
        layout: [
          {
            id: ctx.chartId,
            x: 0,
            y: 0,
            w: 8,
            h: 5,
          },
        ],
      },
    }),
  });
  const layoutJson = await layoutRes.json();
  if (layoutRes.status !== 200 || !layoutJson.success) {
    throw new Error(`Layout update failed: ${JSON.stringify(layoutJson)}`);
  }
  console.log("   ✅ Dashboard Layout saved and persisted");

  // Step 14: Enable Public Sharing Link
  console.log("14. Generating Public Share Link...");
  const shareRes = await fetch(`${API_BASE}/dashboards/${ctx.dashboardId}/share`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
      "Content-Type": "application/json",
    },
  });
  const shareJson = await shareRes.json();
  if (shareRes.status !== 200 || !shareJson.success) {
    throw new Error(`Share link generation failed: ${JSON.stringify(shareJson)}`);
  }
  ctx.shareToken = shareJson.data.shareToken;
  console.log(`   ✅ Public Share Link created: Token=${ctx.shareToken}`);

  // Step 15: Access Shared Dashboard without Authentication (Public)
  console.log("15. Accessing Public Shared Dashboard (Unauthenticated)...");
  const pubRes = await fetch(`${API_BASE}/dashboards/shared/${ctx.shareToken}`);
  const pubJson = await pubRes.json();
  if (pubRes.status !== 200 || !pubJson.success) {
    throw new Error(`Public dashboard fetch failed: ${JSON.stringify(pubJson)}`);
  }
  console.log(`   ✅ Public Dashboard loaded successfully: Title="${pubJson.data.name}", Charts=${pubJson.data.charts?.length}`);

  // Step 16: Query Chart Data through Public Endpoint
  console.log("16. Querying Public Chart Data through Share Token...");
  const pubDataRes = await fetch(
    `${API_BASE}/dashboards/shared/${ctx.shareToken}/charts/${ctx.chartId}/data`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: [] }),
    }
  );
  const pubDataJson = await pubDataRes.json();
  if (pubDataRes.status !== 200 || !pubDataJson.success) {
    throw new Error(`Public chart data query failed: ${JSON.stringify(pubDataJson)}`);
  }
  console.log(`   ✅ Public chart query executed with real rows: count=${pubDataJson.data.rows?.length}`);

  // Step 17: Revoke Share Link
  console.log("17. Revoking Public Share Link...");
  const revokeRes = await fetch(`${API_BASE}/dashboards/${ctx.dashboardId}/share`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": ctx.workspaceId,
    },
  });
  if (revokeRes.status !== 200) {
    throw new Error(`Share revoke failed: ${revokeRes.status}`);
  }
  const testRevoked = await fetch(`${API_BASE}/dashboards/shared/${ctx.shareToken}`);
  if (testRevoked.status !== 404) {
    throw new Error(`Expected 404 after revoking share link, got ${testRevoked.status}`);
  }
  console.log("   ✅ Share link revoked successfully (subsequent access yields 404)");

  // Step 18: Tenant Isolation / Cross-Workspace Security Check
  console.log("18. Testing Cross-Workspace Tenant Isolation Security Check...");
  const foreignWorkspaceId = "00000000-0000-0000-0000-000000000000";
  const crossWsRes = await fetch(`${API_BASE}/datasets`, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "x-workspace-id": foreignWorkspaceId,
    },
  });
  if (crossWsRes.status !== 403 && crossWsRes.status !== 404) {
    throw new Error(`Expected 403 or 404 for unauthorized workspace, got ${crossWsRes.status}`);
  }
  console.log(`   ✅ Unauthorized foreign workspace access rejected with HTTP ${crossWsRes.status}`);

  console.log("\n==================================================");
  console.log("🎉 ALL 18 PRODUCTION SMOKE TEST CHECKS PASSED!");
  console.log("==================================================");
}

runProductionSmokeTest().catch((err) => {
  console.error("\n❌ PRODUCTION SMOKE TEST FAILED:", err);
  process.exit(1);
});
