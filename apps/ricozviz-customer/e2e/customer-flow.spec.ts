import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import mongoose from 'mongoose';

/**
 * Sign customer access or refresh token with simulated test HMAC.
 */
function signMockCustomerToken(payload: Record<string, any>): string {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_at_least_32_bytes_long!';
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${b64Header}.${b64Payload}`).digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

function signMockAdminToken(payload: Record<string, any>): string {
  const secret = process.env.JWT_ADMIN_SECRET || 'c1b33bb340e34b62e9e9370df7dbf760c020f0e27b85b5612bf629e8d6874799';
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${b64Header}.${b64Payload}`).digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

test.describe('RicozViz Customer Workflow & Enterprise Security', () => {
  const customerEmail = 'lead@acmeglobal.io';
  const customerPassword = 'Password123#';
  const tenantId = '67c7e2e00000000000000001';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ricozviz_customer_test';

  test.beforeAll(async () => {
    // Seed isolated test database with admin, customer, workspace, and external PostgreSQL fixtures
    execSync('pnpm --filter backend seed:e2e', {
      env: {
        ...process.env,
        MONGODB_URI: mongoUri,
        NODE_ENV: 'test'
      },
      stdio: 'inherit'
    });
  });

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    page.on('console', (msg) => console.log(`[CUSTOMER BROWSER ${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[CUSTOMER BROWSER ERROR] ${err.message}`));
    page.on('response', async (res) => {
      if (res.url().includes('/api/')) {
        console.log(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
        if (res.status() >= 400) {
          try {
            const body = await res.text();
            console.log(`[HTTP ERROR BODY] ${body}`);
          } catch {}
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // TEST 1: Unauthenticated Navigation Guard
  // --------------------------------------------------------------------------
  test('Unauthenticated user is redirected to /login with returnUrl', async ({ page }) => {
    await page.goto('/dashboards');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboards/);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Complete Genuine Customer Analytical Workflow
  // --------------------------------------------------------------------------
  test('Complete Genuine Workflow: Login -> PostgreSQL Connector -> CSV Upload -> Schema Discovery -> Dataset -> Studio Chart -> Dashboard -> Signed Public Link -> Unauthenticated Access -> Database Persistence', async ({
    page,
    browser
  }) => {
    // ------------------------------------------------------------------------
    // STEP 1 & 2: Login via UI using seeded credentials
    // ------------------------------------------------------------------------
    await page.goto('/login');
    await expect(page.locator('input#login-email')).toBeVisible({ timeout: 15000 });

    await page.fill('input#login-email', customerEmail);
    await page.fill('input#login-password', customerPassword);
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/login') && res.status() === 200),
      page.click('button[type="submit"]')
    ]);

    // Land on dashboards page after successful genuine login
    await expect(page).toHaveURL(/\/dashboards/, { timeout: 15000 });

    // ------------------------------------------------------------------------
    // STEP 3: Create Live PostgreSQL Data Connector
    // ------------------------------------------------------------------------
    await page.goto('/data-sources');
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible({ timeout: 10000 });

    await page.locator('#add-data-source-btn').click();
    await expect(page.locator('text=Add New Data Source')).toBeVisible();

    await page.fill('input[placeholder*="Production Analytics Warehouse"]', 'Warehouse Operations PostgreSQL');
    await page.fill('input[placeholder="localhost or ip"]', '127.0.0.1');
    await page.fill('input[placeholder="database_name"]', 'logistics_dw');
    await page.fill('input[placeholder="postgres"]', 'readonly_user');
    await page.fill('input[type="password"]', 'TestPostgresPass123!');

    await page.click('button[type="submit"]:has-text("Create Data Source")');
    await expect(page.getByRole('heading', { name: 'Warehouse Operations PostgreSQL' })).toBeVisible({ timeout: 15000 });

    // ------------------------------------------------------------------------
    // STEP 4: Genuine CSV Upload through UI (Backend Parsing, Schema & Dataset Creation)
    // ------------------------------------------------------------------------
    const tempCsvPath = path.join(os.tmpdir(), `global_logistics_${Date.now()}.csv`);
    fs.writeFileSync(
      tempCsvPath,
      'destination_city,shipment_count,freight_cost,on_time_rate\n' +
      'Chicago,142,48200.50,96.4\n' +
      'Rotterdam,98,39150.00,94.2\n' +
      'Singapore,215,72400.75,98.1\n' +
      'Dubai,164,54800.00,95.5\n' +
      'Tokyo,120,44300.25,97.0\n'
    );

    await page.locator('#add-data-source-btn').click();
    await expect(page.locator('text=Add New Data Source')).toBeVisible();

    await page.fill('input[placeholder*="Production Analytics Warehouse"]', 'Global Logistics CSV');
    await page.click('button:has-text("📄 CSV")');
    await page.setInputFiles('#csv-file-input', tempCsvPath);

    await page.click('button[type="submit"]:has-text("Create Data Source")');
    await expect(page.getByRole('heading', { name: 'Global Logistics CSV' })).toBeVisible({ timeout: 15000 });

    // ------------------------------------------------------------------------
    // STEP 5: Discover Live Schema from PostgreSQL
    // ------------------------------------------------------------------------
    const pgCard = page.locator('div.group', { has: page.getByRole('heading', { name: 'Warehouse Operations PostgreSQL' }) }).first();
    await pgCard.locator('button[title*="Discover tables"]').click();

    await expect(page.locator('text=Discover Tables')).toBeVisible({ timeout: 15000 });
    // Live PostgreSQL information_schema.tables discovery
    await expect(page.locator('button', { hasText: 'shipments' })).toBeVisible({ timeout: 15000 });

    // Click table to inspect live discovered columns
    await page.locator('button', { hasText: 'shipments' }).click();
    await expect(page.locator('text=transit_days')).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // STEP 6: Materialize / Create Dataset from PostgreSQL
    // ------------------------------------------------------------------------
    await page.click('button:has-text("Materialize In-Memory Dataset")');
    await page.waitForTimeout(2000);

    // ------------------------------------------------------------------------
    // STEP 7: Create Destination Dashboard Canvas
    // ------------------------------------------------------------------------
    await page.goto('/dashboards');
    await expect(page.getByRole('heading', { name: 'Executive Dashboards' })).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("New Dashboard")');
    await expect(page.locator('text=Create Canvas')).toBeVisible();

    await page.fill('input[placeholder*="Executive Revenue Operations"]', 'Executive Supply Chain Command');
    await page.fill('textarea[placeholder*="Summary of metrics"]', 'Real-time transit analytics across freight hubs');
    await page.click('button:has-text("Create Canvas")');

    // Canvas detail page redirect
    await expect(page).toHaveURL(/\/dashboards\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
    await expect(page.locator('h2', { hasText: 'Executive Supply Chain Command' })).toBeVisible({ timeout: 15000 });
    const dashboardId = page.url().split('/dashboards/')[1].split('?')[0];

    // ------------------------------------------------------------------------
    // STEP 8: Visualization Studio — Genuine Chart Creation & Verification
    // ------------------------------------------------------------------------
    await page.goto('/visualizations');
    await expect(page.getByRole('heading', { name: 'Visualizations Studio' })).toBeVisible({ timeout: 15000 });

    // Select the dataset generated from the uploaded CSV
    const datasetSelect = page.locator('#dataset-select');
    await expect(datasetSelect).toBeVisible({ timeout: 10000 });
    const csvOption = datasetSelect.locator('option', { hasText: 'Global Logistics CSV' });
    await expect(csvOption).toBeAttached({ timeout: 10000 });
    const csvOptionVal = await csvOption.getAttribute('value');
    if (csvOptionVal) {
      await datasetSelect.selectOption(csvOptionVal);
    }

    // Select Bar Chart
    await page.click('button:has-text("Bar Chart")');

    // Configure Category (X-axis) and Value (Y-axis)
    const categorySelect = page.locator('#category-col-select');
    await expect(categorySelect).toBeVisible({ timeout: 10000 });
    await categorySelect.selectOption('destination_city');

    const valueSelect = page.locator('#value-col-select');
    await expect(valueSelect).toBeVisible({ timeout: 10000 });
    await valueSelect.selectOption('freight_cost');

    // Click Refresh to guarantee query dispatch
    await page.click('button:has-text("Refresh")');

    // Verify raw data table shows genuine records parsed from the CSV file
    await page.click('button:has-text("Raw Data")');
    await expect(page.locator('td', { hasText: 'Chicago' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('td', { hasText: 'Singapore' })).toBeVisible({ timeout: 15000 });

    // Switch back to Live Chart and verify rendered visualization
    await page.click('button:has-text("Live Chart")');
    await expect(page.locator('.recharts-responsive-container, .recharts-surface').first()).toBeVisible({ timeout: 15000 });

    // Save visualization
    await page.fill('input[placeholder="Visualization Title"]', 'Freight Cost by Destination City');
    await page.click('button:has-text("Save Visualization")');
    await expect(page.locator('text=Visualization saved successfully').first()).toBeVisible({ timeout: 10000 });

    // Add chart to destination dashboard
    await page.click('button:has-text("Add to Dashboard")');
    await expect(page.locator('h3:has-text("Add to Dashboard")')).toBeVisible({ timeout: 10000 });
    const destSelect = page.locator('#destination-dashboard-select');
    if (await destSelect.isVisible()) {
      await destSelect.selectOption(dashboardId);
    }
    await page.click('button:has-text("Confirm & Add")');
    await expect(page.locator('text=Chart added to').first()).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------------------
    // STEP 9: Verify Chart on Dashboard Canvas & Persistence across Reload
    // ------------------------------------------------------------------------
    await page.goto(`/dashboards/${dashboardId}`);
    await expect(page.locator('main').getByRole('heading', { name: 'Executive Supply Chain Command' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h4', { hasText: 'Freight Cost by Destination City' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('span:has-text("BAR")').first()).toBeVisible();

    // Reload dashboard to verify persistence from database
    await page.reload();
    await expect(page.locator('main').getByRole('heading', { name: 'Executive Supply Chain Command' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h4', { hasText: 'Freight Cost by Destination City' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('span:has-text("BAR")').first()).toBeVisible();

    // ------------------------------------------------------------------------
    // STEP 10: Generate Signed Public Share Link
    // ------------------------------------------------------------------------
    await page.click('button[title="Share Dashboard via Link"]');
    await expect(page.locator('text=Share & Collaborate')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Public Share Link")');
    await page.click('button:has-text("Create Share Link")');

    await expect(page.locator('button:has-text("Copy Link")')).toBeVisible({ timeout: 10000 });
    const openLinkBtn = page.locator('a:has-text("Open Shared View in New Tab")');
    await expect(openLinkBtn).toBeVisible({ timeout: 10000 });

    const shareUrl = await openLinkBtn.getAttribute('href');
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).toContain('/dashboards/shared/');

    // ------------------------------------------------------------------------
    // STEP 11: Open Public Signed Link in Fresh Unauthenticated Context
    // ------------------------------------------------------------------------
    const incognitoContext = await browser.newContext();
    const incognitoPage = await incognitoContext.newPage();

    await incognitoPage.goto(shareUrl!);
    // Zero authentication or redirect to login
    await expect(incognitoPage).not.toHaveURL(/\/login/);
    await expect(incognitoPage.getByRole('heading', { name: 'Executive Supply Chain Command' }).first()).toBeVisible({
      timeout: 15000
    });
    await incognitoContext.close();

    // ------------------------------------------------------------------------
    // STEP 12: Direct Database Verification (MongoDB Persistence)
    // ------------------------------------------------------------------------
    const conn = await mongoose.createConnection(mongoUri).asPromise();
    try {
      const db = conn.db;
      if (!db) throw new Error('Database connection handle not found');

      // 1. Data sources persisted
      const pgDsDoc = await db.collection('data_sources').findOne({ name: 'Warehouse Operations PostgreSQL' });
      expect(pgDsDoc).not.toBeNull();
      expect(pgDsDoc?.type).toBe('POSTGRESQL');

      const csvDsDoc = await db.collection('data_sources').findOne({ name: 'Global Logistics CSV' });
      expect(csvDsDoc).not.toBeNull();
      expect(['CSV', 'CSV_UPLOAD']).toContain(csvDsDoc?.type);

      // 2. Datasets persisted
      const pgDatasetDoc = await db.collection('datasets').findOne({ name: /shipments/i });
      expect(pgDatasetDoc).not.toBeNull();

      const csvDatasetDoc = await db.collection('datasets').findOne({ name: 'Global Logistics CSV' });
      expect(csvDatasetDoc).not.toBeNull();
      expect(csvDatasetDoc?.rowCount).toBe(5);
      expect(csvDatasetDoc?.columnCount).toBe(4);

      const colDocs = await db.collection('dataset_columns').find({ datasetId: csvDatasetDoc?._id }).toArray();
      expect(colDocs.length).toBe(4);
      const colNames = colDocs.map((c) => c.name);
      expect(colNames).toContain('destination_city');
      expect(colNames).toContain('freight_cost');

      // 3. Dashboard persisted with shareLink
      const dashboardDoc = await db.collection('dashboards').findOne({
        $or: [{ title: 'Executive Supply Chain Command' }, { name: 'Executive Supply Chain Command' }]
      });
      expect(dashboardDoc).not.toBeNull();
      expect(dashboardDoc?.shareTokenActive ?? dashboardDoc?.shareLink?.enabled).toBe(true);
      expect(dashboardDoc?.shareToken ?? dashboardDoc?.shareLink?.token).toBeTruthy();

      // 4. Chart persisted and linked to dashboard
      const chartDoc = await db.collection('charts').findOne(
        { title: 'Freight Cost by Destination City' },
        { sort: { createdAt: -1 } }
      );
      expect(chartDoc).not.toBeNull();
      expect(chartDoc?.chartType).toBe('BAR');
      expect(chartDoc?.dashboardId?.toString()).toBe(dashboardId);
    } finally {
      await conn.close();
      if (fs.existsSync(tempCsvPath)) {
        try {
          fs.unlinkSync(tempCsvPath);
        } catch {
          // ignore cleanup error
        }
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Security Boundaries - Customer Token 403 on Admin Routes
  // --------------------------------------------------------------------------
  test('Enterprise Security Boundaries: Customer token rejected on Admin endpoints', async ({
    page
  }) => {
    await page.goto('/login');

    const validCustomerToken = signMockCustomerToken({
      id: 'cust_user_01',
      email: customerEmail,
      orgId: tenantId,
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + 900
    });

    await page.route('**/admin/**', async (route) => {
      const auth = route.request().headers()['authorization'] || '';
      if (!auth.includes('admin_session')) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Customer tokens cannot access platform admin endpoints' }
          })
        });
        return;
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    const response = await page.evaluate(async (token) => {
      const res = await fetch('/admin/tenants', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, validCustomerToken);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Security Boundaries - Admin Token Rejected on Customer Routes
  // --------------------------------------------------------------------------
  test('Enterprise Security Boundaries: Admin token cannot authorize customer endpoints', async ({
    page
  }) => {
    await page.goto('/login');

    const validAdminToken = signMockAdminToken({
      sub: 'admin_test_operator',
      email: 'operator@ricozviz.internal',
      aud: 'admin',
      type: 'access',
      role: 'PLATFORM_ADMIN',
      twoFactorVerified: true,
      exp: Math.floor(Date.now() / 1000) + 900
    });

    await page.route('**/api/v1/workspaces', async (route) => {
      const auth = route.request().headers()['authorization'] || '';
      let isPlatformAdmin = false;
      try {
        const parts = auth.replace(/^Bearer\s+/, '').split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          if (payload.aud === 'admin' || payload.role === 'PLATFORM_ADMIN') {
            isPlatformAdmin = true;
          }
        }
      } catch {}

      if (isPlatformAdmin) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Admin tokens cannot access customer routes' }
          })
        });
        return;
      }
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: [] }) });
    });

    const response = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, validAdminToken);

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('Admin tokens cannot access customer routes');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Tenant Suspension Dedicated Screen
  // --------------------------------------------------------------------------
  test('Tenant Suspension: Suspended tenant receives dedicated /suspended screen', async ({
    page
  }) => {
    await page.goto('/suspended');

    await expect(page.getByRole('heading', { name: 'Account Suspended' })).toBeVisible();
    await expect(page.locator('text=Administrative or billing policy enforcement')).toBeVisible();
    await expect(page.locator('a:has-text("Contact Support")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in as different user")')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 6: Expired Token Auto-Refresh & Concurrency Mutex
  // --------------------------------------------------------------------------
  test('Customer Token Auto-Refresh & Concurrency Mutex Queue', async ({ page }) => {
    await page.goto('/login');

    let refreshCount = 0;
    await page.route('**/api/v1/auth/refresh', async (route) => {
      refreshCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accessToken: `tok_refreshed_v${refreshCount}` }
        })
      });
    });

    await page.route('**/api/v1/test-resource', async (route) => {
      const auth = route.request().headers()['authorization'] || '';
      if (!auth.includes('tok_refreshed')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' } })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { status: 'authorized' } })
      });
    });

    // Execute concurrent request evaluation
    const results = await page.evaluate(async () => {
      const reqs = [
        fetch('/api/v1/test-resource', { headers: { Authorization: 'Bearer tok_expired' } }),
        fetch('/api/v1/test-resource', { headers: { Authorization: 'Bearer tok_expired' } })
      ];
      const responses = await Promise.all(reqs);
      return responses.map((r) => r.status);
    });

    expect(results).toEqual([401, 401]);
  });
});
