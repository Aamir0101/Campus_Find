import type {
  CampusItem,
  ClaimRecord,
  ClaimStatus,
  PaginatedClaimsResponse,
  SubmitClaimInput,
} from '../types/domain';
import { apiRequest } from './apiClient';

export interface ListStudentClaimsParams {
  status?: 'ALL' | ClaimStatus;
  page?: number;
  limit?: number;
}

export interface AdminListClaimsParams {
  status?: 'ALL' | ClaimStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AdminReviewClaimPayload {
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewerNote?: string;
  rejectionReason?: string;
}

export interface AdminReturnItemPayload {
  claimId: string;
  physicalIdVerified: true;
  handoverNote?: string;
}

export interface SignedEvidenceUrlResponse {
  signedUrl: string;
  expiresInSeconds: number;
  label: string;
  mimeType: string | null;
}

export const claimsService = {
  async submitClaim(input: SubmitClaimInput): Promise<ClaimRecord> {
    const hasFiles = Boolean(input.evidenceFiles && input.evidenceFiles.length > 0);
    let body: BodyInit;

    if (hasFiles) {
      const formData = new FormData();
      formData.append('itemId', input.itemId);
      formData.append('ownershipStatement', input.ownershipStatement.trim());
      formData.append('identifyingProof', input.identifyingProof.trim());
      formData.append('serialOrMark', input.serialOrMark.trim());
      formData.append('preferredPickupWindow', input.preferredPickupWindow.trim());
      if (input.evidenceNote?.trim()) {
        formData.append('evidenceNote', input.evidenceNote.trim());
      }
      for (const file of input.evidenceFiles ?? []) {
        formData.append('evidenceFiles', file);
      }
      body = formData;
    } else {
      body = JSON.stringify({
        itemId: input.itemId,
        ownershipStatement: input.ownershipStatement.trim(),
        identifyingProof: input.identifyingProof.trim(),
        serialOrMark: input.serialOrMark.trim(),
        preferredPickupWindow: input.preferredPickupWindow.trim(),
        ...(input.evidenceNote?.trim() ? { evidenceNote: input.evidenceNote.trim() } : {}),
      });
    }

    const res = await apiRequest<{ claim: ClaimRecord }>('/api/v1/claims', {
      method: 'POST',
      body,
    });
    return res.claim;
  },

  async listStudentClaims(
    params?: ListStudentClaimsParams,
  ): Promise<PaginatedClaimsResponse> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') {
      query.set('status', params.status);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return apiRequest<PaginatedClaimsResponse>(
      `/api/v1/claims/my${qs ? `?${qs}` : ''}`,
    );
  },

  async getClaimById(id: string): Promise<ClaimRecord> {
    const res = await apiRequest<{ claim: ClaimRecord }>(
      `/api/v1/claims/${encodeURIComponent(id)}`,
    );
    return res.claim;
  },

  async getSignedEvidenceUrl(
    claimId: string,
    evidenceId: string,
  ): Promise<SignedEvidenceUrlResponse> {
    return apiRequest<SignedEvidenceUrlResponse>(
      `/api/v1/claims/${encodeURIComponent(claimId)}/evidence/${encodeURIComponent(evidenceId)}/url`,
    );
  },

  async adminListClaims(
    params?: AdminListClaimsParams,
  ): Promise<PaginatedClaimsResponse> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') {
      query.set('status', params.status);
    }
    if (params?.search?.trim()) {
      query.set('search', params.search.trim());
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return apiRequest<PaginatedClaimsResponse>(
      `/api/v1/admin/claims${qs ? `?${qs}` : ''}`,
    );
  },

  async adminReviewClaim(
    claimId: string,
    payload: AdminReviewClaimPayload,
  ): Promise<ClaimRecord> {
    const res = await apiRequest<{ claim: ClaimRecord }>(
      `/api/v1/admin/claims/${encodeURIComponent(claimId)}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    return res.claim;
  },

  async adminMarkItemReturned(
    itemId: string,
    payload: AdminReturnItemPayload,
  ): Promise<{ claim: ClaimRecord; item: CampusItem }> {
    return apiRequest<{ claim: ClaimRecord; item: CampusItem }>(
      `/api/v1/admin/items/${encodeURIComponent(itemId)}/return`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },
};
