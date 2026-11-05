// ==============================================================================
// Platform Admin Authentication Service
// ==============================================================================
// Handles isolated admin authentication, 15-minute admin JWTs, rotating refresh
// tokens with family replay defense, and mandatory RFC 6238 TOTP 2FA.
// ==============================================================================

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  UserModel,
  RefreshTokenModel,
  toObjectId,
  type IUserDocument
} from '@repo/database';
import {
  signAdminAccessToken,
  signAdminPendingToken,
  signAdminRefreshToken,
  verifyAdminRefreshToken,
  ADMIN_REFRESH_COOKIE,
  getAdminRefreshCookieOptions
} from '../../lib/jwt.js';
import { totpService } from './totp.service.js';
import { consumedPendingJtiService } from './consumed-jti.service.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { logAuditEvent } from '../ricozviz/audit/audit.service.js';
import type { AdminLoginInput, AdminTotpVerifyInput } from '@repo/validation';

const BCRYPT_ROUNDS = 12;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const DUMMY_HASH = '$2a$12$dummy.hash.to.prevent.timing.attacks.123456789';

export interface AdminAuthResult {
  requires2Fa?: boolean;
  pendingToken?: string;
  accessToken?: string;
  refreshToken?: string;
  cookieOptions?: ReturnType<typeof getAdminRefreshCookieOptions>;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    twoFactorEnabled: boolean;
  };
}

