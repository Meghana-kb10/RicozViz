import type { FastifyReply } from 'fastify';
import type { ApiErrorDetail, ApiMeta, ApiSuccessResponse } from '@repo/types';

/**
 * Sanitizes an error message string to prevent accidental leakage of
 * credentials, database URIs, auth tokens, secrets, and system paths.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return message;

  return message
    // Sanitize DB / protocol URIs with potential credentials: mongodb://..., postgres://..., etc.
    .replace(/(?:mongodb|postgres|postgresql|mysql|redis):\/\/[^\s"'<>]+/gi, '[REDACTED_URI]')
    // Sanitize Bearer tokens and JWT strings
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/ey[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]+/g, '[REDACTED_JWT]')
    // Sanitize Windows absolute filesystem paths (e.g. C:\Users\...)
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, '[REDACTED_PATH]')
    // Sanitize POSIX absolute paths (e.g. /home/..., /Users/..., /app/...)
    .replace(/(?:\/(?:home|Users|var|app|root|etc))\/[^\s"'<>]+/g, '[REDACTED_PATH]')
    // Sanitize key/value secret patterns (e.g. password=..., secret=...)
    .replace(/(password|secret|token|apiKey|api_key|access_token|refresh_token)\s*[:=]\s*[^\s&,;]+/gi, '$1=[REDACTED]');
}

/**
 * Sanitizes an error details map to prevent sensitive technical or secret data leakage.
 */
export function sanitizeErrorDetails(
  details?: Record<string, string[]>
): Record<string, string[]> | undefined {
  if (!details || typeof details !== 'object') return details;

  const sanitized: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(details)) {
    if (Array.isArray(messages)) {
      sanitized[key] = messages.map((msg) => sanitizeErrorMessage(msg));
    } else {
      sanitized[key] = [sanitizeErrorMessage(String(messages))];
    }
  }
  return sanitized;
}

/**
 * Standardised success envelope: `{ success: true, data, meta? }`.
 * The web client's `apiFetch` unwraps `body.data`, so this shape is contractual.
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  meta?: ApiMeta
): FastifyReply {
  const body: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(meta !== undefined ? { meta } : {})
  };
  return reply.status(statusCode).send(body);
}

/** Standardised error envelope: `{ success: false, error: { code, message, details? } }`. */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
): FastifyReply {
  const sanitizedMessage = sanitizeErrorMessage(message);
  const sanitizedDetails = details ? sanitizeErrorDetails(details) : undefined;

  const error: ApiErrorDetail = {
    code,
    message: sanitizedMessage,
    ...(sanitizedDetails !== undefined ? { details: sanitizedDetails } : {})
  };
  return reply.status(statusCode).send({ success: false, error });
}