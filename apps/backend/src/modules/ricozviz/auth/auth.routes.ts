import type { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../../plugins/ricozviz-auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute'
      }
    }
  };

  app.post('/register', authRateLimit, authController.register.bind(authController));
  app.post('/login', authRateLimit, authController.login.bind(authController));
  app.post('/refresh', authRateLimit, authController.refresh.bind(authController));
  app.get('/me', { preHandler: [requireAuth] }, authController.me.bind(authController));
  app.post('/logout', { preHandler: [requireAuth] }, authController.logout.bind(authController));
}