import type { FastifyReply } from 'fastify';
import type { ApiErrorDetail, ApiMeta, ApiSuccessResponse } from '@repo/types';

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
  const error: ApiErrorDetail = {
    code,
    message,
    ...(details !== undefined ? { details } : {})
  };
  return reply.status(statusCode).send({ success: false, error });
}