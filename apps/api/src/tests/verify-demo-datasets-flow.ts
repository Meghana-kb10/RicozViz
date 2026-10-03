// ============================================================
// End-to-End Live Runtime Verification: Demo Datasets Flow
// ============================================================

import supertest from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

const app = createApp();
const request = supertest(app);

async function runVerification() {
  console.log("============================================================");
  console.log("🚀 Starting Demo Datasets End-to-End Flow Verification");
  console.log("============================================================\n");

  const runId = Date.now();
  const testEmail = `demotester_${runId}@ricozviz.test`;
  const testPassword = "Password123!Secure";
  const orgName = `Demo Datasets Org ${runId}`;

  try {
    // 1. Register & Login
    console.log("1. Registering test user & tenant organization...");
    const regRes = await request.post("/api/v1/auth/register").send({
      email: testEmail,
      password: testPassword,
      name: "Demo Dataset Tester",
      organizationName: orgName,
    });

    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error(`Register failed (${regRes.status}): ${JSON.stringify(regRes.body)}`);
    }
    const token = regRes.body.data.accessToken;
    const user = regRes.body.data.user;
    console.log(`   ✓ Registered user ${user.email} (Org: ${user.organizationId})`);

    // 2. Create Workspace A
    console.log("\n2. Creating Primary Workspace...");
    const wsResA = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Primary Analytics Workspace" });

    if (wsResA.status !== 201) {
      throw new Error(`Failed to create workspace A: ${JSON.stringify(wsResA.body)}`);
    }
    const workspaceAId = wsResA.body.data.id;
    console.log(`   ✓ Workspace A created: ${workspaceAId}`);

    // 3. Create Workspace B
    console.log("\n3. Creating Secondary Workspace for Isolation Testing...");
    const wsResB = await request
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Secondary Sandbox Workspace" });

    if (wsResB.status !== 201) {
      throw new Error(`Failed to create workspace B: ${JSON.stringify(wsResB.body)}`);
    }
    const workspaceBId = wsResB.body.data.id;
    console.log(`   ✓ Workspace B created: ${workspaceBId}`);

    // 4. Retrieve Demo Catalog
    console.log("\n4. Testing GET /api/v1/datasets/demo/catalog...");
    const catRes = await request
      .get("/api/v1/datasets/demo/catalog")
      .set("Authorization", `Bearer ${token}`);

    if (catRes.status !== 200 || !catRes.body.success) {
      throw new Error(`Failed to retrieve catalog: ${JSON.stringify(catRes.body)}`);
    }

    const catalog = catRes.body.data;
    console.log(`   ✓ Retrieved ${catalog.length} curated datasets in catalog.`);
    for (const d of catalog) {
      console.log(`     - [${d.id}] "${d.name}" | ${d.category} | ${d.rowCount} rows, ${d.columnCount} cols | License: ${d.license}`);
    }

    // 5. Filter by Category
    console.log("\n5. Testing Catalog Category Filter (Retail & Products)...");
    const filterRes = await request
      .get("/api/v1/datasets/demo/catalog?category=Retail %26 Products")
      .set("Authorization", `Bearer ${token}`);

    if (filterRes.status !== 200 || filterRes.body.data.length !== 1) {
      throw new Error(`Category filter failed: ${JSON.stringify(filterRes.body)}`);
    }
    console.log(`   ✓ Category filter returned: "${filterRes.body.data[0].name}"`);

    // 6. Filter by Search Query
    console.log("\n6. Testing Catalog Search Filter (query: 'starbucks')...");
    const searchRes = await request
      .get("/api/v1/datasets/demo/catalog?search=starbucks")
      .set("Authorization", `Bearer ${token}`);

    if (searchRes.status !== 200 || searchRes.body.data.length !== 1) {
      throw new Error(`Search filter failed: ${JSON.stringify(searchRes.body)}`);
    }
    console.log(`   ✓ Search filter matched: "${searchRes.body.data[0].name}"`);

    // 7. Preview Demo Dataset
    console.log("\n7. Testing GET /api/v1/datasets/demo/:demoId (Cereals)...");
    const detailRes = await request
      .get("/api/v1/datasets/demo/cereals-80")
      .set("Authorization", `Bearer ${token}`);

    if (detailRes.status !== 200 || !detailRes.body.data.records) {
      throw new Error(`Detail fetch failed: ${JSON.stringify(detailRes.body)}`);
    }
    console.log(`   ✓ Preview returned ${detailRes.body.data.records.length} full rows, columns: ${detailRes.body.data.columns.map((c: any) => c.name).join(", ")}`);

    // 8. Import Dataset into Workspace A
    console.log("\n8. Testing POST /api/v1/datasets/demo/cereals-80/import into Workspace A...");
    const importResA = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ workspaceId: workspaceAId });

    if (importResA.status !== 201 || importResA.body.alreadyImported !== false) {
      throw new Error(`Import failed: ${JSON.stringify(importResA.body)}`);
    }
    const importedDatasetA = importResA.body.data;
    console.log(`   ✓ Dataset successfully imported: ID=${importedDatasetA.id}, Name="${importedDatasetA.name}", Rows=${importedDatasetA.rowCount}, Cols=${importedDatasetA.columnCount}`);

    // 9. Query Ingestion Result via Standard Dataset API
    console.log("\n9. Testing GET /api/v1/datasets/:id on the imported demo dataset...");
    const dsVerifyRes = await request
      .get(`/api/v1/datasets/${importedDatasetA.id}`)
      .set("Authorization", `Bearer ${token}`);

    if (dsVerifyRes.status !== 200) {
      throw new Error(`Failed to fetch imported dataset: ${JSON.stringify(dsVerifyRes.body)}`);
    }
    console.log(`   ✓ Standard dataset details verified: Status=${dsVerifyRes.body.data.status}, SourceType=${dsVerifyRes.body.data.sourceType}`);

    // 10. Query Engine Compatibility
    console.log("\n10. Testing Query Engine aggregation on imported demo dataset...");
    const queryRes = await request
      .post(`/api/v1/datasets/${importedDatasetA.id}/query`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        measures: [
          { column: "calories", aggregation: "AVG", alias: "avg_calories" },
          { column: "sugars", aggregation: "AVG", alias: "avg_sugars" },
          { column: "rating", aggregation: "AVG", alias: "avg_rating" },
        ],
        groupBy: ["mfr"],
      });

    if (queryRes.status !== 200) {
      throw new Error(`Query failed: ${JSON.stringify(queryRes.body)}`);
    }
    console.log(`   ✓ Aggregated query returned ${queryRes.body.data.rows.length} grouped rows.`);
    console.log(`     Sample aggregated row:`, queryRes.body.data.rows[0]);

    // 11. Duplicate Prevention
    console.log("\n11. Testing Duplicate Import Prevention in Workspace A...");
    const duplicateRes = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ workspaceId: workspaceAId });

    if (duplicateRes.status !== 200 || duplicateRes.body.alreadyImported !== true) {
      throw new Error(`Duplicate handling failed: ${JSON.stringify(duplicateRes.body)}`);
    }
    console.log(`   ✓ Duplicate prevented successfully: alreadyImported=true, Message="${duplicateRes.body.message}"`);

    // 12. Workspace Isolation
    console.log("\n12. Testing Workspace Isolation (importing cereals-80 into Workspace B)...");
    const importResB = await request
      .post("/api/v1/datasets/demo/cereals-80/import")
      .set("Authorization", `Bearer ${token}`)
      .send({ workspaceId: workspaceBId });

    if (importResB.status !== 201 || importResB.body.alreadyImported !== false) {
      throw new Error(`Isolation import failed: ${JSON.stringify(importResB.body)}`);
    }
    console.log(`   ✓ Workspace B successfully received its own independent copy (ID=${importResB.body.data.id})`);

    // 13. Import a Second Demo Dataset with Custom Name
    console.log("\n13. Testing Import of LEGO Database with Custom Name...");
    const legoRes = await request
      .post("/api/v1/datasets/demo/lego-database/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workspaceId: workspaceAId,
        customName: "LEGO Themes 2024 Demo",
      });

    if (legoRes.status !== 201 || legoRes.body.data.name !== "LEGO Themes 2024 Demo") {
      throw new Error(`Custom name import failed: ${JSON.stringify(legoRes.body)}`);
    }
    console.log(`   ✓ Custom name demo dataset imported: "${legoRes.body.data.name}"`);

    console.log("\n============================================================");
    console.log("🎉 ALL 13 DEMO DATASET VERIFICATION STEPS PASSED SUCCESSFULLY!");
    console.log("============================================================\n");
  } finally {
    // Cleanup test tenant
    if (orgName) {
      await prisma.auditLog.deleteMany({
        where: { user: { email: testEmail } },
      }).catch(() => null);
      await prisma.datasetColumn.deleteMany({
        where: { dataset: { organization: { name: orgName } } },
      }).catch(() => null);
      await prisma.dataset.deleteMany({
        where: { organization: { name: orgName } },
      }).catch(() => null);
      await prisma.workspaceMember.deleteMany({
        where: { workspace: { organization: { name: orgName } } },
      }).catch(() => null);
      await prisma.workspace.deleteMany({
        where: { organization: { name: orgName } },
      }).catch(() => null);
      await prisma.user.deleteMany({
        where: { email: testEmail },
      }).catch(() => null);
      await prisma.organization.deleteMany({
        where: { name: orgName },
      }).catch(() => null);
    }
    await prisma.$disconnect();
  }
}

void runVerification();
