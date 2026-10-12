import fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { config } from './config/env.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRequestLogging } from './plugins/logger.js';
import { registerAuthenticate } from './plugins/authenticate.js';
import { registerMultipart } from './plugins/multipart.js';
import { registerModules } from './modules/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  // Added logger as false
  const app = fastify({
    logger: false,
    bodyLimit: config.maxUploadSizeBytes
  });

  // Enable CORS
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Required for the HttpOnly refresh-token cookie
  await app.register(cookie);

  // Allow empty JSON bodies on POST requests (e.g. /api/v1/auth/refresh without payload)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim().length === 0)) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Multipart uploads (dataset CSV/XLSX import)
  registerMultipart(app);

  // Global logging, error handling and authentication
  registerRequestLogging(app);
  registerErrorHandler(app);
  registerAuthenticate(app);

  // Register feature modules
  await registerModules(app);

  return app;
}