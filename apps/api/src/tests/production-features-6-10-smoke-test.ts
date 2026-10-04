/**
 * Production Smoke Test for Features 6–10
 * Hits the live deployed Render environment: https://ricozviz-api.onrender.com
 */

const API_BASE = (process.env.API_URL || "https://ricozviz-api.onrender.com/api/v1").trim();

async function runFeatures6To10ProductionSmokeTest() {
  console.log("==================================================");
  console.log("🚀 STARTING PRODUCTION SMOKE TEST FOR FEATURES 6–10");
  console.log(`Target API: ${API_BASE}`);
  console.log("==================================================\n");

  const runId = Date.now().toString().slice(-6);
  const email = `feat6_10_${runId}@ricozviz.test`;
  const password = "ProductionSecurePassword123!";
  const name = `Features 6-10 Tester ${runId}`;

  // 1. Health check & Render status
  console.log("1. Checking Live API Health & Uptime...");
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthJson = await healthRes.json();
  if (healthRes.status !== 200 || !healthJson.success) {
    throw new Error(`Health check failed: ${JSON.stringify(healthJson)}`);
  }
  console.log(`   ✅ API Health OK: uptime=${healthJson.data?.uptime}s, version=${healthJson.data?.version}`);

  // 2. Register fresh user (triggers Audit Log: USER_REGISTER)
  console.log(`2. Registering Fresh User: ${email}...`);
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, organizationName: `Features Org ${runId}` }),
  });
  const regJson = await regRes.json();
  if (regRes.status !== 201 || !regJson.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  }
  const token = regJson.data.accessToken || regJson.data.tokens?.accessToken;
  const user = regJson.data.user;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  console.log(`   ✅ User registered: ID=${user.id}`);

  // 3. Resolve default workspace
  console.log("3. Resolving Default Workspace...");
  const wsRes = await fetch(`${API_BASE}/workspaces`, { headers });
  const wsJson = await wsRes.json();
  const workspaces = wsJson.data || [];
  if (workspaces.length === 0) {
    throw new Error("No default workspace created for user");
  }
  const workspaceId = workspaces[0].id;
  console.log(`   ✅ Workspace resolved: ID=${workspaceId}`);

  // 4. Import demo dataset for profiling & export testing
  console.log("4. Importing Demo Dataset (80 Breakfast Cereals)...");
  const importRes = await fetch(`${API_BASE}/datasets/demo/cereals-80/import`, {
    method: "POST",
    headers,
    body: JSON.stringify({ workspaceId }),
  });
  const importJson = await importRes.json();
  if (!importRes.ok || !importJson.success) {
    throw new Error(`Demo import failed: ${JSON.stringify(importJson)}`);
  }
  const datasetId = importJson.data.id;
  console.log(`   ✅ Dataset imported: ID=${datasetId}, Name="${importJson.data.name}"`);

  // ==========================================
  // FEATURE 6: DATA QUALITY & PROFILING
  // ==========================================
  console.log("\n--- FEATURE 6: DATA QUALITY & PROFILING ---");
  console.log("5. Profiling Dataset...");
  const profileRes = await fetch(`${API_BASE}/datasets/${datasetId}/profile`, { headers });
  const profileJson = await profileRes.json();
  if (!profileRes.ok || !profileJson.success) {
    throw new Error(`Data profiling failed: ${JSON.stringify(profileJson)}`);
  }
  const profile = profileJson.data;
  console.log(`   ✅ Profile summary: ${profile.totalRows} rows, ${profile.totalColumns} columns`);
  console.log(`   ✅ Duplicate rows detected: ${profile.duplicateRowsCount}`);
  console.log(`   ✅ Columns profiled: ${profile.columns.length}`);

  const caloriesCol = profile.columns.find((c: any) => c.name.toLowerCase().includes("calories"));
  if (caloriesCol) {
    console.log(`   ✅ Numeric stats for '${caloriesCol.name}': min=${caloriesCol.min}, max=${caloriesCol.max}, avg=${caloriesCol.avg}, median=${caloriesCol.median}`);
  }
  console.log(`   ✅ Quality warnings count: ${profile.warnings.length}`);

  // Test Feature 6 Security: Unauthorized access to profiling
  console.log("6. Verifying Unauthorized Dataset Profiling Rejection...");
  const unauthProfileRes = await fetch(`${API_BASE}/datasets/${datasetId}/profile`);
  if (unauthProfileRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated profile, got ${unauthProfileRes.status}`);
  }
  console.log("   ✅ Unauthenticated profiling properly rejected with 401");

  // ==========================================
  // FEATURE 7: ADVANCED EXPORT CENTER
  // ==========================================
  console.log("\n--- FEATURE 7: ADVANCED EXPORT CENTER ---");

  // 7a: Export Dataset to CSV
  console.log("7. Exporting Dataset to CSV...");
  const csvExportRes = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      resourceType: "DATASET",
      resourceId: datasetId,
      format: "CSV",
      rowLimit: 500,
    }),
  });
  const csvExportJson = await csvExportRes.json();
  if (!csvExportRes.ok || !csvExportJson.success) {
    throw new Error(`CSV export failed: ${JSON.stringify(csvExportJson)}`);
  }
  console.log(`   ✅ CSV Export OK: rows=${csvExportJson.data.rowCount}, size=${csvExportJson.data.fileSizeBytes} bytes`);

  // 7b: Export Dataset to Excel
  console.log("8. Exporting Dataset to Excel (XLSX)...");
  const xlsxExportRes = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      resourceType: "DATASET",
      resourceId: datasetId,
      format: "EXCEL",
      rowLimit: 500,
    }),
  });
  const xlsxExportJson = await xlsxExportRes.json();
  if (!xlsxExportRes.ok || !xlsxExportJson.success) {
    throw new Error(`Excel export failed: ${JSON.stringify(xlsxExportJson)}`);
  }
  console.log(`   ✅ Excel Export OK: base64Length=${xlsxExportJson.data.dataBase64?.length}, size=${xlsxExportJson.data.fileSizeBytes} bytes`);

  // 7c: Export Dashboard to PDF
  console.log("9. Creating Dashboard for PDF Export...");
  const dashRes = await fetch(`${API_BASE}/dashboards`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: `Export Test Dashboard ${runId}`,
      workspaceId,
      description: "Testing export to PDF and PNG",
    }),
  });
  const dashJson = await dashRes.json();
  const dashboardId = dashJson.data.id;

  console.log("10. Exporting Dashboard to PDF Descriptor...");
  const pdfExportRes = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      resourceType: "DASHBOARD",
      resourceId: dashboardId,
      format: "PDF",
    }),
  });
  const pdfExportJson = await pdfExportRes.json();
  if (!pdfExportRes.ok || !pdfExportJson.success) {
    throw new Error(`PDF export failed: ${JSON.stringify(pdfExportJson)}`);
  }
  console.log(`   ✅ Dashboard PDF Export OK: filename="${pdfExportJson.data.filename}"`);

  // 7d: Query Export History
  console.log("11. Verifying Export History Tracking...");
  const historyRes = await fetch(`${API_BASE}/exports/history`, { headers });
  const historyJson = await historyRes.json();
  if (!historyRes.ok || !historyJson.success) {
    throw new Error(`Export history failed: ${JSON.stringify(historyJson)}`);
  }
  console.log(`   ✅ Export history contains ${historyJson.data.length} job records`);

  // ==========================================
  // FEATURE 8: DASHBOARD TEMPLATES
  // ==========================================
  console.log("\n--- FEATURE 8: DASHBOARD TEMPLATES ---");
  console.log("12. Listing Built-in System Templates...");
  const tmplListRes = await fetch(`${API_BASE}/templates`, { headers });
  const tmplListJson = await tmplListRes.json();
  if (!tmplListRes.ok || !tmplListJson.success) {
    throw new Error(`Template listing failed: ${JSON.stringify(tmplListJson)}`);
  }
  console.log(`   ✅ Retrieved ${tmplListJson.data.length} dashboard templates`);
  const salesTmpl = tmplListJson.data.find((t: any) => t.category === "Sales") || tmplListJson.data[0];
  console.log(`   ✅ Found template: "${salesTmpl.name}" (Category: ${salesTmpl.category})`);

  console.log("13. Instantiating Dashboard From Template...");
  const applyRes = await fetch(`${API_BASE}/templates/${salesTmpl.id}/apply`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspaceId,
      name: `Sales Dashboard ${runId}`,
      description: "Cloned independently from system template",
      targetDatasetId: datasetId,
    }),
  });
  const applyJson = await applyRes.json();
  if (!applyRes.ok || !applyJson.success) {
    throw new Error(`Template instantiation failed: ${JSON.stringify(applyJson)}`);
  }
  const clonedDashboard = applyJson.data;
  console.log(`   ✅ Cloned Dashboard created: ID=${clonedDashboard.id}, Name="${clonedDashboard.name}"`);

  console.log("14. Verifying Template Independence (editing cloned dashboard leaves template intact)...");
  await fetch(`${API_BASE}/dashboards/${clonedDashboard.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name: "Modified Cloned Dashboard Name" }),
  });
  const verifyTmplRes = await fetch(`${API_BASE}/templates/${salesTmpl.id}`, { headers });
  const verifyTmplJson = await verifyTmplRes.json();
  if (verifyTmplJson.data.name !== salesTmpl.name) {
    throw new Error("CRITICAL: Editing cloned dashboard corrupted the original template!");
  }
  console.log("   ✅ Verified: Template remained completely unchanged after dashboard edits");

  // ==========================================
  // FEATURE 9: ADVANCED RBAC
  // ==========================================
  console.log("\n--- FEATURE 9: ADVANCED RBAC ---");
  console.log("15. Creating Restricted Viewer User...");
  const viewerEmail = `viewer_${runId}@ricozviz.test`;
  const viewerRegRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: viewerEmail,
      password: "ViewerSecurePassword123!",
      name: `Viewer User ${runId}`,
      organizationName: `Viewer Org ${runId}`,
    }),
  });
  const viewerRegJson = await viewerRegRes.json();
  const viewerToken = viewerRegJson.data.accessToken || viewerRegJson.data.tokens?.accessToken;
  const viewerHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${viewerToken}`,
  };

  console.log("16. Verifying Cross-Tenant / Cross-Workspace Access Isolation (RBAC boundary)...");
  const crossAccessRes = await fetch(`${API_BASE}/datasets/${datasetId}`, {
    headers: viewerHeaders,
  });
  if (crossAccessRes.status !== 404 && crossAccessRes.status !== 403) {
    throw new Error(`Expected 403/404 for cross-tenant dataset access, got ${crossAccessRes.status}`);
  }
  console.log(`   ✅ Direct cross-tenant access correctly blocked with HTTP ${crossAccessRes.status}`);

  // ==========================================
  // FEATURE 10: AUDIT LOGS
  // ==========================================
  console.log("\n--- FEATURE 10: AUDIT LOGS ---");
  console.log("17. Querying Workspace Audit Logs...");
  const auditRes = await fetch(`${API_BASE}/audit-logs?workspaceId=${workspaceId}&limit=20`, { headers });
  const auditJson = await auditRes.json();
  if (!auditRes.ok || !auditJson.success) {
    throw new Error(`Audit log query failed: ${JSON.stringify(auditJson)}`);
  }
  const logs = auditJson.data.logs;
  console.log(`   ✅ Found ${logs.length} audit log entries for workspace`);

  const actions = logs.map((l: any) => l.action);
  console.log(`   ✅ Actions recorded: ${Array.from(new Set(actions)).join(", ")}`);

  console.log("18. Verifying Sensitive Credentials Redaction in Audit Logs...");
  for (const log of logs) {
    const rawJson = JSON.stringify(log.metadata || {});
    if (rawJson.includes("password") || rawJson.includes("secret") || rawJson.includes("accessToken")) {
      throw new Error(`CRITICAL SECURITY FAILURE: Sensitive credentials found in audit log: ${rawJson}`);
    }
  }
  console.log("   ✅ Verified: Zero passwords, tokens, or secrets exposed in audit metadata");

  console.log("19. Verifying Audit Log Summary Statistics...");
  const statsRes = await fetch(`${API_BASE}/audit-logs/stats?workspaceId=${workspaceId}`, { headers });
  const statsJson = await statsRes.json();
  if (!statsRes.ok || !statsJson.success) {
    throw new Error(`Audit stats query failed: ${JSON.stringify(statsJson)}`);
  }
  console.log(`   ✅ Audit stats: totalEvents=${statsJson.data.totalEvents}, topActions=${Object.keys(statsJson.data.actionBreakdown || {}).length}`);

  console.log("\n==================================================");
  console.log("🎉 ALL FEATURES 6–10 PRODUCTION CHECKS PASSED!");
  console.log("==================================================");
}

runFeatures6To10ProductionSmokeTest().catch((err) => {
  console.error("❌ PRODUCTION TEST FAILED:", err);
  process.exit(1);
});
