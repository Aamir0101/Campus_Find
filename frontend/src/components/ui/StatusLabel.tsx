import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  GitCompareArrows,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { ClaimStatus, ItemStatus, MatchClassification } from '../../types/domain';
import {
  formatClaimStatusLabel,
  formatConfidenceLabel,
  formatItemStatusLabel,
} from '../../utils/formatters';

export function ItemStatusLabel({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#334155]">
          <Clock className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
    case 'POTENTIAL_MATCH':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E40AF]">
          <GitCompareArrows className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
    case 'CLAIM_PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309]">
          <AlertCircle className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
    case 'UNDER_VERIFICATION':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E40AF]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
    case 'RETURNED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
    case 'CLOSED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
          <Archive className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
          <span>{formatItemStatusLabel(status)}</span>
        </span>
      );
  }
}

export function ClaimStatusLabel({ status }: { status: ClaimStatus }) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309]">
          <Clock className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
          <span>{formatClaimStatusLabel(status)}</span>
        </span>
      );
    case 'UNDER_REVIEW':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E40AF]">
          <AlertCircle className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
          <span>{formatClaimStatusLabel(status)}</span>
        </span>
      );
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
          <span>{formatClaimStatusLabel(status)}</span>
        </span>
      );
    case 'RETURNED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
          <span>{formatClaimStatusLabel(status)}</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
          <XCircle className="h-3.5 w-3.5 text-[#DC2626]" aria-hidden="true" />
          <span>{formatClaimStatusLabel(status)}</span>
        </span>
      );
  }
}

export function MatchConfidenceLabel({
  classification,
  score,
}: {
  classification: MatchClassification;
  score: number;
}) {
  const tone =
    classification === 'HIGH MATCH'
      ? 'text-[#1E40AF]'
      : classification === 'POSSIBLE MATCH'
        ? 'text-[#B45309]'
        : 'text-[#475569]';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${tone}`}>
      <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        {score}% · {formatConfidenceLabel(classification)}
      </span>
    </span>
  );
}
