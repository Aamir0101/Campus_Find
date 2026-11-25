import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auditService, type ListAuditLogsParams } from '../services/auditService';
import { authService, type LoginPayload, type RegisterPayload } from '../services/authService';
import {
  claimsService,
  type AdminListClaimsParams,
  type AdminReturnItemPayload,
  type AdminReviewClaimPayload,
  type ListStudentClaimsParams,
} from '../services/claimsService';
import { itemsService } from '../services/itemsService';
import { matchesService, type ListMatchesParams } from '../services/matchesService';
import type {
  CreateItemReportInput,
  ItemFilters,
  ReportType,
  SubmitClaimInput,
  UpdateItemReportInput,
} from '../types/domain';

export const campusQueryKeys = {
  currentUser: ['auth', 'me'] as const,
  itemMetadata: ['items', 'metadata'] as const,
  items: (filters?: Partial<ItemFilters>) => ['items', 'list', filters ?? {}] as const,
  item: (id: string) => ['items', 'detail', id] as const,
  studentReports: (filters?: { reportType?: 'ALL' | ReportType; page?: number }) =>
    ['items', 'mine', filters ?? {}] as const,
  matches: (filters?: ListMatchesParams) => ['potential-matches', filters ?? {}] as const,
  match: (id: string) => ['potential-matches', 'detail', id] as const,
  adminClaims: (filters?: AdminListClaimsParams) => ['claims', 'admin', filters ?? {}] as const,
  studentClaims: (filters?: ListStudentClaimsParams) => ['claims', 'student', filters ?? {}] as const,
  claimDetail: (id: string) => ['claims', 'detail', id] as const,
  auditLogs: (filters?: ListAuditLogsParams) => ['audit-logs', filters ?? {}] as const,
};

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: campusQueryKeys.currentUser,
    queryFn: () => authService.getMe(),
    staleTime: 60_000,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(campusQueryKeys.currentUser, user);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(campusQueryKeys.currentUser, user);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.setQueryData(campusQueryKeys.currentUser, null);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useItemMetadataQuery() {
  return useQuery({
    queryKey: campusQueryKeys.itemMetadata,
    queryFn: () => itemsService.getMetadata(),
    staleTime: 5 * 60_000,
  });
}

export function useItemsQuery(filters?: Partial<ItemFilters>) {
  return useQuery({
    queryKey: campusQueryKeys.items(filters),
    queryFn: () => itemsService.listItems(filters),
  });
}

export function useItemByIdQuery(id: string) {
  return useQuery({
    queryKey: campusQueryKeys.item(id),
    queryFn: () => itemsService.getItemById(id),
    enabled: Boolean(id),
  });
}

export function useStudentReportsQuery(
  filters?: {
    reportType?: 'ALL' | ReportType;
    page?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: campusQueryKeys.studentReports(filters),
    queryFn: () => itemsService.listStudentReports(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateItemReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemReportInput) => itemsService.createReport(input),
    onSuccess: (created) => {
      queryClient.setQueryData(campusQueryKeys.item(created.id), created);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
    },
  });
}

export function useUpdateItemReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateItemReportInput) => itemsService.updateReport(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(campusQueryKeys.item(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
    },
  });
}

export function useWithdrawItemReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => itemsService.withdrawReport(id),
    onSuccess: (withdrawn) => {
      queryClient.setQueryData(campusQueryKeys.item(withdrawn.id), withdrawn);
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
    },
  });
}

export function useMatchesQuery(
  filters?: ListMatchesParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: campusQueryKeys.matches(filters),
    queryFn: () => matchesService.listPotentialMatches(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useMatchByIdQuery(id: string) {
  return useQuery({
    queryKey: campusQueryKeys.match(id),
    queryFn: () => matchesService.getMatchById(id),
    enabled: Boolean(id),
  });
}

export function useRecalculateMatchesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => matchesService.recalculateForItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useUpdateMatchReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      matchId,
      status,
    }: {
      matchId: string;
      status: 'DISMISSED' | 'PENDING';
    }) => {
      return matchesService.updateMatchVisibility(matchId, status);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useStudentClaimsQuery(
  filters?: ListStudentClaimsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: campusQueryKeys.studentClaims(filters),
    queryFn: () => claimsService.listStudentClaims(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useClaimByIdQuery(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: campusQueryKeys.claimDetail(id),
    queryFn: () => claimsService.getClaimById(id),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

export function useSubmitClaimMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitClaimInput) => claimsService.submitClaim(input),
    onSuccess: (created) => {
      queryClient.setQueryData(campusQueryKeys.claimDetail(created.id), created);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useAllClaimsQuery(
  filters?: AdminListClaimsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: campusQueryKeys.adminClaims(filters),
    queryFn: () => claimsService.adminListClaims(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useReviewClaimMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      claimId,
      payload,
    }: {
      claimId: string;
      payload: AdminReviewClaimPayload;
    }) => claimsService.adminReviewClaim(claimId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(campusQueryKeys.claimDetail(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useReturnItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string;
      payload: AdminReturnItemPayload;
    }) => claimsService.adminMarkItemReturned(itemId, payload),
    onSuccess: (res) => {
      queryClient.setQueryData(campusQueryKeys.claimDetail(res.claim.id), res.claim);
      queryClient.setQueryData(campusQueryKeys.item(res.item.id), res.item);
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      void queryClient.invalidateQueries({ queryKey: ['potential-matches'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
}

export function useAuditLogsQuery(
  filters?: ListAuditLogsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: campusQueryKeys.auditLogs(filters),
    queryFn: () => auditService.listAuditLogs(filters),
    enabled: options?.enabled ?? true,
  });
}
