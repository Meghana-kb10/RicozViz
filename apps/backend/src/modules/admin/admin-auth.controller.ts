import type { FastifyReply, FastifyRequest } from 'fastify';
import { adminAuthService } from './admin-auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/errors.js';
import { ADMIN_REFRESH_COOKIE } from '../../lib/jwt.js';
import { validate } from '@repo/validation';
import {
  adminLoginSchema,
  adminTotpVerifySchema,
  adminChangePasswordSchema
} from '@repo/validation';

export class AdminAuthController {
  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = validate(adminLoginSchema, request.body);
    const ipAddress = request.ip || (request.headers['x-forwarded-for'] as string) || undefined;
    const userAgent = (request.headers['user-agent'] as string) || undefined;

    const result = await adminAuthService.login(input, ipAddress, userAgent);

    if (result.refreshToken && result.cookieOptions) {
      reply.setCookie(ADMIN_REFRESH_COOKIE, result.refreshToken, result.cookieOptions);
    }

    sendSuccess(reply, result, 200);
  }

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieToken = request.cookies[ADMIN_REFRESH_COOKIE];
    const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
    const token = cookieToken || bodyToken;

    if (!token) {
      throw AppError.unauthorized('No admin refresh token provided');
    }

    const result = await adminAuthService.refresh(token);
    reply.setCookie(ADMIN_REFRESH_COOKIE, result.newRefreshToken, result.cookieOptions);

    sendSuccess(reply, { accessToken: result.accessToken }, 200);
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieToken = request.cookies[ADMIN_REFRESH_COOKIE];
    const bodyToken = (request.body as { refreshToken?: string })?.refreshToken;
    const token = cookieToken || bodyToken;

    await adminAuthService.logout(token);
    reply.clearCookie(ADMIN_REFRESH_COOKIE, { path: '/admin/auth' });

    sendSuccess(reply, { message: 'Logged out successfully' }, 200);
  }

  async enrollTotp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const adminUser = request.adminUser;
    if (!adminUser) throw AppError.unauthorized('Admin unauthorized');

    const result = await adminAuthService.enrollTotp(adminUser.userId);
    sendSuccess(reply, result, 200);
  }

  async verifyTotp(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const adminUser = request.adminUser;
    if (!adminUser) throw AppError.unauthorized('Admin unauthorized');

    const input = validate(adminTotpVerifySchema, request.body);
    const result = await adminAuthService.verifyTotp(adminUser.userId, input.totpCode);
    sendSuccess(reply, result, 200);
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const adminUser = request.adminUser;
    if (!adminUser) throw AppError.unauthorized('Admin unauthorized');

    const input = validate(adminChangePasswordSchema, request.body);
    const ipAddress = request.ip || (request.headers['x-forwarded-for'] as string) || undefined;
    const userAgent = (request.headers['user-agent'] as string) || undefined;

    await adminAuthService.changePassword(
      adminUser.userId,
      input.currentPassword,
      input.newPassword,
      ipAddress,
      userAgent
    );

    sendSuccess(reply, { message: 'Password changed successfully' }, 200);
  }
}

export const adminAuthController = new AdminAuthController();
