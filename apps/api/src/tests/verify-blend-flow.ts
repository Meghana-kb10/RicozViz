// ========================================
// Live Runtime Verification: Blend & Multi-Source End-to-End Flow
// ========================================
import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const app = createApp();
const request = supertest(app);

async function run() {
  console.log("🚀 Starting Full 80% → 85% Runtime Verification...\n");

  const runId = Date.now();
  const testEmail = `sprint85_${runId}@ricozviz.test`;
  const testPassword = "Password123!Secure";
  const orgName = `Sprint85 Org ${runId}`;

  // 1. REGISTER & LOGIN
  console.log("1. Registering new user & workspace...");
  const regRes = await request.post("/api/v1/auth/register").send({
    email: testEmail,
    password: testPassword,
    name: "Sprint 85 Tester",
    organizationName: orgName,
  });

  if (regRes.status !== 201 && regRes.status !== 200) {
    throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
  }
  const token = regRes.body.data.accessToken;
  const user = regRes.body.data.user;
  console.log(`   ✓ Registered user ${user.email} (Org: ${user.organizationId})`);

  // Create a test workspace
  const wsRes = await request
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Analytics Workspace" });
  if (wsRes.status !== 201) {
    throw new Error(`Failed to create workspace: ${JSON.stringify(wsRes.body)}`);
  }
  const workspaceId = wsRes.body.data.id;
  console.log(`   ✓ Workspace created: ${workspaceId}`);

  // 2. INGEST DATASET A (Sales)
  console.log("\n2. Ingesting Dataset A (Sales Transactions)...");
  const salesCsv = [
    "order_id,customer_id,product,amount,country",
    "ORD-1,CUST-10,Enterprise Suite,12000,US",
    "ORD-2,CUST-20,Pro Tier,3500,UK",
    "ORD-3,CUST-30,Basic Pack,800,DE",
    "ORD-4,CUST-99,One-off Service,1500,FR", // CUST-99 is not in Customers
  ].join("\n");

  const dsARes = await request
    .post("/api/v1/datasets/upload")
    .set("Authorization", `Bearer ${token}`)
    .field("name", "Sales 2026")
    .field("workspaceId", workspaceId)
    .attach("file", Buffer.from(salesCsv, "utf-8"), "sales.csv");

  if (dsARes.status !== 201) {
    throw new Error(`Dataset A creation failed (${dsARes.status}): ${JSON.stringify(dsARes.body)}`);
  }
  const datasetA = dsARes.body.data;
  console.log(`   ✓ Dataset A created: "${datasetA.name}" (ID: ${datasetA.id}, Rows: ${datasetA.rowCount}, Cols: ${datasetA.columnCount})`);

  // 3. INGEST DATASET B (Customer CRM)
  console.log("\n3. Ingesting Dataset B (Customer Profiles)...");
  const customersCsv = [
    "customer_id,company_name,tier,credit_limit",
    "CUST-10,Acme Global,VIP,50000",
    "CUST-20,Apex Logistics,Growth,20000",
    "CUST-30,CloudNine Systems,Starter,5000",
    "CUST-40,Dormant Labs,Starter,2000", // CUST-40 has no orders
  ].join("\n");

  const dsBRes = await request
    .post("/api/v1/datasets/upload")
    .set("Authorization", `Bearer ${token}`)
    .field("name", "Customer Profiles")
    .field("workspaceId", workspaceId)
    .attach("file", Buffer.from(customersCsv, "utf-8"), "customers.csv");

  if (dsBRes.status !== 201) {
    throw new Error(`Dataset B creation failed (${dsBRes.status}): ${JSON.stringify(dsBRes.body)}`);
  }
  const datasetB = dsBRes.body.data;
  console.log(`   ✓ Dataset B created: "${datasetB.name}" (ID: ${datasetB.id}, Rows: ${datasetB.rowCount}, Cols: ${datasetB.columnCount})`);

  // 4. PREVIEW INNER JOIN BLEND
  console.log("\n4. Previewing INNER JOIN Blend...");
  const innerPreviewRes = await request
    .post("/api/v1/datasets/blends/preview")
    .set("Authorization", `Bearer ${token}`)
    .send({
      datasetAId: datasetA.id,
      datasetBId: datasetB.id,
      joinColumnA: "customer_id",
      joinColumnB: "customer_id",
      joinType: "INNER",
    });

  if (innerPreviewRes.status !== 200) {
    throw new Error(`Inner preview failed (${innerPreviewRes.status}): ${JSON.stringify(innerPreviewRes.body)}`);
  }
  const innerData = innerPreviewRes.body.data;
  console.log(`   ✓ Inner join preview returned ${innerData.rowCount} rows`);
  if (innerData.rowCount !== 3) {
    throw new Error(`Expected 3 inner join rows, got ${innerData.rowCount}`);
  }

  // 5. PREVIEW LEFT JOIN BLEND
  console.log("\n5. Previewing LEFT JOIN Blend...");
  const leftPreviewRes = await request
    .post("/api/v1/datasets/blends/preview")
    .set("Authorization", `Bearer ${token}`)
    .send({
      datasetAId: datasetA.id,
      datasetBId: datasetB.id,
      joinColumnA: "customer_id",
      joinColumnB: "customer_id",
      joinType: "LEFT",
    });

  if (leftPreviewRes.status !== 200) {
    throw new Error(`Left preview failed (${leftPreviewRes.status}): ${JSON.stringify(leftPreviewRes.body)}`);
  }
  const leftData = leftPreviewRes.body.data;
  console.log(`   ✓ Left join preview returned ${leftData.rowCount} rows (All 4 Sales rows preserved)`);
  if (leftData.rowCount !== 4) {
    throw new Error(`Expected 4 left join rows, got ${leftData.rowCount}`);
  }
  const unmatched = leftData.rows.find((r: any) => r.customer_id === "CUST-99");
  if (!unmatched || unmatched.company_name !== null) {
    throw new Error(`Expected CUST-99 to have null company_name in left join, got: ${JSON.stringify(unmatched)}`);
  }
  console.log(`   ✓ Unmatched customer CUST-99 has company_name = null as expected`);

  // 6. SAVE BLENDED DATASET
  console.log("\n6. Saving Blended Dataset (DERIVED)...");
  const saveBlendRes = await request
    .post("/api/v1/datasets/blends")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Sales with Customer Intelligence",
      description: "Blended dataset uniting 2026 Sales with Customer Profiles",
      datasetAId: datasetA.id,
      datasetBId: datasetB.id,
      joinColumnA: "customer_id",
      joinColumnB: "customer_id",
      joinType: "LEFT",
    });

  if (saveBlendRes.status !== 201) {
    throw new Error(`Save blend failed (${saveBlendRes.status}): ${JSON.stringify(saveBlendRes.body)}`);
  }
  const blendedDataset = saveBlendRes.body.data;
  console.log(`   ✓ Saved Blended Dataset: "${blendedDataset.name}" (ID: ${blendedDataset.id}, Type: ${blendedDataset.type})`);
  console.log(`   ✓ Columns: ${blendedDataset.columns.map((c: any) => `${c.name} (${c.dataType})`).join(", ")}`);

  // 7. QUERY BLENDED DATASET
  console.log("\n7. Executing Query Engine on Blended Dataset...");
  const queryRes = await request
    .post(`/api/v1/datasets/${blendedDataset.id}/query`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      dimensions: ["tier"],
      metrics: [{ field: "amount", aggregation: "SUM" }],
    });

  if (queryRes.status !== 200) {
    throw new Error(`Query blended dataset failed (${queryRes.status}): ${JSON.stringify(queryRes.body)}`);
  }
  console.log(`   ✓ Query engine aggregated ${queryRes.body.data.rows.length} groups by customer tier!`);
  console.log("   Results:", queryRes.body.data.rows);

  // 8. CREATE VISUALIZATION FROM BLENDED DATASET
  console.log("\n8. Creating BAR Chart Visualization from Blended Dataset...");
  const vizRes = await request
    .post("/api/v1/visualizations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Revenue by Customer Tier",
      chartType: "BAR",
      datasetId: blendedDataset.id,
      config: {
        xAxis: "tier",
        yAxis: "amount",
      },
    });

  if (vizRes.status !== 201) {
    throw new Error(`Create visualization failed (${vizRes.status}): ${JSON.stringify(vizRes.body)}`);
  }
  const viz = vizRes.body.data;
  console.log(`   ✓ Visualization created: "${viz.title}" (ID: ${viz.id})`);

  // 9. CREATE DASHBOARD & ATTACH BLENDED CHART
  console.log("\n9. Creating Dashboard and embedding blended chart...");
  const dashRes = await request
    .post("/api/v1/dashboards")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Executive Customer & Sales Dashboard",
      description: "Powered by multi-source blended datasets",
    });

  if (dashRes.status !== 201) {
    throw new Error(`Create dashboard failed (${dashRes.status}): ${JSON.stringify(dashRes.body)}`);
  }
  const dashboard = dashRes.body.data;
  console.log(`   ✓ Dashboard created: "${dashboard.name}" (ID: ${dashboard.id})`);

  const addChartRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/charts`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Revenue by Tier (Blended)",
      chartType: "BAR",
      datasetId: blendedDataset.id,
      config: {
        xAxis: "tier",
        yAxis: "amount",
      },
      position: { x: 0, y: 0, w: 6, h: 4 },
    });

  if (addChartRes.status !== 201) {
    throw new Error(`Add chart failed (${addChartRes.status}): ${JSON.stringify(addChartRes.body)}`);
  }
  const chart = addChartRes.body.data;
  console.log(`   ✓ Chart added to dashboard: "${chart.title}" (ID: ${chart.id})`);

  // 10. VERIFY EXISTING DASHBOARD FEATURES (Sharing, Schedule, Report Generation)
  console.log("\n10. Verifying existing features remain 100% operational...");

  // 10a. Share dashboard
  const shareRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/share`)
    .set("Authorization", `Bearer ${token}`);
  if (shareRes.status !== 200 || !shareRes.body.data.shareUrl) {
    throw new Error(`Share dashboard failed: ${JSON.stringify(shareRes.body)}`);
  }
  console.log(`   ✓ Public share link generated: ${shareRes.body.data.shareUrl}`);

  // 10b. Fetch shared public dashboard without auth
  const tokenPart = shareRes.body.data.shareToken;
  const publicRes = await request.get(`/api/v1/dashboards/shared/${tokenPart}`);
  if (publicRes.status !== 200) {
    throw new Error(`Public shared view failed (${publicRes.status}): ${JSON.stringify(publicRes.body)}`);
  }
  console.log(`   ✓ Public shared dashboard retrieved successfully without auth!`);

  // 10c. Configure report schedule
  const scheduleRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/schedule`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      frequency: "WEEKLY",
      format: "PDF",
      recipients: ["exec@company.test"],
    });
  if (scheduleRes.status !== 200) {
    throw new Error(`Schedule setup failed (${scheduleRes.status}): ${JSON.stringify(scheduleRes.body)}`);
  }
  console.log(`   ✓ Dashboard weekly PDF schedule configured!`);

  // 10d. On-demand report generation
  const reportGenRes = await request
    .post(`/api/v1/dashboards/${dashboard.id}/reports/generate`)
    .set("Authorization", `Bearer ${token}`)
    .send({ format: "CSV" });
  if (reportGenRes.status !== 200) {
    throw new Error(`On-demand report generation failed (${reportGenRes.status}): ${JSON.stringify(reportGenRes.body)}`);
  }
  console.log(`   ✓ On-demand CSV report generated successfully!`);

  // 11. CLEANUP
  console.log("\n11. Cleaning up test resources...");
  try {
    await request.delete(`/api/v1/dashboards/${dashboard.id}`).set("Authorization", `Bearer ${token}`);
    await prisma.dataset.delete({ where: { id: blendedDataset.id } }).catch(() => {});
    await prisma.dataset.delete({ where: { id: datasetA.id } }).catch(() => {});
    await prisma.dataset.delete({ where: { id: datasetB.id } }).catch(() => {});
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await prisma.organizationMember.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.organization.delete({ where: { id: user.organizationId } }).catch(() => {});
    console.log("   ✓ Test resources cleaned up.");
  } catch (err: any) {
    console.log(`   (Cleanup note: ${err?.message || err})`);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL 11 RUNTIME VERIFICATION STEPS PASSED PERFECTLY!");
  console.log("========================================================");
}

run()
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
