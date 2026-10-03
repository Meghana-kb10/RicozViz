// ========================================
// Live Runtime Verification: Calculated Fields End-to-End Flow (Phase 14)
// ========================================
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const app = createApp();
const request = supertest(app);

async function run() {
  console.log("🚀 Starting Full 85% → 90% Calculated Fields Runtime Verification...\n");

  const runId = Date.now();
  const testEmail = `calcfield_${runId}@ricozviz.test`;
  const testPassword = "Password123!Secure";
  const orgName = `Calculated Fields Org ${runId}`;

  // STEP 1: REGISTER & LOGIN
  console.log("1. Registering test user & creating workspace...");
  const regRes = await request.post("/api/v1/auth/register").send({
    email: testEmail,
    password: testPassword,
    name: "Calc Field Tester",
    organizationName: orgName,
  });

  if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }
  const token = regRes.body.data.accessToken;
  const user = regRes.body.data.user;
  console.log(`   ✓ Registered user ${user.email} (Org: ${user.organizationId})`);

  // STEP 2: CREATE WORKSPACE
  const wsRes = await request
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Analytics Workspace" });
  if (wsRes.status !== 201) {
    throw new Error(`Failed to create workspace: ${JSON.stringify(wsRes.body)}`);
  }
  const workspaceId = wsRes.body.data.id;
  console.log(`   ✓ Workspace created: ${workspaceId}`);

  // STEP 3: CREATE DATASET
  console.log("\n2. Ingesting Sales Dataset...");
  const salesCsv = [
    "region,customer_name,revenue,cost,quantity",
    "North,Acme Inc,10000,7000,50",
    "South,Beta Corp,15000,9000,75",
    "East,Gamma LLC,8000,4000,40",
    "West,Delta Co,20000,12000,100",
  ].join("\n");

  const dsRes = await request
    .post("/api/v1/datasets/upload")
    .set("Authorization", `Bearer ${token}`)
    .field("name", "Sales Q3")
    .field("workspaceId", workspaceId)
    .attach("file", Buffer.from(salesCsv, "utf-8"), "sales.csv");

  if (dsRes.status !== 201) {
    throw new Error(`Dataset creation failed (${dsRes.status}): ${JSON.stringify(dsRes.body)}`);
  }
  const dataset = dsRes.body.data;
  console.log(`   ✓ Dataset created: "${dataset.name}" (ID: ${dataset.id}, Rows: ${dataset.rowCount})`);

  // STEP 4 & 5: PREVIEW CALCULATED FIELD (profit = revenue - cost)
  console.log("\n3. Previewing calculated field: profit = revenue - cost...");
  const previewRes = await request
    .post(`/api/v1/datasets/${dataset.id}/calculated-fields/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "profit",
      expression: "revenue - cost",
    });

  if (previewRes.status !== 200) {
    throw new Error(`Preview failed (${previewRes.status}): ${JSON.stringify(previewRes.body)}`);
  }
  const previewData = previewRes.body.data;
  console.log(`   ✓ Inferred data type: ${previewData.dataType}`);
  console.log(`   ✓ Referenced columns: ${previewData.referencedColumns.join(", ")}`);
  console.log(`   ✓ Preview row count: ${previewData.rows.length}`);
  const sampleProfits = previewData.rows.map((r: any) => r.profit);
  console.log(`   ✓ Sample calculated profits: [${sampleProfits.join(", ")}]`);
  if (sampleProfits[0] !== 3000 || sampleProfits[1] !== 6000) {
    throw new Error(`Unexpected calculated profit values: ${JSON.stringify(sampleProfits)}`);
  }

  // STEP 6: SAVE CALCULATED FIELD (profit)
  console.log("\n4. Saving calculated field: profit...");
  const createRes = await request
    .post(`/api/v1/datasets/${dataset.id}/calculated-fields`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "profit",
      expression: "revenue - cost",
    });

  if (createRes.status !== 201) {
    throw new Error(`Create calculated field failed (${createRes.status}): ${JSON.stringify(createRes.body)}`);
  }
  const savedField = createRes.body.data.field;
  console.log(`   ✓ Calculated field created with ID: ${savedField.id}`);

  // Also save a second string-based calculated field: upper_region = UPPER(region)
  console.log("\n5. Saving second calculated field: upper_region = UPPER(region)...");
  const createUpperRes = await request
    .post(`/api/v1/datasets/${dataset.id}/calculated-fields`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "upper_region",
      expression: "UPPER(region)",
    });
  if (createUpperRes.status !== 201) {
    throw new Error(`Create upper_region failed: ${JSON.stringify(createUpperRes.body)}`);
  }
  console.log(`   ✓ Calculated field upper_region created`);

  // STEP 7: QUERY CALCULATED FIELD
  console.log("\n6. Querying raw data with calculated fields...");
  const queryRes = await request
    .post(`/api/v1/datasets/${dataset.id}/query`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      fields: ["region", "upper_region", "revenue", "cost", "profit"],
      limit: 10,
    });

  if (queryRes.status !== 200) {
    throw new Error(`Query failed (${queryRes.status}): ${JSON.stringify(queryRes.body)}`);
  }
  const queryRows = queryRes.body.data.rows;
  console.log(`   ✓ Query returned ${queryRows.length} rows`);
  console.log(`   ✓ Sample row 0: ${JSON.stringify(queryRows[0])}`);
  if (queryRows[0].profit !== 3000 || queryRows[0].upper_region !== "NORTH") {
    throw new Error(`Data mismatch in calculated fields: ${JSON.stringify(queryRows[0])}`);
  }

  // STEP 8: AGGREGATE CALCULATED FIELD
  console.log("\n7. Aggregating calculated field (SUM of profit grouped by upper_region)...");
  const aggRes = await request
    .post(`/api/v1/datasets/${dataset.id}/query`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      groupBy: ["upper_region"],
      measures: [
        { column: "profit", aggregation: "SUM" },
        { column: "revenue", aggregation: "SUM" },
      ],
      sort: { column: "upper_region", direction: "asc" },
    });

  if (aggRes.status !== 200) {
    throw new Error(`Aggregation failed (${aggRes.status}): ${JSON.stringify(aggRes.body)}`);
  }
  const aggRows = aggRes.body.data.rows;
  console.log(`   ✓ Aggregation returned ${aggRows.length} grouped rows`);
  console.log(`   ✓ Aggregated rows: ${JSON.stringify(aggRows)}`);
  const totalProfit = aggRows.reduce((sum: number, r: any) => sum + Number(r.sum_profit ?? r.profit_sum ?? r.profit), 0);
  console.log(`   ✓ Total aggregated profit: ${totalProfit} (Expected: 21000)`);
  if (totalProfit !== 21000) {
    throw new Error(`Expected total profit 21000, got ${totalProfit}`);
  }

  // STEP 9: CREATE VISUALIZATION USING CALCULATED FIELD
  console.log("\n8. Creating BAR chart visualization using calculated field 'profit'...");
  const vizRes = await request
    .post("/api/v1/visualizations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Profit by Region",
      type: "BAR",
      datasetId: dataset.id,
      workspaceId,
      config: {
        categoryField: "upper_region",
        valueField: "profit",
        aggregation: "SUM",
      },
    });

  if (vizRes.status !== 201) {
    throw new Error(`Create visualization failed (${vizRes.status}): ${JSON.stringify(vizRes.body)}`);
  }
  const visualization = vizRes.body.data;
  console.log(`   ✓ Visualization created: "${visualization.title}" (ID: ${visualization.id})`);

  // STEP 10: ADD VISUALIZATION TO DASHBOARD
  console.log("\n9. Creating Dashboard and embedding visualization...");
  const dashRes = await request
    .post("/api/v1/dashboards")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Executive Profitability Dashboard",
      description: "Live dashboard tracking calculated profit margins and regions",
      workspaceId,
      layout: [
        {
          id: "widget-1",
          visualizationId: visualization.id,
          x: 0,
          y: 0,
          w: 6,
          h: 4,
        },
      ],
    });

  if (dashRes.status !== 201) {
    throw new Error(`Create dashboard failed (${dashRes.status}): ${JSON.stringify(dashRes.body)}`);
  }
  const dashboard = dashRes.body.data;
  console.log(`   ✓ Dashboard created: "${dashboard.name}" (ID: ${dashboard.id})`);

  // STEP 11: VERIFY DASHBOARD RENDERS
  console.log("\n10. Verifying dashboard retrieval and layout integrity...");
  const fetchDashRes = await request
    .get(`/api/v1/dashboards/${dashboard.id}`)
    .set("Authorization", `Bearer ${token}`);

  if (fetchDashRes.status !== 200) {
    throw new Error(`Fetch dashboard failed: ${JSON.stringify(fetchDashRes.body)}`);
  }
  const fetchedDash = fetchDashRes.body.data;
  console.log(`   ✓ Dashboard "${fetchedDash.name}" fetched successfully with ${fetchedDash.layout?.length || 0} widgets`);

  // STEP 12: VERIFY EXISTING SHARING & REPORT SCHEDULING STILL WORKS
  console.log("\n11. Verifying existing features: Dashboard Share Link...");
  const shareRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/share`)
    .set("Authorization", `Bearer ${token}`)
    .send({ isPublic: true });

  if (shareRes.status !== 200) {
    throw new Error(`Create share link failed: ${JSON.stringify(shareRes.body)}`);
  }
  const shareToken = shareRes.body.data.shareToken;
  console.log(`   ✓ Share link generated: ${shareToken}`);

  // Fetch shared dashboard anonymously (without auth token)
  const publicRes = await request.get(`/api/v1/dashboards/shared/${shareToken}`);
  if (publicRes.status !== 200) {
    throw new Error(`Public shared dashboard failed: ${JSON.stringify(publicRes.body)}`);
  }
  console.log(`   ✓ Public shared dashboard loaded successfully without auth`);

  console.log("\n12. Verifying existing features: Scheduled Report...");
  const reportRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/reports`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      frequency: "WEEKLY",
      format: "PDF",
      recipients: ["cfo@acme.test"],
    });

  if (reportRes.status !== 201) {
    throw new Error(`Create scheduled report failed: ${JSON.stringify(reportRes.body)}`);
  }
  const report = reportRes.body.data;
  console.log(`   ✓ Scheduled report created: ${report.id} (${report.frequency})`);

  // Trigger manual execution
  const runReportRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/reports/${report.id}/run`)
    .set("Authorization", `Bearer ${token}`);

  if (runReportRes.status !== 200) {
    throw new Error(`Trigger report failed: ${JSON.stringify(runReportRes.body)}`);
  }
  console.log(`   ✓ Report run triggered successfully. Status: ${runReportRes.body.data.status}`);

  // CLEANUP TEST DATA
  console.log("\n13. Cleaning up test workspace and resources...");
  await prisma.scheduledReport.deleteMany({ where: { dashboardId: dashboard.id } });
  await prisma.dashboard.deleteMany({ where: { id: dashboard.id } });
  await prisma.visualization.deleteMany({ where: { id: visualization.id } });
  await prisma.datasetColumn.deleteMany({ where: { datasetId: dataset.id } });
  await prisma.dataset.deleteMany({ where: { id: dataset.id } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await prisma.organization.deleteMany({ where: { id: user.organizationId } });
  console.log("   ✓ Cleaned up test resources successfully");

  console.log("\n🎉 ALL 12 RUNTIME VERIFICATION STEPS PASSED SUCCESSFULLY! (85% → 90% Verified)");
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Runtime Verification Error:", err);
    process.exit(1);
  });
