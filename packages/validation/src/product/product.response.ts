import { z } from 'zod';
import { productSchema } from './product.schema';
import { paginationMetaSchema } from '../common/pagination.schema';

export const productResponseSchema = productSchema;

export const productListResponseSchema = z.object({
  items: z.array(productSchema),
  pagination: paginationMetaSchema.optional()
});

export type ProductResponse = z.infer<typeof productResponseSchema>;
export type ProductListResponse = z.infer<typeof productListResponseSchema>;
