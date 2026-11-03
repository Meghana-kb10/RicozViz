import { test, expect } from '@playwright/test';

test.describe('Platform Operator Admin Portal Security & Workflows', () => {
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
});
