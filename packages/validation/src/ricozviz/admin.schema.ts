import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
  backupCode: z.string().length(8, 'Backup code must be 8 characters').optional()
});

export const adminTotpVerifySchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be exactly 6 digits')
});

export const adminRegenerateBackupCodesSchema = z.object({
  totpCode: z.string().length(6, 'TOTP code must be exactly 6 digits')
});

export const adminTenantListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const adminTenantPlanUpdateSchema = z.object({
  plan: z.enum(['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'])
});

export const adminTenantSuspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500)
});

export const adminTenantUnsuspendSchema = z.object({
  reason: z.string().max(500).optional()
});

export const adminUserListQuerySchema = z.object({
  search: z.string().optional(),
  tenantId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const adminUserStatusUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  reason: z.string().max(500).optional()
});

export const adminUserImpersonateSchema = z.object({
  reason: z.string().max(500).optional()
});

export const adminFeatureFlagUpsertSchema = z.object({
  key: z.string().min(2, 'Flag key must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean(),
  tenantOverrides: z
    .array(
      z.object({
        tenantId: z.string().min(1),
        enabled: z.boolean()
      })
    )
    .optional()
});

export const adminWorkerTriggerSchema = z.object({
  jobName: z.string().min(1, 'Job name is required')
});

export const adminAuditQuerySchema = z.object({
  tenantId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters long')
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminTotpVerifyInput = z.infer<typeof adminTotpVerifySchema>;
export type AdminRegenerateBackupCodesInput = z.infer<typeof adminRegenerateBackupCodesSchema>;
export type AdminTenantListQueryInput = z.infer<typeof adminTenantListQuerySchema>;
export type AdminTenantPlanUpdateInput = z.infer<typeof adminTenantPlanUpdateSchema>;
export type AdminTenantSuspendInput = z.infer<typeof adminTenantSuspendSchema>;
export type AdminTenantUnsuspendInput = z.infer<typeof adminTenantUnsuspendSchema>;
export type AdminUserListQueryInput = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserStatusUpdateInput = z.infer<typeof adminUserStatusUpdateSchema>;
export type AdminUserImpersonateInput = z.infer<typeof adminUserImpersonateSchema>;
export type AdminFeatureFlagUpsertInput = z.infer<typeof adminFeatureFlagUpsertSchema>;
export type AdminWorkerTriggerInput = z.infer<typeof adminWorkerTriggerSchema>;
export type AdminAuditQueryInput = z.infer<typeof adminAuditQuerySchema>;
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
