import { z } from 'zod';

export const createProductRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim(),
  price: z.number().positive('Price must be greater than 0'),
  category: z.string().min(1, 'Category is required').trim(),
  inStock: z.boolean().default(true)
});

export const updateProductRequestSchema = createProductRequestSchema.partial();

export type CreateProductRequestInput = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequestInput = z.infer<typeof updateProductRequestSchema>;
