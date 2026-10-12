import type { FastifyReply, FastifyRequest } from 'fastify';
import { createApiResponse, createApiError } from '@repo/api';
import { logger } from '@repo/utils';
import {
  validate,
  registerRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  forgotPasswordRequestSchema
} from '@repo/validation';
import { authService } from './auth.service.js';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(registerRequestSchema, request.body);
      const result = await authService.register(input);
      reply.status(201).send(createApiResponse(result, 'User registered successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      logger.error(`[Auth] Registration failed: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(loginRequestSchema, request.body);
      const result = await authService.login(input);
      reply.status(200).send(createApiResponse(result, 'Login successful'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Login failed';
      logger.error(`[Auth] Login failed: ${message}`, error);
      reply.status(401).send(createApiError(message));
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(refreshTokenRequestSchema, request.body);
      const tokens = await authService.refreshToken(input.refreshToken);
      reply.status(200).send(createApiResponse(tokens, 'Token refreshed successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      logger.error(`[Auth] Refresh token failed: ${message}`, error);
      reply.status(401).send(createApiError(message));
    }
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(forgotPasswordRequestSchema, request.body);
      const result = await authService.forgotPassword(input.email);
      reply.status(200).send(createApiResponse(result, 'Password reset initiated'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Forgot password request failed';
      logger.error(`[Auth] Forgot password request failed: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        logger.warn('[Auth] Unauthorized profile request: No user attached');
        reply.status(401).send(createApiError('Unauthorized', 'Authentication required'));
        return;
      }
      reply.status(200).send(createApiResponse(request.user));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to get profile';
      logger.error(`[Auth] Profile request failed: ${message}`, error);
      reply.status(500).send(createApiError(message));
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const authHeader = request.headers.authorization;
      const token = authHeader?.split(' ')[1];
      if (token) {
        await authService.logout(token);
      }
      reply.status(200).send(createApiResponse({ loggedOut: true }, 'Logged out successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      logger.error(`[Auth] Logout failed: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }
}

export const authController = new AuthController();
