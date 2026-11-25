import { randomBytes, randomUUID } from 'node:crypto';
import {
  AuditAction,
  ClaimStatus,
  EvidenceType,
  ItemStatus,
  MatchStatus,
  Prisma,
  ReportType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type {
  AuditLogFilterCriteria,
  AuditLogRepository,
  AuditLogWithActor,
  AuthenticatedUser,
  ClaimEvidenceDto,
  ClaimFilterCriteria,
  ClaimRepository,
  ClaimWithRelations,
  CreateClaimEvidenceRecord,
  CreateClaimRecord,
  ItemWithRelations,
  ReturnItemCustodyRecord,
  ReviewClaimUpdateRecord,
  SafeAuditLogResponse,
  SafeClaimResponse,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import type {
  AdminAuditLogsQuery,
  AdminListClaimsQuery,
  AdminReturnItemInput,
  AdminReviewClaimInput,
  CreateClaimInput,
  ListMyClaimsQuery,
} from '../validators/claim.validator.js';
import {
  MAX_EVIDENCE_FILES_PER_CLAIM,
  SIGNED_EVIDENCE_URL_TTL_SECONDS,
  storageService,
  validateUploadedEvidenceFile,
  type EvidenceStorageAdapter,
  type UploadImageFileInput,
} from './storage.service.js';

const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = [
  ClaimStatus.PENDING,
  ClaimStatus.UNDER_REVIEW,
  ClaimStatus.APPROVED,
];

const NON_CLAIMABLE_ITEM_STATUSES = new Set<ItemStatus>([
  ItemStatus.RETURNED,
  ItemStatus.CLOSED,
]);

const ALLOWED_CLAIM_REVIEW_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  [ClaimStatus.PENDING]: [
    ClaimStatus.UNDER_REVIEW,
    ClaimStatus.APPROVED,
    ClaimStatus.REJECTED,
  ],
  [ClaimStatus.UNDER_REVIEW]: [ClaimStatus.APPROVED, ClaimStatus.REJECTED],
  [ClaimStatus.APPROVED]: [ClaimStatus.REJECTED],
  [ClaimStatus.REJECTED]: [],
  [ClaimStatus.RETURNED]: [],
};

const ITEM_RELATIONS_INCLUDE = {
  category: true,
  location: true,
  images: {
    orderBy: { displayOrder: 'asc' as const },
  },
  reportedBy: {
    select: {
      id: true,
      fullName: true,
      department: true,
    },
  },
} satisfies Prisma.ItemInclude;

const CLAIM_RELATIONS_INCLUDE = {
  item: {
    include: ITEM_RELATIONS_INCLUDE,
  },
  claimant: {
    select: {
      id: true,
      fullName: true,
      email: true,
      campusId: true,
      department: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      fullName: true,
      campusId: true,
    },
  },
  evidences: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ClaimInclude;

function generateClaimCode(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `CLM-${year}-${suffix}`;
}

export async function toSafeClaimResponse(
  claim: ClaimWithRelations,
  viewer: AuthenticatedUser,
  evidenceStorage?: EvidenceStorageAdapter,
): Promise<SafeClaimResponse> {
  const isAdmin = viewer.role === UserRole.ADMIN;
  const isClaimant = claim.claimantId === viewer.id;

  const proofRecord = claim.evidences.find(
    (e) =>
      e.evidenceType === EvidenceType.TEXT_DESCRIPTION &&
      e.label === 'Identifying Proof',
  );
  const serialRecord = claim.evidences.find(
    (e) =>
      e.evidenceType === EvidenceType.SERIAL_NUMBER &&
      e.label === 'Serial or Identifying Mark',
  );

  const evidences: ClaimEvidenceDto[] = await Promise.all(
    claim.evidences.map(async (ev) => {
      let signedUrl: string | null = null;
      if (ev.storageKey && evidenceStorage && (isAdmin || isClaimant)) {
        signedUrl = await evidenceStorage
          .createSignedEvidenceUrl(
            ev.storageKey,
            SIGNED_EVIDENCE_URL_TTL_SECONDS,
          )
          .catch(() => null);
      }

      return {
        id: ev.id,
        evidenceType: ev.evidenceType,
        label: ev.label,
        details: ev.details,
        mimeType: ev.mimeType ?? null,
        fileSize: ev.fileSize ?? null,
        hasPrivateFile: Boolean(ev.storageKey),
        ...(signedUrl ? { signedUrl } : {}),
        verifiedByReviewer: ev.verifiedByReviewer,
        createdAt: ev.createdAt.toISOString(),
      };
    }),
  );

  const base: SafeClaimResponse = {
    id: claim.id,
    claimCode: claim.claimCode,
    itemId: claim.itemId,
    itemTitle: claim.item.title,
    itemReferenceCode: claim.item.referenceCode,
    itemCategory: claim.item.category.name,
    itemStatus: claim.item.status,
    building: claim.item.location.buildingName,
    custodyLocation:
      claim.item.custodyLocation ?? claim.item.location.custodyDesk ?? null,
    ownershipStatement: claim.ownershipStatement,
    identifyingProof: proofRecord?.details ?? '',
    serialOrMark: serialRecord?.details ?? '',
    preferredPickupWindow: claim.preferredPickupWindow,
    pickupDesk: claim.pickupDesk ?? null,
    status: claim.status,
    reviewerNote: claim.reviewerNote ?? null,
    rejectionReason: claim.rejectionReason ?? null,
    reviewedByName: claim.reviewedBy?.fullName ?? null,
    reviewedAt: claim.reviewedAt ? claim.reviewedAt.toISOString() : null,
    collectedAt: claim.collectedAt ? claim.collectedAt.toISOString() : null,
    submittedAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    evidences,
  };

  if (isAdmin || isClaimant) {
    base.claimantId = claim.claimant.id;
    base.claimantName = claim.claimant.fullName;
    base.claimantEmail = claim.claimant.email;
    base.claimantCampusId = claim.claimant.campusId;
    base.claimantDepartment = claim.claimant.department;
  }

  // Strictly protect hidden item verification identifiers from claimants; only ADMIN sees them
  if (isAdmin) {
    base.itemDistinguishingFeatures = claim.item.distinguishingFeatures;
    base.itemVerificationPrompt = claim.item.verificationPrompt ?? null;
  }

  return base;
}

export function toSafeAuditLogResponse(
  log: AuditLogWithActor,
): SafeAuditLogResponse {
  const meta =
    log.metadata && typeof log.metadata === 'object'
      ? (log.metadata as Record<string, unknown>)
      : null;

  const targetCode =
    log.claim?.claimCode ??
    log.item?.referenceCode ??
    (typeof meta?.claimCode === 'string' ? meta.claimCode : null) ??
    (typeof meta?.referenceCode === 'string' ? meta.referenceCode : null) ??
    log.entityId.slice(0, 8).toUpperCase();

  const targetSummary =
    log.item?.title ??
    (typeof meta?.itemTitle === 'string' ? meta.itemTitle : null) ??
    `${log.entityType} Record`;

  return {
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    actorName: log.actor.fullName,
    actorRole: log.actor.role,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    targetCode,
    targetSummary,
    details: log.summary,
    metadata: log.metadata ?? null,
  };
}

export const prismaClaimRepository: ClaimRepository = {
  async findTargetItemForClaim(
    itemId: string,
  ): Promise<ItemWithRelations | null> {
    return prisma.item.findUnique({
      where: { id: itemId },
      include: ITEM_RELATIONS_INCLUDE,
    });
  },

  async findActiveClaimForItemAndClaimant(
    itemId: string,
    claimantId: string,
  ): Promise<ClaimWithRelations | null> {
    return prisma.claim.findFirst({
      where: {
        itemId,
        claimantId,
        status: { in: ACTIVE_CLAIM_STATUSES },
      },
      include: CLAIM_RELATIONS_INCLUDE,
    });
  },

  async findApprovedClaimForItem(
    itemId: string,
  ): Promise<ClaimWithRelations | null> {
    return prisma.claim.findFirst({
      where: {
        itemId,
        status: ClaimStatus.APPROVED,
      },
      include: CLAIM_RELATIONS_INCLUDE,
    });
  },

  async createClaimAndAudit(
    data: CreateClaimRecord,
  ): Promise<ClaimWithRelations> {
    try {
      return await prisma.$transaction(async (tx) => {
        const item = await tx.item.findUnique({
          where: { id: data.itemId },
          select: { id: true, status: true, referenceCode: true },
        });
        if (!item) {
          throw new AppError('Found item not found.', 404, 'ITEM_NOT_FOUND');
        }

        const created = await tx.claim.create({
          data: {
            id: data.id,
            claimCode: data.claimCode,
            itemId: data.itemId,
            claimantId: data.claimantId,
            ownershipStatement: data.ownershipStatement,
            preferredPickupWindow: data.preferredPickupWindow,
            pickupDesk: data.pickupDesk,
            status: ClaimStatus.PENDING,
            evidences: {
              create: data.evidences.map((ev) => ({
                evidenceType: ev.evidenceType,
                label: ev.label,
                details: ev.details,
                storageKey: ev.storageKey ?? null,
                mimeType: ev.mimeType ?? null,
                fileSize: ev.fileSize ?? null,
              })),
            },
          },
          include: CLAIM_RELATIONS_INCLUDE,
        });

        if (
          item.status === ItemStatus.ACTIVE ||
          item.status === ItemStatus.POTENTIAL_MATCH
        ) {
          await tx.item.update({
            where: { id: item.id },
            data: { status: ItemStatus.CLAIM_PENDING },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: data.claimantId,
            action: AuditAction.CLAIM_SUBMITTED,
            entityType: 'Claim',
            entityId: created.id,
            claimId: created.id,
            itemId: created.itemId,
            summary: `Submitted ownership claim ${created.claimCode} for ${item.referenceCode}.`,
            metadata: {
              claimCode: created.claimCode,
              referenceCode: item.referenceCode,
            },
          },
        });

        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'You already have an active ownership claim for this item.',
          409,
          'DUPLICATE_ACTIVE_CLAIM',
        );
      }
      throw error;
    }
  },

  async listClaims(criteria: ClaimFilterCriteria) {
    const where: Prisma.ClaimWhereInput = {};

    if (criteria.claimantId) {
      where.claimantId = criteria.claimantId;
    }

    if (criteria.status !== 'ALL') {
      where.status = criteria.status;
    }

    if (criteria.search) {
      const q = criteria.search.trim();
      where.OR = [
        { claimCode: { contains: q, mode: 'insensitive' } },
        { item: { title: { contains: q, mode: 'insensitive' } } },
        { item: { referenceCode: { contains: q, mode: 'insensitive' } } },
        { claimant: { fullName: { contains: q, mode: 'insensitive' } } },
        { claimant: { campusId: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const skip = (criteria.page - 1) * criteria.limit;
    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        include: CLAIM_RELATIONS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: criteria.limit,
      }),
      prisma.claim.count({ where }),
    ]);

    return { claims, total };
  },

  async findClaimByIdWithRelations(
    id: string,
  ): Promise<ClaimWithRelations | null> {
    return prisma.claim.findUnique({
      where: { id },
      include: CLAIM_RELATIONS_INCLUDE,
    });
  },

  async reviewClaimAndAudit(
    data: ReviewClaimUpdateRecord,
  ): Promise<ClaimWithRelations> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.claim.update({
        where: { id: data.claimId },
        data: {
          status: data.nextStatus,
          reviewedById: data.reviewerId,
          reviewedAt: now,
          ...(data.reviewerNote !== undefined
            ? { reviewerNote: data.reviewerNote }
            : {}),
          ...(data.rejectionReason !== undefined
            ? { rejectionReason: data.rejectionReason }
            : {}),
        },
        include: CLAIM_RELATIONS_INCLUDE,
      });

      if (
        data.nextStatus === ClaimStatus.UNDER_REVIEW ||
        data.nextStatus === ClaimStatus.APPROVED
      ) {
        await tx.item.update({
          where: { id: updated.itemId },
          data: { status: ItemStatus.UNDER_VERIFICATION },
        });
      } else if (data.nextStatus === ClaimStatus.REJECTED) {
        const remainingActive = await tx.claim.count({
          where: {
            itemId: updated.itemId,
            id: { not: updated.id },
            status: { in: ACTIVE_CLAIM_STATUSES },
          },
        });
        if (remainingActive === 0) {
          const activeMatches = await tx.match.count({
            where: {
              OR: [
                { lostItemId: updated.itemId },
                { foundItemId: updated.itemId },
              ],
              similarityScore: { gte: 60 },
              status: { not: MatchStatus.DISMISSED },
            },
          });
          await tx.item.update({
            where: { id: updated.itemId },
            data: {
              status:
                activeMatches > 0
                  ? ItemStatus.POTENTIAL_MATCH
                  : ItemStatus.ACTIVE,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: data.reviewerId,
          action: data.auditAction,
          entityType: 'Claim',
          entityId: updated.id,
          claimId: updated.id,
          itemId: updated.itemId,
          summary: data.auditSummary,
          metadata: {
            claimCode: updated.claimCode,
            referenceCode: updated.item.referenceCode,
            nextStatus: data.nextStatus,
          },
        },
      });

      return updated;
    });
  },

  async markItemReturnedAndAudit(
    data: ReturnItemCustodyRecord,
  ): Promise<{ claim: ClaimWithRelations; item: ItemWithRelations }> {
    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const targetClaim = await tx.claim.findUnique({
        where: { id: data.claimId },
        select: { reviewerNote: true },
      });

      const handoverSummary = data.handoverNote?.trim()
        ? data.handoverNote.trim()
        : 'Physical Campus ID verified in person and custody released.';

      const mergedReviewerNote = targetClaim?.reviewerNote
        ? `${targetClaim.reviewerNote} · Handover: ${handoverSummary}`
        : handoverSummary;

      const updatedClaim = await tx.claim.update({
        where: { id: data.claimId },
        data: {
          status: ClaimStatus.RETURNED,
          collectedAt: now,
          reviewedById: data.adminId,
          reviewerNote: mergedReviewerNote,
        },
        include: CLAIM_RELATIONS_INCLUDE,
      });

      // Close any competing pending/under-review claims on this returned item
      await tx.claim.updateMany({
        where: {
          itemId: data.itemId,
          id: { not: data.claimId },
          status: { in: [ClaimStatus.PENDING, ClaimStatus.UNDER_REVIEW] },
        },
        data: {
          status: ClaimStatus.REJECTED,
          reviewedById: data.adminId,
          reviewedAt: now,
          rejectionReason:
            'Item custody has been physically returned to the verified owner.',
        },
      });

      await tx.match.updateMany({
        where: {
          OR: [{ lostItemId: data.itemId }, { foundItemId: data.itemId }],
          status: { in: [MatchStatus.PENDING, MatchStatus.CONFIRMED] },
        },
        data: { status: MatchStatus.RESOLVED },
      });

      const updatedItem = await tx.item.update({
        where: { id: data.itemId },
        data: { status: ItemStatus.RETURNED },
        include: ITEM_RELATIONS_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: data.adminId,
          action: AuditAction.CUSTODY_RELEASED,
          entityType: 'Item',
          entityId: updatedItem.id,
          itemId: updatedItem.id,
          claimId: updatedClaim.id,
          summary: `Verified physical ID and returned ${updatedItem.referenceCode} via claim ${updatedClaim.claimCode}. ${handoverSummary}`,
          metadata: {
            referenceCode: updatedItem.referenceCode,
            claimCode: updatedClaim.claimCode,
            physicalIdVerified: true,
          },
        },
      });

      return { claim: updatedClaim, item: updatedItem };
    });
  },
};

