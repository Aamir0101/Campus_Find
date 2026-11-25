import type {
  MatchClassification,
  MatchSignal,
  MatchStatus,
  PaginatedMatchesResponse,
  PotentialMatch,
} from '../types/domain';
import { ApiClientError, apiRequest } from './apiClient';
import { type BackendItemDto, mapBackendItem } from './itemsService';

interface BackendMatchDto {
  id: string;
  lostItemId: string;
  foundItemId: string;
  similarityScore: number;
  classification: MatchClassification;
  status: MatchStatus;
  notice: string;
  signals: MatchSignal[];
  lostItem: BackendItemDto;
  foundItem: BackendItemDto;
  detectedAt: string;
  updatedAt: string;
}

interface BackendMatchesListResponse {
  matches: BackendMatchDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function mapBackendMatch(dto: BackendMatchDto): PotentialMatch {
  return {
    id: dto.id,
    lostItemId: dto.lostItemId,
    foundItemId: dto.foundItemId,
    similarityScore: dto.similarityScore,
    classification: dto.classification,
    status: dto.status,
    notice: dto.notice,
    signals: dto.signals ?? [],
    lostItem: mapBackendItem(dto.lostItem),
    foundItem: mapBackendItem(dto.foundItem),
    detectedAt: dto.detectedAt,
    updatedAt: dto.updatedAt,
  };
}

export interface ListMatchesParams {
  status?: 'ALL' | 'ACTIVE' | MatchStatus;
  itemId?: string;
  page?: number;
  limit?: number;
}

export const matchesService = {
  async listPotentialMatches(
    params?: ListMatchesParams,
  ): Promise<PaginatedMatchesResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.itemId) searchParams.set('itemId', params.itemId);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();

    const data = await apiRequest<BackendMatchesListResponse>(
      `/api/v1/matches${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    );

    return {
      matches: data.matches.map(mapBackendMatch),
      pagination: data.pagination,
    };
  },

  async getMatchById(id: string): Promise<PotentialMatch | null> {
    try {
      const data = await apiRequest<{ match: BackendMatchDto }>(
        `/api/v1/matches/${encodeURIComponent(id)}`,
        { method: 'GET' },
      );
      return mapBackendMatch(data.match);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async recalculateForItem(itemId: string): Promise<{
    itemId: string;
    matchesSaved: number;
    matchIds: string[];
    matches: PotentialMatch[];
  }> {
    const data = await apiRequest<{
      itemId: string;
      matchesSaved: number;
      matchIds: string[];
      matches: BackendMatchDto[];
    }>(`/api/v1/matches/recalculate/${encodeURIComponent(itemId)}`, {
      method: 'POST',
    });

    return {
      itemId: data.itemId,
      matchesSaved: data.matchesSaved,
      matchIds: data.matchIds,
      matches: data.matches.map(mapBackendMatch),
    };
  },

  async updateMatchVisibility(
    matchId: string,
    status: 'DISMISSED' | 'PENDING',
  ): Promise<PotentialMatch> {
    const data = await apiRequest<{ match: BackendMatchDto }>(
      `/api/v1/matches/${encodeURIComponent(matchId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
    );
    return mapBackendMatch(data.match);
  },
};
