// ==============================================================================
// Customer Token Auto-Refresh & Security Hygiene Test Suite
// ==============================================================================
// Tests:
// 1. Zero localStorage Token Storage: Verifies neither access nor refresh tokens
//    are stored in window.localStorage.
// 2. Proactive Auto-Refresh: Verifies background scheduling triggers before JWT expiry.
// 3. Proactive Auto-Refresh Cancellation: Verifies clearAccessToken cancels pending timer.
// 4. Concurrency Mutex: Multiple simultaneous requests queue behind 1 refresh call.
// 5. Suspended Tenant Handling: Intercepts 403 TENANT_SUSPENDED, clears token, triggers callback.
// 6. Token Rotation Parity: Fresh access token replaces expired token seamlessly.
// ==============================================================================

import assert from "node:assert/strict";
import http from "node:http";
import {
  configureRicozVizApi,
  apiFetch,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  scheduleProactiveRefresh,
  cancelProactiveRefresh,
  setOnAuthFailure,
  setOnTenantSuspended,
  ApiError
} from "../lib/api";

console.log("🛡️ Starting RicozViz Customer Token Auto-Refresh & Hygiene Tests...\n");

async function runCustomerTests(): Promise<void> {
  // --------------------------------------------------------------------------
  // TEST 1: Strict Zero localStorage Token Storage Rule
  // --------------------------------------------------------------------------
  console.log("--- Test 1: Zero localStorage Token Hygiene ---");
  // Simulate browser environment with mock localStorage & sessionStorage
  const mockLocalStorage: Record<string, string> = {
    ricoz_access_token: "stale_legacy_token",
    token: "stale_plain_token"
  };
  const mockSessionStorage: Record<string, string> = {};

  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => mockLocalStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockLocalStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockLocalStorage[k];
      }
    },
    sessionStorage: {
      getItem: (k: string) => mockSessionStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockSessionStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockSessionStorage[k];
      }
    },
    document: {
      cookie: ""
    },
    location: {
      origin: "http://localhost:3001",
      pathname: "/dashboards",
      search: "",
      href: ""
    }
  };

  const testToken = "test.access.token.v1";
  setAccessToken(testToken);

  // Assert that localStorage NEVER contains the token
  assert.strictEqual(
    mockLocalStorage["ricoz_access_token"],
    undefined,
    "Access token must NOT be written to localStorage"
  );
  assert.strictEqual(
    mockLocalStorage["ricozviz_at"],
    undefined,
    "Access token must NOT be written to localStorage"
  );
  assert.strictEqual(
    mockSessionStorage["ricozviz_at"],
    testToken,
    "Access token MUST be stored in sessionStorage for browser tab scope"
  );

  clearAccessToken();
  assert.strictEqual(
    mockSessionStorage["ricozviz_at"],
    undefined,
    "Access token must be removed from sessionStorage on clear"
  );
  console.log("✓ Zero localStorage token hygiene verified: tokens strictly quarantined from localStorage");

  // Clean up global mock
  delete (globalThis as any).window;

  // --------------------------------------------------------------------------
  // TEST 2: Proactive Auto-Refresh Scheduling Before Token Expiration
  // --------------------------------------------------------------------------
  console.log("\n--- Test 2: Proactive Auto-Refresh Background Timer ---");

  let mockRefreshCounter = 0;
  let activeValidToken = "";

  const server = http.createServer((req, res) => {
    const url = req.url || "";

    if (url === "/api/v1/auth/refresh" && req.method === "POST") {
      mockRefreshCounter += 1;
      const nextExp = Math.floor((Date.now() + 60000) / 1000);
      const nextPayload = { sub: "cust_123", exp: nextExp };
      const nextToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
        Buffer.from(JSON.stringify(nextPayload)).toString("base64url") +
        `.sig_v${mockRefreshCounter}`;
      activeValidToken = nextToken;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          data: { accessToken: nextToken }
        })
      );
      return;
    }

    if (url === "/api/v1/customer/check") {
      const auth = req.headers.authorization || "";
      const token = auth.replace(/^Bearer\s+/, "").trim();
      if (token === activeValidToken) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, data: { status: "active" } }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED", message: "Token expired" } }));
      }
      return;
    }

    if (url === "/api/v1/customer/suspended-check") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: "TENANT_SUSPENDED",
            message: "Organization account is suspended. Contact platform administrator."
          }
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const port = (server.address() as { port: number }).port;
  configureRicozVizApi({ baseUrl: `http://127.0.0.1:${port}` });

  try {
    // Generate a token that expires in 1.5 seconds
    const shortExp = Math.ceil((Date.now() + 1500) / 1000);
    const mockExpiringToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ sub: "cust_123", exp: shortExp })).toString("base64url") +
      ".sig_short_lived";

    activeValidToken = mockExpiringToken;
    setAccessToken(mockExpiringToken);

    // Wait 1400ms for proactive timer to trigger refresh before expiration
    await new Promise((resolve) => setTimeout(resolve, 1400));

    assert.strictEqual(mockRefreshCounter, 1, "Proactive timer must trigger background refresh");
    const renewedToken = getAccessToken();
    assert.ok(
      renewedToken && renewedToken !== mockExpiringToken,
      "Access token must be renewed seamlessly in background"
    );
    console.log("✓ Proactive background refresh triggered before token expiry without interruption");

    // --------------------------------------------------------------------------
    // TEST 3: Proactive Refresh Timer Cancellation
    // --------------------------------------------------------------------------
    console.log("\n--- Test 3: Timer Cancellation on Clear / Logout ---");
    const countBeforeCancel = mockRefreshCounter;
    const anotherExp = Math.floor((Date.now() + 1000) / 1000);
    const tokenToCancel =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ sub: "cust_cancel", exp: anotherExp })).toString("base64url") +
      ".sig_cancel";

    setAccessToken(tokenToCancel);
    // Explicitly clear token (simulating logout)
    clearAccessToken();

    // Wait 1200ms
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.strictEqual(
      mockRefreshCounter,
      countBeforeCancel,
      "Cleared access token must cancel proactive timer so no refresh fires"
    );
    console.log("✓ Timer successfully cancelled on logout / clearAccessToken");

    // --------------------------------------------------------------------------
    // TEST 4: Concurrency Mutex & Re-execution
    // --------------------------------------------------------------------------
    console.log("\n--- Test 4: Concurrency Mutex Under Parallel 401s ---");
    activeValidToken = "different_valid_token";
    // Invalidate current token by setting expired token
    setAccessToken("expired_dummy_token");

    const refreshCountBeforeParallel = mockRefreshCounter;
    // Dispatch 4 parallel API calls
    const parallelResults = await Promise.all([
      apiFetch<{ status: string }>("/api/v1/customer/check"),
      apiFetch<{ status: string }>("/api/v1/customer/check"),
      apiFetch<{ status: string }>("/api/v1/customer/check"),
      apiFetch<{ status: string }>("/api/v1/customer/check")
    ]);

    assert.strictEqual(parallelResults.length, 4);
    assert.strictEqual(parallelResults[0]?.status, "active");
    assert.strictEqual(
      mockRefreshCounter,
      refreshCountBeforeParallel + 1,
      "4 parallel 401 requests must deduplicate to exactly 1 refresh call"
    );
    console.log("✓ 4 parallel 401 requests resolved via single deduplicated refresh call");

    // --------------------------------------------------------------------------
    // TEST 5: Suspended Tenant 403 Response Interception
    // --------------------------------------------------------------------------
    console.log("\n--- Test 5: Suspended Tenant Interception & Redirection Callback ---");
    let suspendedNotificationMessage = "";
    setOnTenantSuspended((msg) => {
      suspendedNotificationMessage = msg || "Tenant suspended";
    });

    try {
      await apiFetch("/api/v1/customer/suspended-check");
      assert.fail("apiFetch should have thrown ApiError on 403");
    } catch (err: any) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.code, "TENANT_SUSPENDED");
    }

    assert.ok(
      suspendedNotificationMessage.includes("suspended"),
      "Tenant suspension callback must be triggered with suspension reason"
    );
    assert.strictEqual(
      getAccessToken(),
      null,
      "Access token must be cleared when tenant is suspended"
    );
    console.log("✓ Suspended tenant 403 handled: tokens purged and router suspension callback triggered");

    console.log("\n============================================================");
    console.log("🎉 ALL CUSTOMER REFRESH & SECURITY TESTS PASSED 100%!");
    console.log("============================================================\n");
  } finally {
    server.close();
  }
}

runCustomerTests().catch((err) => {
  console.error("❌ Customer Test Failure:", err);
  process.exit(1);
});
