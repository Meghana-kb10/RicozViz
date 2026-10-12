import { z } from 'zod';
import { authTokensSchema, authUserSchema } from './auth.schema';

export const authResponseSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema
});

export const tokenResponseSchema = authTokensSchema;

export const authProfileResponseSchema = authUserSchema;

export type AuthResponse = z.infer<typeof authResponseSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type AuthProfileResponse = z.infer<typeof authProfileResponseSchema>;
