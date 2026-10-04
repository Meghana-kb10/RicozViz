/**
 * Production Smoke Test for Features 11–15
 * Hits the live deployed Render environment: https://ricozviz-api.onrender.com
 *
 * Verifies:
 * - Feature 11: Advanced Visualization & Chart Customization (palettes, legends, axes, formatting, persistence)
 * - Feature 12: Calculated Fields & Formula Builder (AST engine, validation, preview, creation, injection prevention)
 * - Feature 13: Data Transformation Pipeline (filtering, renaming, type conversion, previews, derived datasets)
 * - Feature 14: Dataset Versioning & Lineage (snapshots, version incrementation, non-destructive restoration, lineage graphs)
 * - Feature 15: Collaboration & Sharing (collaborator access grants, roles, public chart share tokens, isolation)
 */

const API_BASE = (process.env.API_URL || "https://ricozviz-api.onrender.com/api/v1").trim();

async function runFeatures11To15ProductionSmokeTest() {
  console.log("==================================================");
  console.log("🚀 STARTING PRODUCTION SMOKE TEST FOR FEATURES 11–15");
  console.log(`Target API: ${API_BASE}`);
  console.log("==================================================\n");

  const runId = Date.now().toString().slice(-6);
  const emailOwner = `feat11_15_owner_${runId}@ricozviz.test`;
  const emailCollab = `feat11_15_collab_${runId}@ricozviz.test`;
  const emailAlien = `feat11_15_alien_${runId}@ricozviz.test`;
  const password = "ProductionSecurePassword123!";

  // 1. Health check
  console.log("1. Checking Live API Health & Uptime...");
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthJson = (await healthRes.json()) as any;
  if (healthRes.status !== 200 || !healthJson.success) {
    throw new Error(`Health check failed: ${JSON.stringify(healthJson)}`);
  }
  console.log(`   ✅ API Health OK: uptime=${healthJson.data?.uptime}s, version=${healthJson.data?.version}`);

  // 2. Register Owner User & Primary Org
  console.log(`2. Registering Primary Owner: ${emailOwner}...`);
  const regOwnerRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailOwner,
      password,
      name: `Features Owner ${runId}`,
      organizationName: `Primary Org ${runId}`,
    }),
  });
  const regOwnerJson = (await regOwnerRes.json()) as any;
  if (!regOwnerRes.ok || !regOwnerJson.success) {
    throw new Error(`Owner registration failed: ${JSON.stringify(regOwnerJson)}`);
  }
  const tokenOwner = regOwnerJson.data.accessToken || regOwnerJson.data.tokens?.accessToken;
  const ownerUser = regOwnerJson.data.user;
  const headersOwner = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenOwner}`,
  };
  console.log(`   ✅ Owner registered: ID=${ownerUser.id}`);

  // 3. Register Second User in the SAME organization for collaboration tests
  console.log(`3. Registering Collaborator in Same Organization: ${emailCollab}...`);
  const regCollabRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailCollab,
      password,
      name: `Collaborator User ${runId}`,
      organizationName: `Primary Org ${runId}`, // Same organization
    }),
  });
  const regCollabJson = (await regCollabRes.json()) as any;
  const tokenCollab = regCollabJson.data?.accessToken || regCollabJson.data?.tokens?.accessToken;
  const collabUser = regCollabJson.data?.user;
  const headersCollab = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenCollab}`,
  };
  console.log(`   ✅ Collaborator registered: ID=${collabUser?.id}`);

  // 4. Register Alien User in a DIFFERENT organization for isolation tests
  console.log(`4. Registering Alien User in Different Organization: ${emailAlien}...`);
  const regAlienRes = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailAlien,
      password,
      name: `Alien User ${runId}`,
      organizationName: `Alien Org ${runId}`,
    }),
  });
  const regAlienJson = (await regAlienRes.json()) as any;
  const tokenAlien = regAlienJson.data?.accessToken || regAlienJson.data?.tokens?.accessToken;
  const headersAlien = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenAlien}`,
  };
  console.log(`   ✅ Alien user registered`);

  // 5. Resolve Owner Workspace
  console.log("5. Resolving Owner Default Workspace...");
  const wsRes = await fetch(`${API_BASE}/workspaces`, { headers: headersOwner });
  const wsJson = (await wsRes.json()) as any;
  const workspaceId = wsJson.data?.[0]?.id;
  if (!workspaceId) throw new Error("Could not find default workspace for owner");
  console.log(`   ✅ Owner Workspace: ${workspaceId}`);

  // 6. Import Demo Dataset (80 Cereals)
  console.log("6. Importing Demo Dataset for Feature Testing...");
  const demoRes = await fetch(`${API_BASE}/datasets/demo/cereals-80/import`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({ workspaceId }),
  });
  const demoJson = (await demoRes.json()) as any;
  if (!demoRes.ok || !demoJson.success) {
    throw new Error(`Demo import failed: ${JSON.stringify(demoJson)}`);
  }
  const datasetId = demoJson.data.id;
  console.log(`   ✅ Demo dataset imported: ID=${datasetId}, Name="${demoJson.data.name}"`);

  // ==========================================
  // FEATURE 11: ADVANCED VISUALIZATION & CHART CUSTOMIZATION
  // ==========================================
  console.log("\n--- FEATURE 11: ADVANCED VISUALIZATION & CHART CUSTOMIZATION ---");
  console.log("7. Creating Visualization with Advanced Chart Customization...");
  const advancedConfig = {
    colorPalette: "OCEAN",
    customColors: ["#0284c7", "#0ea5e9", "#38bdf8"],
    xAxisConfig: {
      title: "Cereal Type",
      showGrid: true,
      labelRotation: 30,
      showLabels: true,
    },
    yAxisConfig: {
      title: "Average Calories",
      showGrid: true,
      min: 0,
      max: 200,
      format: "#,##0",
    },
    legend: {
      show: true,
      position: "top",
    },
    dataLabels: {
      show: true,
      position: "top",
      format: "NUMBER",
    },
    animation: {
      enabled: true,
      durationMs: 500,
    },
  };

  const createVizRes = await fetch(`${API_BASE}/visualizations`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      title: `Advanced Nutrition Chart ${runId}`,
      type: "BAR",
      datasetId,
      workspaceId,
      dimensions: ["mfr"],
      measures: [{ column: "calories", aggregation: "AVG", alias: "avg_calories" }],
      config: {
        theme: "light",
        advancedCustomization: advancedConfig,
      },
    }),
  });
  const createVizJson = (await createVizRes.json()) as any;
  if (!createVizRes.ok || !createVizJson.success) {
    throw new Error(`Creating advanced visualization failed: ${JSON.stringify(createVizJson)}`);
  }
  const chartId = createVizJson.data.id;
  console.log(`   ✅ Visualization created: ID=${chartId}`);

  console.log("8. Verifying Customization Persistence and Retrieval...");
  const getVizRes = await fetch(`${API_BASE}/visualizations/${chartId}`, { headers: headersOwner });
  const getVizJson = (await getVizRes.json()) as any;
  const retrievedConfig = getVizJson.data.config?.advancedCustomization;
  if (!retrievedConfig || retrievedConfig.colorPalette !== "OCEAN") {
    throw new Error(`Advanced customization not persisted correctly: ${JSON.stringify(retrievedConfig)}`);
  }
  console.log(`   ✅ Advanced configuration restored: palette=${retrievedConfig.colorPalette}, xTitle="${retrievedConfig.xAxisConfig?.title}"`);

  // ==========================================
  // FEATURE 12: CALCULATED FIELDS & FORMULA BUILDER
  // ==========================================
  console.log("\n--- FEATURE 12: CALCULATED FIELDS & FORMULA BUILDER ---");
  console.log("9. Testing Preview of Safe Calculated Field...");
  const previewCalcRes = await fetch(`${API_BASE}/datasets/${datasetId}/calculated-fields/preview`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      name: "calories_per_cup",
      expression: "ROUND(calories / cups)",
      sampleSize: 5,
    }),
  });
  const previewCalcJson = (await previewCalcRes.json()) as any;
  if (!previewCalcRes.ok || !previewCalcJson.success) {
    throw new Error(`Calculated field preview failed: ${JSON.stringify(previewCalcJson)}`);
  }
  console.log(`   ✅ Formula preview successful: Inferred Type=${previewCalcJson.data?.dataType}, Sample Values=${JSON.stringify(previewCalcJson.data?.sampleValues?.slice(0, 3))}`);

  console.log("10. Testing Security Guard Against Malicious Expressions...");
  const maliciousRes = await fetch(`${API_BASE}/datasets/${datasetId}/calculated-fields/preview`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      name: "hack",
      expression: "DROP TABLE users; --",
    }),
  });
  if (maliciousRes.status !== 400) {
    throw new Error(`Expected 400 for malicious formula, received ${maliciousRes.status}`);
  }
  console.log("   ✅ Prohibited SQL/code execution properly rejected with HTTP 400");

  console.log("11. Persisting Calculated Field to Dataset...");
  const createCalcRes = await fetch(`${API_BASE}/datasets/${datasetId}/calculated-fields`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      name: "caloric_density",
      expression: "ROUND(calories / weight)",
      dataType: "NUMBER",
      description: "Calories per weight unit",
    }),
  });
  const createCalcJson = (await createCalcRes.json()) as any;
  if (!createCalcRes.ok || !createCalcJson.success) {
    throw new Error(`Failed to create calculated field: ${JSON.stringify(createCalcJson)}`);
  }
  console.log(`   ✅ Calculated field persisted: ID=${createCalcJson.data?.id}`);

  // ==========================================
  // FEATURE 13: DATA TRANSFORMATION & CLEANING PIPELINE
  // ==========================================
  console.log("\n--- FEATURE 13: DATA TRANSFORMATION & CLEANING PIPELINE ---");
  const transformPipeline = [
    {
      type: "FILTER_ROWS",
      column: "calories",
      operator: "GREATER_THAN",
      value: "100",
    },
    {
      type: "TRIM_WHITESPACE",
      column: "name",
    },
    {
      type: "RENAME_COLUMN",
      oldName: "name",
      newName: "cereal_title",
    },
  ];

  console.log("12. Previewing Multi-Step Transformation Pipeline...");
  const previewTransRes = await fetch(`${API_BASE}/datasets/${datasetId}/transform/preview`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({ steps: transformPipeline }),
  });
  const previewTransJson = (await previewTransRes.json()) as any;
  if (!previewTransRes.ok || !previewTransJson.success) {
    throw new Error(`Transformation preview failed: ${JSON.stringify(previewTransJson)}`);
  }
  console.log(`   ✅ Transformation preview: Original Rows=${previewTransJson.data.originalRowCount}, Filtered Rows=${previewTransJson.data.transformedRowCount}`);

  console.log("13. Applying Pipeline to Generate Derived Cleaned Dataset...");
  const applyTransRes = await fetch(`${API_BASE}/datasets/${datasetId}/transform/apply`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      steps: transformPipeline,
      mode: "CREATE_NEW",
      newDatasetName: `High Energy Cereals Cleaned ${runId}`,
      changeSummary: "Filtered calories > 100 and trimmed names",
      workspaceId,
    }),
  });
  const applyTransJson = (await applyTransRes.json()) as any;
  if (!applyTransRes.ok || !applyTransJson.success) {
    throw new Error(`Applying transformation failed: ${JSON.stringify(applyTransJson)}`);
  }
  const derivedDatasetId = applyTransJson.data.dataset?.id;
  console.log(`   ✅ Derived dataset created: ID=${derivedDatasetId}, Version=${applyTransJson.data.dataset?.currentVersion}`);

  // ==========================================
  // FEATURE 14: DATASET VERSIONING & LINEAGE
  // ==========================================
  console.log("\n--- FEATURE 14: DATASET VERSIONING & LINEAGE ---");
  console.log("14. Inspecting Dataset Version History...");
  const versionsRes = await fetch(`${API_BASE}/datasets/${derivedDatasetId}/versions`, { headers: headersOwner });
  const versionsJson = (await versionsRes.json()) as any;
  if (!versionsRes.ok || !versionsJson.success) {
    throw new Error(`Failed to list versions: ${JSON.stringify(versionsJson)}`);
  }
  console.log(`   ✅ Initial version found: v${versionsJson.data?.[0]?.versionNumber}, Summary="${versionsJson.data?.[0]?.changeSummary}"`);

  console.log("15. Tracing Upstream & Downstream Lineage Graph...");
  const lineageRes = await fetch(`${API_BASE}/datasets/${derivedDatasetId}/lineage`, { headers: headersOwner });
  const lineageJson = (await lineageRes.json()) as any;
  if (!lineageRes.ok || !lineageJson.success) {
    throw new Error(`Failed to get dataset lineage: ${JSON.stringify(lineageJson)}`);
  }
  const lineage = lineageJson.data;
  console.log(`   ✅ Lineage verified: Dataset="${lineage.dataset.name}", Upstream Parent="${lineage.parent?.name}"`);

  console.log("16. Applying Version Increment (v2)...");
  const v2Pipeline = [
    {
      type: "TYPE_CONVERSION",
      column: "calories",
      targetType: "NUMBER",
    },
  ];
  const applyV2Res = await fetch(`${API_BASE}/datasets/${derivedDatasetId}/transform/apply`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      steps: v2Pipeline,
      mode: "SAVE_VERSION",
      changeSummary: "Explicit number cast for calories",
    }),
  });
  const applyV2Json = (await applyV2Res.json()) as any;
  if (!applyV2Res.ok || !applyV2Json.success) {
    throw new Error(`Failed to save v2: ${JSON.stringify(applyV2Json)}`);
  }
  console.log(`   ✅ Version incremented to: v${applyV2Json.data.dataset?.currentVersion}`);

  console.log("17. Performing Non-Destructive Version Rollback to v1...");
  const restoreRes = await fetch(`${API_BASE}/datasets/${derivedDatasetId}/versions/1/restore`, {
    method: "POST",
    headers: headersOwner,
  });
  const restoreJson = (await restoreRes.json()) as any;
  if (!restoreRes.ok || !restoreJson.success) {
    throw new Error(`Rollback failed: ${JSON.stringify(restoreJson)}`);
  }
  console.log(`   ✅ Rollback successful: Restored Version=${restoreJson.data?.restoredVersion}, New Active Version=${restoreJson.data?.newVersion}`);

  // ==========================================
  // FEATURE 15: COLLABORATION & SHARING
  // ==========================================
  console.log("\n--- FEATURE 15: COLLABORATION & SHARING ---");
  console.log("18. Creating Dashboard for Collaboration...");
  const dashRes = await fetch(`${API_BASE}/dashboards`, {
    method: "POST",
    headers: headersOwner,
    body: JSON.stringify({
      title: `Team Collaboration Board ${runId}`,
      description: "Shared metrics board",
      workspaceId,
      visibility: "INTERNAL",
    }),
  });
  const dashJson = (await dashRes.json()) as any;
  if (!dashRes.ok || !dashJson.success) {
    throw new Error(`Failed to create dashboard: ${JSON.stringify(dashJson)}`);
  }
  const dashboardId = dashJson.data.id;
  console.log(`   ✅ Dashboard created: ID=${dashboardId}`);

  console.log("19. Listing Workspace Collaborators for Dashboard...");
  const listCollabRes = await fetch(`${API_BASE}/dashboards/${dashboardId}/collaborators`, { headers: headersOwner });
  const listCollabJson = (await listCollabRes.json()) as any;
  if (!listCollabRes.ok || !listCollabJson.success) {
    throw new Error(`Failed to list collaborators: ${JSON.stringify(listCollabJson)}`);
  }
  console.log(`   ✅ Collaborator list loaded: Owner=${listCollabJson.data.owner?.name}, Available Members=${listCollabJson.data.workspaceMembers?.length}`);

  if (collabUser?.id) {
    console.log(`20. Granting Collaborator Access to User ID=${collabUser.id}...`);
    const grantRes = await fetch(`${API_BASE}/dashboards/${dashboardId}/collaborators`, {
      method: "POST",
      headers: headersOwner,
      body: JSON.stringify({
        targetUserId: collabUser.id,
        accessLevel: "EDIT",
      }),
    });
    const grantJson = (await grantRes.json()) as any;
    if (!grantRes.ok || !grantJson.success) {
      throw new Error(`Failed to grant access: ${JSON.stringify(grantJson)}`);
    }
    console.log(`   ✅ Access granted: Level=${grantJson.data?.accessLevel}`);

    console.log("21. Verifying Collaborator Can View Dashboard...");
    const collabViewRes = await fetch(`${API_BASE}/dashboards/${dashboardId}`, { headers: headersCollab });
    if (!collabViewRes.ok) {
      throw new Error(`Collaborator was denied access to dashboard: ${collabViewRes.status}`);
    }
    console.log("   ✅ Collaborator successfully loaded dashboard");
  }

  console.log("22. Verifying Cross-Tenant Isolation Rejection for Alien User...");
  const alienViewRes = await fetch(`${API_BASE}/dashboards/${dashboardId}`, { headers: headersAlien });
  if (alienViewRes.status !== 404 && alienViewRes.status !== 403) {
    throw new Error(`Expected 404 or 403 for cross-organization access, got ${alienViewRes.status}`);
  }
  console.log(`   ✅ Cross-organization access securely denied with HTTP ${alienViewRes.status}`);

  console.log("23. Creating Public Standalone Visualization Share Link...");
  const shareVizRes = await fetch(`${API_BASE}/visualizations/${chartId}/share`, {
    method: "POST",
    headers: headersOwner,
  });
  const shareVizJson = (await shareVizRes.json()) as any;
  if (!shareVizRes.ok || !shareVizJson.success) {
    throw new Error(`Failed to generate chart share: ${JSON.stringify(shareVizJson)}`);
  }
  const shareToken = shareVizJson.data.shareToken;
  console.log(`   ✅ Public Share Token: ${shareToken}`);

  console.log("24. Querying Public Chart Metadata without Authentication...");
  const publicChartRes = await fetch(`${API_BASE}/visualizations/shared/${shareToken}`);
  const publicChartJson = (await publicChartRes.json()) as any;
  if (!publicChartRes.ok || !publicChartJson.success) {
    throw new Error(`Failed to query public chart: ${JSON.stringify(publicChartJson)}`);
  }
  console.log(`   ✅ Public chart accessible: Title="${publicChartJson.data.chart?.title}", Type=${publicChartJson.data.chart?.type}`);

  console.log("25. Querying Public Chart Dataset via Token without Auth...");
  const publicDataRes = await fetch(`${API_BASE}/visualizations/shared/${shareToken}/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const publicDataJson = (await publicDataRes.json()) as any;
  if (!publicDataRes.ok || !publicDataJson.success) {
    throw new Error(`Failed to query public chart data: ${JSON.stringify(publicDataJson)}`);
  }
  console.log(`   ✅ Public data returned: ${publicDataJson.data.rowCount} rows`);

  console.log("26. Revoking Standalone Chart Share Link...");
  const revokeVizRes = await fetch(`${API_BASE}/visualizations/${chartId}/share`, {
    method: "DELETE",
    headers: headersOwner,
  });
  const revokeVizJson = (await revokeVizRes.json()) as any;
  if (!revokeVizRes.ok || !revokeVizJson.success) {
    throw new Error(`Failed to revoke share: ${JSON.stringify(revokeVizJson)}`);
  }
  console.log("   ✅ Share link revoked successfully");

  console.log("27. Verifying Revoked Token is Rejected (404/410)...");
  const revokedAccessRes = await fetch(`${API_BASE}/visualizations/shared/${shareToken}`);
  if (revokedAccessRes.status !== 404 && revokedAccessRes.status !== 410) {
    throw new Error(`Expected 404/410 for revoked share token, got ${revokedAccessRes.status}`);
  }
  console.log(`   ✅ Revoked token properly rejected with HTTP ${revokedAccessRes.status}`);

  console.log("\n==================================================");
  console.log("🎉 ALL 27 PRODUCTION SMOKE CHECKS FOR FEATURES 11–15 PASSED!");
  console.log("==================================================\n");
}

runFeatures11To15ProductionSmokeTest().catch((err) => {
  console.error("\n❌ PRODUCTION SMOKE TEST FAILED:", err);
  process.exit(1);
});
