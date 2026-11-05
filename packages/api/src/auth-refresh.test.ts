// ==============================================================================
// Automatic 401 Token Refresh & Concurrency Queuing Test Suite
// ==============================================================================
// Proves:
// 1. Transparent 401 interception and single-call token refresh.
// 2. Strict concurrency queuing: N simultaneous 401 requests trigger EXACTLY 1 refresh call.
// 3. 20-second access token TTL lifecycle without mid-session logout.
// 4. Safe session clearance and return URL redirect on refresh failure.
// ==============================================================================

import assert from 'node:assert/strict';
import http from 'node:http';
import {
  configureRicozVizApi,
  apiFetch,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  setOnAuthFailure,
  ApiError
} from './index.js';

console.log('🔄 Starting Automatic 401 Token Refresh & Concurrency Queuing Tests...\n');

async function runTests(): Promise<void> {
  let refreshCallsCount = 0;
  let tokensIssuedCount = 0;
  let allowRefresh = true;
  const validAccessTokens = new Set<string>();

  // Helper to issue new token
  const issueNewToken = () => {
    tokensIssuedCount += 1;
    const tok = `tok_access_v${tokensIssuedCount}_${Date.now()}`;
    validAccessTokens.add(tok);
    return tok;
  };

  // Mock Fastify/backend HTTP server using node:http
  const server = http.createServer((req, res) => {
    const url = req.url || '';

    // Route: Refresh
    if (url === '/api/v1/auth/refresh' && req.method === 'POST') {
      refreshCallsCount += 1;

      if (!allowRefresh) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token has expired or been revoked' }
          })
        );
        return;
      }

      // Small network delay simulation to ensure concurrent requests arrive while refresh is pending
      setTimeout(() => {
        const newToken = issueNewToken();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': 'ricozviz_refresh=mock_rotated_refresh_cookie; Path=/api/v1/auth; HttpOnly; SameSite=Strict'
        });
        res.end(
          JSON.stringify({
            success: true,
            data: { accessToken: newToken }
          })
        );
      }, 35);
      return;
    }

    // Helper: Authenticate Bearer token
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    if (!token || !validAccessTokens.has(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired or is invalid' }
        })
      );
      return;
    }

    // Authenticated API resources
    if (url === '/api/v1/dashboards') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [{ id: 'dash_1', title: 'Executive Overview' }] }));
      return;
    }

    if (url === '/api/v1/datasets') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [{ id: 'ds_1', name: 'PostgreSQL Orders' }] }));
      return;
    }

    if (url === '/api/v1/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [{ id: 'm_1', name: 'Quarterly ARR Growth' }] }));
      return;
    }

    if (url === '/api/v1/alerts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [{ id: 'a_1', name: 'High Latency Anomaly' }] }));
      return;
    }

    if (url === '/api/v1/workspaces') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [{ id: 'ws_1', name: 'Enterprise Analytics' }] }));
      return;
    }

    if (url === '/api/v1/suspended-check') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'TENANT_SUSPENDED',
            message: 'Organization account is suspended. Contact platform administrator.'
          }
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }));
  });

  // Start on random ephemeral port
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const testBaseUrl = `http://127.0.0.1:${address.port}`;
  configureRicozVizApi({ baseUrl: testBaseUrl });

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Initial Login with Valid Token
    // --------------------------------------------------------------------------
    console.log('--- Test 1: Initial Authenticated Request ---');
    const token1 = issueNewToken();
    setAccessToken(token1);

    const initialDashboards = await apiFetch<Array<{ id: string; title: string }>>('/api/v1/dashboards');
    assert.strictEqual(initialDashboards.length, 1);
    assert.strictEqual(initialDashboards[0]?.title, 'Executive Overview');
    assert.strictEqual(refreshCallsCount, 0, 'No refresh should occur when access token is valid');
    console.log('✓ Initial authenticated request succeeded without triggering refresh');

    // --------------------------------------------------------------------------
    // TEST 2: 20-Second Access Token Expiration & Automatic Seamless Refresh
    // --------------------------------------------------------------------------
    console.log('\n--- Test 2: 20-Second Access Token Expiration Lifecycle ---');
    // Simulate 20-second access token TTL expiration: invalidate token1 on server
    validAccessTokens.delete(token1);

    // Call API while access token is expired
    const refreshedDashboards = await apiFetch<Array<{ id: string; title: string }>>('/api/v1/dashboards');
    assert.strictEqual(refreshedDashboards.length, 1);
    assert.strictEqual(refreshedDashboards[0]?.title, 'Executive Overview');
    assert.strictEqual(refreshCallsCount, 1, 'Exactly one refresh call should be made on 401');

    const currentToken = getAccessToken();
    assert.ok(currentToken && currentToken !== token1, 'Access token in storage must be updated with new token');
    assert.ok(validAccessTokens.has(currentToken), 'New token must be active and valid');

    // Subsequent request uses new token directly without refreshing
    const datasets = await apiFetch<Array<{ id: string; name: string }>>('/api/v1/datasets');
    assert.strictEqual(datasets[0]?.name, 'PostgreSQL Orders');
    assert.strictEqual(refreshCallsCount, 1, 'Subsequent request must reuse refreshed token without refreshing again');
    console.log('✓ 20-second token expiration lifecycle: transparent refresh with zero mid-session logout');

    // --------------------------------------------------------------------------
    // TEST 3: Concurrent Request Queuing (5 simultaneous 401s -> 1 refresh call)
    // --------------------------------------------------------------------------
    console.log('\n--- Test 3: Concurrency Queuing (5 Concurrent Requests) ---');
    // Simulate next expiration cycle: invalidate the current token
    validAccessTokens.delete(currentToken!);

    const countBeforeConcurrency = refreshCallsCount;

    // Dispatch 5 concurrent requests simultaneously
    const [dashboardsRes, datasetsRes, metricsRes, alertsRes, workspacesRes] = await Promise.all([
      apiFetch<Array<{ id: string }>>('/api/v1/dashboards'),
      apiFetch<Array<{ id: string }>>('/api/v1/datasets'),
      apiFetch<Array<{ id: string }>>('/api/v1/metrics'),
      apiFetch<Array<{ id: string }>>('/api/v1/alerts'),
      apiFetch<Array<{ id: string }>>('/api/v1/workspaces')
    ]);

    assert.strictEqual(dashboardsRes.length, 1);
    assert.strictEqual(datasetsRes.length, 1);
    assert.strictEqual(metricsRes.length, 1);
    assert.strictEqual(alertsRes.length, 1);
    assert.strictEqual(workspacesRes.length, 1);

    // Verify only 1 refresh call was made for all 5 concurrent requests
    assert.strictEqual(
      refreshCallsCount,
      countBeforeConcurrency + 1,
      '5 concurrent requests must be queued and result in EXACTLY ONE refresh call'
    );
    console.log('✓ 5 concurrent requests queued seamlessly: exactly 1 refresh call executed, all 5 succeeded');

    // --------------------------------------------------------------------------
    // TEST 4: Refresh Failure Handling (Safe Clearance & Return URL Redirect)
    // --------------------------------------------------------------------------
    console.log('\n--- Test 4: Refresh Failure Handling & Return URL ---');
    // Invalidate current token and simulate revoked/expired refresh cookie
    const activeTok = getAccessToken()!;
    validAccessTokens.delete(activeTok);
    allowRefresh = false;

    let capturedReturnUrl: string | null = null;
    setOnAuthFailure((returnUrl) => {
      capturedReturnUrl = returnUrl;
    });

    let failedWithError: any = null;
    try {
      await apiFetch('/api/v1/dashboards');
    } catch (err) {
      failedWithError = err;
    }

    assert.ok(failedWithError instanceof ApiError, 'Failed request must throw ApiError');
    assert.strictEqual(failedWithError.status, 401);
    assert.strictEqual(getAccessToken(), null, 'Access token must be cleared on refresh failure');
    assert.ok(capturedReturnUrl !== null, 'onAuthFailure callback must be invoked');
    console.log('✓ Refresh failure safely clears session and triggers return URL callback');

    // --------------------------------------------------------------------------
    // TEST 5: Proactive Background Refresh Timer Before Expiration
    // --------------------------------------------------------------------------
    console.log('\n--- Test 5: Proactive Auto-Refresh Timer Before Expiration ---');
    allowRefresh = true;
    const initialRefreshCount = refreshCallsCount;

    // Create a mock JWT that expires in 1.5 seconds (1500ms)
    // Buffer is min(60s, 1500 * 0.2 = 300ms) -> delay is 1200ms
    const shortExpSeconds = Math.floor((Date.now() + 1500) / 1000);
    const mockPayload = { id: 'usr_proactive', exp: shortExpSeconds };
    const mockToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(JSON.stringify(mockPayload)).toString('base64url') +
      '.mock_proactive_sig';

    setAccessToken(mockToken);
    validAccessTokens.add(mockToken);

    // Wait 1350ms for proactive timer to execute background refresh
    await new Promise((resolve) => setTimeout(resolve, 1350));

    assert.strictEqual(
      refreshCallsCount,
      initialRefreshCount + 1,
      'Proactive refresh timer must automatically trigger refresh before token expiration'
    );
    const activeTokenAfterProactive = getAccessToken();
    assert.ok(
      activeTokenAfterProactive && activeTokenAfterProactive !== mockToken,
      'Access token must be proactively updated without any 401 error'
    );
    console.log('✓ Proactive auto-refresh executed in background before expiration');

    // --------------------------------------------------------------------------
    // TEST 6: Suspended Tenant Interception & Callback Trigger
    // --------------------------------------------------------------------------
    console.log('\n--- Test 6: Suspended Tenant 403 Interception ---');
    let capturedSuspensionMessage: string | null = null;
    const { setOnTenantSuspended } = await import('./index.js');
    setOnTenantSuspended((msg) => {
      capturedSuspensionMessage = msg || 'suspended';
    });

    // Configure server route to simulate suspended tenant response
    let simulateSuspended = true;
    const originalToken = issueNewToken();
    setAccessToken(originalToken);

    // Make an API request to a route that returns 403 TENANT_SUSPENDED
    const suspendedReqError = await (async () => {
      try {
        await apiFetch('/api/v1/suspended-check');
        return null;
      } catch (err: any) {
        return err;
      }
    })();

    assert.ok(capturedSuspensionMessage !== null, 'Tenant suspension callback must be triggered');
    assert.strictEqual(getAccessToken(), null, 'Access token must be cleared when tenant is suspended');
    console.log('✓ Suspended tenant properly detected, token cleared, and suspension callback triggered');

    console.log('\n🎉 ALL AUTOMATIC 401 REFRESH, CONCURRENCY & SUSPENSION TESTS PASSED 100%!\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
