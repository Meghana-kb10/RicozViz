import assert from 'node:assert/strict';
import {
  getRlsPoliciesCatalog,
  simulateRlsEvaluation,
  RLS_ROLES,
  RLS_POLICIES
} from './rls-simulator.js';

console.log('Testing Cryptographic RLS & Dynamic Column Masking Simulator...');

// 1. Catalog Verification
const catalog = getRlsPoliciesCatalog();
assert.equal(catalog.roles.length, 4, 'Should expose 4 standard enterprise roles');
assert.equal(catalog.policies.length, 5, 'Should expose 5 standard RLS policies');
assert.equal(catalog.defaultRole, 'REGIONAL_SALES_LEAD');
console.log('✓ RLS Policies Catalog successfully validated');

// 2. Org Admin Simulation (Full Visibility)
const adminResult = simulateRlsEvaluation({
  role: 'ORGANIZATION_ADMIN',
  activePolicyIds: ['TENANT_ISOLATION', 'ROW_SIGNING'],
  tenantId: 'org_101'
});

assert.equal(adminResult.databaseRebuildsRequired, 0, 'Must require 0 database rebuilds');
assert.ok(adminResult.executionLatencyMs >= 0, 'Execution latency must be measured');
assert.ok(adminResult.cryptographicSignature.startsWith('0x'), 'Must provide HMAC SHA-256 signature');
assert.equal(adminResult.visibleRowsCount, 3, 'Org 101 should have 3 visible records across all regions');
assert.equal(adminResult.filteredOutRowsCount, 3, '3 records from org 102 and 103 should be filtered');

// Verify unmasked values for admin
const adminRecord = adminResult.records.find((r) => r.id === 'tx_01');
assert.ok(adminRecord);
assert.equal(adminRecord.email, 'sarah.connor@acme.corp', 'Admin email must remain unmasked');
assert.equal(adminRecord.representative, 'Sarah Connor', 'Admin representative must remain unmasked');
assert.equal(adminRecord.grossRevenue, '$142,500.00', 'Admin revenue must be exact currency');
console.log('✓ Organization Admin evaluation validated without regressions');

// 3. Regional Sales Lead (Geo-Fencing + PII Masking)
const regionalLeadResult = simulateRlsEvaluation({
  role: 'REGIONAL_SALES_LEAD',
  activePolicyIds: ['TENANT_ISOLATION', 'REGIONAL_PARTITION', 'PII_MASKING', 'ROW_SIGNING'],
  tenantId: 'org_101',
  userRegion: 'EU-West'
});

assert.equal(regionalLeadResult.databaseRebuildsRequired, 0);
assert.equal(regionalLeadResult.visibleRowsCount, 1, 'Only 1 record should match org_101 + EU-West');
assert.equal(regionalLeadResult.filteredOutRowsCount, 5, '5 records should be filtered out');

const euRecord = regionalLeadResult.records.find((r) => r.id === 'tx_02');
assert.ok(euRecord);
assert.equal(euRecord.rowStatus, 'PARTIALLY_MASKED');
assert.equal(euRecord.email, 'm***t@acme.corp', 'Email must be dynamically masked');
assert.equal(euRecord.representative, 'M*** Wright', 'Representative must be dynamically masked');
assert.ok(regionalLeadResult.appliedSqlAst.includes("WHERE tenant_id = 'org_101'"));
assert.ok(regionalLeadResult.appliedSqlAst.includes("region IN ('EU-West')"));
console.log('✓ Regional Sales Lead geo-fence and dynamic PII masking validated');

// 4. Restricted Contractor (Full Redaction & Metric Bucketing)
const contractorResult = simulateRlsEvaluation({
  role: 'RESTRICTED_CONTRACTOR',
  activePolicyIds: [
    'TENANT_ISOLATION',
    'REGIONAL_PARTITION',
    'PII_MASKING',
    'METRIC_REDACTION',
    'ROW_SIGNING'
  ],
  tenantId: 'org_101',
  userRegion: 'US-East'
});

const contractorVisibleRecord = contractorResult.records.find((r) => r.id === 'tx_01');
assert.ok(contractorVisibleRecord);
assert.ok(
  contractorVisibleRecord.grossRevenue.includes('Tier A'),
  'Financial metric must be bucketed rather than exposing exact dollars'
);
assert.ok(
  contractorVisibleRecord.paymentToken.includes('[HMAC_REDACTED]'),
  'Payment token must be HMAC-redacted'
);
console.log('✓ Financial metric redaction & payment token HMAC obfuscation validated');

// 5. Zero Database Rebuilds Invariance
for (const role of RLS_ROLES) {
  const res = simulateRlsEvaluation({
    role: role.id,
    activePolicyIds: RLS_POLICIES.map((p) => p.id)
  });
  assert.equal(res.databaseRebuildsRequired, 0, 'Database rebuilds must always be 0');
  assert.ok(res.executionLatencyMs < 20, 'Pure memory execution must be sub-20ms');
}
console.log('✓ Zero database rebuilds verified across all roles');

console.log('All Cryptographic RLS Simulator tests passed successfully! 🛡️⚡');
