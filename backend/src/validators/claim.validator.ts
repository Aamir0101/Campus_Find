import { AuditAction, ClaimStatus } from '@prisma/client';
import { z } from 'zod';

export const claimIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid claim identifier.'),
  })
  .strict();

export const claimEvidenceParamSchema = z
  .object({
    id: z.string().uuid('Invalid claim identifier.'),
    evidenceId: z.string().uuid('Invalid evidence identifier.'),
  })
  .strict();

export const adminItemIdParamSchema = z
  .object({
    id: z.string().uuid('Invalid item identifier.'),
  })
  .strict();

export const createClaimSchema = z
  .object({
    itemId: z.string().uuid('A valid found item identifier is required.'),
    ownershipStatement: z
      .string()
      .trim()
      .min(20, 'Explain when and where you misplaced the item (minimum 20 characters).')
      .max(2000, 'Ownership explanation cannot exceed 2000 characters.'),
    identifyingProof: z
      .string()
      .trim()
      .min(12, 'Provide hidden or non-public identifying details (minimum 12 characters).')
      .max(2000, 'Identifying proof cannot exceed 2000 characters.'),
    serialOrMark: z
      .string()
      .trim()
      .min(2, 'Provide a serial fragment, monogram, or "Not applicable".')
      .max(200, 'Serial or mark description cannot exceed 200 characters.'),
    preferredPickupWindow: z
      .string()
      .trim()
      .min(3, 'Select a preferred Campus Safety desk pickup window.')
      .max(100, 'Pickup window cannot exceed 100 characters.'),
    evidenceNote: z
      .string()
      .trim()
      .max(500, 'Evidence note cannot exceed 500 characters.')
      .optional(),
  })
  .strict();

export const listMyClaimsQuerySchema = z
  .object({
    status: z
      .enum([
        'ALL',
        ClaimStatus.PENDING,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.APPROVED,
        ClaimStatus.REJECTED,
        ClaimStatus.RETURNED,
      ])
      .default('ALL'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminListClaimsQuerySchema = z
  .object({
    status: z
      .enum([
        'ALL',
        ClaimStatus.PENDING,
        ClaimStatus.UNDER_REVIEW,
        ClaimStatus.APPROVED,
        ClaimStatus.REJECTED,
        ClaimStatus.RETURNED,
      ])
      .default('ALL'),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export const adminReviewClaimSchema = z
  .object({
    status: z.enum([
      ClaimStatus.UNDER_REVIEW,
      ClaimStatus.APPROVED,
      ClaimStatus.REJECTED,
    ]),
    reviewerNote: z
      .string()
      .trim()
      .max(1000, 'Reviewer note cannot exceed 1000 characters.')
      .optional(),
    rejectionReason: z
      .string()
      .trim()
      .max(1000, 'Rejection reason cannot exceed 1000 characters.')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.status === ClaimStatus.REJECTED) {
      const reason = data.rejectionReason?.trim() ?? '';
      if (reason.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rejectionReason'],
          message: 'A clear rejection reason (minimum 5 characters) is required when rejecting a claim.',
        });
      }
    }
  });

export const adminReturnItemSchema = z
  .object({
    claimId: z.string().uuid('An approved claim identifier is required to confirm handover.'),
    physicalIdVerified: z.literal(true, {
      errorMap: () => ({
        message: 'Physical Campus ID verification must be confirmed before marking an item returned.',
      }),
    }),
    handoverNote: z
      .string()
      .trim()
      .max(1000, 'Handover note cannot exceed 1000 characters.')
      .optional(),
  })
  .strict();

export const adminAuditLogsQuerySchema = z
  .object({
    action: z
      .enum([
        'ALL',
        AuditAction.USER_REGISTERED,
        AuditAction.REPORT_CREATED,
        AuditAction.REPORT_UPDATED,
        AuditAction.REPORT_STATUS_CHANGED,
        AuditAction.MATCH_CREATED,
        AuditAction.MATCH_REVIEWED,
        AuditAction.CLAIM_SUBMITTED,
        AuditAction.CLAIM_REVIEWED,
        AuditAction.CLAIM_APPROVED,
        AuditAction.CLAIM_REJECTED,
        AuditAction.CUSTODY_RELEASED,
      ])
      .default('ALL'),
    entityType: z.string().trim().max(64).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type ListMyClaimsQuery = z.infer<typeof listMyClaimsQuerySchema>;
export type AdminListClaimsQuery = z.infer<typeof adminListClaimsQuerySchema>;
export type AdminReviewClaimInput = z.infer<typeof adminReviewClaimSchema>;
export type AdminReturnItemInput = z.infer<typeof adminReturnItemSchema>;
export type AdminAuditLogsQuery = z.infer<typeof adminAuditLogsQuerySchema>;
