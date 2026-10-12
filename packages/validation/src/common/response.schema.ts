import { z } from 'zod';

export const baseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  baseResponseSchema.extend({
    data: dataSchema.optional()
  });

export const apiErrorResponseSchema = baseResponseSchema.extend({
  success: z.literal(false),
  error: z.string()
});
