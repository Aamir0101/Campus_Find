import { randomBytes, randomUUID } from 'node:crypto';
import {
  AuditAction,
  ItemStatus,
  Prisma,
  ReportType,
  UserRole,
} from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type {
  AuthenticatedUser,
  CategoryDto,
  CreateItemRecord,
  ItemFilterCriteria,
  ItemRepository,
  ItemWithRelations,
  LocationDto,
  SafeItemResponse,
  UpdateItemRecord,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import {
  ALLOWED_CATEGORY_NAMES,
  type CreateItemInput,
  type ListItemsQuery,
  type UpdateItemInput,
} from '../validators/item.validator.js';
import {
  MAX_ITEM_IMAGES_PER_REPORT,
  storageService,
  type StorageAdapter,
  type UploadImageFileInput,
  validateUploadedImageFile,
} from './storage.service.js';

const ELIGIBLE_STUDENT_MUTATION_STATUSES = new Set<ItemStatus>([
  ItemStatus.ACTIVE,
  ItemStatus.POTENTIAL_MATCH,
]);

const DEFAULT_PUBLIC_BROWSABLE_STATUSES: ItemStatus[] = [
  ItemStatus.ACTIVE,
  ItemStatus.POTENTIAL_MATCH,
  ItemStatus.CLAIM_PENDING,
  ItemStatus.UNDER_VERIFICATION,
];

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

function generateItemReferenceCode(reportType: ReportType): string {
  const prefix = reportType === ReportType.LOST ? 'LF' : 'FD';
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${suffix}`;
}

export function toSafeItemResponse(
  item: ItemWithRelations,
  currentUser?: AuthenticatedUser,
): SafeItemResponse {
  const isOwner = Boolean(currentUser && item.reportedById === currentUser.id);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canInspectPrivateFields = isOwner || isAdmin;

  return {
    id: item.id,
    referenceCode: item.referenceCode,
    reportType: item.reportType,
    title: item.title,
    categoryId: item.categoryId,
    category: item.category.name,
    locationId: item.locationId,
    building: item.location.buildingName,
    zoneName: item.location.zoneName,
    specificSpot: item.specificSpot,
    custodyLocation: item.custodyLocation ?? item.location.custodyDesk ?? null,
    occurredDate: item.occurredDate.toISOString().slice(0, 10),
    timeWindow: item.timeWindow,
    description: item.description,
    ...(canInspectPrivateFields
      ? {
          distinguishingFeatures: item.distinguishingFeatures,
          verificationPrompt: item.verificationPrompt,
        }
      : {}),
    status: item.status,
    reporterAffiliation: canInspectPrivateFields
      ? `${item.reportedBy.fullName} · ${item.reportedBy.department}`
      : `${item.reportedBy.department} Member`,
    isOwner,
    isEditable: isOwner && ELIGIBLE_STUDENT_MUTATION_STATUSES.has(item.status),
    images: [...item.images]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((img) => ({
        id: img.id,
        publicUrl: img.publicUrl,
        mimeType: img.mimeType,
        altText: img.altText,
        displayOrder: img.displayOrder,
        isPrimary: img.isPrimary,
      })),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export const prismaItemRepository: ItemRepository = {
  async listActiveCategories(): Promise<CategoryDto[]> {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
    });

    const orderMap = new Map<string, number>(
      ALLOWED_CATEGORY_NAMES.map((name, index) => [name, index]),
    );
    return categories.sort(
      (a, b) => (orderMap.get(a.name) ?? 99) - (orderMap.get(b.name) ?? 99),
    );
  },

  async listActiveLocations(): Promise<LocationDto[]> {
    return prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ buildingName: 'asc' }, { zoneName: 'asc' }],
      select: {
        id: true,
        code: true,
        buildingName: true,
        zoneName: true,
        custodyDesk: true,
      },
    });
  },

  async findCategoryByIdOrName(input): Promise<CategoryDto | null> {
    if (input.categoryId) {
      return prisma.category.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { id: true, name: true, slug: true, description: true },
      });
    }
    if (input.categoryName) {
      return prisma.category.findFirst({
        where: {
          isActive: true,
          name: { equals: input.categoryName, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, description: true },
      });
    }
    return null;
  },

  async findLocationByIdOrBuilding(input): Promise<LocationDto | null> {
    if (input.locationId) {
      return prisma.location.findFirst({
        where: { id: input.locationId, isActive: true },
        select: {
          id: true,
          code: true,
          buildingName: true,
          zoneName: true,
          custodyDesk: true,
        },
      });
    }
    if (input.building) {
      return prisma.location.findFirst({
        where: {
          isActive: true,
          buildingName: { equals: input.building, mode: 'insensitive' },
        },
        select: {
          id: true,
          code: true,
          buildingName: true,
          zoneName: true,
          custodyDesk: true,
        },
      });
    }
    return null;
  },

  async listItems(criteria: ItemFilterCriteria) {
    const where: Prisma.ItemWhereInput = {};

    if (criteria.reportedById) {
      where.reportedById = criteria.reportedById;
    }

    if (criteria.reportType !== 'ALL') {
      where.reportType = criteria.reportType;
    }

    if (criteria.status !== 'ALL') {
      if (!criteria.includeClosed && criteria.status === ItemStatus.CLOSED) {
        return { items: [], total: 0 };
      }
      where.status = criteria.status;
    } else if (!criteria.includeClosed) {
      where.status = { in: DEFAULT_PUBLIC_BROWSABLE_STATUSES };
    }

    if (criteria.category && criteria.category !== 'ALL') {
      where.category = {
        OR: [
          { name: { equals: criteria.category, mode: 'insensitive' } },
          { slug: { equals: criteria.category, mode: 'insensitive' } },
        ],
      };
    }

    if (criteria.locationId) {
      where.locationId = criteria.locationId;
    } else if (criteria.building && criteria.building !== 'ALL') {
      where.location = {
        buildingName: { equals: criteria.building, mode: 'insensitive' },
      };
    }

    if (criteria.search) {
      where.OR = [
        { title: { contains: criteria.search, mode: 'insensitive' } },
        { description: { contains: criteria.search, mode: 'insensitive' } },
        { specificSpot: { contains: criteria.search, mode: 'insensitive' } },
        { referenceCode: { contains: criteria.search, mode: 'insensitive' } },
        {
          location: {
            buildingName: { contains: criteria.search, mode: 'insensitive' },
          },
        },
        {
          category: {
            name: { contains: criteria.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const skip = (criteria.page - 1) * criteria.limit;

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: ITEM_RELATIONS_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: criteria.limit,
      }),
      prisma.item.count({ where }),
    ]);

    return { items, total };
  },

  async findByIdWithRelations(id: string): Promise<ItemWithRelations | null> {
    return prisma.item.findUnique({
      where: { id },
      include: ITEM_RELATIONS_INCLUDE,
    });
  },

  async createItemAndAudit(data: CreateItemRecord): Promise<ItemWithRelations> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          id: data.id,
          referenceCode: data.referenceCode,
          reportType: data.reportType,
          title: data.title,
          description: data.description,
          distinguishingFeatures: data.distinguishingFeatures,
          verificationPrompt: data.verificationPrompt ?? null,
          specificSpot: data.specificSpot,
          custodyLocation: data.custodyLocation ?? null,
          occurredDate: data.occurredDate,
          timeWindow: data.timeWindow,
          status: ItemStatus.ACTIVE,
          reportedById: data.reportedById,
          categoryId: data.categoryId,
          locationId: data.locationId,
          images:
            data.images.length > 0
              ? {
                  create: data.images.map((img) => ({
                    storageKey: img.storageKey,
                    publicUrl: img.publicUrl,
                    mimeType: img.mimeType,
                    altText: img.altText ?? null,
                    displayOrder: img.displayOrder,
                    isPrimary: img.isPrimary,
                  })),
                }
              : undefined,
        },
        include: ITEM_RELATIONS_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: data.reportedById,
          action: AuditAction.REPORT_CREATED,
          entityType: 'Item',
          entityId: created.id,
          itemId: created.id,
          summary: `Created ${created.reportType.toLowerCase()} item report ${created.referenceCode}.`,
        },
      });

      return created;
    });
  },

  async updateItemAndAudit(
    id: string,
    actorId: string,
    data: UpdateItemRecord,
  ): Promise<{ item: ItemWithRelations; removedStorageKeys: string[] }> {
    return prisma.$transaction(async (tx) => {
      let removedStorageKeys: string[] = [];

      if (data.removeImageIds && data.removeImageIds.length > 0) {
        const ownedToRemove = await tx.itemImage.findMany({
          where: {
            itemId: id,
            id: { in: data.removeImageIds },
          },
          select: { id: true, storageKey: true },
        });
        if (ownedToRemove.length > 0) {
          removedStorageKeys = ownedToRemove.map((img) => img.storageKey);
          await tx.itemImage.deleteMany({
            where: {
              itemId: id,
              id: { in: ownedToRemove.map((img) => img.id) },
            },
          });
        }
      }

      if (data.addImages && data.addImages.length > 0) {
        await tx.itemImage.createMany({
          data: data.addImages.map((img) => ({
            itemId: id,
            storageKey: img.storageKey,
            publicUrl: img.publicUrl,
            mimeType: img.mimeType,
            altText: img.altText ?? null,
            displayOrder: img.displayOrder,
            isPrimary: false,
          })),
        });
      }

      // Normalize displayOrder & primary flag if images were modified
      if (
        (data.removeImageIds && data.removeImageIds.length > 0) ||
        (data.addImages && data.addImages.length > 0)
      ) {
        const remaining = await tx.itemImage.findMany({
          where: { itemId: id },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        });
        for (let idx = 0; idx < remaining.length; idx += 1) {
          await tx.itemImage.update({
            where: { id: remaining[idx].id },
            data: {
              displayOrder: idx,
              isPrimary: idx === 0,
            },
          });
        }
      }

      const updateFields: Prisma.ItemUncheckedUpdateInput = {};
      if (data.title !== undefined) updateFields.title = data.title;
      if (data.categoryId !== undefined) updateFields.categoryId = data.categoryId;
      if (data.locationId !== undefined) updateFields.locationId = data.locationId;
      if (data.specificSpot !== undefined) updateFields.specificSpot = data.specificSpot;
      if (data.occurredDate !== undefined) updateFields.occurredDate = data.occurredDate;
      if (data.timeWindow !== undefined) updateFields.timeWindow = data.timeWindow;
      if (data.description !== undefined) updateFields.description = data.description;
      if (data.distinguishingFeatures !== undefined) {
        updateFields.distinguishingFeatures = data.distinguishingFeatures;
      }
      if (data.verificationPrompt !== undefined) {
        updateFields.verificationPrompt = data.verificationPrompt;
      }
      if (data.custodyLocation !== undefined) {
        updateFields.custodyLocation = data.custodyLocation;
      }

      const updated = await tx.item.update({
        where: { id },
        data: updateFields,
        include: ITEM_RELATIONS_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: AuditAction.REPORT_UPDATED,
          entityType: 'Item',
          entityId: updated.id,
          itemId: updated.id,
          summary: `Updated item report ${updated.referenceCode}.`,
        },
      });

      return { item: updated, removedStorageKeys };
    });
  },

  async withdrawItemAndAudit(
    id: string,
    actorId: string,
    previousStatus: ItemStatus,
  ): Promise<ItemWithRelations> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id },
        data: { status: ItemStatus.CLOSED },
        include: ITEM_RELATIONS_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: AuditAction.REPORT_STATUS_CHANGED,
          entityType: 'Item',
          entityId: updated.id,
          itemId: updated.id,
          summary: `Withdrew item report ${updated.referenceCode} (${previousStatus} -> CLOSED).`,
        },
      });

      return updated;
    });
  },
};

export interface ItemMatchingLifecycleHook {
  recalculateForItem(itemId: string): Promise<unknown>;
  cleanupMatchesForInactiveItem(itemId: string): Promise<void>;
}

export function createItemService(
  repo: ItemRepository = prismaItemRepository,
  storage: StorageAdapter = storageService,
  matchingHook?: ItemMatchingLifecycleHook,
) {
  return {
    async listMetadata() {
      const [categories, locations] = await Promise.all([
        repo.listActiveCategories(),
        repo.listActiveLocations(),
      ]);
      return { categories, locations };
    },

    async listItems(query: ListItemsQuery, currentUser?: AuthenticatedUser) {
      if (query.mine && !currentUser) {
        throw new AppError(
          'Authentication required to view your reports.',
          401,
          'AUTHENTICATION_REQUIRED',
        );
      }

      const includeClosed = Boolean(
        query.mine || currentUser?.role === UserRole.ADMIN,
      );

      const { items, total } = await repo.listItems({
        search: query.search,
        reportType: query.reportType,
        category: query.category,
        building: query.building,
        locationId: query.locationId,
        status: query.status,
        reportedById: query.mine ? currentUser?.id : undefined,
        includeClosed,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.max(1, Math.ceil(total / query.limit));

      return {
        items: items.map((item) => toSafeItemResponse(item, currentUser)),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },

    async getItemById(id: string, currentUser?: AuthenticatedUser) {
      const item = await repo.findByIdWithRelations(id);
      if (!item) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      const isOwner = Boolean(currentUser && item.reportedById === currentUser.id);
      const isAdmin = currentUser?.role === UserRole.ADMIN;

      if (item.status === ItemStatus.CLOSED && !isOwner && !isAdmin) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      return toSafeItemResponse(item, currentUser);
    },

    async createItem(
      input: CreateItemInput,
      files: UploadImageFileInput[],
      currentUser: AuthenticatedUser,
    ): Promise<SafeItemResponse> {
      if (currentUser.role !== UserRole.STUDENT) {
        throw new AppError(
          'Only authenticated students can submit lost or found item reports.',
          403,
          'STUDENT_ROLE_REQUIRED',
        );
      }

      if (files.length > MAX_ITEM_IMAGES_PER_REPORT) {
        throw new AppError(
          `Maximum ${MAX_ITEM_IMAGES_PER_REPORT} photographs allowed per report.`,
          400,
          'TOO_MANY_IMAGES',
        );
      }

      // Fast-fail file validation before hitting storage or database
      for (const file of files) {
        validateUploadedImageFile(file);
      }

      const [category, location] = await Promise.all([
        repo.findCategoryByIdOrName({
          categoryId: input.categoryId,
          categoryName: input.category,
        }),
        repo.findLocationByIdOrBuilding({
          locationId: input.locationId,
          building: input.building,
        }),
      ]);

      if (!category) {
        throw new AppError(
          'Selected item category is invalid or unavailable.',
          400,
          'INVALID_CATEGORY',
        );
      }

      if (!location) {
        throw new AppError(
          'Selected campus location is invalid or unavailable.',
          400,
          'INVALID_LOCATION',
        );
      }

      const itemId = randomUUID();
      const uploadedImages =
        files.length > 0 ? await storage.uploadItemImages(itemId, files, 0) : [];

      try {
        const created = await repo.createItemAndAudit({
          id: itemId,
          referenceCode: generateItemReferenceCode(input.reportType),
          reportType: input.reportType,
          title: input.title,
          description: input.description,
          distinguishingFeatures: input.distinguishingFeatures,
          verificationPrompt: input.verificationPrompt ?? null,
          specificSpot: input.specificSpot,
          custodyLocation:
            input.reportType === ReportType.FOUND
              ? input.custodyLocation || location.custodyDesk || null
              : null,
          occurredDate: new Date(`${input.occurredDate}T00:00:00.000Z`),
          timeWindow: input.timeWindow,
          reportedById: currentUser.id,
          categoryId: category.id,
          locationId: location.id,
          images: uploadedImages.map((img) => ({
            storageKey: img.storageKey,
            publicUrl: img.publicUrl,
            mimeType: img.mimeType,
            altText: `${input.title} photograph ${img.displayOrder + 1}`,
            displayOrder: img.displayOrder,
            isPrimary: img.isPrimary,
          })),
        });

        if (matchingHook) {
          await matchingHook.recalculateForItem(created.id).catch(() => undefined);
          const refreshed = await repo.findByIdWithRelations(created.id);
          if (refreshed) {
            return toSafeItemResponse(refreshed, currentUser);
          }
        }

        return toSafeItemResponse(created, currentUser);
      } catch (error) {
        if (uploadedImages.length > 0) {
          await storage
            .deleteItemImages(uploadedImages.map((img) => img.storageKey))
            .catch(() => undefined);
        }
        throw error;
      }
    },

    async updateItem(
      id: string,
      input: UpdateItemInput,
      newFiles: UploadImageFileInput[],
      currentUser: AuthenticatedUser,
    ): Promise<SafeItemResponse> {
      if (currentUser.role !== UserRole.STUDENT) {
        throw new AppError(
          'Only students can edit their own item reports.',
          403,
          'STUDENT_ROLE_REQUIRED',
        );
      }

      const existing = await repo.findByIdWithRelations(id);
      if (!existing) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      if (existing.reportedById !== currentUser.id) {
        throw new AppError(
          'You can only edit your own item reports.',
          403,
          'OWNERSHIP_REQUIRED',
        );
      }

      if (!ELIGIBLE_STUDENT_MUTATION_STATUSES.has(existing.status)) {
        throw new AppError(
          'This report can no longer be edited because verification or closure is already underway.',
          409,
          'REPORT_NOT_ELIGIBLE_FOR_EDIT',
        );
      }

      const removeSet = new Set(input.removeImageIds ?? []);
      const remainingExistingCount = existing.images.filter(
        (img) => !removeSet.has(img.id),
      ).length;

      if (remainingExistingCount + newFiles.length > MAX_ITEM_IMAGES_PER_REPORT) {
        throw new AppError(
          `A report may contain at most ${MAX_ITEM_IMAGES_PER_REPORT} photographs.`,
          400,
          'TOO_MANY_IMAGES',
        );
      }

      for (const file of newFiles) {
        validateUploadedImageFile(file);
      }

      const updatePayload: UpdateItemRecord = {
        removeImageIds: input.removeImageIds,
      };

      if (input.title !== undefined) updatePayload.title = input.title;
      if (input.specificSpot !== undefined) {
        updatePayload.specificSpot = input.specificSpot;
      }
      if (input.occurredDate !== undefined) {
        updatePayload.occurredDate = new Date(
          `${input.occurredDate}T00:00:00.000Z`,
        );
      }
      if (input.timeWindow !== undefined) updatePayload.timeWindow = input.timeWindow;
      if (input.description !== undefined) updatePayload.description = input.description;
      if (input.distinguishingFeatures !== undefined) {
        updatePayload.distinguishingFeatures = input.distinguishingFeatures;
      }
      if (input.verificationPrompt !== undefined) {
        updatePayload.verificationPrompt = input.verificationPrompt;
      }
      if (input.custodyLocation !== undefined) {
        updatePayload.custodyLocation =
          existing.reportType === ReportType.FOUND ? input.custodyLocation : null;
      }

      if (input.categoryId !== undefined || input.category !== undefined) {
        const category = await repo.findCategoryByIdOrName({
          categoryId: input.categoryId,
          categoryName: input.category,
        });
        if (!category) {
          throw new AppError(
            'Selected item category is invalid or unavailable.',
            400,
            'INVALID_CATEGORY',
          );
        }
        updatePayload.categoryId = category.id;
      }

      if (input.locationId !== undefined || input.building !== undefined) {
        const location = await repo.findLocationByIdOrBuilding({
          locationId: input.locationId,
          building: input.building,
        });
        if (!location) {
          throw new AppError(
            'Selected campus location is invalid or unavailable.',
            400,
            'INVALID_LOCATION',
          );
        }
        updatePayload.locationId = location.id;
      }

      const startingOrder =
        existing.images.reduce((max, img) => Math.max(max, img.displayOrder), -1) + 1;
      const uploadedImages =
        newFiles.length > 0
          ? await storage.uploadItemImages(existing.id, newFiles, startingOrder)
          : [];

      if (uploadedImages.length > 0) {
        updatePayload.addImages = uploadedImages.map((img) => ({
          storageKey: img.storageKey,
          publicUrl: img.publicUrl,
          mimeType: img.mimeType,
          altText: `${input.title ?? existing.title} photograph ${img.displayOrder + 1}`,
          displayOrder: img.displayOrder,
          isPrimary: false,
        }));
      }

      try {
        const { item: updated, removedStorageKeys } = await repo.updateItemAndAudit(
          existing.id,
          currentUser.id,
          updatePayload,
        );

        if (removedStorageKeys.length > 0) {
          await storage.deleteItemImages(removedStorageKeys).catch(() => undefined);
        }

        const shouldRecalculate =
          input.title !== undefined ||
          input.description !== undefined ||
          input.specificSpot !== undefined ||
          input.occurredDate !== undefined ||
          input.categoryId !== undefined ||
          input.category !== undefined ||
          input.locationId !== undefined ||
          input.building !== undefined;

        if (matchingHook && shouldRecalculate) {
          await matchingHook.recalculateForItem(updated.id).catch(() => undefined);
          const refreshed = await repo.findByIdWithRelations(updated.id);
          if (refreshed) {
            return toSafeItemResponse(refreshed, currentUser);
          }
        }

        return toSafeItemResponse(updated, currentUser);
      } catch (error) {
        if (uploadedImages.length > 0) {
          await storage
            .deleteItemImages(uploadedImages.map((img) => img.storageKey))
            .catch(() => undefined);
        }
        throw error;
      }
    },

    async withdrawItem(
      id: string,
      currentUser: AuthenticatedUser,
    ): Promise<SafeItemResponse> {
      if (currentUser.role !== UserRole.STUDENT) {
        throw new AppError(
          'Only students can withdraw their own item reports.',
          403,
          'STUDENT_ROLE_REQUIRED',
        );
      }

      const existing = await repo.findByIdWithRelations(id);
      if (!existing) {
        throw new AppError('Item report not found.', 404, 'ITEM_NOT_FOUND');
      }

      if (existing.reportedById !== currentUser.id) {
        throw new AppError(
          'You can only withdraw your own item reports.',
          403,
          'OWNERSHIP_REQUIRED',
        );
      }

      if (existing.status === ItemStatus.CLOSED) {
        throw new AppError(
          'This report has already been withdrawn.',
          409,
          'REPORT_ALREADY_CLOSED',
        );
      }

      if (!ELIGIBLE_STUDENT_MUTATION_STATUSES.has(existing.status)) {
        throw new AppError(
          'Active verification or custody status prevents withdrawing this report.',
          409,
          'REPORT_NOT_ELIGIBLE_FOR_WITHDRAWAL',
        );
      }

      const withdrawn = await repo.withdrawItemAndAudit(
        existing.id,
        currentUser.id,
        existing.status,
      );

      if (matchingHook) {
        await matchingHook
          .cleanupMatchesForInactiveItem(withdrawn.id)
          .catch(() => undefined);
      }

      return toSafeItemResponse(withdrawn, currentUser);
    },
  };
}

export const itemService = createItemService();
