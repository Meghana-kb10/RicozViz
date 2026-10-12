import { z } from 'zod';

export const authRoleSchema = z.enum(['admin', 'user', 'guest']);

export const authTokensSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().min(1, 'Refresh token is required'),
  expiresIn: z.number().int().positive()
});

export const authUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  role: authRoleSchema,
  createdAt: z.string()
});

export type AuthRole = z.infer<typeof authRoleSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
