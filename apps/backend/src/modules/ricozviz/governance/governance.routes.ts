// ========================================
// Governance & Security Badges Routes
// ========================================
// Fastify route definitions for security badges, posture, and verification.
// ========================================

import type { FastifyInstance } from 'fastify';
import {
  getBadgesHandler,
  getBadgeByIdHandler,
  verifyBadgeHandler,
  getPostureHandler,
  getRlsPoliciesHandler,
  simulateRlsHandler
} from './governance.controller.js';

export async function governanceRoutes(app: FastifyInstance): Promise<void> {
  // Public/tenant read access to security badges and posture
  app.get('/', getBadgesHandler);
  app.get('/badges', getBadgesHandler);
  app.get('/posture', getPostureHandler);
  app.get('/badges/:id', getBadgeByIdHandler);
  app.get('/badges/:id/verify', verifyBadgeHandler);
  app.post('/badges/:id/verify', verifyBadgeHandler);

  // Cryptographic RLS & RBAC policy simulation
  app.get('/rls/policies', getRlsPoliciesHandler);
  app.post('/rls/simulate', simulateRlsHandler);
}
