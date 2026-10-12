import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'user', 'guest']);

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: userRoleSchema.default('user'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserSchemaType = z.infer<typeof userSchema>;
