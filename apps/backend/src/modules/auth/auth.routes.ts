import type { FastifyInstance } from 'fastify';
import { authController } from './auth.controller.js';
import { authenticate } from '../../plugins/authenticate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', authController.register.bind(authController));
  app.post('/login', authController.login.bind(authController));
  app.post('/refresh', authController.refreshToken.bind(authController));
  app.post('/forgot-password', authController.forgotPassword.bind(authController));
  app.get('/me', { preHandler: [authenticate] }, authController.me.bind(authController));
  app.post('/logout', { preHandler: [authenticate] }, authController.logout.bind(authController));
}
