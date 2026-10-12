import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination.schema';
import { userRoleSchema } from './user.schema';

export const userQuerySchema = paginationQuerySchema.extend({
  role: userRoleSchema.optional(),
  email: z.string().trim().optional()
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;
