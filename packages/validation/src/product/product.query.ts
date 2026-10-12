import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination.schema';

export const productQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().optional(),
  inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
