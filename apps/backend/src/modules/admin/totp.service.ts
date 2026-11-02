// ==============================================================================
// RFC 6238 TOTP 2FA Service (Node Native Crypto)
// ==============================================================================
// Implements Time-based One-Time Password generation and verification per
// RFC 6238 / RFC 4226 without external dependencies.
// Integrates with CredentialService to encrypt secrets at rest using AES-256-GCM.
// ==============================================================================

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { credentialService, type EncryptedPayload } from '../ricozviz/data-source/credential.service.js';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function toBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

export function fromBase32(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export class TotpService {
  private readonly stepSeconds = 30;
  private readonly codeLength = 6;

  /**
   * Generates a new 20-byte random secret encoded as Base32.
   */
  generateSecret(): string {
    const buf = crypto.randomBytes(20);
    return toBase32(buf);
  }

  /**
   * Constructs an otpauth:// URI suitable for authenticator apps.
   */
  getOtpAuthUri(email: string, secret: string, issuer: string = 'RicozViz Admin'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const label = `${encodedIssuer}:${encodeURIComponent(email)}`;
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${this.codeLength}&period=${this.stepSeconds}`;
  }

  /**
   * Calculates the 6-digit TOTP code for a given timestamp.
   */
  generateCode(secretBase32: string, timestampMs: number = Date.now()): string {
    const key = fromBase32(secretBase32);
    const counter = Math.floor(timestampMs / 1000 / this.stepSeconds);

    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 10 ** this.codeLength;
    return otp.toString().padStart(this.codeLength, '0');
  }

  /**
   * Verifies a 6-digit TOTP code allowing a +/- 1 step (30s) drift window.
   */
  verifyCode(secretBase32: string, token: string, timestampMs: number = Date.now()): boolean {
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    for (let step = -1; step <= 1; step++) {
      const checkTime = timestampMs + step * this.stepSeconds * 1000;
      const expected = this.generateCode(secretBase32, checkTime);
      if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates 10 8-character random single-use backup codes, plus their bcrypt hashes.
   */
  async generateBackupCodes(count: number = 10): Promise<{ plaintextCodes: string[]; hashedCodes: string[] }> {
    const plaintextCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex'); // 8 characters hex
      plaintextCodes.push(code);
      const hash = await bcrypt.hash(code, 10);
      hashedCodes.push(hash);
    }

    return { plaintextCodes, hashedCodes };
  }

  /**
   * Verifies and consumes a backup code against an array of hashed backup codes.
   * Returns the remaining hashed codes on match, or null if invalid.
   */
  async verifyAndConsumeBackupCode(
    providedCode: string,
    hashedCodes: string[]
  ): Promise<{ valid: boolean; remainingHashed: string[] }> {
    const clean = providedCode.trim();
    for (let i = 0; i < hashedCodes.length; i++) {
      const matches = await bcrypt.compare(clean, hashedCodes[i]);
      if (matches) {
        const remaining = [...hashedCodes];
        remaining.splice(i, 1);
        return { valid: true, remainingHashed: remaining };
      }
    }
    return { valid: false, remainingHashed: hashedCodes };
  }

  /**
   * Encrypts TOTP secret at rest with AES-256-GCM.
   */
  encryptSecret(secretBase32: string): EncryptedPayload {
    return credentialService.encryptRaw(secretBase32);
  }

  /**
   * Decrypts TOTP secret from its encrypted payload.
   */
  decryptSecret(payload: EncryptedPayload): string {
    return credentialService.decryptRaw(payload);
  }
}

export const totpService = new TotpService();
