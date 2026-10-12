import { z } from 'zod';
import { userSchema } from './user.schema';
import { paginationMetaSchema } from '../common/pagination.schema';

export const userResponseSchema = userSchema;

export const userListResponseSchema = z.object({
  items: z.array(userSchema),
  pagination: paginationMetaSchema.optional()
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
