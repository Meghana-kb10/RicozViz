import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ValidationError } from '@repo/validation';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Recursively strip secrets from a value before it reaches the logs.
 */
export function sanitizeMeta(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMeta(item, depth + 1));
  }

  const sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'token',
    'accesstoken',
    'refreshtoken',
    'secret',
    'authorization',
    'cookie',
    'jwt_access_secret',
    'jwt_refresh_secret'
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMeta(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Normalise a ZodError into the `details` map used by the error envelope. */
export function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }
  return details;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    logger.warn(`Route not found: ${request.method} ${request.url}`);
    sendError(reply, 404, 'NOT_FOUND', `Route ${request.method} ${request.url} not found`);
  });

  app.setErrorHandler(
    (error: FastifyError | AppError | ZodError | ValidationError | Error, request: FastifyRequest, reply: FastifyReply) => {
      const requestInfo = {
        method: request.method,
        path: request.url,
        body: sanitizeMeta(request.body),
        query: sanitizeMeta(request.query),
        params: sanitizeMeta(request.params)
      };

      // ---- 1. Zod validation errors (400) ----
      if (error instanceof ZodError) {
        const details = zodDetails(error);
        logger.warn('Validation failed (ZodError)', { ...requestInfo, details });
        sendError(reply, 400, 'VALIDATION_ERROR', 'Validation failed', details);
        return;
      }

      // ---- 2. @repo/validation wrapper (400) ----
      if (error instanceof ValidationError) {
        sendError(reply, 400, 'VALIDATION_ERROR', error.message, error.fieldErrors);
        return;
      }

      // ---- 3. Application operational errors ----
      const isAppError =
        error instanceof AppError ||
        (typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          'code' in error &&
          typeof (error as AppError).statusCode === 'number' &&
          typeof (error as AppError).code === 'string');

      if (isAppError) {
        const appErr = error as AppError;
        if (appErr.statusCode >= 500) {
          logger.error(`AppError ${appErr.statusCode}: ${appErr.message}`, {
            code: appErr.code,
            statusCode: appErr.statusCode,
            stack: appErr.stack,
            ...requestInfo
          });
        } else {
          logger.warn(`AppError ${appErr.statusCode}: ${appErr.message}`, {
            code: appErr.code,
            statusCode: appErr.statusCode,
            ...requestInfo
          });
        }
        sendError(reply, appErr.statusCode, appErr.code, appErr.message, appErr.details);
        return;
      }

      // ---- 4. Fastify schema validation (400) ----
      const fastifyError = error as FastifyError;
      if (fastifyError.validation) {
        const messages = fastifyError.validation.map((v) => v.message ?? String(v)).join(', ');
        sendError(reply, 400, 'VALIDATION_ERROR', messages || 'Validation failed');
        return;
      }

      // ---- 5. Mongoose / MongoDB known errors ----
      const mongoCode = (error as { code?: unknown } | undefined)?.code;
      if (typeof mongoCode === 'number') {
        if (mongoCode === 11000) {
          const target = (error as { keyValue?: Record<string, unknown> }).keyValue;
          const fields = target ? Object.keys(target) : ['field'];
          const message = fields.some((f) => f.includes('email'))
            ? 'An account with this email already exists'
            : `A resource with this ${fields.join(', ')} already exists`;
          logger.warn('MongoDB duplicate key violation', { fields, ...requestInfo });
          sendError(reply, 409, 'CONFLICT', message);
          return;
        }
        if (mongoCode === 11000 || mongoCode === 27) {
          logger.error(`MongoDB error ${mongoCode}`, { ...requestInfo });
          sendError(reply, 400, 'DATABASE_ERROR', 'A database error occurred');
          return;
        }
      }

      // ---- 6. Payload too large ----
      if (fastifyError.statusCode === 413) {
        sendError(reply, 413, 'PAYLOAD_TOO_LARGE', fastifyError.message);
        return;
      }

      // ---- 7. Unknown / unexpected errors (500) ----
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Unhandled server exception: ${errMessage}`, {
        error: errMessage,
        stack: error instanceof Error ? error.stack : undefined,
        ...requestInfo
      });

      sendError(
        reply,
        500,
        'INTERNAL_ERROR',
        config.nodeEnv === 'production' || config.env === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : errMessage
      );
    }
  );
}