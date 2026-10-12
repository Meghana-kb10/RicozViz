import type { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { requireAuth } from '../../../plugins/ricozviz-auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', authController.register.bind(authController));
  app.post('/login', authController.login.bind(authController));
  app.post('/refresh', authController.refresh.bind(authController));
  app.get('/me', { preHandler: [requireAuth] }, authController.me.bind(authController));
  app.post('/logout', { preHandler: [requireAuth] }, authController.logout.bind(authController));
}