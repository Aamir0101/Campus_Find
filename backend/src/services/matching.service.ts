import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  ItemStatus,
  MatchStatus,
  Prisma,
  ReportType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type {
  AuthenticatedUser,
  ItemWithRelations,
  MatchClassification,
  MatchFilterCriteria,
  MatchRepository,
  MatchSignalBreakdown,
  MatchWithRelations,
  SafeMatchResponse,
  UpsertMatchRecord,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import type { ListMatchesQuery } from '../validators/match.validator.js';
import { toSafeItemResponse } from './item.service.js';

export const MIN_PERSISTED_MATCH_SCORE = 60;
export const MATCH_ADVISORY_NOTICE =
  'Potential match found. This is an automated suggestion and does not establish ownership.';

const INACTIVE_MATCHING_STATUSES: ItemStatus[] = [
  ItemStatus.CLOSED,
  ItemStatus.RETURNED,
];

const ELIGIBLE_MATCHING_STATUSES: ItemStatus[] = [
  ItemStatus.ACTIVE,
  ItemStatus.POTENTIAL_MATCH,
  ItemStatus.CLAIM_PENDING,
  ItemStatus.UNDER_VERIFICATION,
];

const RELATED_CATEGORY_PAIRS = new Set<string>([
  'bags|wallets',
  'wallets|bags',
  'id cards|wallets',
  'wallets|id cards',
  'accessories|keys',
  'keys|accessories',
  'accessories|clothing',
  'clothing|accessories',
]);

const STOP_WORDS = new Set<string>([
  'a',
  'an',
  'and',
  'are',
  'at',
  'by',
  'for',
  'found',
  'from',
  'has',
  'have',
  'in',
  'inside',
  'into',
  'is',
  'it',
  'item',
  'lost',
  'my',
  'near',
  'of',
  'on',
  'or',
  'report',
  'the',
  'this',
  'to',
  'was',
  'were',
  'with',
]);

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

const MATCH_RELATIONS_INCLUDE = {
  lostItem: {
    include: ITEM_RELATIONS_INCLUDE,
  },
  foundItem: {
    include: ITEM_RELATIONS_INCLUDE,
  },
} satisfies Prisma.MatchInclude;

function normalizeToken(token: string): string {
  if (token.length > 4 && token.endsWith('es')) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenizeText(text: string, minLength = 2): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= minLength && !STOP_WORDS.has(t))
    .map(normalizeToken);

  return new Set(cleaned);
}

function computeTokenSimilarity(a: Set<string>, b: Set<string>): {
  ratio: number;
  sharedTokens: string[];
} {
  if (a.size === 0 || b.size === 0) {
    return { ratio: 0, sharedTokens: [] };
  }

  const sharedTokens: string[] = [];
  for (const token of a) {
    if (b.has(token)) {
      sharedTokens.push(token);
    }
  }

  if (sharedTokens.length === 0) {
    return { ratio: 0, sharedTokens: [] };
  }

  const unionSize = a.size + b.size - sharedTokens.length;
  const jaccard = unionSize > 0 ? sharedTokens.length / unionSize : 0;
  const overlapCoeff = sharedTokens.length / Math.min(a.size, b.size);
  const ratio = Math.min(1, overlapCoeff * 0.65 + jaccard * 0.35);

  return { ratio, sharedTokens };
}

export function classifyMatchScore(score: number): MatchClassification {
  if (score >= 80) return 'HIGH MATCH';
  if (score >= 60) return 'POSSIBLE MATCH';
  return 'LOW MATCH';
}

export interface CalculatedMatchEvaluation {
  similarityScore: number;
  classification: MatchClassification;
  signals: MatchSignalBreakdown[];
}

/**
 * Pure backend weighted scoring system (Total = 100%):
 *  1. Category similarity: 25%
 *  2. Item name similarity: 25%
 *  3. Description keyword similarity: 20%
 *  4. Location similarity: 20%
 *  5. Date proximity: 10%
 */
