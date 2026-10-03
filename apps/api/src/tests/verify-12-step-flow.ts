// ============================================================
// RicozViz Complete 12-Step Runtime Verification Script
// Tests the full end-to-end user flow with real database & APIs
// ============================================================

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BASE_URL = process.env.API_URL || "http://localhost:4000/api/v1";

interface TestContext {
  token: string;
  userId: string;
  orgId: string;
  workspaceId: string;
  datasetId: string;
  vizId1: string;
  vizId2: string;
  dashboardId: string;
  chartId1: string;
  chartId2: string;
}

const ctx: Partial<TestContext> = {};

function logStep(step: number, title: string, details?: unknown) {
  console.log(`\n==================================================`);
  console.log(`STEP ${step}: ${title.toUpperCase()}`);
  console.log(`==================================================`);
  if (details) {
    console.log(typeof details === "string" ? details : JSON.stringify(details, null, 2));
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (ctx.token) {
    headers["Authorization"] = `Bearer ${ctx.token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  let body: any = null;
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${endpoint}: ${JSON.stringify(body)}`);
  }

  return body?.data !== undefined ? body.data : body;
}

async function runVerification() {
  console.log("Starting RicozViz 12-Step Runtime Verification against:", BASE_URL);

  // ----------------------------------------------------
  // STEP 1: Login / Authenticate User
  // ----------------------------------------------------
  const randomSuffix = Math.floor(Math.random() * 100000);
  const email = `sprint_tester_${randomSuffix}@ricozviz.test`;
  const password = "Password123!";

  // Register fresh user for clean isolated run
  const regRes = await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: `Sprint Tester ${randomSuffix}`,
      organizationName: `Sprint Org ${randomSuffix}`,
    }),
  });

  // Verify login endpoint works as specified
  const loginRes = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  ctx.token = loginRes.accessToken;
  ctx.userId = loginRes.user.id;
  ctx.orgId = loginRes.user.organizationId;
  logStep(1, "Login Successful", {
    userId: ctx.userId,
    orgId: ctx.orgId,
    email: loginRes.user.email,
  });

  // ----------------------------------------------------
  // STEP 2: Open Workspace
  // ----------------------------------------------------
  const workspaces = await request("/workspaces");
  if (!workspaces || workspaces.length === 0) {
    // Create one if needed
    const ws = await request("/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Primary Analytics Workspace" }),
    });
    ctx.workspaceId = ws.id;
  } else {
    ctx.workspaceId = workspaces[0].id;
  }
  logStep(2, "Open Workspace", { workspaceId: ctx.workspaceId });

  // ----------------------------------------------------
  // STEP 3: Open / Ingest Dataset
  // ----------------------------------------------------
  // Upload real tabular dataset via multipart/form-data
  const csvContent =
    "region,product,sales,profit\n" +
    "North,Electronics,4500,900\n" +
    "South,Apparel,2300,500\n" +
    "East,Electronics,6100,1250\n" +
    "West,Furniture,3200,640\n" +
    "Central,Apparel,1800,380\n" +
    "North,Furniture,2900,580\n" +
    "East,Apparel,3100,620";

  const boundary = "----RicozVizBoundary" + Math.random().toString(36).substring(2);
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="sales_data.csv"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${csvContent}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="name"\r\n\r\n` +
    `Regional Sales & Profit Dataset\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="workspaceId"\r\n\r\n` +
    `${ctx.workspaceId}\r\n` +
    `--${boundary}--\r\n`;

  const uploadedDataset = await request("/datasets/upload", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  ctx.datasetId = uploadedDataset.id;
  logStep(3, "Dataset Ingested & Opened", {
    datasetId: ctx.datasetId,
    name: uploadedDataset.name,
    rowCount: uploadedDataset.rowCount,
    columnCount: uploadedDataset.columnCount,
    columns: uploadedDataset.columns?.map((c: any) => `${c.name} (${c.type})`),
  });

  // ----------------------------------------------------
  // STEP 4: Preview Dataset
  // ----------------------------------------------------
  const preview = await request(`/datasets/${ctx.datasetId}/preview?limit=5`);
  logStep(4, "Preview Dataset", {
    rowCount: preview.rowCount,
    columns: preview.columns.map((c: any) => c.name),
    sampleRow: preview.rows[0],
  });

  // ----------------------------------------------------
  // STEP 5: Generate Chart from Real Data (Query Engine)
  // ----------------------------------------------------
  // Test server-side dataset query engine with grouping and aggregation
  const queryResult1 = await request(`/datasets/${ctx.datasetId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupBy: ["region"],
      aggregations: [{ column: "sales", function: "SUM", alias: "total_sales" }],
      orderBy: { column: "total_sales", direction: "desc" },
      limit: 10,
    }),
  });

  logStep(5, "Generate Chart from Real Data (Query Executed)", {
    queryMode: queryResult1.metadata?.queryMode,
    executionTimeMs: queryResult1.metadata?.executionTimeMs,
    rows: queryResult1.rows,
  });

  // ----------------------------------------------------
  // STEP 6: Save Visualization 1 & 2
  // ----------------------------------------------------
  const viz1 = await request("/visualizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Regional Sales Breakdown",
      description: "Aggregated sales by geographic region",
      chartType: "BAR",
      datasetId: ctx.datasetId,
      config: {
        category: "region",
        value: "sales",
        aggregation: "SUM",
        dimensions: ["region"],
        measures: [{ column: "sales", aggregation: "SUM", alias: "total_sales" }],
      },
      position: { x: 0, y: 0, w: 6, h: 4 },
    }),
  });
  ctx.vizId1 = viz1.id;

  const viz2 = await request("/visualizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Product Profit Share",
      description: "Profit distributed across product categories",
      chartType: "PIE",
      datasetId: ctx.datasetId,
      config: {
        category: "product",
        value: "profit",
        aggregation: "SUM",
        dimensions: ["product"],
        measures: [{ column: "profit", aggregation: "SUM", alias: "total_profit" }],
      },
      position: { x: 6, y: 0, w: 6, h: 4 },
    }),
  });
  ctx.vizId2 = viz2.id;

  logStep(6, "Saved Real Visualizations", {
    viz1: { id: ctx.vizId1, title: viz1.title, type: viz1.chartType },
    viz2: { id: ctx.vizId2, title: viz2.title, type: viz2.chartType },
  });

  // ----------------------------------------------------
  // STEP 7: Open Dashboard Page
  // ----------------------------------------------------
  const existingDashboards = await request("/dashboards");
  logStep(7, "Opened Dashboard Page (List Dashboards)", {
    existingCount: existingDashboards.dashboards?.length || 0,
  });

  // ----------------------------------------------------
  // STEP 8: Create Dashboard
  // ----------------------------------------------------
  const createdDash = await request("/dashboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Q4 Executive Revenue & Profit Overview",
      description: "High-level performance monitoring dashboard",
      status: "DRAFT",
      visibility: "ORGANIZATION",
    }),
  });
  ctx.dashboardId = createdDash.id;
  logStep(8, "Created Dashboard", {
    dashboardId: ctx.dashboardId,
    name: createdDash.name,
    status: createdDash.status,
  });

  // ----------------------------------------------------
  // STEP 9: Add Saved Chart 1 to Dashboard
  // ----------------------------------------------------
  const chart1 = await request(`/dashboards/${ctx.dashboardId}/charts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: viz1.title,
      description: viz1.description,
      chartType: viz1.chartType,
      datasetId: viz1.datasetId,
      config: viz1.config,
      position: { x: 0, y: 0, w: 6, h: 4 },
      sortOrder: 0,
    }),
  });
  ctx.chartId1 = chart1.id;

  // Execute data query for chart 1
  const chart1Data = await request(`/datasets/${chart1.datasetId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupBy: chart1.config.dimensions,
      aggregations: chart1.config.measures?.map((m: any) => ({
        column: m.column,
        function: m.aggregation,
        alias: m.alias || m.column,
      })),
      limit: 100,
    }),
  });

  logStep(9, "Added Saved Chart 1 to Dashboard & Verified Data", {
    chartId: ctx.chartId1,
    title: chart1.title,
    position: chart1.position,
    renderedRowsCount: chart1Data.rowCount,
    sampleRenderedRow: chart1Data.rows[0],
  });

  // ----------------------------------------------------
  // STEP 10: Add Second Chart to Dashboard
  // ----------------------------------------------------
  const chart2 = await request(`/dashboards/${ctx.dashboardId}/charts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: viz2.title,
      description: viz2.description,
      chartType: viz2.chartType,
      datasetId: viz2.datasetId,
      config: viz2.config,
      position: { x: 6, y: 0, w: 6, h: 4 },
      sortOrder: 1,
    }),
  });
  ctx.chartId2 = chart2.id;

  // Execute data query for chart 2
  const chart2Data = await request(`/datasets/${chart2.datasetId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupBy: chart2.config.dimensions,
      aggregations: chart2.config.measures?.map((m: any) => ({
        column: m.column,
        function: m.aggregation,
        alias: m.alias || m.column,
      })),
      limit: 100,
    }),
  });

  logStep(10, "Added Second Chart to Dashboard & Verified Data", {
    chartId: ctx.chartId2,
    title: chart2.title,
    position: chart2.position,
    renderedRowsCount: chart2Data.rowCount,
    sampleRenderedRow: chart2Data.rows[0],
  });

  // ----------------------------------------------------
  // STEP 11: Save Dashboard Layout & Configuration
  // ----------------------------------------------------
  const updatedDash = await request(`/dashboards/${ctx.dashboardId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layoutConfig: {
        chartCount: 2,
        chartOrder: [ctx.chartId1, ctx.chartId2],
        gridColumns: 12,
        lastSavedAt: new Date().toISOString(),
      },
    }),
  });

  // Update chart 1 to full width (12 columns)
  const updatedChart1 = await request(`/dashboards/${ctx.dashboardId}/charts/${ctx.chartId1}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position: { x: 0, y: 0, w: 12, h: 6 },
    }),
  });

  logStep(11, "Saved Dashboard Layout Configuration & Resized Chart", {
    layoutConfig: updatedDash.layoutConfig,
    chart1UpdatedPosition: updatedChart1.position,
  });

  // ----------------------------------------------------
  // STEP 12: Reload Dashboard from Real Database
  // ----------------------------------------------------
  const reloadedDash = await request(`/dashboards/${ctx.dashboardId}`);
  const reloadedCharts = await request(`/dashboards/${ctx.dashboardId}/charts`);

  logStep(12, "Reload Dashboard from Real Database Records", {
    dashboardName: reloadedDash.name,
    chartCount: reloadedCharts.length,
    charts: reloadedCharts.map((c: any) => ({
      id: c.id,
      title: c.title,
      type: c.chartType,
      position: c.position,
      hasDataset: !!c.datasetId,
    })),
  });

  // ----------------------------------------------------
  // STEP 13: Create Dashboard Share Link
  // ----------------------------------------------------
  const shareRes = await request(`/dashboards/${ctx.dashboardId}/share`, {
    method: "POST",
  });
  const shareToken = shareRes.shareToken || shareRes.token;

  logStep(13, "Created Dashboard Share Link", {
    shareToken,
    active: shareRes.shareTokenActive ?? shareRes.active,
    shareUrl: shareRes.shareUrl,
  });

  // ----------------------------------------------------
  // STEP 14: Public Read-Only Shared Dashboard Access
  // ----------------------------------------------------
  // Use raw fetch without Authorization header to verify public unauthenticated access
  const publicDashRes = await fetch(`${BASE_URL}/dashboards/shared/${shareToken}`);
  const publicDashBody = await publicDashRes.json();
  if (!publicDashRes.ok || !publicDashBody.success) {
    throw new Error(`Failed to access shared dashboard: ${JSON.stringify(publicDashBody)}`);
  }
  const sharedData = publicDashBody.data;

  logStep(14, "Accessed Shared Dashboard Publicly (No Auth)", {
    dashboardName: sharedData.name,
    chartCount: sharedData.charts?.length,
    isOwnerExposed: sharedData.ownerId !== undefined,
    isOrgExposed: sharedData.organizationId !== undefined,
    charts: sharedData.charts?.map((c: any) => ({ id: c.id, title: c.title, type: c.chartType })),
  });

  // ----------------------------------------------------
  // STEP 15: Public Chart Query with Dashboard Filter
  // ----------------------------------------------------
  const sharedChart1 = sharedData.charts[0];
  const publicChartQueryRes = await fetch(
    `${BASE_URL}/dashboards/shared/${shareToken}/charts/${sharedChart1.id}/data`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: [
          {
            field: sharedChart1.config?.dimensions?.[0] || "Region",
            operator: "=",
            value: "North",
          },
        ],
      }),
    }
  );
  const publicChartQueryBody = await publicChartQueryRes.json();
  if (!publicChartQueryRes.ok || !publicChartQueryBody.success) {
    throw new Error(`Failed to query shared chart data: ${JSON.stringify(publicChartQueryBody)}`);
  }

  logStep(15, "Executed Filtered Query on Shared Chart via Public Endpoint", {
    chartId: sharedChart1.id,
    appliedFilter: { field: sharedChart1.config?.dimensions?.[0] || "Region", operator: "=", value: "North" },
    returnedRows: publicChartQueryBody.data?.rowCount ?? publicChartQueryBody.data?.rows?.length,
    sampleRow: publicChartQueryBody.data?.rows?.[0],
  });

  // ----------------------------------------------------
  // STEP 16: Disable Share Link
  // ----------------------------------------------------
  const disableRes = await request(`/dashboards/${ctx.dashboardId}/share`, {
    method: "DELETE",
  });

  logStep(16, "Disabled Share Link", {
    active: disableRes.shareTokenActive ?? disableRes.active,
    message: disableRes.message,
  });

  // ----------------------------------------------------
  // STEP 17: Confirm Disabled Share Link Is Revoked
  // ----------------------------------------------------
  const revokedRes = await fetch(`${BASE_URL}/dashboards/shared/${shareToken}`);
  const revokedBody = await revokedRes.json();

  if (revokedRes.status !== 404) {
    throw new Error(`Expected HTTP 404 for disabled share link, received ${revokedRes.status}`);
  }

  logStep(17, "Verified Disabled Share Link Is Inaccessible", {
    httpStatus: revokedRes.status,
    response: revokedBody,
  });

  console.log("\n==================================================");
  console.log("✅ COMPLETE END-TO-END FLOW VERIFICATION SUCCEEDED!");
  console.log("All 17 steps (including sharing, public querying, and filter execution) passed against real PostgreSQL.");
  console.log("==================================================\n");
}

runVerification().catch((err) => {
  console.error("\n❌ VERIFICATION FAILED:", err);
  process.exit(1);
});
