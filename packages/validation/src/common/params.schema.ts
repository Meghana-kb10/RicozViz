import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required').trim()
});

export type IdParamInput = z.infer<typeof idParamSchema>;

// MongoDB ObjectId validator pattern (24 hex characters)
export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const mongoIdParamSchema = z.object({
  id: mongoIdSchema
});

export type MongoIdParamInput = z.infer<typeof mongoIdParamSchema>;