export function evaluateItemMatch(
  lostItem: ItemWithRelations,
  foundItem: ItemWithRelations,
): CalculatedMatchEvaluation {
  // Never match an item to itself or same report type
  if (
    lostItem.id === foundItem.id ||
    lostItem.reportType === foundItem.reportType
  ) {
    return {
      similarityScore: 0,
      classification: 'LOW MATCH',
      signals: [],
    };
  }

  // 1. Category similarity (25%)
  const lostCatName = lostItem.category.name.trim().toLowerCase();
  const foundCatName = foundItem.category.name.trim().toLowerCase();
  const exactCategory =
    lostItem.categoryId === foundItem.categoryId || lostCatName === foundCatName;
  const relatedCategory =
    !exactCategory &&
    RELATED_CATEGORY_PAIRS.has(`${lostCatName}|${foundCatName}`);
  const categoryScore = exactCategory ? 25 : relatedCategory ? 12 : 0;
  const categoryDetail = exactCategory
    ? `Both categorized as ${lostItem.category.name}`
    : relatedCategory
      ? `Related categories (${lostItem.category.name} / ${foundItem.category.name})`
      : `Different categories (${lostItem.category.name} vs ${foundItem.category.name})`;

  // 2. Item name similarity (25%)
  const lostTitleTokens = tokenizeText(lostItem.title, 2);
  const foundTitleTokens = tokenizeText(foundItem.title, 2);
  const titleMatch = computeTokenSimilarity(lostTitleTokens, foundTitleTokens);
  const normTitleA = lostItem.title.trim().toLowerCase();
  const normTitleB = foundItem.title.trim().toLowerCase();
  const hasSubstringTitleMatch =
    normTitleA.length >= 4 &&
    normTitleB.length >= 4 &&
    (normTitleA.includes(normTitleB) || normTitleB.includes(normTitleA));
  const titleRatio =
    titleMatch.sharedTokens.length > 0 || hasSubstringTitleMatch
      ? Math.min(1, titleMatch.ratio + (hasSubstringTitleMatch ? 0.2 : 0))
      : 0;
  const nameScore = Math.round(titleRatio * 25);
  const nameDetail =
    titleMatch.sharedTokens.length > 0
      ? `Matched name terms: ${titleMatch.sharedTokens.slice(0, 5).join(', ')}`
      : hasSubstringTitleMatch
        ? 'Close item title phrase overlap'
        : 'No significant item name keyword overlap';

  // 3. Description keyword similarity (20%)
  // Strictly uses public description + public specificSpot — never private distinguishingFeatures or claim evidence
  const lostDescTokens = tokenizeText(
    `${lostItem.description} ${lostItem.specificSpot}`,
    3,
  );
  const foundDescTokens = tokenizeText(
    `${foundItem.description} ${foundItem.specificSpot}`,
    3,
  );
  const descMatch = computeTokenSimilarity(lostDescTokens, foundDescTokens);
  const descriptionScore = Math.round(descMatch.ratio * 20);
  const descDetail =
    descMatch.sharedTokens.length > 0
      ? `Shared keywords: ${descMatch.sharedTokens.slice(0, 6).join(', ')}`
      : 'No shared public description keywords';

  // 4. Location similarity (20%)
  const lostBuilding = lostItem.location.buildingName.trim().toLowerCase();
  const foundBuilding = foundItem.location.buildingName.trim().toLowerCase();
  const lostZone = lostItem.location.zoneName.trim().toLowerCase();
  const foundZone = foundItem.location.zoneName.trim().toLowerCase();

  let locationScore = 0;
  let locationDetail = `Different buildings (${lostItem.location.buildingName} vs ${foundItem.location.buildingName})`;

  if (lostItem.locationId === foundItem.locationId) {
    locationScore = 20;
    locationDetail = `Same location: ${lostItem.location.buildingName} (${lostItem.location.zoneName})`;
  } else if (lostBuilding === foundBuilding) {
    locationScore = 17;
    locationDetail = `Same campus building: ${lostItem.location.buildingName}`;
  } else if (lostZone === foundZone && lostZone.length > 0) {
    locationScore = 12;
    locationDetail = `Nearby campus zone: ${lostItem.location.zoneName}`;
  }

  // 5. Date proximity (10%)
  const lostTime = new Date(
    lostItem.occurredDate.toISOString().slice(0, 10) + 'T00:00:00.000Z',
  ).getTime();
  const foundTime = new Date(
    foundItem.occurredDate.toISOString().slice(0, 10) + 'T00:00:00.000Z',
  ).getTime();
  const diffDays = Math.abs(Math.round((lostTime - foundTime) / 86_400_000));

  let dateScore = 0;
  if (diffDays === 0) dateScore = 10;
  else if (diffDays === 1) dateScore = 8;
  else if (diffDays === 2) dateScore = 6;
  else if (diffDays <= 4) dateScore = 4;
  else if (diffDays <= 7) dateScore = 2;

  const dateDetail =
    diffDays === 0
      ? 'Reported on the same calendar date'
      : diffDays === 1
        ? 'Reported 1 day apart'
        : `Reported ${diffDays} days apart`;

  const similarityScore = Math.min(
    100,
    Math.max(
      0,
      categoryScore + nameScore + descriptionScore + locationScore + dateScore,
    ),
  );

  const signals: MatchSignalBreakdown[] = [
    {
      label: 'Category',
      weight: 25,
      score: categoryScore,
      detail: categoryDetail,
      matched: categoryScore > 0,
    },
    {
      label: 'Item Name',
      weight: 25,
      score: nameScore,
      detail: nameDetail,
      matched: nameScore >= 10,
    },
    {
      label: 'Description Keywords',
      weight: 20,
      score: descriptionScore,
      detail: descDetail,
      matched: descriptionScore >= 6,
    },
    {
      label: 'Campus Location',
      weight: 20,
      score: locationScore,
      detail: locationDetail,
      matched: locationScore > 0,
    },
    {
      label: 'Date Proximity',
      weight: 10,
      score: dateScore,
      detail: dateDetail,
      matched: dateScore >= 6,
    },
  ];

  return {
    similarityScore,
    classification: classifyMatchScore(similarityScore),
    signals,
  };
}

