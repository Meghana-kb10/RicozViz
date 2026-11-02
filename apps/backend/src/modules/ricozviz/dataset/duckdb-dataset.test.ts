// ========================================
// DuckDB Real In-Memory OLAP & Dataset Blending Integration Tests
// ========================================
// Verifies:
// 1. 100,000-row CSV vectorized aggregation performance & mathematical accuracy
// 2. All 4 Join Types: INNER, LEFT, RIGHT, and FULL OUTER joins in DuckDB
// 3. Query timeout interruption under heavy computational load
// 4. Cross-tenant isolation & RLS WHERE-clause security enforcement
// ========================================

import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { duckdbStore } from './duckdb-store.js';
import { datasetQueryEngine, type QueryableDataset } from './query-engine.js';
import {
  performDatasetJoin,
  computeResultingColumns,
  type BlendColumn,
  type ResultingColumn
} from './dataset-blend.service.js';
import { AppError } from '../../../utils/errors.js';

console.log('⚡ Starting DuckDB OLAP & Dataset Integration Tests...');

// ------------------------------------------------------------
// TEST 1: 100,000-Row Aggregation Performance & Mathematical Accuracy
// ------------------------------------------------------------
async function test100kRowAggregation(): Promise<void> {
  console.log('\n--- Test 1: 100,000-Row Dataset Vectorized Aggregation ---');

  const datasetId = 'test_100k_perf';
  const tmpCsv = path
    .join(os.tmpdir(), `duckdb_test_100k_${Date.now()}.csv`)
    .replace(/\\/g, '/');

  const stream = fs.createWriteStream(tmpCsv, { encoding: 'utf8' });
  stream.write('id,department,region,salary,active\n');

  const depts = ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance'];
  const regions = ['North America', 'EMEA', 'APAC', 'LATAM'];

  for (let i = 0; i < 100_000; i++) {
    const dept = depts[i % depts.length]!;
    const region = regions[i % regions.length]!;
    const salary = 50_000 + (i % 50_000);
    const active = i % 2 === 0 ? 'true' : 'false';
    stream.write(`${i},${dept},${region},${salary},${active}\n`);
  }
  stream.end();
  await new Promise<void>((resolve) => {
    stream.on('finish', () => resolve());
  });

  const dataset: QueryableDataset = {
    id: datasetId,
    organizationId: 'org_enterprise',
    workspaceId: 'ws_analytics',
    columns: [
      { name: 'id', dataType: 'INTEGER' },
      { name: 'department', dataType: 'STRING' },
      { name: 'region', dataType: 'STRING' },
      { name: 'salary', dataType: 'NUMBER' },
      { name: 'active', dataType: 'BOOLEAN' }
    ],
    schemaMeta: {
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'department', type: 'string' },
        { name: 'region', type: 'string' },
        { name: 'salary', type: 'number' },
        { name: 'active', type: 'boolean' }
      ]
    }
  };

  const conn = await duckdbStore.createConnection();
  const tableName = duckdbStore.getTableName(datasetId, 1);
  await conn.run(
    `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${tmpCsv}')`
  );
  conn.closeSync();

  // Mark table as loaded in cache
  (duckdbStore as unknown as { loadedTables: Map<string, unknown> }).loadedTables.set(
    datasetId,
    {
      datasetId,
      version: 1,
      tableName,
      loadedAt: Date.now(),
      rowCount: 100_000
    }
  );

  const startMs = Date.now();
  const result = await datasetQueryEngine.executeQuery(dataset, {
    dimensions: ['department'],
    measures: [
      { column: '*', aggregation: 'COUNT', alias: 'headcount' },
      { column: 'salary', aggregation: 'SUM', alias: 'total_salary' },
      { column: 'salary', aggregation: 'AVG', alias: 'avg_salary' },
      { column: 'salary', aggregation: 'MIN', alias: 'min_salary' },
      { column: 'salary', aggregation: 'MAX', alias: 'max_salary' }
    ],
    orderBy: { column: 'total_salary', direction: 'desc' },
    limit: 10
  });

  const durationMs = Date.now() - startMs;
  console.log(`✓ 100k-row aggregation executed in ${durationMs}ms`);

  assert.equal(result.rowCount, 5, 'Should produce 5 department groups');
  assert.equal(result.total, 5, 'Total matching groups should be 5');

  const totalHeadcount = result.rows.reduce(
    (sum, r) => sum + Number(r['headcount']),
    0
  );
  assert.equal(totalHeadcount, 100_000, 'All 100,000 rows must be accounted for');

  for (const row of result.rows) {
    assert.equal(row['headcount'], 20_000, 'Each department should have 20,000 employees');
    assert.ok(Number(row['total_salary']) > 1_000_000_000, 'Total salary must be > 1B');
    assert.ok(Number(row['min_salary']) >= 50_000, 'Min salary >= 50,000');
    assert.ok(Number(row['max_salary']) <= 100_000, 'Max salary <= 100,000');
  }

  // Cleanup temp file
  try {
    fs.unlinkSync(tmpCsv);
  } catch {}

  console.log('✓ 100k-row aggregation test passed successfully! 🚀');
}

