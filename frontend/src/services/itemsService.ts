import type {
  CampusItem,
  CreateItemReportInput,
  ItemCategory,
  ItemFilters,
  ItemImageRecord,
  ItemMetadataResponse,
  ItemStatus,
  PaginatedItemsResponse,
  ReportType,
  UpdateItemReportInput,
} from '../types/domain';
import { ApiClientError, apiRequest } from './apiClient';

export interface BackendItemDto {
  id: string;
  referenceCode: string;
  reportType: ReportType;
  title: string;
  categoryId: string;
  category: ItemCategory;
  locationId: string;
  building: string;
  zoneName: string;
  specificSpot: string;
  custodyLocation: string | null;
  occurredDate: string;
  timeWindow: string;
  description: string;
  distinguishingFeatures?: string;
  verificationPrompt?: string | null;
  status: ItemStatus;
  reporterAffiliation: string;
  isOwner: boolean;
  isEditable: boolean;
  images: ItemImageRecord[];
  createdAt: string;
  updatedAt: string;
}

interface BackendListResponse {
  items: BackendItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function mapBackendItem(dto: BackendItemDto): CampusItem {
  const sortedImages = [...(dto.images ?? [])].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const primaryImage =
    sortedImages.find((img) => img.isPrimary)?.publicUrl ??
    sortedImages[0]?.publicUrl;

  return {
    id: dto.id,
    referenceCode: dto.referenceCode,
    reportType: dto.reportType,
    title: dto.title,
    categoryId: dto.categoryId,
    category: dto.category,
    locationId: dto.locationId,
    building: dto.building,
    zoneName: dto.zoneName,
    specificLocation: dto.specificSpot,
    custodyLocation: dto.custodyLocation,
    dateOccurred: dto.occurredDate,
    timeWindow: dto.timeWindow,
    description: dto.description,
    distinguishingFeatures: dto.distinguishingFeatures,
    verificationPrompt: dto.verificationPrompt,
    status: dto.status,
    reporterAffiliation: dto.reporterAffiliation,
    isOwner: dto.isOwner,
    isEditable: dto.isEditable,
    images: sortedImages,
    imageUrl: primaryImage,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function buildItemsQueryString(
  filters?: Partial<ItemFilters> & { mine?: boolean },
): string {
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set('search', filters.search.trim());
  if (filters?.reportType && filters.reportType !== 'ALL') {
    params.set('reportType', filters.reportType);
  }
  if (filters?.category && filters.category !== 'ALL') {
    params.set('category', filters.category);
  }
  if (filters?.building && filters.building !== 'ALL') {
    params.set('building', filters.building);
  }
  if (filters?.status && filters.status !== 'ALL') {
    params.set('status', filters.status);
  }
  if (filters?.mine) {
    params.set('mine', 'true');
  }
  if (filters?.page) {
    params.set('page', String(filters.page));
  }
  if (filters?.limit) {
    params.set('limit', String(filters.limit));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const itemsService = {
  async getMetadata(): Promise<ItemMetadataResponse> {
    return apiRequest<ItemMetadataResponse>('/api/v1/items/metadata', {
      method: 'GET',
    });
  },

  async listItems(
    filters?: Partial<ItemFilters>,
  ): Promise<PaginatedItemsResponse> {
    const qs = buildItemsQueryString(filters);
    const data = await apiRequest<BackendListResponse>(`/api/v1/items${qs}`, {
      method: 'GET',
    });
    return {
      items: data.items.map(mapBackendItem),
      pagination: data.pagination,
    };
  },

  async listStudentReports(filters?: {
    reportType?: 'ALL' | ReportType;
    page?: number;
    limit?: number;
  }): Promise<PaginatedItemsResponse> {
    const qs = buildItemsQueryString({
      mine: true,
      reportType: filters?.reportType ?? 'ALL',
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 25,
    });
    const data = await apiRequest<BackendListResponse>(`/api/v1/items${qs}`, {
      method: 'GET',
    });
    return {
      items: data.items.map(mapBackendItem),
      pagination: data.pagination,
    };
  },

  async getItemById(id: string): Promise<CampusItem | null> {
    try {
      const data = await apiRequest<{ item: BackendItemDto }>(
        `/api/v1/items/${encodeURIComponent(id)}`,
        { method: 'GET' },
      );
      return mapBackendItem(data.item);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async createReport(input: CreateItemReportInput): Promise<CampusItem> {
    const formData = new FormData();
    formData.set('reportType', input.reportType);
    formData.set('title', input.title.trim());
    if (input.categoryId) {
      formData.set('categoryId', input.categoryId);
    } else {
      formData.set('category', input.category);
    }
    if (input.locationId) {
      formData.set('locationId', input.locationId);
    } else {
      formData.set('building', input.building);
    }
    formData.set('specificSpot', input.specificLocation.trim());
    formData.set('occurredDate', input.dateOccurred);
    formData.set('timeWindow', input.timeWindow);
    formData.set('description', input.description.trim());
    formData.set('distinguishingFeatures', input.distinguishingFeatures.trim());

    if (input.verificationQuestion?.trim()) {
      formData.set('verificationPrompt', input.verificationQuestion.trim());
    }
    if (input.reportType === 'FOUND' && input.custodyLocation?.trim()) {
      formData.set('custodyLocation', input.custodyLocation.trim());
    }
    if (input.imageFiles && input.imageFiles.length > 0) {
      for (const file of input.imageFiles) {
        formData.append('images', file);
      }
    }

    const data = await apiRequest<{ item: BackendItemDto }>('/api/v1/items', {
      method: 'POST',
      body: formData,
    });
    return mapBackendItem(data.item);
  },

  async updateReport(input: UpdateItemReportInput): Promise<CampusItem> {
    const formData = new FormData();
    if (input.title !== undefined) formData.set('title', input.title.trim());
    if (input.categoryId) {
      formData.set('categoryId', input.categoryId);
    } else if (input.category) {
      formData.set('category', input.category);
    }
    if (input.locationId) {
      formData.set('locationId', input.locationId);
    } else if (input.building) {
      formData.set('building', input.building);
    }
    if (input.specificLocation !== undefined) {
      formData.set('specificSpot', input.specificLocation.trim());
    }
    if (input.dateOccurred !== undefined) {
      formData.set('occurredDate', input.dateOccurred);
    }
    if (input.timeWindow !== undefined) {
      formData.set('timeWindow', input.timeWindow);
    }
    if (input.description !== undefined) {
      formData.set('description', input.description.trim());
    }
    if (input.distinguishingFeatures !== undefined) {
      formData.set('distinguishingFeatures', input.distinguishingFeatures.trim());
    }
    if (input.verificationQuestion !== undefined) {
      formData.set('verificationPrompt', input.verificationQuestion.trim());
    }
    if (input.custodyLocation !== undefined) {
      formData.set('custodyLocation', input.custodyLocation.trim());
    }
    if (input.removeImageIds && input.removeImageIds.length > 0) {
      formData.set('removeImageIds', JSON.stringify(input.removeImageIds));
    }
    if (input.imageFiles && input.imageFiles.length > 0) {
      for (const file of input.imageFiles) {
        formData.append('images', file);
      }
    }

    const data = await apiRequest<{ item: BackendItemDto }>(
      `/api/v1/items/${encodeURIComponent(input.id)}`,
      {
        method: 'PATCH',
        body: formData,
      },
    );
    return mapBackendItem(data.item);
  },

  async withdrawReport(id: string): Promise<CampusItem> {
    const data = await apiRequest<{ item: BackendItemDto }>(
      `/api/v1/items/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
    return mapBackendItem(data.item);
  },
};