export function toSafeMatchResponse(
  match: MatchWithRelations,
  currentUser: AuthenticatedUser,
): SafeMatchResponse {
  const parsedSignals = Array.isArray(match.matchedSignals)
    ? (match.matchedSignals as MatchSignalBreakdown[])
    : [];

  return {
    id: match.id,
    lostItemId: match.lostItemId,
    foundItemId: match.foundItemId,
    similarityScore: match.similarityScore,
    classification: classifyMatchScore(match.similarityScore),
    status: match.status,
    notice: MATCH_ADVISORY_NOTICE,
    signals: parsedSignals,
    lostItem: toSafeItemResponse(match.lostItem, currentUser),
    foundItem: toSafeItemResponse(match.foundItem, currentUser),
    detectedAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}

export const prismaMatchRepository: MatchRepository = {
  async findSourceItem(itemId: string): Promise<ItemWithRelations | null> {
    return prisma.item.findUnique({
      where: { id: itemId },
      include: ITEM_RELATIONS_INCLUDE,
    });
  },

  async findActiveOppositeItems(
    oppositeType: ReportType,
    excludeItemId: string,
  ): Promise<ItemWithRelations[]> {
    return prisma.item.findMany({
      where: {
        reportType: oppositeType,
        id: { not: excludeItemId },
        status: { in: ELIGIBLE_MATCHING_STATUSES },
      },
      include: ITEM_RELATIONS_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  },

  async upsertMatch(data: UpsertMatchRecord): Promise<MatchWithRelations> {
    const signalsJson = data.matchedSignals as unknown as Prisma.InputJsonValue;

    try {
      return await prisma.match.upsert({
        where: {
          lostItemId_foundItemId: {
            lostItemId: data.lostItemId,
            foundItemId: data.foundItemId,
          },
        },
        create: {
          id: randomUUID(),
          lostItemId: data.lostItemId,
          foundItemId: data.foundItemId,
          similarityScore: data.similarityScore,
          matchedSignals: signalsJson,
          status: MatchStatus.PENDING,
        },
        update: {
          similarityScore: data.similarityScore,
          matchedSignals: signalsJson,
        },
        include: MATCH_RELATIONS_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return prisma.match.update({
          where: {
            lostItemId_foundItemId: {
              lostItemId: data.lostItemId,
              foundItemId: data.foundItemId,
            },
          },
          data: {
            similarityScore: data.similarityScore,
            matchedSignals: signalsJson,
          },
          include: MATCH_RELATIONS_INCLUDE,
        });
      }
      throw error;
    }
  },

  async deleteStalePendingMatches(
    sourceItemId: string,
    keepPairItemIds: string[],
  ): Promise<number> {
    const result = await prisma.match.deleteMany({
      where: {
        status: MatchStatus.PENDING,
        OR: [
          {
            lostItemId: sourceItemId,
            ...(keepPairItemIds.length > 0
              ? { foundItemId: { notIn: keepPairItemIds } }
              : {}),
          },
          {
            foundItemId: sourceItemId,
            ...(keepPairItemIds.length > 0
              ? { lostItemId: { notIn: keepPairItemIds } }
              : {}),
          },
        ],
      },
    });
    return result.count;
  },

  async countActiveMatchesForItem(itemId: string): Promise<number> {
    return prisma.match.count({
      where: {
        similarityScore: { gte: MIN_PERSISTED_MATCH_SCORE },
        status: { not: MatchStatus.DISMISSED },
        lostItem: { status: { notIn: INACTIVE_MATCHING_STATUSES } },
        foundItem: { status: { notIn: INACTIVE_MATCHING_STATUSES } },
        OR: [{ lostItemId: itemId }, { foundItemId: itemId }],
      },
    });
  },

  async syncItemPotentialMatchStatus(itemId: string): Promise<void> {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, status: true },
    });
    if (!item) return;

    if (
      item.status !== ItemStatus.ACTIVE &&
      item.status !== ItemStatus.POTENTIAL_MATCH
    ) {
      return;
    }

    const activeCount = await this.countActiveMatchesForItem(itemId);
    const nextStatus =
      activeCount > 0 ? ItemStatus.POTENTIAL_MATCH : ItemStatus.ACTIVE;

    if (item.status !== nextStatus) {
      await prisma.item.update({
        where: { id: itemId },
        data: { status: nextStatus },
      });
    }
  },

  async listMatches(criteria: MatchFilterCriteria) {
    const where: Prisma.MatchWhereInput = {
      similarityScore: { gte: MIN_PERSISTED_MATCH_SCORE },
      lostItem: {
        status: { notIn: INACTIVE_MATCHING_STATUSES },
      },
      foundItem: {
        status: { notIn: INACTIVE_MATCHING_STATUSES },
      },
    };

    if (!criteria.isAdmin && criteria.viewerUserId) {
      where.OR = [
        { lostItem: { reportedById: criteria.viewerUserId } },
        { foundItem: { reportedById: criteria.viewerUserId } },
      ];
    }

    if (criteria.itemId) {
      where.AND = [
        {
          OR: [
            { lostItemId: criteria.itemId },
            { foundItemId: criteria.itemId },
          ],
        },
      ];
    }

    if (criteria.status === 'ACTIVE') {
      where.status = { in: [MatchStatus.PENDING, MatchStatus.CONFIRMED] };
    } else if (criteria.status !== 'ALL') {
      where.status = criteria.status;
    }

    const skip = (criteria.page - 1) * criteria.limit;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: MATCH_RELATIONS_INCLUDE,
        orderBy: [{ similarityScore: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: criteria.limit,
      }),
      prisma.match.count({ where }),
    ]);

    return { matches, total };
  },

  async findMatchById(id: string): Promise<MatchWithRelations | null> {
    return prisma.match.findUnique({
      where: { id },
      include: MATCH_RELATIONS_INCLUDE,
    });
  },

  async updateMatchStatusAndAudit(
    id: string,
    status: MatchStatus,
    actorId: string,
  ): Promise<MatchWithRelations> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.match.update({
        where: { id },
        data: {
          status,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
        include: MATCH_RELATIONS_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: AuditAction.MATCH_REVIEWED,
          entityType: 'Match',
          entityId: updated.id,
          matchId: updated.id,
          summary: `Match ${updated.lostItem.referenceCode} <-> ${updated.foundItem.referenceCode} marked ${status}.`,
        },
      });

      return updated;
    });
  },
};

