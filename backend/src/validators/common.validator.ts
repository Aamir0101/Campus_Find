import { z } from 'zod';

export const uuidSchema = z.string().uuid('Must be a valid UUID identifier');

export const uuidParamSchema = z.object({
  id: uuidSchema,
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const safeExternalUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .max(1024)
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Only http:// and https:// URLs are permitted');
