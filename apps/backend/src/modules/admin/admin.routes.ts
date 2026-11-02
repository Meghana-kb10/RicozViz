// ==============================================================================
// Platform Admin Subsystem Routes
// ==============================================================================
// Mounts all platform-operator endpoints under /admin/* with strict authentication
// and rate limiting.
// ==============================================================================

import type { FastifyInstance } from 'fastify';
import { platformAdminGuard } from './admin.guard.js';
import { adminAuthController } from './admin-auth.controller.js';
import { adminTenantsController } from './admin-tenants.controller.js';
import { adminUsersController } from './admin-users.controller.js';
import { adminWorkersController } from './admin-workers.controller.js';
import { adminAuditController } from './admin-audit.controller.js';
import { adminSystemController } from './admin-system.controller.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [platformAdminGuard] };

  // Stricter rate limiting on admin authentication (max 10 attempts per 15 min per IP)
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes'
      }
    }
  };

  // ---- Admin Authentication ---------------------------------------------------
  app.post('/auth/login', authRateLimit, adminAuthController.login.bind(adminAuthController));
  app.post('/auth/refresh', adminAuthController.refresh.bind(adminAuthController));
  app.post('/auth/logout', adminAuthController.logout.bind(adminAuthController));
  app.post('/auth/totp/enroll', adminGuard, adminAuthController.enrollTotp.bind(adminAuthController));
  app.post('/auth/totp/verify', adminGuard, adminAuthController.verifyTotp.bind(adminAuthController));

  // ---- Tenants Administration -------------------------------------------------
  app.get('/tenants', adminGuard, adminTenantsController.list.bind(adminTenantsController));
  app.get('/tenants/:id', adminGuard, adminTenantsController.getById.bind(adminTenantsController));
  app.post('/tenants/:id/suspend', adminGuard, adminTenantsController.suspend.bind(adminTenantsController));
  app.post('/tenants/:id/unsuspend', adminGuard, adminTenantsController.unsuspend.bind(adminTenantsController));
  app.put('/tenants/:id/plan', adminGuard, adminTenantsController.updatePlan.bind(adminTenantsController));

  // ---- Users Administration ---------------------------------------------------
  app.get('/users', adminGuard, adminUsersController.list.bind(adminUsersController));
  app.get('/users/:id', adminGuard, adminUsersController.getById.bind(adminUsersController));
  app.post('/users/:id/disable', adminGuard, (req, res) => {
    (req.body as any) = { status: 'SUSPENDED' };
    return adminUsersController.setStatus(req, res);
  });
  app.post('/users/:id/enable', adminGuard, (req, res) => {
    (req.body as any) = { status: 'ACTIVE' };
    return adminUsersController.setStatus(req, res);
  });
  app.post('/users/:id/force-logout', adminGuard, adminUsersController.forceLogout.bind(adminUsersController));
  app.post('/users/:id/impersonate', adminGuard, adminUsersController.impersonate.bind(adminUsersController));

  // ---- Background Worker Orchestration ----------------------------------------
  app.get('/workers/runs', adminGuard, adminWorkersController.runs.bind(adminWorkersController));
  app.get('/workers/health', adminGuard, adminWorkersController.health.bind(adminWorkersController));
  app.post('/workers/trigger', adminGuard, adminWorkersController.trigger.bind(adminWorkersController));

  // ---- Global WORM Audit Ledger -----------------------------------------------
  app.get('/audit', adminGuard, adminAuditController.list.bind(adminAuditController));
  app.post('/audit/verify', adminGuard, adminAuditController.verify.bind(adminAuditController));

  // ---- System Governance & Feature Flags --------------------------------------
  app.get('/system/health', adminGuard, adminSystemController.health.bind(adminSystemController));
  app.get('/system/ai-usage', adminGuard, adminSystemController.aiUsage.bind(adminSystemController));
  app.get('/system/flags', adminGuard, adminSystemController.listFlags.bind(adminSystemController));
  app.post('/system/flags', adminGuard, adminSystemController.upsertFlag.bind(adminSystemController));
  app.delete('/system/flags/:key', adminGuard, adminSystemController.deleteFlag.bind(adminSystemController));
}
