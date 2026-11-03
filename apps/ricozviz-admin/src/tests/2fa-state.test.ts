import assert from 'node:assert/strict';

/**
 * Unit tests for 2FA state management, TOTP input normalization, and backup code formats.
 */

function normalizeTotpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

function normalizeBackupCode(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
}

function isValidTotpFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function isValidBackupCodeFormat(code: string): boolean {
  return /^[a-z0-9]{8}$/.test(code);
}

console.log('Running 2FA state & input normalization tests...');

// 1. TOTP code cleaning & length limit
assert.equal(normalizeTotpInput('123-456'), '123456');
assert.equal(normalizeTotpInput(' 987 654 '), '987654');
assert.equal(normalizeTotpInput('123456789'), '123456', 'Must truncate at 6 digits');
assert.equal(isValidTotpFormat(normalizeTotpInput('123-456')), true);
assert.equal(isValidTotpFormat('12345'), false, '5 digits must be rejected');

// 2. Backup code normalization
assert.equal(normalizeBackupCode('A1B2-C3D4'), 'a1b2c3d4');
assert.equal(normalizeBackupCode('  X9Y8Z7W6  '), 'x9y8z7w6');
assert.equal(isValidBackupCodeFormat(normalizeBackupCode('A1B2-C3D4')), true);
assert.equal(isValidBackupCodeFormat('a1b2'), false, 'Short backup code rejected');

// 3. Backup code array formatting for export
const sampleBackupCodes = [
  'a1b2c3d4',
  'e5f6g7h8',
  'i9j0k1l2',
  'm3n4o5p6',
  'q7r8s9t0',
  'u1v2w3x4',
  'y5z6a7b8',
  'c9d0e1f2',
  'g3h4i5j6',
  'k7l8m9n0'
];

assert.equal(sampleBackupCodes.length, 10);
assert.equal(
  sampleBackupCodes.every((c) => isValidBackupCodeFormat(c)),
  true
);

console.log('✅ 2FA state & input normalization tests passed successfully.');
