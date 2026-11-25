import { ItemStatus, ReportType } from '@prisma/client';
import { z } from 'zod';

export const ALLOWED_CATEGORY_NAMES = [
  'Electronics',
  'ID Cards',
  'Wallets',
  'Bags',
  'Books',
  'Clothing',
  'Accessories',
  'Keys',
  'Other',
] as const;

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD.')
  .refine((val) => !Number.isNaN(new Date(val).getTime()), 'Invalid calendar date.');

export const createItemSchema = z
  .object({
    reportType: z.nativeEnum(ReportType),
    title: z
      .string()
      .trim()
      .min(4, 'Item name must be at least 4 characters.')
      .max(200, 'Item name must not exceed 200 characters.'),
    categoryId: z.string().uuid('Category ID must be a valid UUID.').optional(),
    category: z.enum(ALLOWED_CATEGORY_NAMES).optional(),
    locationId: z.string().uuid('Location ID must be a valid UUID.').optional(),
    building: z.string().trim().min(2).max(160).optional(),
    specificSpot: z
      .string()
      .trim()
      .min(3, 'Specify the room, floor, or nearby landmark.')
      .max(200),
    occurredDate: dateStringSchema,
    timeWindow: z
      .string()
      .trim()
      .min(2, 'Approximate time window is required.')
      .max(40),
    description: z
      .string()
      .trim()
      .min(15, 'Description must be at least 15 characters.')
      .max(2000),
    distinguishingFeatures: z
      .string()
      .trim()
      .min(8, 'Include distinguishing marks or private verification details (min 8 chars).')
      .max(2000),
    verificationPrompt: z.string().trim().max(255).optional(),
    custodyLocation: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.categoryId || data.category), {
    message: 'Select a valid category.',
    path: ['category'],
  })
  .refine((data) => Boolean(data.locationId || data.building), {
    message: 'Select a valid campus location.',
    path: ['building'],
  });

export const updateItemSchema = z
  .object({
    title: z.string().trim().min(4).max(200).optional(),
    categoryId: z.string().uuid().optional(),
    category: z.enum(ALLOWED_CATEGORY_NAMES).optional(),
    locationId: z.string().uuid().optional(),
    building: z.string().trim().min(2).max(160).optional(),
    specificSpot: z.string().trim().min(3).max(200).optional(),
    occurredDate: dateStringSchema.optional(),
    timeWindow: z.string().trim().min(2).max(40).optional(),
    description: z.string().trim().min(15).max(2000).optional(),
    distinguishingFeatures: z.string().trim().min(8).max(2000).optional(),
    verificationPrompt: z.string().trim().max(255).optional(),
    custodyLocation: z.string().trim().max(200).optional(),
    removeImageIds: z.preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[')) {
          try {
            return JSON.parse(trimmed) as unknown;
          } catch {
            return val;
          }
        }
        return [trimmed];
      }
      return val;
    }, z.array(z.string().uuid()).max(4).optional()),
  })
  .strict();

export const itemIdParamSchema = z.object({
  id: z.string().uuid('Invalid item report identifier.'),
});

export const listItemsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  reportType: z.enum(['ALL', 'LOST', 'FOUND']).default('ALL'),
  category: z.string().trim().max(100).optional(),
  building: z.string().trim().max(160).optional(),
  locationId: z.string().uuid().optional(),
  status: z
    .union([z.literal('ALL'), z.nativeEnum(ItemStatus)])
    .default('ALL'),
  mine: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(18),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