export const prismaAuditLogRepository: AuditLogRepository = {
  async listAuditLogs(criteria: AuditLogFilterCriteria) {
    const where: Prisma.AuditLogWhereInput = {};
    if (criteria.action !== 'ALL') {
      where.action = criteria.action;
    }
    if (criteria.entityType) {
      where.entityType = criteria.entityType;
    }

    const skip = (criteria.page - 1) * criteria.limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
          item: {
            select: {
              referenceCode: true,
              title: true,
            },
          },
          claim: {
            select: {
              claimCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: criteria.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  },
};

export function createClaimService(
  claimRepo: ClaimRepository = prismaClaimRepository,
  auditRepo: AuditLogRepository = prismaAuditLogRepository,
  evidenceStorage: EvidenceStorageAdapter = storageService,
) {
  return {
    async submitClaim(
      input: CreateClaimInput,
      files: UploadImageFileInput[],
      currentUser: AuthenticatedUser,
    ): Promise<SafeClaimResponse> {
      if (currentUser.role !== UserRole.STUDENT) {
        throw new AppError(
          'Only authenticated students can submit ownership claims.',
          403,
          'STUDENT_ROLE_REQUIRED',
        );
      }

      if (files.length > MAX_EVIDENCE_FILES_PER_CLAIM) {
        throw new AppError(
          `Maximum ${MAX_EVIDENCE_FILES_PER_CLAIM} supporting evidence files allowed per claim.`,
          400,
          'TOO_MANY_EVIDENCE_FILES',
        );
      }

      for (const file of files) {
        validateUploadedEvidenceFile(file);
      }

      const targetItem = await claimRepo.findTargetItemForClaim(input.itemId);
      if (!targetItem) {
        throw new AppError('Found item not found.', 404, 'ITEM_NOT_FOUND');
      }

      if (targetItem.reportType !== ReportType.FOUND) {
        throw new AppError(
          'Ownership claims can only be submitted for found item reports.',
          400,
          'CLAIM_REQUIRES_FOUND_ITEM',
        );
      }

      if (NON_CLAIMABLE_ITEM_STATUSES.has(targetItem.status)) {
        throw new AppError(
          'Returned or closed items can no longer be claimed.',
          409,
          'ITEM_NOT_CLAIMABLE',
        );
      }

      // A student cannot claim a found item they themselves reported
      if (targetItem.reportedById === currentUser.id) {
        throw new AppError(
          'You cannot submit an ownership claim for an item you reported as found.',
          403,
          'CANNOT_CLAIM_OWN_FOUND_ITEM',
        );
      }

      const existingActive = await claimRepo.findActiveClaimForItemAndClaimant(
        targetItem.id,
        currentUser.id,
      );
      if (existingActive) {
        throw new AppError(
          'You already have an active ownership claim for this item.',
          409,
          'DUPLICATE_ACTIVE_CLAIM',
        );
      }

      const existingApproved = await claimRepo.findApprovedClaimForItem(
        targetItem.id,
      );
      if (existingApproved) {
        throw new AppError(
          'An ownership claim for this item has already been approved and is awaiting handover.',
          409,
          'ITEM_ALREADY_APPROVED_FOR_CLAIM',
        );
      }

      const claimId = randomUUID();
      const uploadedEvidence =
        files.length > 0
          ? await evidenceStorage.uploadClaimEvidenceFiles(claimId, files)
          : [];

      const evidences: CreateClaimEvidenceRecord[] = [
        {
          evidenceType: EvidenceType.TEXT_DESCRIPTION,
          label: 'Identifying Proof',
          details: input.identifyingProof,
        },
        {
          evidenceType: EvidenceType.SERIAL_NUMBER,
          label: 'Serial or Identifying Mark',
          details: input.serialOrMark,
        },
        ...uploadedEvidence.map((file, idx) => ({
          evidenceType: EvidenceType.PHOTO_REFERENCE,
          label: `Private Supporting File ${idx + 1}`,
          details:
            input.evidenceNote?.trim() ||
            `Private supporting document (${file.mimeType})`,
          storageKey: file.storageKey,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
        })),
      ];

      try {
        const pickupDesk =
          targetItem.custodyLocation ??
          targetItem.location.custodyDesk ??
          targetItem.location.buildingName;

        const created = await claimRepo.createClaimAndAudit({
          id: claimId,
          claimCode: generateClaimCode(),
          itemId: targetItem.id,
          claimantId: currentUser.id,
          ownershipStatement: input.ownershipStatement,
          preferredPickupWindow: input.preferredPickupWindow,
          pickupDesk,
          evidences,
        });

        return toSafeClaimResponse(created, currentUser, evidenceStorage);
      } catch (error) {
        if (uploadedEvidence.length > 0) {
          await evidenceStorage
            .deleteClaimEvidenceFiles(uploadedEvidence.map((u) => u.storageKey))
            .catch(() => undefined);
        }
        throw error;
      }
    },

    async listMyClaims(
      query: ListMyClaimsQuery,
      currentUser: AuthenticatedUser,
    ) {
      const { claims, total } = await claimRepo.listClaims({
        claimantId: currentUser.id,
        status: query.status,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.max(1, Math.ceil(total / query.limit));
      const safeClaims = await Promise.all(
        claims.map((claim) =>
          toSafeClaimResponse(claim, currentUser, evidenceStorage),
        ),
      );

      return {
        claims: safeClaims,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },

    async getClaimById(
      claimId: string,
      currentUser: AuthenticatedUser,
    ): Promise<SafeClaimResponse> {
      const claim = await claimRepo.findClaimByIdWithRelations(claimId);
      if (!claim) {
        throw new AppError('Claim record not found.', 404, 'CLAIM_NOT_FOUND');
      }

      const isAdmin = currentUser.role === UserRole.ADMIN;
      const isClaimant = claim.claimantId === currentUser.id;
      if (!isAdmin && !isClaimant) {
        throw new AppError(
          'You are not authorized to access this claim record.',
          403,
          'CLAIM_ACCESS_DENIED',
        );
      }

      return toSafeClaimResponse(claim, currentUser, evidenceStorage);
    },

    async getSignedEvidenceUrl(
      claimId: string,
      evidenceId: string,
      currentUser: AuthenticatedUser,
    ): Promise<{ signedUrl: string; expiresInSeconds: number }> {
      const claim = await claimRepo.findClaimByIdWithRelations(claimId);
      if (!claim) {
        throw new AppError('Claim record not found.', 404, 'CLAIM_NOT_FOUND');
      }

      const isAdmin = currentUser.role === UserRole.ADMIN;
      const isClaimant = claim.claimantId === currentUser.id;
      if (!isAdmin && !isClaimant) {
        throw new AppError(
          'You are not authorized to access private evidence for this claim.',
          403,
          'EVIDENCE_ACCESS_DENIED',
        );
      }

      const evidence = claim.evidences.find((ev) => ev.id === evidenceId);
      if (!evidence || !evidence.storageKey) {
        throw new AppError(
          'Private evidence file not found.',
          404,
          'EVIDENCE_NOT_FOUND',
        );
      }

      const signedUrl = await evidenceStorage.createSignedEvidenceUrl(
        evidence.storageKey,
        SIGNED_EVIDENCE_URL_TTL_SECONDS,
      );
      if (!signedUrl) {
        throw new AppError(
          'Unable to generate signed URL for private evidence.',
          503,
          'SIGNED_URL_UNAVAILABLE',
        );
      }

      return {
        signedUrl,
        expiresInSeconds: SIGNED_EVIDENCE_URL_TTL_SECONDS,
      };
    },

    async adminListClaims(
      query: AdminListClaimsQuery,
      adminUser: AuthenticatedUser,
    ) {
      if (adminUser.role !== UserRole.ADMIN) {
        throw new AppError(
          'Administrator access is required to review claims.',
          403,
          'ADMIN_ROLE_REQUIRED',
        );
      }

      const { claims, total } = await claimRepo.listClaims({
        status: query.status,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.max(1, Math.ceil(total / query.limit));
      const safeClaims = await Promise.all(
        claims.map((claim) =>
          toSafeClaimResponse(claim, adminUser, evidenceStorage),
        ),
      );

      return {
        claims: safeClaims,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },

    async adminReviewClaim(
      claimId: string,
      input: AdminReviewClaimInput,
      adminUser: AuthenticatedUser,
    ): Promise<SafeClaimResponse> {
      if (adminUser.role !== UserRole.ADMIN) {
        throw new AppError(
          'Only administrators can review or approve ownership claims.',
          403,
          'ADMIN_ROLE_REQUIRED',
        );
      }

      const claim = await claimRepo.findClaimByIdWithRelations(claimId);
      if (!claim) {
        throw new AppError('Claim record not found.', 404, 'CLAIM_NOT_FOUND');
      }

      if (claim.claimantId === adminUser.id) {
        throw new AppError(
          'Administrators cannot approve or review their own claims.',
          403,
          'CANNOT_REVIEW_OWN_CLAIM',
        );
      }

      if (NON_CLAIMABLE_ITEM_STATUSES.has(claim.item.status)) {
        throw new AppError(
          'Claims on returned or closed items cannot be modified.',
          409,
          'ITEM_NOT_CLAIMABLE',
        );
      }

      const allowedNext = ALLOWED_CLAIM_REVIEW_TRANSITIONS[claim.status] ?? [];
      if (!allowedNext.includes(input.status)) {
        throw new AppError(
          `Invalid claim status transition from ${claim.status} to ${input.status}.`,
          409,
          'INVALID_CLAIM_TRANSITION',
        );
      }

      if (input.status === ClaimStatus.APPROVED) {
        const otherApproved = await claimRepo.findApprovedClaimForItem(
          claim.itemId,
        );
        if (otherApproved && otherApproved.id !== claim.id) {
          throw new AppError(
            'Another claim for this item has already been approved.',
            409,
            'ANOTHER_CLAIM_ALREADY_APPROVED',
          );
        }
      }

      let auditAction: AuditAction = AuditAction.CLAIM_REVIEWED;
      let auditSummary = `Moved claim ${claim.claimCode} to ${input.status}.`;
      if (input.status === ClaimStatus.APPROVED) {
        auditAction = AuditAction.CLAIM_APPROVED;
        auditSummary = `Approved ownership claim ${claim.claimCode} for ${claim.item.referenceCode}. Physical ID verification required before handover.`;
      } else if (input.status === ClaimStatus.REJECTED) {
        auditAction = AuditAction.CLAIM_REJECTED;
        auditSummary = `Rejected ownership claim ${claim.claimCode}: ${input.rejectionReason ?? 'Insufficient proof'}`;
      }

      const updated = await claimRepo.reviewClaimAndAudit({
        claimId: claim.id,
        nextStatus: input.status,
        reviewerId: adminUser.id,
        reviewerNote: input.reviewerNote?.trim() || null,
        rejectionReason:
          input.status === ClaimStatus.REJECTED
            ? input.rejectionReason?.trim() || null
            : null,
        auditAction,
        auditSummary,
      });

      return toSafeClaimResponse(updated, adminUser, evidenceStorage);
    },

    async adminMarkItemReturned(
      itemId: string,
      input: AdminReturnItemInput,
      adminUser: AuthenticatedUser,
    ) {
      if (adminUser.role !== UserRole.ADMIN) {
        throw new AppError(
          'Only administrators can confirm physical verification and return an item.',
          403,
          'ADMIN_ROLE_REQUIRED',
        );
      }

      const item = await claimRepo.findTargetItemForClaim(itemId);
      if (!item) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      if (item.reportType !== ReportType.FOUND) {
        throw new AppError(
          'Only found items held in custody can be marked as returned.',
          400,
          'RETURN_REQUIRES_FOUND_ITEM',
        );
      }

      if (
        item.status === ItemStatus.RETURNED ||
        item.status === ItemStatus.CLOSED
      ) {
        throw new AppError(
          'This item has already been returned or closed.',
          409,
          'ITEM_ALREADY_RETURNED_OR_CLOSED',
        );
      }

      const claim = await claimRepo.findClaimByIdWithRelations(input.claimId);
      if (!claim || claim.itemId !== itemId) {
        throw new AppError(
          'Referenced claim does not belong to this found item.',
          404,
          'CLAIM_NOT_FOUND',
        );
      }

      // Approval alone never marks an item returned; conversely, physical return strictly requires APPROVED claim
      if (claim.status !== ClaimStatus.APPROVED) {
        throw new AppError(
          'Only an approved claim can be completed with physical handover verification.',
          409,
          'APPROVED_CLAIM_REQUIRED_FOR_RETURN',
        );
      }

      const { claim: returnedClaim, item: returnedItem } =
        await claimRepo.markItemReturnedAndAudit({
          itemId,
          claimId: claim.id,
          adminId: adminUser.id,
          handoverNote: input.handoverNote?.trim() || null,
        });

      return {
        claim: await toSafeClaimResponse(
          returnedClaim,
          adminUser,
          evidenceStorage,
        ),
        item: {
          id: returnedItem.id,
          referenceCode: returnedItem.referenceCode,
          title: returnedItem.title,
          status: returnedItem.status,
          updatedAt: returnedItem.updatedAt.toISOString(),
        },
      };
    },

    async adminListAuditLogs(
      query: AdminAuditLogsQuery,
      adminUser: AuthenticatedUser,
    ) {
      if (adminUser.role !== UserRole.ADMIN) {
        throw new AppError(
          'Administrator access is required to view audit logs.',
          403,
          'ADMIN_ROLE_REQUIRED',
        );
      }

      const { logs, total } = await auditRepo.listAuditLogs({
        action: query.action,
        entityType: query.entityType,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.max(1, Math.ceil(total / query.limit));

      return {
        logs: logs.map(toSafeAuditLogResponse),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },
  };
}

export const claimService = createClaimService();
