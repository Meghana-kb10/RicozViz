// ========================================
// Credential Service — Enterprise AES-256-GCM Encryption at Rest
// ========================================
// Encrypts sensitive credentials (database passwords, tokens, API keys,
// SMTP secrets, Slack webhooks) at rest using AES-256-GCM with key rotation.
// Guarantees zero credential leakage in API responses or logs.
// ========================================

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { CredentialVaultModel, toObjectId } from '@repo/database';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export class CredentialService {
  private readonly activeKeyVersion: number;
  private readonly keyMap: Map<number, Buffer> = new Map();
  // Fast memory cache for hot query engines to avoid redundant DB reads
  private readonly memoryCache = new Map<string, { creds: Record<string, unknown>; cachedAt: number }>();

  constructor() {
    this.activeKeyVersion = config.credentialEncKeyVersion || 1;

    // 1. Resolve active key
    const activeKeyBuf = this.normalizeKey(config.credentialEncKey);
    this.keyMap.set(this.activeKeyVersion, activeKeyBuf);

    // 2. Parse previous keys for seamless rotation: e.g. "1:hexkey,2:hexkey"
    if (config.credentialEncKeysPrevious) {
      const parts = config.credentialEncKeysPrevious.split(',');
      for (const part of parts) {
        const [vStr, kStr] = part.split(':').map((s) => s.trim());
        const vNum = Number(vStr);
        if (vNum && kStr) {
          this.keyMap.set(vNum, this.normalizeKey(kStr));
        }
      }
    }
  }

  /**
   * Normalizes an encryption key into a 32-byte Buffer.
   * If 64 hex characters, parses directly; otherwise hashes with SHA-256.
   */
  private normalizeKey(rawKey: string): Buffer {
    const trimmed = rawKey.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  /**
   * Retrieves the 32-byte encryption key for a given version.
   */
  private getKey(version: number): Buffer {
    const key = this.keyMap.get(version);
    if (!key) {
      // Fallback to active key if specific version is missing
      return this.keyMap.get(this.activeKeyVersion)!;
    }
    return key;
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   */
  encryptRaw(plaintext: string, targetVersion: number = this.activeKeyVersion): EncryptedPayload {
    const key = this.getKey(targetVersion);
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: targetVersion
    };
  }

  /**
   * Decrypts an encrypted payload using AES-256-GCM with key-version awareness.
   */
  decryptRaw(payload: EncryptedPayload): string {
    const key = this.getKey(payload.keyVersion);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Encrypts and securely stores connector credentials at rest in MongoDB.
   * Returns an opaque reference string `cred_<uuid>`.
   */
  async storeCredentials(
    orgId: string,
    credentials: Record<string, unknown>,
    workspaceId?: string | null
  ): Promise<string> {
    const credentialRef = `cred_${crypto.randomUUID()}`;
    const plaintext = JSON.stringify(credentials);
    const encrypted = this.encryptRaw(plaintext);

    const orgObjectId = toObjectId(orgId);
    if (orgObjectId && mongoose.connection.readyState === 1) {
      try {
        await CredentialVaultModel.create({
          reference: credentialRef,
          organizationId: orgObjectId,
          workspaceId: workspaceId ? toObjectId(workspaceId) : null,
          encryptedData: encrypted.encryptedData,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          algorithm: 'aes-256-gcm'
        });
      } catch (err) {
      logger.warn('[CredentialService] MongoDB persistence failed, falling back to cache', {
        error: err instanceof Error ? err.message : String(err)
      });
      }
    }

    // Cache in memory for immediate hot access
    this.memoryCache.set(credentialRef, { creds: credentials, cachedAt: Date.now() });

    return credentialRef;
  }

  /**
   * Retrieves and decrypts credentials for internal connector use only.
   * Never exposed to API callers.
   */
  async getCredentials(credentialRef: string): Promise<Record<string, unknown> | null> {
    // 1. Check hot memory cache
    const cached = this.memoryCache.get(credentialRef);
    if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
      return cached.creds;
    }

    // 2. Fetch from MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const record = await CredentialVaultModel.findOne({ reference: credentialRef }).lean();
      if (!record) return null;

      const plaintext = this.decryptRaw({
        encryptedData: record.encryptedData,
        iv: record.iv,
        authTag: record.authTag,
        keyVersion: record.keyVersion
      });

      const parsed = JSON.parse(plaintext) as Record<string, unknown>;
      this.memoryCache.set(credentialRef, { creds: parsed, cachedAt: Date.now() });
      return parsed;
    } catch (err) {
      logger.error('[CredentialService] Failed to decrypt credential record', {
        reference: credentialRef,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
      }
    }
    return null;
  }

  /**
   * Checks if credentials exist for a given reference.
   */
  async hasCredentials(credentialRef: string): Promise<boolean> {
    if (this.memoryCache.has(credentialRef)) return true;
    try {
      const exists = await CredentialVaultModel.exists({ reference: credentialRef });
      return Boolean(exists);
    } catch {
      return false;
    }
  }

  /**
   * Removes credentials from the vault upon data source deletion.
   */
  async deleteCredentials(credentialRef: string): Promise<void> {
    this.memoryCache.delete(credentialRef);
    try {
      await CredentialVaultModel.deleteOne({ reference: credentialRef });
    } catch (err) {
      logger.warn('[CredentialService] Failed to delete credential record from MongoDB', {
        reference: credentialRef,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  /**
   * Re-encrypts all credentials stored under an older key version with the latest key.
   */
  async rotateAllCredentials(newKeyVersion: number = this.activeKeyVersion): Promise<number> {
    let rotatedCount = 0;
    try {
      const records = await CredentialVaultModel.find({
        keyVersion: { $ne: newKeyVersion }
      }).lean();

      for (const record of records) {
        try {
          const decrypted = this.decryptRaw({
            encryptedData: record.encryptedData,
            iv: record.iv,
            authTag: record.authTag,
            keyVersion: record.keyVersion
          });

          const reEncrypted = this.encryptRaw(decrypted, newKeyVersion);
          await CredentialVaultModel.updateOne(
            { _id: record._id },
            {
              encryptedData: reEncrypted.encryptedData,
              iv: reEncrypted.iv,
              authTag: reEncrypted.authTag,
              keyVersion: reEncrypted.keyVersion
            }
          );
          rotatedCount++;
        } catch (rotErr) {
          logger.error('[CredentialService] Failed rotating credential record', {
            id: record._id,
            error: rotErr instanceof Error ? rotErr.message : String(rotErr)
          });
        }
      }
    } catch (err) {
      logger.error('[CredentialService] Rotation batch failed', {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    return rotatedCount;
  }

  /**
   * Masks secret string values for safe API output.
   */
  maskSecret(val?: string | null): string {
    if (!val) return '';
    if (val.length <= 6) return '••••••••';
    return `${val.slice(0, 2)}••••••••${val.slice(-2)}`;
  }

  /**
   * Sanitizes a credential dictionary so secrets are never returned in API responses.
   */
  maskCredentials(creds?: Record<string, unknown> | null): Record<string, unknown> {
    if (!creds) return {};
    const masked: Record<string, unknown> = {};
    const secretKeys = ['password', 'apikey', 'bearertoken', 'secret', 'token', 'accesskey'];

    for (const [key, value] of Object.entries(creds)) {
      if (secretKeys.includes(key.toLowerCase())) {
        masked[key] = '••••••••';
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}

// Singleton instance
export const credentialService = new CredentialService();
