import { z } from 'zod';
import { userRoleSchema } from './user.schema';

export const createUserRequestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  role: userRoleSchema.default('user'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional()
});

export const updateUserRequestSchema = createUserRequestSchema.partial();

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

// Backward compatibility alias
export const createUserSchema = createUserRequestSchema;
export const updateUserSchema = updateUserRequestSchema;

export type CreateUserRequestInput = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequestInput = z.infer<typeof updateUserRequestSchema>;
export type ChangePasswordRequestInput = z.infer<typeof changePasswordRequestSchema>;
export type CreateUserInputType = CreateUserRequestInput;
export type UpdateUserInputType = UpdateUserRequestInput;
