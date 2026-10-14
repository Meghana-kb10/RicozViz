import assert from 'node:assert/strict';
import { auditPreviewService } from './audit-preview.service.js';

async function runAuditPreviewTests() {
  console.log('Testing Multi-Tenant Audit Trail Preview & Cryptographic Ledger...');

  // 1. Test Audit Trail Preview Data Retrieval
  const preview = await auditPreviewService.getAuditTrailPreview();
  assert.ok(preview, 'Preview data should be returned');
  assert.ok(preview.immutableLogs.length >= 5, 'Should return at least 5 seeded immutable query logs');
  assert.ok(preview.activeSessions.length >= 4, 'Should return at least 4 active multi-tenant sessions');
  assert.ok(preview.revokedTokens.length >= 5, 'Should return token registry with active and revoked tokens');
  assert.equal(preview.ledgerIntegrity.tamperEvident, true, 'Ledger should report tamperEvident: true');
  assert.equal(preview.ledgerIntegrity.zeroLeakageEnforced, true, 'Zero leakage should be enforced');
  console.log('✓ Audit trail preview data & integrity summary verified');

  // 2. Test Cryptographic Hash Chaining on Genesis & Subsequent Blocks
  const logs = preview.immutableLogs;
  assert.equal(
    logs[0].prevBlockHash,
    '0000000000000000000000000000000000000000000000000000000000000000',
    'Genesis block should link to 64-character null prevBlockHash'
  );

  for (let i = 1; i < logs.length; i++) {
    assert.equal(
      logs[i].prevBlockHash,
      logs[i - 1].blockHash,
      `Block ${logs[i].blockHeight} prevBlockHash must strictly match block ${logs[i - 1].blockHeight} blockHash`
    );
    assert.ok(logs[i].cryptographicProof.startsWith('0x'), 'Proof should be prefixed with 0x');
  }
  console.log('✓ Cryptographic WORM hash chain validated across all seeded blocks');

  // 3. Test Full Chain Verification Method
  const verification = await auditPreviewService.verifyChainIntegrity();
  assert.equal(verification.valid, true, 'Chain integrity verification should report valid: true');
  assert.equal(verification.errors.length, 0, 'Chain integrity verification should report zero errors');
  assert.ok(verification.totalBlocksVerified >= 5, 'Should have verified all blocks');
  console.log('✓ verifyChainIntegrity confirmed 100% mathematical validity');

  // 4. Test Multi-Tenant Session Presence
  const sessions = preview.activeSessions;
  const tenants = new Set(sessions.map((s) => s.tenantId));
  assert.ok(tenants.size >= 4, 'Should represent at least 4 distinct enterprise tenants');
  const elenaSession = sessions.find((s) => s.userId === 'usr_elena_r');
  assert.ok(elenaSession, 'Elena Rostova session should exist');
  assert.equal(elenaSession.connectionStatus, 'QUERYING', 'Elena session should be active/querying');
  console.log('✓ Multi-tenant session presence across isolated tenants verified');

  // 5. Test Cryptographic Token Revocation (Kill-Switch)
  const targetTokenId = 'tok_live_12ff9c4'; // CyberShield restricted contractor token
  const revokeResult = await auditPreviewService.revokeToken({
    tokenId: targetTokenId,
    reason: 'Anomalous geographic IP egress detected by automated SIEM guardrail',
    revokedBy: 'CISO Autonomous SecOps'
  });

  assert.equal(revokeResult.success, true, 'Revocation should succeed');
  assert.equal(revokeResult.tokenId, targetTokenId, 'Revocation should target correct token ID');
  assert.ok(revokeResult.revocationReceiptSignature.startsWith('0x'), 'Should generate cryptographic receipt signature');
  assert.ok(revokeResult.invalidatedSessionId, 'Linked session should be invalidated');

  // Verify token is now marked REVOKED in registry
  const updatedPreview = await auditPreviewService.getAuditTrailPreview();
  const revokedToken = updatedPreview.revokedTokens.find((t) => t.tokenId === targetTokenId);
  assert.ok(revokedToken, 'Revoked token should exist in registry');
  assert.equal(revokedToken.status, 'REVOKED', 'Token status must be REVOKED');
  assert.equal(revokedToken.zeroReuseGuaranteed, true, 'Zero reuse must be guaranteed');

  // Verify linked session is disconnected
  const linkedSession = updatedPreview.activeSessions.find((s) => s.sessionId === revokeResult.invalidatedSessionId);
  assert.ok(linkedSession, 'Linked session should exist');
  assert.equal(linkedSession.connectionStatus, 'REVOKED', 'Linked session connection status must be REVOKED');

  // Verify new block was appended to ledger
  const latestBlock = updatedPreview.immutableLogs[updatedPreview.immutableLogs.length - 1];
  assert.ok(latestBlock.queryText.includes('CRYPTOGRAPHIC_REVOKE_TOKEN'), 'Ledger must record revocation event');
  assert.equal(latestBlock.status, 'GUARDRAIL_BLOCKED', 'Revocation event should be logged as guardrail');

  // Re-verify mathematical chain integrity after appending revocation block
  const postRevokeVerification = await auditPreviewService.verifyChainIntegrity();
  assert.equal(postRevokeVerification.valid, true, 'Chain integrity must remain valid after revocation block appended');
  assert.equal(postRevokeVerification.errors.length, 0, 'Zero errors after ledger append');
  console.log('✓ Cryptographic token revocation & dynamic ledger appending verified');

  // 6. Test Idempotent Revocation Call
  const duplicateRevoke = await auditPreviewService.revokeToken({
    tokenId: targetTokenId,
    reason: 'Duplicate revocation attempt'
  });
  assert.equal(duplicateRevoke.success, true, 'Duplicate call should be handled gracefully');
  assert.ok(duplicateRevoke.message.includes('previously cryptographically revoked'), 'Should report previously revoked');
  console.log('✓ Idempotent token revocation verified');

  console.log('All Multi-Tenant Audit Trail Preview tests passed successfully! 🛡️⚡');
}

runAuditPreviewTests().catch((err) => {
  console.error('Audit Preview test failed:', err);
  process.exit(1);
});