// ------------------------------------------------------------
// TEST 2: All Four Join Types (INNER, LEFT, RIGHT, FULL OUTER)
// ------------------------------------------------------------
async function testAllFourJoinTypes(): Promise<void> {
  console.log('\n--- Test 2: Real DuckDB Joins (INNER, LEFT, RIGHT, FULL OUTER) ---');

  const rowsA = [
    { customer_id: 'C1', customer_name: 'Acme Corp', tier: 'Enterprise' },
    { customer_id: 'C2', customer_name: 'Beta LLC', tier: 'Growth' },
    { customer_id: 'C3', customer_name: 'Cyber Inc', tier: 'Startup' },
    { customer_id: 'C4', customer_name: 'Delta Co', tier: 'Enterprise' }
  ];

  const rowsB = [
    { customer_id: 'C2', order_id: 'ORD-101', amount: 4500 },
    { customer_id: 'C3', order_id: 'ORD-102', amount: 1200 },
    { customer_id: 'C5', order_id: 'ORD-103', amount: 7800 },
    { customer_id: 'C6', order_id: 'ORD-104', amount: 3300 }
  ];

  const colsA: BlendColumn[] = [
    { name: 'customer_id', type: 'string' },
    { name: 'customer_name', type: 'string' },
    { name: 'tier', type: 'string' }
  ];

  const colsB: BlendColumn[] = [
    { name: 'customer_id', type: 'string' },
    { name: 'order_id', type: 'string' },
    { name: 'amount', type: 'number' }
  ];

  const { resultingColumns, colMappingB } = computeResultingColumns(
    colsA,
    colsB,
    'customer_id',
    'customer_id'
  );

  // 1. INNER JOIN: Should return only matching { C2, C3 }
  const innerRes = await performDatasetJoin(
    rowsA,
    rowsB,
    'customer_id',
    'customer_id',
    'INNER',
    resultingColumns,
    colMappingB
  );
  console.log('✓ INNER JOIN row count:', innerRes.totalCount);
  assert.equal(innerRes.totalCount, 2, 'INNER JOIN must return exactly 2 matches');
  const innerIds = innerRes.rows.map((r) => r['customer_id']).sort();
  assert.deepEqual(innerIds, ['C2', 'C3']);

  // 2. LEFT JOIN: Should return all from A { C1, C2, C3, C4 }
  const leftRes = await performDatasetJoin(
    rowsA,
    rowsB,
    'customer_id',
    'customer_id',
    'LEFT',
    resultingColumns,
    colMappingB
  );
  console.log('✓ LEFT JOIN row count:', leftRes.totalCount);
  assert.equal(leftRes.totalCount, 4, 'LEFT JOIN must return all 4 rows from A');
  const c1Row = leftRes.rows.find((r) => r['customer_id'] === 'C1');
  assert.ok(c1Row, 'C1 must be present');
  assert.equal(c1Row['order_id'], null, 'Unmatched right column must be null');

  // 3. RIGHT JOIN: Should return all from B { C2, C3, C5, C6 }
  const rightRes = await performDatasetJoin(
    rowsA,
    rowsB,
    'customer_id',
    'customer_id',
    'RIGHT',
    resultingColumns,
    colMappingB
  );
  console.log('✓ RIGHT JOIN row count:', rightRes.totalCount);
  assert.equal(rightRes.totalCount, 4, 'RIGHT JOIN must return all 4 rows from B');
  const c5Row = rightRes.rows.find((r) => r['customer_id'] === 'C5');
  assert.ok(c5Row, 'C5 must be present in RIGHT JOIN');
  assert.equal(c5Row['customer_name'], null, 'Unmatched left column must be null');

  // 4. FULL OUTER JOIN: Should return all unique from A and B { C1, C2, C3, C4, C5, C6 }
  const fullRes = await performDatasetJoin(
    rowsA,
    rowsB,
    'customer_id',
    'customer_id',
    'FULL_OUTER',
    resultingColumns,
    colMappingB
  );
  console.log('✓ FULL OUTER JOIN row count:', fullRes.totalCount);
  assert.equal(fullRes.totalCount, 6, 'FULL OUTER JOIN must return all 6 unique records');
  const fullIds = fullRes.rows.map((r) => r['customer_id']).sort();
  assert.deepEqual(fullIds, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']);

  console.log('✓ All 4 DuckDB join types passed successfully! 🔗');
}

// ------------------------------------------------------------
// TEST 3: Query Timeout & Circuit Breaker Enforcement
// ------------------------------------------------------------
async function testQueryTimeout(): Promise<void> {
  console.log('\n--- Test 3: Query Timeout & Connection Interruption ---');

  let caughtTimeoutError = false;

  try {
    // Run an intentionally heavy query with a strict 20ms timeout
    const heavySql =
      'SELECT count(*) FROM generate_series(1, 10000000) t1, generate_series(1, 100) t2';
    await duckdbStore.executeSql(heavySql, 20);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 504) {
      caughtTimeoutError = true;
    } else if (err instanceof Error && /timeout|interrupt/i.test(err.message)) {
      caughtTimeoutError = true;
    }
  }

  assert.ok(
    caughtTimeoutError,
    'Heavy DuckDB query must be cleanly interrupted when exceeding timeout threshold'
  );
  // Give interrupted thread 100ms to unwind cleanly
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log('✓ Query timeout successfully interrupted long-running execution! ⏱️');
}

