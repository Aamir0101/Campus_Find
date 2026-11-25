import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Lock,
  PackageCheck,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { ClaimStatusLabel } from '../../components/ui/StatusLabel';
import {
  useAllClaimsQuery,
  useCurrentUserQuery,
  useReturnItemMutation,
  useReviewClaimMutation,
} from '../../hooks/useCampusFindQueries';
import { claimsService } from '../../services/claimsService';
import type { ClaimStatus } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

const STATUS_FILTERS: ('ALL' | ClaimStatus)[] = [
  'ALL',
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
];

export function ReviewClaimsPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const isAdmin = Boolean(currentUser && currentUser.role === 'ADMIN');

  const [statusFilter, setStatusFilter] = useState<'ALL' | ClaimStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notesByClaim, setNotesByClaim] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [physicalVerifiedByClaim, setPhysicalVerifiedByClaim] = useState<
    Record<string, boolean>
  >({});
  const [handoverNotesByClaim, setHandoverNotesByClaim] = useState<
    Record<string, string>
  >({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const claimsQuery = useAllClaimsQuery(
    {
      status: statusFilter,
      search: searchQuery.trim() || undefined,
      limit: 50,
    },
    { enabled: isAdmin },
  );

  const reviewMutation = useReviewClaimMutation();
  const returnMutation = useReturnItemMutation();

  const claims = claimsQuery.data?.claims ?? [];
  const isLoading = isAuthLoading || (isAdmin && claimsQuery.isLoading);

  const handleLoadEvidenceUrl = async (claimId: string, evidenceId: string) => {
    setActionError(null);
    setLoadingEvidenceId(evidenceId);
    try {
      const res = await claimsService.getSignedEvidenceUrl(claimId, evidenceId);
      setSignedUrls((prev) => ({ ...prev, [evidenceId]: res.signedUrl }));
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to authorize access to supporting evidence.',
      );
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  const handleReviewDecision = async (
    claimId: string,
    claimCode: string,
    nextStatus: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED',
  ) => {
    setActionError(null);
    setActionSuccess(null);

    const reviewerNote = (notesByClaim[claimId] ?? '').trim();
    const rejectionReason = (rejectionReasons[claimId] ?? '').trim();

    if (nextStatus === 'REJECTED' && rejectionReason.length < 5) {
      setActionError(
        `Please enter a clear rejection reason (minimum 5 characters) before rejecting ${claimCode}.`,
      );
      return;
    }

    try {
      await reviewMutation.mutateAsync({
        claimId,
        payload: {
          status: nextStatus,
          ...(reviewerNote ? { reviewerNote } : {}),
          ...(nextStatus === 'REJECTED' ? { rejectionReason } : {}),
        },
      });
      setActionSuccess(
        nextStatus === 'APPROVED'
          ? `Claim ${claimCode} approved for pickup. Confirm physical University ID at handover to mark the item returned.`
          : nextStatus === 'REJECTED'
            ? `Claim ${claimCode} rejected and recorded in audit history.`
            : `Claim ${claimCode} moved to Under Review.`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update claim review status.',
      );
    }
  };

  const handlePhysicalReturn = async (
    itemId: string,
    claimId: string,
    claimCode: string,
  ) => {
    setActionError(null);
    setActionSuccess(null);

    if (!physicalVerifiedByClaim[claimId]) {
      setActionError(
        `Confirm physical University ID verification before marking ${claimCode} returned.`,
      );
      return;
    }

    const handoverNote = (handoverNotesByClaim[claimId] ?? '').trim();

    try {
      await returnMutation.mutateAsync({
        itemId,
        payload: {
          claimId,
          physicalIdVerified: true,
          ...(handoverNote ? { handoverNote } : {}),
        },
      });
      setActionSuccess(
        `Physical handover recorded for ${claimCode}. Item status updated to RETURNED.`,
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to complete custody return.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Ownership Claims"
        description="Compare claimant statements and private evidence against intake descriptors, then verify physical University ID at handover before marking items returned."
        actions={
          isAdmin ? (
            <div
              role="group"
              aria-label="Filter claims by status"
              className="inline-flex flex-wrap items-center rounded-md border border-[#CBD5E1] bg-white p-1"
            >
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    statusFilter === status
                      ? 'bg-[#0F172A] text-white'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {status === 'ALL'
                    ? 'All'
                    : status === 'PENDING'
                      ? 'Pending'
                      : status === 'UNDER_REVIEW'
                        ? 'Under Review'
                        : status === 'APPROVED'
                          ? 'Approved'
                          : status === 'REJECTED'
                            ? 'Rejected'
                            : 'Returned'}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      {isAdmin ? (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search claims by code, item, or claimant"
            placeholder="Search claim code, item title, or claimant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[40px] w-full rounded-md border border-[#CBD5E1] bg-white pl-10 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none"
          />
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {actionSuccess ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !currentUser ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Administrator sign-in required
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Sign in with an authorized Campus Safety administrator account to review ownership claims and release property custody.
          </p>
          <div className="mt-5 flex justify-center">
            <Link to="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      ) : !isAdmin ? (
        <div className="rounded-lg border border-[#FECACA] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ShieldAlert className="mx-auto h-7 w-7 text-[#DC2626]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Administrator Access Restricted
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Your account ({currentUser.email}) does not have administrator privileges to review claims or access private claimant evidence.
          </p>
          <div className="mt-5 flex justify-center">
            <Link to="/student">
              <Button variant="outline" size="sm">
                Return to Student Portal
              </Button>
            </Link>
          </div>
        </div>
      ) : claimsQuery.error ? (
        <ErrorState
          message={(claimsQuery.error as Error).message}
          onRetry={() => void claimsQuery.refetch()}
        />
      ) : claims.length === 0 ? (
        <EmptyState
          title="No claims in this queue"
          description="When students submit ownership verification claims, they appear here for property staff review."
        />
      ) : (
        <div className="space-y-5">
          {claims.map((claim) => {
            const fileEvidences = claim.evidences.filter((ev) => ev.hasPrivateFile);
            const canReview =
              claim.status === 'PENDING' || claim.status === 'UNDER_REVIEW';
            const isApprovedPendingReturn = claim.status === 'APPROVED';

            return (
              <article
                key={claim.id}
                className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-4">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {claim.claimCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {claim.itemReferenceCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Item Status: {claim.itemStatus}</span>
                      <span aria-hidden="true">·</span>
                      <span>Submitted {formatDateTime(claim.submittedAt)}</span>
                    </div>
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      {claim.itemTitle}
                    </h2>
                  </div>

                  <ClaimStatusLabel status={claim.status} />
                </div>

                <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                  {/* Claimant Evidence */}
                  <div className="space-y-3 p-6 lg:col-span-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0F172A]">
                        Claimant Verification Evidence
                      </span>
                      <span className="font-mono text-[#64748B] tabular-nums">
                        {claim.claimantCampusId ?? '—'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-[#475569]">
                      <p>
                        <strong className="text-[#0F172A]">
                          {claim.claimantName ?? 'Unknown Claimant'}
                        </strong>{' '}
                        ({claim.claimantEmail ?? '—'})
                      </p>
                      <p>
                        Preferred Window: {claim.preferredPickupWindow} · Desk:{' '}
                        {claim.pickupDesk ?? claim.custodyLocation ?? claim.building}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-[#F1F5F9] pt-3 text-sm">
                      <div>
                        <p className="text-xs font-medium text-[#64748B]">
                          Loss Context
                        </p>
                        <p className="mt-0.5 text-[#334155]">
                          {claim.ownershipStatement}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#64748B]">
                          Non-Public Proof &amp; Serial / Mark
                        </p>
                        <p className="mt-0.5 text-[#334155]">
                          {claim.identifyingProof}
                        </p>
                        <p className="mt-1 font-mono text-xs text-[#0F172A]">
                          Mark: {claim.serialOrMark}
                        </p>
                      </div>

                      {fileEvidences.length > 0 ? (
                        <div className="border-t border-[#F1F5F9] pt-2.5 space-y-1.5">
                          <p className="text-xs font-medium text-[#64748B]">
                            Private Supporting Files ({fileEvidences.length})
                          </p>
                          <ul className="space-y-1.5">
                            {fileEvidences.map((ev) => {
                              const signedUrl = signedUrls[ev.id];
                              return (
                                <li
                                  key={ev.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs"
                                >
                                  <span className="inline-flex items-center gap-1.5 text-[#0F172A] min-w-0">
                                    <FileText
                                      className="h-3.5 w-3.5 shrink-0 text-[#1E40AF]"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate font-medium">
                                      {ev.label}
                                    </span>
                                  </span>
                                  {signedUrl ? (
                                    <a
                                      href={signedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 font-medium text-[#1E40AF] hover:underline"
                                    >
                                      <span>Inspect File</span>
                                      <ExternalLink
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={loadingEvidenceId === ev.id}
                                      onClick={() =>
                                        void handleLoadEvidenceUrl(claim.id, ev.id)
                                      }
                                      className="font-medium text-[#1E40AF] hover:underline cursor-pointer disabled:opacity-50"
                                    >
                                      {loadingEvidenceId === ev.id
                                        ? 'Loading...'
                                        : 'View Evidence'}
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Private Intake Reference */}
                  <div className="space-y-3 p-6 lg:col-span-3">
                    <p className="text-xs font-semibold text-[#1E40AF]">
                      Intake Private Identifiers
                    </p>
                    <p className="text-sm leading-relaxed text-[#334155]">
                      {claim.itemDistinguishingFeatures ??
                        'Refer to Campus Safety physical vault intake sheet.'}
                    </p>
                    {claim.itemVerificationPrompt ? (
                      <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-xs text-[#475569]">
                        <span className="font-semibold text-[#0F172A]">
                          Verification Prompt:
                        </span>{' '}
                        {claim.itemVerificationPrompt}
                      </div>
                    ) : null}
                    {claim.custodyLocation ? (
                      <p className="text-xs text-[#64748B]">
                        Vault Location:{' '}
                        <span className="font-medium text-[#0F172A]">
                          {claim.custodyLocation}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {/* Decision & Physical Handover Controls */}
                  <div className="flex flex-col justify-between space-y-4 p-6 lg:col-span-4">
                    {canReview ? (
                      <>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label
                              htmlFor={`note-${claim.id}`}
                              className="block text-xs font-semibold text-[#0F172A]"
                            >
                              Officer Verification Note
                            </label>
                            <textarea
                              id={`note-${claim.id}`}
                              rows={2}
                              placeholder="Record intake comparison notes or desk pickup instructions..."
                              value={notesByClaim[claim.id] ?? claim.reviewerNote ?? ''}
                              onChange={(e) =>
                                setNotesByClaim((prev) => ({
                                  ...prev,
                                  [claim.id]: e.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label
                              htmlFor={`reject-${claim.id}`}
                              className="block text-xs font-semibold text-[#0F172A]"
                            >
                              Rejection Reason (Required only if rejecting)
                            </label>
                            <input
                              id={`reject-${claim.id}`}
                              type="text"
                              placeholder="e.g., Serial fragment and sleeve contents do not match intake log"
                              value={rejectionReasons[claim.id] ?? ''}
                              onChange={(e) =>
                                setRejectionReasons((prev) => ({
                                  ...prev,
                                  [claim.id]: e.target.value,
                                }))
                              }
                              className="h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {claim.status === 'PENDING' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={reviewMutation.isPending}
                              onClick={() =>
                                void handleReviewDecision(
                                  claim.id,
                                  claim.claimCode,
                                  'UNDER_REVIEW',
                                )
                              }
                            >
                              <ClipboardCheck
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Start Review</span>
                            </Button>
                          ) : null}

                          <Button
                            size="sm"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              void handleReviewDecision(
                                claim.id,
                                claim.claimCode,
                                'APPROVED',
                              )
                            }
                          >
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            <span>Approve Pickup</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={reviewMutation.isPending}
                            onClick={() =>
                              void handleReviewDecision(
                                claim.id,
                                claim.claimCode,
                                'REJECTED',
                              )
                            }
                            className="text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Reject</span>
                          </Button>
                        </div>
                      </>
                    ) : isApprovedPendingReturn ? (
                      <div className="space-y-3">
                        <div className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs text-[#1E3A8A]">
                          <p className="font-semibold">
                            Approved — Pending Physical Verification
                          </p>
                          <p className="mt-0.5">
                            Verify the claimant&apos;s physical University ID card at the desk before releasing custody and marking this item returned.
                          </p>
                        </div>

                        {claim.reviewerNote ? (
                          <p className="text-xs text-[#475569]">
                            Approval Note: {claim.reviewerNote}
                          </p>
                        ) : null}

                        <label className="flex items-start gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-xs text-[#0F172A] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(physicalVerifiedByClaim[claim.id])}
                            onChange={(e) =>
                              setPhysicalVerifiedByClaim((prev) => ({
                                ...prev,
                                [claim.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#1E40AF]"
                          />
                          <span>
                            Physical University ID verified in person and matched to{' '}
                            <strong>{claim.claimantName}</strong> (
                            {claim.claimantCampusId})
                          </span>
                        </label>

                        <input
                          type="text"
                          aria-label={`Handover note for ${claim.claimCode}`}
                          placeholder="Optional handover desk note..."
                          value={handoverNotesByClaim[claim.id] ?? ''}
                          onChange={(e) =>
                            setHandoverNotesByClaim((prev) => ({
                              ...prev,
                              [claim.id]: e.target.value,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none"
                        />

                        <Button
                          size="sm"
                          className="w-full"
                          disabled={
                            returnMutation.isPending ||
                            !physicalVerifiedByClaim[claim.id]
                          }
                          onClick={() =>
                            void handlePhysicalReturn(
                              claim.itemId,
                              claim.id,
                              claim.claimCode,
                            )
                          }
                        >
                          <PackageCheck className="h-4 w-4" aria-hidden="true" />
                          <span>
                            {returnMutation.isPending
                              ? 'Recording Custody Return...'
                              : 'Confirm Physical Return'}
                          </span>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-[#475569]">
                        <p className="font-semibold text-[#0F172A]">
                          {claim.status === 'RETURNED'
                            ? 'Custody Returned'
                            : 'Claim Rejected'}
                        </p>
                        {claim.rejectionReason ? (
                          <p className="rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-[#991B1B]">
                            Reason: {claim.rejectionReason}
                          </p>
                        ) : null}
                        {claim.reviewerNote ? (
                          <p>Reviewer Note: {claim.reviewerNote}</p>
                        ) : null}
                        {claim.reviewedByName ? (
                          <p className="text-[#64748B]">
                            Officer: {claim.reviewedByName}
                          </p>
                        ) : null}
                        {claim.collectedAt ? (
                          <p className="text-[#15803D] tabular-nums">
                            Handover Completed: {formatDateTime(claim.collectedAt)}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
