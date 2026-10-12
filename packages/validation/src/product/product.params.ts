import { z } from 'zod';

export const productParamsSchema = z.object({
  id: z.string().min(1, 'Product ID is required').trim()
});

export type ProductParamsInput = z.infer<typeof productParamsSchema>;
