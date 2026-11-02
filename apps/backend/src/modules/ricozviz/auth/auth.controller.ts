import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  loginSchema,
  registerSchema,
  register as registerUser,
  login as loginUser,
  me as getMe,
  refresh as refreshSession,
  logout as logoutSession,
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions
} from './auth.service.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { sendSuccess } from '../../../utils/response.js';
import type { SessionResult } from './auth.service.js';

export class AuthController {
  /** POST /api/v1/auth/register */
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = registerSchema.parse(request.body);
    const { payload, refreshToken }: SessionResult<unknown> = await registerUser(input);

    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
    sendSuccess(reply, payload, 201);
  }

  /** POST /api/v1/auth/login */
  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = loginSchema.parse(request.body);
    const { payload, refreshToken }: SessionResult<unknown> = await loginUser(input, {
      ip: request.ip,
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined
    });

    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
    sendSuccess(reply, payload);
  }

  /** GET /api/v1/auth/me */
  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const payload = await getMe(principal.userId, principal.organizationId);
    sendSuccess(reply, payload);
  }

  /** POST /api/v1/auth/refresh */
  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    const { payload, refreshToken }: SessionResult<unknown> = await refreshSession(cookieToken, {
      ip: request.ip,
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined
    });

    // Rotate the refresh cookie on every successful refresh.
    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
    sendSuccess(reply, payload);
  }

  /** POST /api/v1/auth/logout */
  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cookieToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await logoutSession(request.ricozvizUser, cookieToken);

    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
    sendSuccess(reply, result);
  }
}

export const authController = new AuthController();