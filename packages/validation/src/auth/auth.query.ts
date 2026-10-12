import { z } from 'zod';

export const authVerifyQuerySchema = z.object({
  token: z.string().min(1, 'Verification token is required')
});

export const authRedirectQuerySchema = z.object({
  redirect: z.string().url().optional()
});

export type AuthVerifyQueryInput = z.infer<typeof authVerifyQuerySchema>;
export type AuthRedirectQueryInput = z.infer<typeof authRedirectQuerySchema>;