// ------------------------------------------------------------
// TEST 4: Cross-Tenant Isolation & RLS WHERE-Clause Rewriting
// ------------------------------------------------------------
async function testCrossTenantIsolation(): Promise<void> {
  console.log('\n--- Test 4: Cross-Tenant Isolation & RLS Security ---');

  const datasetId = 'test_rls_multitenant';
  const multitenantRows = [
    { tenant_id: 'org_alpha', user_id: 'u1', order_amount: 150, pii_name: 'Alpha Alice' },
    { tenant_id: 'org_alpha', user_id: 'u2', order_amount: 320, pii_name: 'Alpha Bob' },
    { tenant_id: 'org_beta', user_id: 'u3', order_amount: 999, pii_name: 'Beta Secret Carol' },
    { tenant_id: 'org_beta', user_id: 'u4', order_amount: 1400, pii_name: 'Beta Secret Dave' }
  ];

  const dataset: QueryableDataset = {
    id: datasetId,
    organizationId: 'org_alpha',
    workspaceId: 'ws_alpha',
    columns: [
      { name: 'tenant_id', dataType: 'STRING' },
      { name: 'user_id', dataType: 'STRING' },
      { name: 'order_amount', dataType: 'NUMBER' },
      { name: 'pii_name', dataType: 'STRING' }
    ],
    schemaMeta: {
      sampleData: multitenantRows,
      rlsRules: [
        {
          id: 'rule_tenant_alpha',
          organizationId: 'org_alpha',
          workspaceId: 'ws_alpha',
          datasetId,
          column: 'tenant_id',
          operator: '=',
          value: 'org_alpha',
          enabled: true
        }
      ],
      columns: [
        { name: 'tenant_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'order_amount', type: 'number' },
        { name: 'pii_name', type: 'string' }
      ]
    }
  };

  // Prime table in DuckDB
  await duckdbStore.ensureDatasetTable(dataset, multitenantRows);

  // Security Context for Tenant Alpha
  const alphaUser = {
    userId: 'u_alpha_admin',
    email: 'admin@alpha.io',
    organizationId: 'org_alpha',
    roleName: 'MEMBER'
  };

  // 1. Raw query under Tenant Alpha context: must NEVER see org_beta data
  const resultAlpha = await datasetQueryEngine.executeQuery(
    dataset,
    {
      columns: ['tenant_id', 'user_id', 'order_amount'],
      // User attempts wide filter that would match beta rows if RLS was absent
      filters: [{ column: 'order_amount', operator: '>', value: 100 }]
    },
    alphaUser
  );

  console.log('✓ Rows returned for org_alpha user:', resultAlpha.rowCount);
  assert.equal(resultAlpha.rowCount, 2, 'Only org_alpha rows should be visible');

  for (const row of resultAlpha.rows) {
    assert.equal(row['tenant_id'], 'org_alpha', 'Tenant isolation breach: found non-alpha row');
  }

  // 2. Aggregate query under Tenant Alpha context: SUM(order_amount)
  const aggResult = await datasetQueryEngine.executeQuery(
    dataset,
    {
      measures: [{ column: 'order_amount', aggregation: 'SUM', alias: 'total_spent' }]
    },
    alphaUser
  );

  // Sum should be 150 + 320 = 470, NOT including Beta's 999 + 1400 = 2399
  const totalSpent = Number(aggResult.rows[0]?.['total_spent']);
  console.log('✓ Aggregated spend for org_alpha:', totalSpent);
  assert.equal(totalSpent, 470, 'Aggregations must strictly respect tenant RLS boundary');

  console.log('✓ Cross-tenant isolation verified with zero credential/data leakage! 🛡️');
}

// ------------------------------------------------------------
// RUN ALL TESTS
// ------------------------------------------------------------
async function runAll(): Promise<void> {
  try {
    await test100kRowAggregation();
    await testAllFourJoinTypes();
    await testQueryTimeout();
    await testCrossTenantIsolation();

    console.log('\n🎉 ALL DUCKDB INTEGRATION TESTS PASSED 100% SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  }
}

runAll();
