// ========================================
// Credential Service — Secure Secret Storage
// ========================================
// Separates sensitive credentials (passwords, tokens, API keys)
// from ordinary data source configuration.
// Uses AES-256-GCM authenticated encryption.
// Credentials never leak into API responses, logs, or error traces.
// ========================================

import crypto from "node:crypto";
import { config } from "../../config/env.js";

interface EncryptedPayload {
  iv: string;
  authTag: string;
  data: string;
  orgId: string;
  createdAt: number;
}

export class CredentialService {
  private encryptionKey: Buffer;
  // In-memory encrypted store for the MVP; easily swappable with Redis/Vault/KMS in production
  private vault = new Map<string, EncryptedPayload>();

  constructor() {
    // Derive a fixed 32-byte key using PBKDF2 from environment secrets
    const secretSource = `${config.JWT_ACCESS_SECRET}::${config.JWT_REFRESH_SECRET}`;
    this.encryptionKey = crypto.scryptSync(secretSource, "ricozviz-cred-salt-2026", 32);
  }

  /**
   * Encrypts and securely stores credentials, returning an opaque credential reference.
   */
  storeCredentials(
    orgId: string,
    credentials: Record<string, unknown>
  ): Promise<string> {
    const credentialRef = `cred_${crypto.randomUUID()}`;
    const plaintext = JSON.stringify(credentials);

    const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    this.vault.set(credentialRef, {
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
      data: encrypted,
      orgId,
      createdAt: Date.now(),
    });

    return Promise.resolve(credentialRef);
  }

  /**
   * Retrieves and decrypts credentials for internal connector use only.
   */
  getCredentials(
    credentialRef: string
  ): Promise<Record<string, unknown> | null> {
    const record = this.vault.get(credentialRef);
    if (!record) return Promise.resolve(null);

    try {
      const iv = Buffer.from(record.iv, "hex");
      const authTag = Buffer.from(record.authTag, "hex");
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(record.data, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return Promise.resolve(JSON.parse(decrypted) as Record<string, unknown>);
    } catch {
      return Promise.resolve(null);
    }
  }

  /**
   * Checks if credentials exist for a given reference without decrypting.
   */
  hasCredentials(credentialRef: string): Promise<boolean> {
    return Promise.resolve(this.vault.has(credentialRef));
  }

  /**
   * Removes credentials from the vault upon data source deletion.
   */
  deleteCredentials(credentialRef: string): Promise<void> {
    this.vault.delete(credentialRef);
    return Promise.resolve();
  }
}

// Singleton instance
export const credentialService = new CredentialService();
