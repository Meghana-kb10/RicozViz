// ============================================================
// RicozViz Report Schedule & Snapshot Live Verification Script
// Tests end-to-end against http://localhost:4000/api/v1
// ============================================================

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BASE_URL = process.env.API_URL || "http://localhost:4000/api/v1";

async function runVerification() {
  console.log("=== RicozViz Scheduled Report System Live Verification ===");

  const randomSuffix = Math.floor(Math.random() * 100000);
  const email = `schedule_tester_${randomSuffix}@ricozviz.test`;
  const password = "Password123!";

  // 1. Register fresh user for clean isolated run
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: `Schedule Tester ${randomSuffix}`,
      organizationName: `Schedule Org ${randomSuffix}`,
    }),
  });
  const regBody = (await regRes.json()) as any;
  if (!regRes.ok || !regBody.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regBody)}`);
  }

  // 2. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = (await loginRes.json()) as any;
  if (!loginRes.ok || !loginBody.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginBody)}`);
  }

  const token = loginBody.data.tokens?.accessToken || loginBody.data.accessToken;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  console.log(`✓ Registered and logged in as: ${email}`);

  // 3. Create a test dashboard
  const createDashRes = await fetch(`${BASE_URL}/dashboards`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Automated Report Test Dashboard ${randomSuffix}`,
      description: "Testing automated report schedule & snapshot generation",
      status: "PUBLISHED",
      visibility: "ORGANIZATION",
    }),
  });
  const createDashBody = (await createDashRes.json()) as any;
  if (!createDashRes.ok || !createDashBody.success) {
    throw new Error(`Create dashboard failed: ${JSON.stringify(createDashBody)}`);
  }
  const dashboardId = createDashBody.data.id;
  console.log(`✓ Created test dashboard: ${dashboardId}`);

  // 4. Initial schedule state should be null
  const initScheduleRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, { headers });
  const initScheduleBody = (await initScheduleRes.json()) as any;
  if (initScheduleBody.data !== null) {
    throw new Error(`Expected null schedule, got: ${JSON.stringify(initScheduleBody)}`);
  }
  console.log("✓ Initial schedule is null as expected.");

  // 5. Create Daily Schedule
  const createScheduleRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      frequency: "DAILY",
      enabled: true,
    }),
  });
  const createScheduleBody = (await createScheduleRes.json()) as any;
  if (!createScheduleRes.ok || !createScheduleBody.success) {
    throw new Error(`Create schedule failed: ${JSON.stringify(createScheduleBody)}`);
  }
  console.log("✓ Created DAILY schedule:", {
    id: createScheduleBody.data.id,
    frequency: createScheduleBody.data.frequency,
    enabled: createScheduleBody.data.enabled,
    nextRunAt: createScheduleBody.data.nextRunAt,
  });

  // 6. Fetch schedule via GET
  const getScheduleRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, { headers });
  const getScheduleBody = (await getScheduleRes.json()) as any;
  if (!getScheduleBody.data || getScheduleBody.data.frequency !== "DAILY" || !getScheduleBody.data.enabled) {
    throw new Error(`Get schedule mismatch: ${JSON.stringify(getScheduleBody)}`);
  }
  console.log("✓ Retrieved schedule via GET: frequency=DAILY, enabled=true");

  // 7. Update Schedule to Weekly & Paused
  const updateScheduleRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      frequency: "WEEKLY",
      enabled: false,
    }),
  });
  const updateScheduleBody = (await updateScheduleRes.json()) as any;
  if (!updateScheduleRes.ok || !updateScheduleBody.success) {
    throw new Error(`Update schedule failed: ${JSON.stringify(updateScheduleBody)}`);
  }
  console.log("✓ Updated schedule to WEEKLY (Paused):", {
    id: updateScheduleBody.data.id,
    frequency: updateScheduleBody.data.frequency,
    enabled: updateScheduleBody.data.enabled,
  });

  // 8. Generate Live Dashboard Report Snapshot
  const genReportRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/reports/generate`, {
    method: "POST",
    headers,
  });
  const genReportBody = (await genReportRes.json()) as any;
  if (!genReportRes.ok || !genReportBody.success) {
    throw new Error(`Generate report failed: ${JSON.stringify(genReportBody)}`);
  }
  console.log("✓ Generated live dashboard report snapshot:", {
    reportId: genReportBody.data.reportId,
    dashboardName: genReportBody.data.dashboardName,
    chartCount: genReportBody.data.chartCount,
    totalRecords: genReportBody.data.summary.totalRecords,
    executionTimeMs: genReportBody.data.summary.executionTimeMs,
  });

  // 9. Delete Schedule
  const deleteScheduleRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, {
    method: "DELETE",
    headers,
  });
  const deleteScheduleBody = (await deleteScheduleRes.json()) as any;
  if (!deleteScheduleRes.ok || !deleteScheduleBody.success) {
    throw new Error(`Delete schedule failed: ${JSON.stringify(deleteScheduleBody)}`);
  }
  console.log("✓ Deleted schedule successfully.");

  // 10. Verify schedule is now null
  const verifyDeleteRes = await fetch(`${BASE_URL}/dashboards/${dashboardId}/schedule`, { headers });
  const verifyDeleteBody = (await verifyDeleteRes.json()) as any;
  if (verifyDeleteBody.data !== null) {
    throw new Error(`Expected null schedule after delete, got: ${JSON.stringify(verifyDeleteBody)}`);
  }
  console.log("✓ Verified schedule is cleared (null).");

  console.log("\n==================================================");
  console.log("🎉 ALL LIVE REPORT SCHEDULE VERIFICATION STEPS PASSED!");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
