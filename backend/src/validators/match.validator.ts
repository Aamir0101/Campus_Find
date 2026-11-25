import { MatchStatus } from '@prisma/client';
import { z } from 'zod';

export const matchIdParamSchema = z.object({
  id: z.string().uuid('Invalid match identifier.'),
});

export const recalculateItemIdParamSchema = z.object({
  itemId: z.string().uuid('Invalid item report identifier.'),
});

export const listMatchesQuerySchema = z.object({
  status: z
    .union([z.literal('ALL'), z.literal('ACTIVE'), z.nativeEnum(MatchStatus)])
    .default('ACTIVE'),
  itemId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateMatchVisibilitySchema = z
  .object({
    status: z.enum([MatchStatus.DISMISSED, MatchStatus.PENDING]),
  })
  .strict();

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type UpdateMatchVisibilityInput = z.infer<typeof updateMatchVisibilitySchema>;