export class AdminAuthService {
  private assertNotLocked(user: { lockUntil?: Date | null }) {
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const waitMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw AppError.forbidden(`Account is temporarily locked due to repeated failed logins. Please try again in ${waitMinutes} minutes.`);
    }
  }

  private async recordFailedAttempt(userId: any, currentAttempts: number, email: string) {
    const attempts = (currentAttempts || 0) + 1;
    const updates: { failedLoginAttempts: number; lockUntil?: Date | null } = { failedLoginAttempts: attempts };
    if (attempts >= 5) {
      updates.lockUntil = new Date(Date.now() + FIFTEEN_MINUTES_MS);
      logger.warn(`[AdminAuth] Platform admin account locked due to ${attempts} failed attempts: "${email}"`);
    }
    await UserModel.updateOne({ _id: userId }, { $set: updates });
  }

  private async resetLockout(userId: any) {
    await UserModel.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, lockUntil: null } }
    );
  }

  /**
   * Platform admin login with password, account lockout defense, and TOTP 2FA check.
   */
  async login(
    input: AdminLoginInput,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminAuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await UserModel.findOne({ email }).select(
      '+passwordHash +twoFactorSecretEncrypted +twoFactorSecretIv +twoFactorSecretAuthTag +twoFactorSecretKeyVersion +twoFactorBackupCodesHashed +lockUntil +failedLoginAttempts'
    );

    // 1. Account lockout check
    if (user) {
      this.assertNotLocked(user);
    }

    // 2. Reject non-admins with timing-safe comparison
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      await bcrypt.compare(input.password, DUMMY_HASH);
      throw AppError.unauthorized('Invalid admin credentials');
    }

    // 3. Verify password
    const passwordMatch = user.passwordHash
      ? await bcrypt.compare(input.password, user.passwordHash)
      : false;

    if (!passwordMatch) {
      await this.recordFailedAttempt(user._id, user.failedLoginAttempts || 0, user.email);
      throw AppError.unauthorized('Invalid admin credentials');
    }

    // Reset failed attempts on valid password
    await this.resetLockout(user._id);

    // 4. TOTP 2FA Verification
    if (user.twoFactorEnabled) {
      let twoFactorValid = false;

      if (input.totpCode && user.twoFactorSecretEncrypted && user.twoFactorSecretIv && user.twoFactorSecretAuthTag) {
        const decryptedSecret = totpService.decryptSecret({
          encryptedData: user.twoFactorSecretEncrypted,
          iv: user.twoFactorSecretIv,
          authTag: user.twoFactorSecretAuthTag,
          keyVersion: user.twoFactorSecretKeyVersion || 1
        });
        twoFactorValid = totpService.verifyCode(decryptedSecret, input.totpCode);
      } else if (input.backupCode && user.twoFactorBackupCodesHashed?.length) {
        const consumeResult = await totpService.verifyAndConsumeBackupCode(
          input.backupCode,
          user.twoFactorBackupCodesHashed
        );
        if (consumeResult.valid) {
          twoFactorValid = true;
          await UserModel.updateOne(
            { _id: user._id },
            { $set: { twoFactorBackupCodesHashed: consumeResult.remainingHashed } }
          );
          logger.info(`[AdminAuth] Single-use backup code consumed for admin "${email}".`);
        }
      }

      if (!twoFactorValid) {
        // Password verified, return short-lived (5 min) single-use 2FA-pending token with NO cookie
        if (!input.totpCode && !input.backupCode) {
          const { token: pendingToken } = signAdminPendingToken({
            sub: user._id.toString(),
            email: user.email
          });
          return {
            requires2Fa: true,
            pendingToken,
            user: {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              role: user.role,
              twoFactorEnabled: true
            }
          };
        }
        await this.recordFailedAttempt(user._id, user.failedLoginAttempts || 0, user.email);
        throw AppError.unauthorized('Invalid two-factor authentication code or backup code');
      }

      await this.resetLockout(user._id);
    }

    // 5. Issue 15-minute access token and rotating refresh token
    const familyId = crypto.randomUUID();
    const tokenVersion = user.tokenVersion || 0;

    const accessToken = signAdminAccessToken({
      sub: user._id.toString(),
      email: user.email,
      twoFactorVerified: true
    });

    const refreshToken = signAdminRefreshToken(user._id.toString(), tokenVersion, familyId);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await RefreshTokenModel.create({
      tokenHash,
      userId: user._id,
      familyId,
      createdByIp: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS)
    });

    await logAuditEvent({
      organizationId: 'platform',
      userId: user._id.toString(),
      action: 'ADMIN_LOGIN_SUCCESS',
      resourceType: 'ADMIN_SESSION',
      resourceId: user._id.toString(),
      ipAddress,
      userAgent,
      metadata: { email: user.email, twoFactorUsed: Boolean(user.twoFactorEnabled) }
    }).catch(() => {});

    return {
      accessToken,
      refreshToken,
      cookieOptions: getAdminRefreshCookieOptions(SEVEN_DAYS_MS),
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: Boolean(user.twoFactorEnabled)
      }
    };
  }

  /**
   * Refresh admin access token with rotation and family replay detection.
   */
  async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    accessToken: string;
    newRefreshToken: string;
    cookieOptions: ReturnType<typeof getAdminRefreshCookieOptions>;
  }> {
    const payload = verifyAdminRefreshToken(rawRefreshToken);
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const storedToken = await RefreshTokenModel.findOne({ tokenHash });
    const user = await UserModel.findById(toObjectId(payload.sub));

    if (!user || user.role !== 'PLATFORM_ADMIN') {
      throw AppError.unauthorized('Admin user not found');
    }

    if (!storedToken) {
      if (payload.familyId) {
        logger.warn(`[AdminAuth] Replay detected for family ${payload.familyId}. Revoking all family tokens.`);
        await RefreshTokenModel.deleteMany({ familyId: payload.familyId });
      }
      throw AppError.unauthorized('Invalid or already used refresh token');
    }

    if (storedToken.isRevoked) {
      if (storedToken.familyId) {
        await RefreshTokenModel.deleteMany({ familyId: storedToken.familyId });
      }
      throw AppError.unauthorized('Refresh token revoked');
    }

    // Mark current token as revoked
    storedToken.isRevoked = true;
    await storedToken.save();

    // Issue rotated tokens
    const newFamilyId = storedToken.familyId || crypto.randomUUID();
    const newRefreshToken = signAdminRefreshToken(user._id.toString(), user.tokenVersion || 0, newFamilyId);
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await RefreshTokenModel.create({
      tokenHash: newTokenHash,
      userId: user._id,
      familyId: newFamilyId,
      createdByIp: ipAddress || storedToken.createdByIp || null,
      userAgent: userAgent || storedToken.userAgent || null,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS)
    });

    const accessToken = signAdminAccessToken({
      sub: user._id.toString(),
      email: user.email,
      twoFactorVerified: true
    });

    return {
      accessToken,
      newRefreshToken,
      cookieOptions: getAdminRefreshCookieOptions(SEVEN_DAYS_MS)
    };
  }

  /**
   * Revoke admin session.
   */
  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    try {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      const stored = await RefreshTokenModel.findOne({ tokenHash });
      if (stored?.familyId) {
        await RefreshTokenModel.deleteMany({ familyId: stored.familyId });
      } else if (stored) {
        await RefreshTokenModel.deleteOne({ _id: stored._id });
      }
    } catch (err) {
      logger.warn('[AdminAuth] Error during admin logout', { error: err });
    }
  }

  /**
   * Enroll admin in TOTP 2FA. Allowed only while admin has no confirmed TOTP.
   * If already enrolled, requires full twoFactorVerified token plus current TOTP code to re-enroll.
   */
  async enrollTotp(
    userId: string,
    isFullVerifiedToken = false,
    currentTotpCode?: string
  ): Promise<{
    secret: string;
    otpauthUri: string;
  }> {
    const user = await UserModel.findById(toObjectId(userId)).select(
      '+twoFactorSecretEncrypted +twoFactorSecretIv +twoFactorSecretAuthTag +twoFactorSecretKeyVersion +lockUntil +failedLoginAttempts'
    );
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      throw AppError.notFound('Admin user not found');
    }

    this.assertNotLocked(user);

    const isAlreadyEnrolled = Boolean(user.twoFactorEnabled && user.twoFactorVerifiedAt);

    if (isAlreadyEnrolled) {
      if (!isFullVerifiedToken) {
        throw AppError.forbidden('Forbidden: Platform admin has already enrolled and confirmed two-factor authentication');
      }

      if (!currentTotpCode) {
        throw AppError.badRequest('Current TOTP code is required to re-enroll two-factor authentication');
      }

      if (!user.twoFactorSecretEncrypted || !user.twoFactorSecretIv || !user.twoFactorSecretAuthTag) {
        throw AppError.badRequest('Two-factor secret is corrupted or missing');
      }

      const decryptedSecret = totpService.decryptSecret({
        encryptedData: user.twoFactorSecretEncrypted,
        iv: user.twoFactorSecretIv,
        authTag: user.twoFactorSecretAuthTag,
        keyVersion: user.twoFactorSecretKeyVersion || 1
      });

      const isValid = totpService.verifyCode(decryptedSecret, currentTotpCode);
      if (!isValid) {
        await this.recordFailedAttempt(user._id, user.failedLoginAttempts || 0, user.email);
        throw AppError.unauthorized('Invalid current two-factor authentication code');
      }

      await this.resetLockout(user._id);
    }

    const secret = totpService.generateSecret();
    const encrypted = totpService.encryptSecret(secret);

    user.twoFactorSecretEncrypted = encrypted.encryptedData;
    user.twoFactorSecretIv = encrypted.iv;
    user.twoFactorSecretAuthTag = encrypted.authTag;
    user.twoFactorSecretKeyVersion = encrypted.keyVersion;
    user.twoFactorEnabled = false; // enabled only upon verify
    user.twoFactorVerifiedAt = undefined;
    await user.save();

    return {
      secret,
      otpauthUri: totpService.getOtpAuthUri(user.email, secret)
    };
  }

  /**
   * Verify TOTP code or backup code to complete 2FA login/enrollment.
   * Consumes single-use pending token JTI, resets lockout, issues 15-minute access token
   * and 7-day refresh token, and enables 2FA if first-time confirmation.
   */
  async verifyTotp(
    userId: string,
    input: AdminTotpVerifyInput,
    pendingTokenJti?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    cookieOptions: ReturnType<typeof getAdminRefreshCookieOptions>;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      twoFactorEnabled: boolean;
    };
    backupCodes?: string[];
  }> {
    if (!pendingTokenJti) {
      throw AppError.unauthorized('Invalid pending token: missing token identifier');
    }

    if (await consumedPendingJtiService.isConsumed(pendingTokenJti)) {
      throw AppError.unauthorized('Two-factor pending token has already been consumed');
    }

    const user = await UserModel.findById(toObjectId(userId)).select(
      '+twoFactorSecretEncrypted +twoFactorSecretIv +twoFactorSecretAuthTag +twoFactorSecretKeyVersion +twoFactorBackupCodesHashed +lockUntil +failedLoginAttempts'
    );
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      throw AppError.notFound('Admin user not found');
    }

    this.assertNotLocked(user);

    let codeValid = false;
    let backupCodeConsumed = false;

    if (input.totpCode && user.twoFactorSecretEncrypted && user.twoFactorSecretIv && user.twoFactorSecretAuthTag) {
      const decryptedSecret = totpService.decryptSecret({
        encryptedData: user.twoFactorSecretEncrypted,
        iv: user.twoFactorSecretIv,
        authTag: user.twoFactorSecretAuthTag,
        keyVersion: user.twoFactorSecretKeyVersion || 1
      });
      codeValid = totpService.verifyCode(decryptedSecret, input.totpCode);
    } else if (input.backupCode && user.twoFactorBackupCodesHashed?.length) {
      const consumeResult = await totpService.verifyAndConsumeBackupCode(
        input.backupCode,
        user.twoFactorBackupCodesHashed
      );
      if (consumeResult.valid) {
        codeValid = true;
        backupCodeConsumed = true;
        await UserModel.updateOne(
          { _id: user._id },
          { $set: { twoFactorBackupCodesHashed: consumeResult.remainingHashed } }
        );
        logger.info(`[AdminAuth] Single-use backup code consumed during 2FA verify for admin "${user.email}".`);
      }
    }

    if (!codeValid) {
      await this.recordFailedAttempt(user._id, user.failedLoginAttempts || 0, user.email);
      throw AppError.unauthorized('Invalid two-factor authentication code or backup code');
    }

    await this.resetLockout(user._id);
    await consumedPendingJtiService.consume(pendingTokenJti, user._id.toString());

    let backupCodes: string[] | undefined;
    if (!user.twoFactorEnabled || !user.twoFactorVerifiedAt) {
      const { plaintextCodes, hashedCodes } = await totpService.generateBackupCodes();
      user.twoFactorEnabled = true;
      user.twoFactorVerifiedAt = new Date();
      user.twoFactorBackupCodesHashed = hashedCodes;
      await user.save();
      backupCodes = plaintextCodes;
      logger.info(`[AdminAuth] 2FA successfully confirmed and activated for platform admin "${user.email}".`);
    }

    const familyId = crypto.randomUUID();
    const tokenVersion = user.tokenVersion || 0;

    const accessToken = signAdminAccessToken({
      sub: user._id.toString(),
      email: user.email,
      twoFactorVerified: true
    });

    const refreshToken = signAdminRefreshToken(user._id.toString(), tokenVersion, familyId);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await RefreshTokenModel.create({
      tokenHash,
      userId: user._id,
      familyId,
      createdByIp: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS)
    });

    await logAuditEvent({
      organizationId: 'platform',
      userId: user._id.toString(),
      action: 'ADMIN_LOGIN_SUCCESS',
      resourceType: 'ADMIN_SESSION',
      resourceId: user._id.toString(),
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
        method: backupCodeConsumed ? 'BACKUP_CODE' : 'TOTP',
        firstEnrollment: Boolean(backupCodes)
      }
    }).catch(() => {});

    return {
      accessToken,
      refreshToken,
      cookieOptions: getAdminRefreshCookieOptions(SEVEN_DAYS_MS),
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: true
      },
      backupCodes
    };
  }

  /**
   * Change platform admin password with current password verification and audit logging.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await UserModel.findById(toObjectId(userId)).select('+passwordHash');
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      throw AppError.notFound('Admin user not found');
    }

    const currentMatches = user.passwordHash
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;

    if (!currentMatches) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordHash = newHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAuditEvent({
      organizationId: 'SYSTEM',
      action: 'UPDATE',
      resourceType: 'ADMIN_USER',
      resourceId: user._id.toString(),
      userId: user._id.toString(),
      ipAddress,
      userAgent,
      metadata: { action: 'PASSWORD_CHANGE', adminEmail: user.email }
    });

    logger.info(`[AdminAuth] Password successfully changed for platform admin "${user.email}".`);
  }

  /**
   * Regenerate backup codes for platform admin. Requires verified current TOTP code.
   */
  async regenerateBackupCodes(
    userId: string,
    totpCode: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ backupCodes: string[] }> {
    const user = await UserModel.findById(toObjectId(userId)).select(
      '+twoFactorSecretEncrypted +twoFactorSecretIv +twoFactorSecretAuthTag +twoFactorSecretKeyVersion'
    );
    if (!user || user.role !== 'PLATFORM_ADMIN') {
      throw AppError.notFound('Admin user not found');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted || !user.twoFactorSecretIv || !user.twoFactorSecretAuthTag) {
      throw AppError.badRequest('Two-factor authentication is not active on this account');
    }

    const decryptedSecret = totpService.decryptSecret({
      encryptedData: user.twoFactorSecretEncrypted,
      iv: user.twoFactorSecretIv,
      authTag: user.twoFactorSecretAuthTag,
      keyVersion: user.twoFactorSecretKeyVersion || 1
    });

    const isValid = totpService.verifyCode(decryptedSecret, totpCode);
    if (!isValid) {
      throw AppError.badRequest('Invalid 6-digit TOTP verification code');
    }

    const { plaintextCodes, hashedCodes } = await totpService.generateBackupCodes();

    user.twoFactorBackupCodesHashed = hashedCodes;
    await user.save();

    await logAuditEvent({
      organizationId: 'SYSTEM',
      action: 'UPDATE',
      resourceType: 'ADMIN_USER',
      resourceId: user._id.toString(),
      userId: user._id.toString(),
      ipAddress,
      userAgent,
      metadata: { action: 'REGENERATE_BACKUP_CODES', adminEmail: user.email }
    });

    logger.info(`[AdminAuth] Backup codes regenerated for platform admin "${user.email}".`);

    return { backupCodes: plaintextCodes };
  }

  /**
   * List active refresh token sessions for platform admin.
   */
  async listSessions(
    userId: string,
    currentRefreshToken?: string
  ): Promise<Array<{
    id: string;
    ipAddress: string;
    userAgent: string;
    createdAt: string;
    lastUsedAt: string;
    isCurrent: boolean;
  }>> {
    const currentHash = currentRefreshToken
      ? crypto.createHash('sha256').update(currentRefreshToken).digest('hex')
      : null;

    const tokens = await RefreshTokenModel.find({
      userId: toObjectId(userId),
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    })
      .sort({ updatedAt: -1 })
      .lean();

    return tokens.map((t) => ({
      id: t._id.toString(),
      ipAddress: t.createdByIp || '127.0.0.1',
      userAgent: t.userAgent || 'Unknown Browser / Session',
      createdAt: t.createdAt.toISOString(),
      lastUsedAt: t.updatedAt.toISOString(),
      isCurrent: Boolean(currentHash && t.tokenHash === currentHash)
    }));
  }

  /**
   * Revoke a single active admin refresh session.
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const sId = toObjectId(sessionId);
    if (!sId) throw AppError.badRequest('Invalid session ID');

    const token = await RefreshTokenModel.findOne({
      _id: sId,
      userId: toObjectId(userId)
    });

    if (!token) {
      throw AppError.notFound('Session not found or already revoked');
    }

    token.isRevoked = true;
    await token.save();

    if (token.familyId) {
      await RefreshTokenModel.deleteMany({ familyId: token.familyId });
    }

    await logAuditEvent({
      organizationId: 'SYSTEM',
      action: 'DELETE',
      resourceType: 'ADMIN_SESSION',
      resourceId: sessionId,
      userId,
      ipAddress,
      userAgent,
      metadata: { action: 'REVOKE_ADMIN_SESSION', sessionId }
    });

    logger.info(`[AdminAuth] Revoked admin session "${sessionId}" for admin "${userId}".`);
  }
}

export const adminAuthService = new AdminAuthService();
