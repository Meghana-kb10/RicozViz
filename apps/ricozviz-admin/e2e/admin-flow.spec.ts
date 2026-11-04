import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

/**
 * RFC 6238 Time-based One-Time Password generator (Node native crypto).
 */
function generateTotp(secretBase32: string): string {
  const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = secretBase32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}

function signMockAdminSessionToken(payload: Record<string, any>): string {
  const secret =
    process.env.JWT_ADMIN_SECRET ||
    'c1b33bb340e34b62e9e9370df7dbf760c020f0e27b85b5612bf629e8d6874799';
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${b64Header}.${b64Payload}`).digest('base64url');
  return `${b64Header}.${b64Payload}.${signature}`;
}

test.describe('Platform Operator Admin Portal Security & Workflows', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err.message}`));
  });

  test('Unauthenticated requests to protected admin routes redirect to /login', async ({ page }) => {
    // Attempt navigating directly to /overview without session cookie
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Foverview/);

    // Attempt navigating to /tenants
    await page.goto('/tenants');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftenants/);

    // Attempt navigating to /audit
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Faudit/);
  });

  test('Cross-boundary token rejection: customer session cookie cannot access admin routes', async ({
    context,
    page
  }) => {
    // Seed browser context with customer session cookie
    await context.addCookies([
      {
        name: 'rv_customer_session',
        value: 'customer-access-token-placeholder',
        domain: 'localhost',
        path: '/'
      }
    ]);

    // Try accessing admin overview
    await page.goto('/overview');

    // Edge middleware must reject since rv_admin_session is missing
    await expect(page).toHaveURL(/\/login/);
  });

  test('Admin login interface displays lockout and rate-limit security boundaries', async ({
    page
  }) => {
    await page.goto('/login');

    await expect(page.locator('text=PLATFORM OPERATOR PORTAL')).toBeVisible();
    await expect(page.locator('input#admin-email')).toBeVisible();
    await expect(page.locator('input#admin-password')).toBeVisible();

    // Invalid credentials attempt
    await page.fill('input#admin-email', 'invalid-operator@ricozviz.internal');
    await page.fill('input#admin-password', 'wrong-password-1234');
    await page.click('button[type="submit"]');

    // Error alert banner appears
    await expect(page.locator('text=Authentication Blocked')).toBeVisible({ timeout: 5000 });
  });

  test('End-to-End Operator Lifecycle: TOTP 2FA Login -> Suspend Tenant -> Customer 403 -> Unsuspend -> Customer 200 -> Audit Ledger Verification', async ({
    page,
    request
  }) => {
    const adminEmail = 'operator@ricozviz.internal';
    const adminPassword = 'Str0ngPlatformAdmin!2026#';
    const totpSecret = 'JBSWY3DPEHPK3PXP'; // Base32 RFC 6238 seed
    const tenantName = 'Acme Global Logistics';
    const suspendReason = 'Critical compliance hold: pending AML verification';
    const unsuspendReason = 'Compliance audit cleared satisfactorily by legal';

    let tenantStatus = 'ACTIVE';
    const auditLedger: any[] = [];

    const mockRefreshToken = signMockAdminSessionToken({
      sub: 'admin_test_operator',
      email: adminEmail,
      aud: 'admin',
      type: 'refresh',
      role: 'PLATFORM_ADMIN',
      twoFactorVerified: true,
      exp: Math.floor(Date.now() / 1000) + 7 * 86400
    });

    const mockAccessToken = signMockAdminSessionToken({
      sub: 'admin_test_operator',
      email: adminEmail,
      name: 'Platform Operator Lead',
      aud: 'admin',
      type: 'access',
      role: 'PLATFORM_ADMIN',
      twoFactorVerified: true,
      exp: Math.floor(Date.now() / 1000) + 900
    });

    // Intercept backend & BFF auth and operational endpoints
    await page.route('**/api/auth/login', async (route) => {
      const body = route.request().postDataJSON() || {};
      if (body.email === adminEmail && body.password === adminPassword) {
        if (!body.totpCode) {
          // Password verified, prompts for 2FA
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              requires2Fa: true,
              user: {
                id: 'admin_test_operator',
                email: adminEmail,
                role: 'PLATFORM_ADMIN',
                twoFactorEnabled: true
              }
            })
          });
          return;
        }

        // TOTP verification step
        const currentCode = generateTotp(totpSecret);
        if (body.totpCode === currentCode) {
          await page.context().addCookies([
            {
              name: 'rv_admin_session',
              value: mockRefreshToken,
              domain: 'localhost',
              path: '/'
            }
          ]);

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: {
              'Set-Cookie': `rv_admin_session=${mockRefreshToken}; Path=/; HttpOnly; SameSite=Lax`
            },
            body: JSON.stringify({
              accessToken: mockAccessToken,
              refreshToken: mockRefreshToken,
              user: {
                id: 'admin_test_operator',
                email: adminEmail,
                name: 'Platform Operator Lead',
                role: 'PLATFORM_ADMIN',
                twoFactorEnabled: true
              }
            })
          });
          return;
        }
      }

      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: mockAccessToken
        })
      });
    });

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'admin_test_operator',
            email: adminEmail,
            name: 'Platform Operator Lead',
            role: 'PLATFORM_ADMIN',
            twoFactorEnabled: true
          }
        })
      });
    });

    await page.route(/\/admin\/users/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            users: [],
            total: 840,
            limit: 10,
            offset: 0
          }
        })
      });
    });

    await page.route(/\/admin\/workers\/health/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            status: 'HEALTHY',
            locksHeld: 0
          }
        })
      });
    });

    await page.route('**/admin/overview/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            totalTenants: 12,
            activeUsers: 840,
            workerHealth: 'HEALTHY',
            aiCostThisMonthUsd: 148.5
          }
        })
      });
    });

    await page.route('**/admin/system/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { status: 'HEALTHY', database: 'CONNECTED', uptimeSeconds: 142000 }
        })
      });
    });

    await page.route(/\/admin\/system\/ai-usage/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            totalTokens: 2500000,
            estimatedCostUsd: 148.5,
            totalRequests: 120,
            byTenant: []
          }
        })
      });
    });

    await page.route(/\/admin\/tenants/, async (route) => {
      const url = route.request().url();
      if (url.includes('/suspend')) {
        const payload = route.request().postDataJSON() || {};
        tenantStatus = 'SUSPENDED';
        auditLedger.unshift({
          id: `audit_${Date.now()}_1`,
          sequenceNumber: 101,
          action: 'ADMIN_TENANT_SUSPENDED',
          resourceType: 'ORGANIZATION',
          resourceId: 'tenant_acme_01',
          userId: 'admin_test_operator',
          ipAddress: '127.0.0.1',
          currentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
          createdAt: new Date().toISOString(),
          metadata: {
            adminEmail,
            reason: payload.reason,
            previousStatus: 'ACTIVE',
            newStatus: 'SUSPENDED'
          }
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'tenant_acme_01', status: 'SUSPENDED', message: 'Tenant successfully suspended' }
          })
        });
        return;
      }

      if (url.includes('/unsuspend')) {
        const payload = route.request().postDataJSON() || {};
        tenantStatus = 'ACTIVE';
        auditLedger.unshift({
          id: `audit_${Date.now()}_2`,
          sequenceNumber: 102,
          action: 'ADMIN_TENANT_UNSUSPENDED',
          resourceType: 'ORGANIZATION',
          resourceId: 'tenant_acme_01',
          userId: 'admin_test_operator',
          ipAddress: '127.0.0.1',
          currentHash: 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb',
          previousHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          createdAt: new Date().toISOString(),
          metadata: {
            adminEmail,
            reason: payload.reason,
            previousStatus: 'SUSPENDED',
            newStatus: 'ACTIVE'
          }
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { id: 'tenant_acme_01', status: 'ACTIVE', message: 'Tenant successfully restored' }
          })
        });
        return;
      }

      // Default tenants list
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            tenants: [
              {
                id: 'tenant_acme_01',
                name: tenantName,
                slug: 'acme-global-logistics',
                status: tenantStatus,
                plan: 'ENTERPRISE',
                memberCount: 24,
                workspaceCount: 4,
                datasetCount: 18,
                dashboardCount: 12,
                createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
                updatedAt: new Date().toISOString()
              }
            ],
            total: 1,
            limit: 20,
            offset: 0
          }
        })
      });
    });

    await page.route(/\/admin\/audit/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            logs: auditLedger,
            total: auditLedger.length,
            limit: 50,
            offset: 0
          }
        })
      });
    });

    // Customer route handler simulation: validates tenantStatus suspension boundary
    await page.route('**/api/v1/auth/login', async (route) => {
      if (tenantStatus === 'SUSPENDED') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Organization account is suspended. Contact your platform administrator.'
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: 'customer_access_token_valid',
            user: { email: 'lead@acmeglobal.io', organizationId: 'tenant_acme_01' }
          }
        })
      });
    });

    // --------------------------------------------------------------------------
    // STEP 1: Operator Login & RFC 6238 TOTP Two-Factor Authentication
    // --------------------------------------------------------------------------
    await page.goto('/login');

    await page.fill('input#admin-email', adminEmail);
    await page.fill('input#admin-password', adminPassword);
    await page.click('button[type="submit"]');

    // Land on /login/2fa
    await expect(page).toHaveURL(/\/login\/2fa/);
    await expect(page.locator('text=TWO-FACTOR VERIFICATION')).toBeVisible();

    // Dynamically calculate valid 6-digit TOTP code for current window
    const dynamicTotp = generateTotp(totpSecret);
    await page.fill('input#totp-code', dynamicTotp);
    await page.click('button[type="submit"]');

    // Successfully land on /overview
    await expect(page).toHaveURL(/\/overview/);
    await expect(page.locator('text=Platform Operator Console')).toBeVisible();

    // --------------------------------------------------------------------------
    // STEP 2: Navigate to Tenants & Suspend Tenant with Typed Confirmation
    // --------------------------------------------------------------------------
    await page.goto('/tenants');
    await expect(page.locator(`text=${tenantName}`)).toBeVisible();

    // Open Suspend Dialog
    await page.click('button:has-text("Suspend")');
    await expect(page.locator(`text=Suspend Organization: ${tenantName}`)).toBeVisible();

    // Verify confirmation button disabled before exact name match & reason
    const confirmBtn = page.locator('button:has-text("Suspend Organization")');
    await expect(confirmBtn).toBeDisabled();

    // Type exact tenant name and mandatory reason
    await page.fill(`input[placeholder="${tenantName}"]`, tenantName);
    await page.fill('textarea', suspendReason);
    await expect(confirmBtn).toBeEnabled();

    // Submit suspension
    await confirmBtn.click();
    await expect(page.locator('text=Tenant Suspended')).toBeVisible();

    // --------------------------------------------------------------------------
    // STEP 3: Customer Login Boundary Check (403 Forbidden on Suspended Tenant)
    // --------------------------------------------------------------------------
    const customerLoginBlocked = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lead@acmeglobal.io', password: 'Password123#' })
      });
      return { status: res.status, body: await res.json() };
    });

    expect(customerLoginBlocked.status).toBe(403);
    expect(customerLoginBlocked.body.error.message).toContain('Organization account is suspended');

    // --------------------------------------------------------------------------
    // STEP 4: Unsuspend Tenant with Justification Reason
    // --------------------------------------------------------------------------
    await page.click('button:has-text("Unsuspend")');
    await expect(page.locator(`text=Unsuspend Organization: ${tenantName}`)).toBeVisible();

    const restoreBtn = page.locator('button:has-text("Restore Access")');
    await expect(restoreBtn).toBeDisabled(); // Requires reason

    await page.fill('textarea', unsuspendReason);
    await expect(restoreBtn).toBeEnabled();
    await restoreBtn.click();

    await expect(page.locator('text=Tenant Restored')).toBeVisible();

    // --------------------------------------------------------------------------
    // STEP 5: Customer Login Restored (200 OK)
    // --------------------------------------------------------------------------
    const customerLoginRestored = await page.evaluate(async () => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lead@acmeglobal.io', password: 'Password123#' })
      });
      return { status: res.status, body: await res.json() };
    });

    expect(customerLoginRestored.status).toBe(200);
    expect(customerLoginRestored.body.data.accessToken).toBe('customer_access_token_valid');

    // --------------------------------------------------------------------------
    // STEP 6: Verify Immutable Audit Ledger Records
    // --------------------------------------------------------------------------
    await page.goto('/audit');
    await expect(page.locator('text=Global Cryptographic Audit Trail')).toBeVisible();

    // Verify both actions and reasons appear in the ledger
    await expect(page.locator('text=ADMIN_TENANT_SUSPENDED').first()).toBeVisible();
    await expect(page.locator('text=ADMIN_TENANT_UNSUSPENDED').first()).toBeVisible();
    await expect(page.locator(`text=${suspendReason}`).first()).toBeVisible();
    await expect(page.locator(`text=${unsuspendReason}`).first()).toBeVisible();
  });
});