export function createMatchingService(
  repo: MatchRepository = prismaMatchRepository,
) {
  // Coalesce concurrent recalculations for the same itemId
  const inFlightRecalculations = new Map<
    string,
    Promise<{ itemId: string; matchesSaved: number; matchIds: string[] }>
  >();

  async function runRecalculateForItem(itemId: string): Promise<{
    itemId: string;
    matchesSaved: number;
    matchIds: string[];
  }> {
    const source = await repo.findSourceItem(itemId);
    if (!source) {
      throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
    }

    if (
      source.status === ItemStatus.CLOSED ||
      source.status === ItemStatus.RETURNED
    ) {
      await repo.deleteStalePendingMatches(source.id, []);
      return { itemId: source.id, matchesSaved: 0, matchIds: [] };
    }

    const oppositeType =
      source.reportType === ReportType.LOST
        ? ReportType.FOUND
        : ReportType.LOST;

    const candidates = await repo.findActiveOppositeItems(
      oppositeType,
      source.id,
    );

    const matchedPairIds: string[] = [];
    const savedMatchIds: string[] = [];
    const affectedItemIds = new Set<string>([source.id]);

    for (const candidate of candidates) {
      if (candidate.id === source.id) continue;
      if (
        candidate.status === ItemStatus.CLOSED ||
        candidate.status === ItemStatus.RETURNED
      ) {
        continue;
      }

      const lostItem =
        source.reportType === ReportType.LOST ? source : candidate;
      const foundItem =
        source.reportType === ReportType.FOUND ? source : candidate;

      const evaluation = evaluateItemMatch(lostItem, foundItem);

      if (evaluation.similarityScore >= MIN_PERSISTED_MATCH_SCORE) {
        const upserted = await repo.upsertMatch({
          lostItemId: lostItem.id,
          foundItemId: foundItem.id,
          similarityScore: evaluation.similarityScore,
          matchedSignals: evaluation.signals,
        });
        matchedPairIds.push(candidate.id);
        savedMatchIds.push(upserted.id);
        affectedItemIds.add(candidate.id);
      }
    }

    await repo.deleteStalePendingMatches(source.id, matchedPairIds);

    for (const affectedId of affectedItemIds) {
      await repo.syncItemPotentialMatchStatus(affectedId);
    }

    return {
      itemId: source.id,
      matchesSaved: savedMatchIds.length,
      matchIds: savedMatchIds,
    };
  }

  return {
    async recalculateForItem(itemId: string) {
      const existingPromise = inFlightRecalculations.get(itemId);
      if (existingPromise) {
        return existingPromise;
      }

      const task = runRecalculateForItem(itemId).finally(() => {
        inFlightRecalculations.delete(itemId);
      });
      inFlightRecalculations.set(itemId, task);
      return task;
    },

    async cleanupMatchesForInactiveItem(itemId: string): Promise<void> {
      const source = await repo.findSourceItem(itemId);
      if (!source) return;

      const oppositeType =
        source.reportType === ReportType.LOST
          ? ReportType.FOUND
          : ReportType.LOST;
      const oppositeItems = await repo.findActiveOppositeItems(
        oppositeType,
        source.id,
      );

      await repo.deleteStalePendingMatches(itemId, []);

      for (const candidate of oppositeItems) {
        await repo.syncItemPotentialMatchStatus(candidate.id);
      }
    },

    async recalculateForItemAuthorized(
      itemId: string,
      currentUser: AuthenticatedUser,
    ) {
      const source = await repo.findSourceItem(itemId);
      if (!source) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      const isOwner = source.reportedById === currentUser.id;
      const isAdmin = currentUser.role === UserRole.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new AppError(
          'You are not authorized to recalculate matches for this report.',
          403,
          'MATCH_RECALCULATION_FORBIDDEN',
        );
      }

      if (
        source.status === ItemStatus.CLOSED ||
        source.status === ItemStatus.RETURNED
      ) {
        throw new AppError(
          'Closed or returned reports cannot enter active matching.',
          409,
          'ITEM_NOT_ELIGIBLE_FOR_MATCHING',
        );
      }

      const result = await this.recalculateForItem(itemId);
      const { matches } = await repo.listMatches({
        viewerUserId: currentUser.id,
        isAdmin,
        status: 'ALL',
        itemId,
        page: 1,
        limit: 50,
      });

      return {
        ...result,
        matches: matches.map((m) => toSafeMatchResponse(m, currentUser)),
      };
    },

    async listMatches(
      query: ListMatchesQuery,
      currentUser: AuthenticatedUser,
    ) {
      const isAdmin = currentUser.role === UserRole.ADMIN;
      const { matches, total } = await repo.listMatches({
        viewerUserId: currentUser.id,
        isAdmin,
        status: query.status,
        itemId: query.itemId,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.max(1, Math.ceil(total / query.limit));

      return {
        matches: matches.map((m) => toSafeMatchResponse(m, currentUser)),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },

    async getMatchById(
      id: string,
      currentUser: AuthenticatedUser,
    ): Promise<SafeMatchResponse> {
      const match = await repo.findMatchById(id);
      if (!match) {
        throw new AppError('Match record not found.', 404, 'MATCH_NOT_FOUND');
      }

      const isAdmin = currentUser.role === UserRole.ADMIN;
      const isParticipant =
        match.lostItem.reportedById === currentUser.id ||
        match.foundItem.reportedById === currentUser.id;

      if (!isAdmin && !isParticipant) {
        throw new AppError(
          'You are not authorized to view this match record.',
          403,
          'MATCH_ACCESS_DENIED',
        );
      }

      if (match.similarityScore < MIN_PERSISTED_MATCH_SCORE) {
        throw new AppError('Match record not found.', 404, 'MATCH_NOT_FOUND');
      }

      const hasInactiveItem =
        INACTIVE_MATCHING_STATUSES.includes(match.lostItem.status) ||
        INACTIVE_MATCHING_STATUSES.includes(match.foundItem.status);

      if (hasInactiveItem && !isAdmin) {
        throw new AppError('Match record not found.', 404, 'MATCH_NOT_FOUND');
      }

      return toSafeMatchResponse(match, currentUser);
    },

    async updateMatchVisibility(
      id: string,
      status: MatchStatus,
      currentUser: AuthenticatedUser,
    ): Promise<SafeMatchResponse> {
      const match = await repo.findMatchById(id);
      if (!match) {
        throw new AppError('Match record not found.', 404, 'MATCH_NOT_FOUND');
      }

      const isAdmin = currentUser.role === UserRole.ADMIN;
      const isParticipant =
        match.lostItem.reportedById === currentUser.id ||
        match.foundItem.reportedById === currentUser.id;

      if (!isAdmin && !isParticipant) {
        throw new AppError(
          'You are not authorized to update this match suggestion.',
          403,
          'MATCH_ACCESS_DENIED',
        );
      }

      if (
        status !== MatchStatus.DISMISSED &&
        status !== MatchStatus.PENDING
      ) {
        throw new AppError(
          'Students can only dismiss or restore pending match suggestions.',
          403,
          'MATCH_STATUS_FORBIDDEN',
        );
      }

      const updated = await repo.updateMatchStatusAndAudit(
        id,
        status,
        currentUser.id,
      );
      await Promise.all([
        repo.syncItemPotentialMatchStatus(updated.lostItemId),
        repo.syncItemPotentialMatchStatus(updated.foundItemId),
      ]);

      const refreshed = await repo.findMatchById(updated.id);
      return toSafeMatchResponse(refreshed ?? updated, currentUser);
    },
  };
}

export const matchingService = createMatchingService();
