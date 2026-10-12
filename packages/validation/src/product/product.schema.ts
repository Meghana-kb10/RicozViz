import { z } from 'zod';

export const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().min(5, 'Description must be at least 5 characters').trim(),
  price: z.number().positive('Price must be greater than 0'),
  category: z.string().min(1, 'Category is required').trim(),
  inStock: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type ProductSchemaType = z.infer<typeof productSchema>;
export type ProductInputType = ProductSchemaType;
