import { z } from 'zod';

export const userParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required').trim()
});

export type UserParamsInput = z.infer<typeof userParamsSchema>;
