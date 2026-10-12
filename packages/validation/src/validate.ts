import { z } from 'zod';

export class ValidationError extends Error {
  public errors: string[];
  public fieldErrors: Record<string, string[]>;

  constructor(message: string, errors: string[] = [], fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.fieldErrors = fieldErrors;
  }
}

export function formatZodError(error: z.ZodError): string[] {
  return error.errors.map((e) => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
}

export function formatZodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.errors) {
    const key = issue.path.join('.') || '_root';
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(issue.message);
  }
  return result;
}

export function validate<TOutput>(schema: z.ZodType<TOutput, any, any>, data: unknown): TOutput {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatZodError(result.error);
    const fieldErrors = formatZodFieldErrors(result.error);
    throw new ValidationError(errors.join(', '), errors, fieldErrors);
  }
  return result.data;
}

export async function validateAsync<TOutput>(schema: z.ZodType<TOutput, any, any>, data: unknown): Promise<TOutput> {
  const result = await schema.safeParseAsync(data);
  if (!result.success) {
    const errors = formatZodError(result.error);
    const fieldErrors = formatZodFieldErrors(result.error);
    throw new ValidationError(errors.join(', '), errors, fieldErrors);
  }
  return result.data;
}

export function safeValidate<TOutput>(
  schema: z.ZodType<TOutput, any, any>,
  data: unknown
):
  | { success: true; data: TOutput; errors?: never; fieldErrors?: never }
  | { success: false; data?: never; errors: string[]; fieldErrors: Record<string, string[]> } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: formatZodError(result.error),
      fieldErrors: formatZodFieldErrors(result.error)
    };
  }
  return {
    success: true,
    data: result.data
  };
}
