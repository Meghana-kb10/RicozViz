import { z } from 'zod';
import { authRoleSchema } from './auth.schema';

export const loginRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: authRoleSchema.default('user')
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase()
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
export type RefreshTokenRequestInput = z.infer<typeof refreshTokenRequestSchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
