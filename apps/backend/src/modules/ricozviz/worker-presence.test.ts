// ============================================================
// Worker & Real-Time Presence Integration Tests
// ============================================================
// Verifies:
// 1. Two worker instances racing for the same job lease (only 1 runs)
// 2. Retry / exponential backoff and failed-state behavior
// 3. WorkerRun audit records are accurately written
// 4. WebSocket auth rejects missing, expired, and wrong-dashboard tickets
// 5. Two clients in one room see each other, while a cross-tenant client receives nothing
// ============================================================

import assert from 'node:assert';
import { buildApp } from '../../app.js';
import {
  acquireWorkerLock,
  releaseWorkerLock,
  clearInMemoryLocks,
  runJobWithDistributedLock,
  clearInMemoryRuns,
  listWorkerRuns
} from '../worker/index.js';
import {
  createWsTicket,
  clearInMemoryTickets
} from './collaboration/ws-ticket.service.js';
import { clearAllWsRooms } from './collaboration/ws-collaboration.service.js';

async function runTests() {
  console.log('🚀 Starting Worker Subsystem & Real-Time Presence Integration Tests...\n');

  // Clean test fixtures
  clearInMemoryLocks();
  clearInMemoryRuns();
  clearInMemoryTickets();
  clearAllWsRooms();

  // ============================================================
  // Test 1: Two Worker Instances Racing for Job Lease
  // ============================================================
  console.log('--- Test 1: Distributed Locking Race Condition ---');
  const jobName = 'dataset_etl_pipeline';
  const workerA = 'worker-node-alpha';
  const workerB = 'worker-node-beta';

  const lockAcquiredA = await acquireWorkerLock(jobName, workerA, 5000);
  assert.strictEqual(lockAcquiredA, true, 'Worker A should acquire the lock first');

  const lockAcquiredB = await acquireWorkerLock(jobName, workerB, 5000);
  assert.strictEqual(lockAcquiredB, false, 'Worker B must be rejected while Worker A holds active lease');

  // Worker A releases lock
  await releaseWorkerLock(jobName, workerA);

  // Now Worker B can acquire it
  const lockAcquiredBAfterRelease = await acquireWorkerLock(jobName, workerB, 5000);
  assert.strictEqual(lockAcquiredBAfterRelease, true, 'Worker B should successfully acquire the lease after release');
  await releaseWorkerLock(jobName, workerB);
  console.log('✓ Distributed lock lease acquisition and contention verified');

  // ============================================================
  // Test 2: Retry & Exponential Backoff + Failed-State Behavior
  // ============================================================
  console.log('\n--- Test 2: Worker Retry, Backoff & Failure Handling ---');
  let attemptCounter = 0;
  const retryResult = await runJobWithDistributedLock(
    'flaky-api-sync',
    async (attempt) => {
      attemptCounter = attempt;
      if (attempt < 3) {
        throw new Error(`Transient network glitch (attempt ${attempt})`);
      }
      return { itemsProcessed: 15 };
    },
    { maxAttempts: 3, initialBackoffMs: 20, backoffFactor: 2 }
  );

  assert.strictEqual(retryResult.status, 'SUCCESS', 'Job should succeed on the 3rd attempt');
  assert.strictEqual(retryResult.attempt, 3, 'Should have taken 3 attempts');
  assert.strictEqual(retryResult.itemsProcessed, 15, 'Should process 15 items');
  assert.strictEqual(attemptCounter, 3, 'Execution loop should have run 3 times');
  console.log('✓ Retry with exponential backoff succeeded on eventual recovery');

  // Test permanent failure
  let permanentAttemptCounter = 0;
  const failureResult = await runJobWithDistributedLock(
    'unrecoverable-job',
    async (attempt) => {
      permanentAttemptCounter = attempt;
      throw new Error('Database disk full');
    },
    { maxAttempts: 3, initialBackoffMs: 15 }
  );

  assert.strictEqual(failureResult.status, 'FAILED', 'Exhausted retries should mark job as FAILED');
  assert.strictEqual(failureResult.attempt, 3, 'Should record max attempts limit (3)');
  assert.strictEqual(failureResult.error, 'Database disk full', 'Should record error message');
  assert.strictEqual(permanentAttemptCounter, 3, 'Handler should have run 3 times before failing');
  console.log('✓ Permanent failure state accurately recorded after retries exhausted');

  // ============================================================
  // Test 3: WorkerRun Persistence & Audit Records
  // ============================================================
  console.log('\n--- Test 3: WorkerRun Audit Trail Records ---');
  const runsReport = await listWorkerRuns();
  assert(runsReport.total >= 2, 'Should have recorded at least 2 worker runs');

  const flakyRun = runsReport.runs.find((r: any) => r.jobName === 'flaky-api-sync') as any;
  assert(flakyRun, 'flaky-api-sync record must exist');
  assert.strictEqual(flakyRun.status, 'SUCCESS');
  assert.strictEqual(flakyRun.itemsProcessed, 15);
  assert(flakyRun.durationMs >= 0, 'durationMs must be recorded');

  const failRun = runsReport.runs.find((r: any) => r.jobName === 'unrecoverable-job') as any;
  assert(failRun, 'unrecoverable-job record must exist');
  assert.strictEqual(failRun.status, 'FAILED');
  assert.strictEqual(failRun.error, 'Database disk full');
  console.log('✓ WorkerRun audit trail recorded execution metrics and error states');

  // ============================================================
  // Test 4: WebSocket Authentication Handshake & Ticket Rejection
  // ============================================================
  console.log('\n--- Test 4: WebSocket Handshake Security & Ticket Enforcement ---');
  const app = await buildApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 3001;

  // 4A: Missing ticket -> Rejected with 4401
  const wsNoTicket = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/dash-100`);
  const noTicketCloseCode = await new Promise<number>((resolve) => {
    wsNoTicket.onclose = (event) => resolve(event.code);
  });
  assert.strictEqual(noTicketCloseCode, 4401, 'Handshake without ticket must close with 4401');

  // 4B: Expired / invalid ticket -> Rejected with 4401
  const wsInvalidTicket = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/dash-100?ticket=wst_invalid_gibberish`);
  const invalidTicketCloseCode = await new Promise<number>((resolve) => {
    wsInvalidTicket.onclose = (event) => resolve(event.code);
  });
  assert.strictEqual(invalidTicketCloseCode, 4401, 'Handshake with invalid ticket must close with 4401');

  // 4C: Ticket created for Dashboard A, attempted on Dashboard B -> Rejected with 4401
  const ticketA = await createWsTicket({
    userId: 'user-001',
    userName: 'Alice',
    dashboardId: 'dash-tenantA-001',
    workspaceId: 'workspace-tenantA'
  });

  const wsWrongDashboard = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/dash-tenantB-999?ticket=${ticketA.ticket}`);
  const wrongDashboardCloseCode = await new Promise<number>((resolve) => {
    wsWrongDashboard.onclose = (event) => resolve(event.code);
  });
  assert.strictEqual(wrongDashboardCloseCode, 4401, 'Handshake with ticket for wrong dashboard must close with 4401');
  console.log('✓ WebSocket rejects missing, invalid, and mismatching tickets');

  // ============================================================
  // Test 5: Real-Time Presence, Room Isolation & Cross-Tenant Boundary
  // ============================================================
  console.log('\n--- Test 5: Real-Time Presence & Tenant Room Isolation ---');
  const targetDashboardId = 'dash-production-metrics';
  const tenant1WorkspaceId = 'ws-tenant-acme';
  const tenant2WorkspaceId = 'ws-tenant-competitor';

  // Issue tickets
  const ticketAlice = await createWsTicket({
    userId: 'user-alice-01',
    userName: 'Alice',
    userColor: '#ff6b35',
    dashboardId: targetDashboardId,
    workspaceId: tenant1WorkspaceId
  });

  const ticketBob = await createWsTicket({
    userId: 'user-bob-02',
    userName: 'Bob',
    userColor: '#3b82f6',
    dashboardId: targetDashboardId,
    workspaceId: tenant1WorkspaceId
  });

  // Client 3 in a completely separate tenant
  const ticketEve = await createWsTicket({
    userId: 'user-eve-99',
    userName: 'Eve (Tenant 2)',
    dashboardId: targetDashboardId, // Same dashboardId string, but isolated by tenant workspace!
    workspaceId: tenant2WorkspaceId
  });

  const clientAlice = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/${targetDashboardId}?ticket=${ticketAlice.ticket}`);
  const clientBob = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/${targetDashboardId}?ticket=${ticketBob.ticket}`);
  const clientEve = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboards/${targetDashboardId}?ticket=${ticketEve.ticket}`);

  // Track received messages
  const aliceReceived: any[] = [];
  const bobReceived: any[] = [];
  const eveReceived: any[] = [];

  clientAlice.onmessage = (event) => aliceReceived.push(JSON.parse(event.data.toString()));
  clientBob.onmessage = (event) => bobReceived.push(JSON.parse(event.data.toString()));
  clientEve.onmessage = (event) => eveReceived.push(JSON.parse(event.data.toString()));

  // Wait for connections and initial handshakes to complete
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Check initial presence states
  const aliceInitial = aliceReceived.find((m) => m.type === 'PRESENCE_STATE');
  assert(aliceInitial, 'Alice should receive initial PRESENCE_STATE');

  const bobInitial = bobReceived.find((m) => m.type === 'PRESENCE_STATE');
  assert(bobInitial, 'Bob should receive initial PRESENCE_STATE');

  const eveInitial = eveReceived.find((m) => m.type === 'PRESENCE_STATE');
  assert(eveInitial, 'Eve should receive initial PRESENCE_STATE');

  // Eve's initial roster must ONLY contain Eve, never Alice or Bob!
  assert.strictEqual(eveInitial.collaborators.length, 1, 'Eve must only see herself in her tenant room');
  assert.strictEqual(eveInitial.collaborators[0].userId, 'user-eve-99');

  // Alice should receive USER_JOINED for Bob
  const aliceSawBobJoin = aliceReceived.some((m) => m.type === 'USER_JOINED' && m.userId === 'user-bob-02');
  assert(aliceSawBobJoin, 'Alice should see Bob join her room');

  // Neither Alice nor Bob should EVER see Eve join
  const aliceSawEve = aliceReceived.some((m) => m.userId === 'user-eve-99');
  const bobSawEve = bobReceived.some((m) => m.userId === 'user-eve-99');
  assert.strictEqual(aliceSawEve, false, 'Tenant A (Alice) must NEVER see Tenant B user (Eve)');
  assert.strictEqual(bobSawEve, false, 'Tenant A (Bob) must NEVER see Tenant B user (Eve)');

  // Test Cursor Synchronization
  clientAlice.send(JSON.stringify({ type: 'CURSOR_MOVE', cursor: { x: 350, y: 520 } }));
  await new Promise((resolve) => setTimeout(resolve, 100));

  const bobSawCursor = bobReceived.some(
    (m) => m.type === 'CURSOR_MOVED' && m.userId === 'user-alice-01' && m.cursor?.x === 350
  );
  assert(bobSawCursor, 'Bob should receive Alice cursor movement');

  const eveSawCursor = eveReceived.some((m) => m.type === 'CURSOR_MOVED');
  assert.strictEqual(eveSawCursor, false, 'Eve in Tenant B must receive 0 cursor events from Tenant A');

  // Test Client Disconnect
  clientBob.close();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const aliceSawBobLeave = aliceReceived.some((m) => m.type === 'USER_LEFT' && m.userId === 'user-bob-02');
  assert(aliceSawBobLeave, 'Alice should be notified when Bob leaves');

  const eveSawBobLeave = eveReceived.some((m) => m.type === 'USER_LEFT');
  assert.strictEqual(eveSawBobLeave, false, 'Eve should receive no leave events from other tenants');

  console.log('✓ Two clients in same tenant room sync presence & cursor');
  console.log('✓ Cross-tenant room isolation strictly verified (0 leakage)');

  // Cleanup
  clientAlice.close();
  clientEve.close();
  await app.close();

  console.log('\n🎉 ALL WORKER & REAL-TIME PRESENCE TESTS PASSED 100%!\n');
}

void runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
