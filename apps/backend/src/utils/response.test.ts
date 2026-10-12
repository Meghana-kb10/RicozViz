import assert from 'node:assert';
import { sanitizeErrorMessage, sanitizeErrorDetails } from './response.js';

console.log('Testing error payload sanitization...');

// 1. Database URI with credentials
const dbUriError = 'Failed to connect to mongodb://admin:p%40ssw0rd!@10.0.0.5:27017/core_mono?authSource=admin';
const sanitizedDbUri = sanitizeErrorMessage(dbUriError);
assert.strictEqual(
  sanitizedDbUri,
  'Failed to connect to [REDACTED_URI]',
  'Database URI must be redacted'
);
console.log('✓ Database URI sanitized');

// 2. Bearer tokens and JWTs
const tokenError = 'Invalid token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const sanitizedToken = sanitizeErrorMessage(tokenError);
assert.ok(!sanitizedToken.includes('eyJhbGci'), 'JWT token must be redacted');
assert.ok(sanitizedToken.includes('[REDACTED_TOKEN]') || sanitizedToken.includes('[REDACTED_JWT]'), 'Token must show redacted placeholder');
console.log('✓ Bearer token and JWT sanitized');

// 3. Absolute filesystem paths (Windows and POSIX)
const winPathError = 'Cannot read configuration file at C:\\Users\\Administrator\\AppData\\Local\\secret.json';
const sanitizedWinPath = sanitizeErrorMessage(winPathError);
assert.ok(!sanitizedWinPath.includes('Administrator'), 'Windows filesystem path must be redacted');
assert.ok(sanitizedWinPath.includes('[REDACTED_PATH]'), 'Windows path must show [REDACTED_PATH]');

const posixPathError = 'File missing at /home/deployer/app/secret.env';
const sanitizedPosixPath = sanitizeErrorMessage(posixPathError);
assert.ok(!sanitizedPosixPath.includes('deployer'), 'POSIX path must be redacted');
assert.ok(sanitizedPosixPath.includes('[REDACTED_PATH]'), 'POSIX path must show [REDACTED_PATH]');
console.log('✓ Filesystem paths sanitized');

// 4. Secret key/value pairs
const secretError = 'Authentication failed with password=supersecretpass and apiKey=ak_live_99887766';
const sanitizedSecret = sanitizeErrorMessage(secretError);
assert.ok(!sanitizedSecret.includes('supersecretpass'), 'Password must be redacted');
assert.ok(!sanitizedSecret.includes('ak_live_99887766'), 'ApiKey must be redacted');
console.log('✓ Secret key-value pairs sanitized');

// 5. Details map sanitization
const details = {
  db: ['Connection timeout at postgresql://user:pass@db:5432/mydb'],
  auth: ['Expired token: Bearer mysecrettoken123'],
  config: ['Path missing at C:\\Windows\\System32\\driver.sys']
};
const sanitizedDetails = sanitizeErrorDetails(details);
assert.ok(sanitizedDetails, 'Sanitized details must be returned');
assert.strictEqual(sanitizedDetails.db[0], 'Connection timeout at [REDACTED_URI]');
assert.ok(!sanitizedDetails.auth[0].includes('mysecrettoken123'));
assert.ok(!sanitizedDetails.config[0].includes('System32'));
console.log('✓ Error details dictionary sanitized');

console.log('All error sanitization tests passed successfully! 🎉');
