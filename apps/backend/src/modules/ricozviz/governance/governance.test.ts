// ========================================
// Governance & Security Badges Unit Tests
// ========================================
// Validates enterprise security badges, cryptographic proof verification,
// and sanitized payload behavior.
// ========================================

import assert from 'node:assert/strict';
import { governanceService, ENTERPRISE_SECURITY_BADGES } from './governance.service.js';
import { AppError } from '../../../utils/errors.js';
import { sanitizeResponsePayload } from '../../../utils/response.js';

async function runTests() {
  console.log('Testing Enterprise Security & Governance Badges...');

  // 1. All badges retrieved
  const allBadges = await governanceService.getSecurityBadges();
  assert.equal(allBadges.length, 8, 'Expected 8 enterprise security badges');
  assert.ok(allBadges.some((b) => b.id === 'soc2-type-2'), 'Should include SOC 2 Type II');
  assert.ok(allBadges.some((b) => b.id === 'hipaa-compliant'), 'Should include HIPAA Ready');
  assert.ok(allBadges.some((b) => b.id === 'iso-27001'), 'Should include ISO 27001');
  assert.ok(allBadges.some((b) => b.id === 'gdpr-ccpa'), 'Should include GDPR & CCPA');
  assert.ok(allBadges.some((b) => b.id === 'cryptographic-rls'), 'Should include Cryptographic RLS');
  assert.ok(allBadges.some((b) => b.id === 'immutable-audit'), 'Should include Immutable Audit');
  assert.ok(allBadges.some((b) => b.id === 'zero-credential-exposure'), 'Should include Zero Credential Exposure');
  assert.ok(allBadges.some((b) => b.id === 'sandboxed-embed'), 'Should include Sandboxed Embed');
  console.log('✓ All 8 enterprise security badges verified');

  // 2. Category filtering
  const complianceBadges = await governanceService.getSecurityBadges('COMPLIANCE');
  assert.ok(complianceBadges.length >= 3, 'Should filter compliance badges');
  assert.ok(complianceBadges.every((b) => b.category === 'COMPLIANCE'), 'All returned badges must be COMPLIANCE');

  const accessBadges = await governanceService.getSecurityBadges('ACCESS_CONTROL');
  assert.ok(accessBadges.length >= 2, 'Should filter access control badges');
  assert.ok(accessBadges.every((b) => b.category === 'ACCESS_CONTROL'), 'All returned badges must be ACCESS_CONTROL');
  console.log('✓ Category filtering works as expected');

  // 3. Single badge lookup
  const soc2Badge = await governanceService.getSecurityBadgeById('soc2-type-2');
  assert.equal(soc2Badge.id, 'soc2-type-2');
  assert.equal(soc2Badge.status, 'VERIFIED');
  assert.ok(soc2Badge.evidenceHash.length === 64, 'Evidence hash should be valid 64-char SHA-256');

  // Lookup invalid badge throws AppError.notFound
  await assert.rejects(
    async () => {
      await governanceService.getSecurityBadgeById('non-existent-badge');
    },
    (err: unknown) => err instanceof AppError && err.statusCode === 404,
    'Should throw 404 for non-existent badge'
  );
  console.log('✓ Single badge lookup and 404 handling verified');

  // 4. Cryptographic signature verification
  const verification = await governanceService.verifySecurityBadge('soc2-type-2');
  assert.equal(verification.valid, true);
  assert.equal(verification.signatureVerified, true);
  assert.equal(verification.badgeId, 'soc2-type-2');
  assert.ok(verification.evidenceHash.length === 64);
  console.log('✓ Cryptographic signature verification passed');

  // 5. Overall Governance Posture Evaluation
  const posture = await governanceService.getGovernancePosture();
  assert.equal(posture.postureScore, 100);
  assert.equal(posture.overallStatus, 'HEALTHY_VERIFIED');
  assert.equal(posture.tlsVersion, 'TLSv1.3');
  assert.equal(posture.atRestCipher, 'AES-256-GCM');
  assert.equal(posture.zeroLeakageGuarantee, true);
  assert.equal(posture.badges.length, 8);
  console.log('✓ Enterprise governance posture score & controls evaluated');

  // 6. Error & payload sanitization verification
  const payloadWithSecrets = {
    badge: soc2Badge,
    leakAttempt: {
      password: 'super-secret-password-123',
      apiKey: 'api_live_9988224411',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret',
      databaseUri: 'mongodb://admin:secretPass@mongo.internal:27017/prod_db'
    }
  };

  const sanitized = sanitizeResponsePayload(payloadWithSecrets);
  const jsonStr = JSON.stringify(sanitized);
  assert.ok(!jsonStr.includes('super-secret-password-123'), 'Passwords must be sanitized');
  assert.ok(!jsonStr.includes('api_live_9988224411'), 'API keys must be sanitized');
  assert.ok(!jsonStr.includes('admin:secretPass@mongo.internal'), 'Connection URIs must be sanitized');
  console.log('✓ Error & payload sanitization verified with zero credential leakage');

  console.log('All governance tests passed successfully! 🛡️');
}

runTests().catch((err) => {
  console.error('Governance tests failed:', err);
  process.exit(1);
});
