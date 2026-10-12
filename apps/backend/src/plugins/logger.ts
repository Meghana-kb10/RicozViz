import type { FastifyInstance } from 'fastify';
import { logger } from '@repo/utils';

export function registerRequestLogging(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    logger.info(`--> ${request.method} ${request.url}`);
  });

  // Log unhandled errors caught during request lifecycle
  app.addHook('onError', async (request, reply, error) => {
    logger.error(`API Error [${request.method} ${request.url}] Status: ${reply.statusCode}`, error);
  });

  // Log any response that returns an error status code (>= 400)
  app.addHook('onSend', async (request, reply, payload) => {
    if (reply.statusCode >= 400) {
      let detail = '';
      try {
        if (typeof payload === 'string') {
          const parsed = JSON.parse(payload);
          detail = parsed.message ? `: ${parsed.message}` : (parsed.error ? `: ${parsed.error}` : '');
        }
      } catch {
        // payload is not JSON
      }
      logger.error(`API Failed: ${request.method} ${request.url} [${reply.statusCode}]${detail}`);
    }
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode >= 400) {
      logger.warn(`<-- ${request.method} ${request.url} ${reply.statusCode} (FAILED)`);
    } else {
      logger.info(`<-- ${request.method} ${request.url} ${reply.statusCode}`);
    }
  });
}

