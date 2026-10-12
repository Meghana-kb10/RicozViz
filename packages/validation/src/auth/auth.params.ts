import { z } from 'zod';

export const authResetTokenParamSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

export type AuthResetTokenParamInput = z.infer<typeof authResetTokenParamSchema>;
