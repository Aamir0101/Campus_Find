import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
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
  useCurrentUserQuery,
  useStudentClaimsQuery,
} from '../../hooks/useCampusFindQueries';
import { ApiClientError } from '../../services/apiClient';
import { claimsService } from '../../services/claimsService';
import type { ClaimStatus } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

const CLAIM_FILTERS: ('ALL' | ClaimStatus)[] = [
  'ALL',
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
];

export function MyClaimsPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const [statusFilter, setStatusFilter] = useState<'ALL' | ClaimStatus>('ALL');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const isStudent = Boolean(currentUser && currentUser.role === 'STUDENT');
  const claimsQuery = useStudentClaimsQuery(
    { status: statusFilter, limit: 25 },
    { enabled: isStudent },
  );

  const claims = claimsQuery.data?.claims ?? [];
  const isUnauthorized =
    !isAuthLoading &&
    (!currentUser ||
      (claimsQuery.error instanceof ApiClientError &&
        claimsQuery.error.status === 401));
  const isLoading = isAuthLoading || (isStudent && claimsQuery.isLoading);

  const handleLoadEvidenceUrl = async (claimId: string, evidenceId: string) => {
    setEvidenceError(null);
    setLoadingEvidenceId(evidenceId);
    try {
      const res = await claimsService.getSignedEvidenceUrl(claimId, evidenceId);
      setSignedUrls((prev) => ({ ...prev, [evidenceId]: res.signedUrl }));
    } catch (err) {
      setEvidenceError(
        err instanceof Error
          ? err.message
          : 'Unable to authorize access to this evidence file.',
      );
    } finally {
      setLoadingEvidenceId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Claims"
        description="Track ownership verification status, Campus Safety reviewer feedback, attached evidence, and physical pickup instructions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/student/claims/new">
              <Button size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Submit Claim</span>
              </Button>
            </Link>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse Found Items
              </Button>
            </Link>
          </div>
        }
      />

      {isStudent ? (
        <div
          role="group"
          aria-label="Filter my claims by status"
          className="inline-flex flex-wrap items-center rounded-md border border-[#CBD5E1] bg-white p-1"
        >
          {CLAIM_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === status
                  ? 'bg-[#1E40AF] text-white'
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
      ) : null}

      {evidenceError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{evidenceError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isUnauthorized ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Sign in to track your ownership claims
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Your verification statements, supporting evidence files, and pickup authorizations are private to your student account.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/login">
              <Button size="sm">Sign In</Button>
            </Link>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse Found Items
              </Button>
            </Link>
          </div>
        </div>
      ) : currentUser && currentUser.role !== 'STUDENT' ? (
        <EmptyState
          title="Student Claims Queue"
          description="Use the Campus Safety Admin Console to review submitted student claims."
          action={
            <Link to="/admin/claims">
              <Button size="sm">Open Admin Review Queue</Button>
            </Link>
          }
        />
      ) : claimsQuery.error ? (
        <ErrorState
          message={(claimsQuery.error as Error).message}
          onRetry={() => void claimsQuery.refetch()}
        />
      ) : claims.length === 0 ? (
        <EmptyState
          title="No ownership claims found"
          description="Locate your item in Browse Inventory or Potential Matches and submit identifying proof to start verification."
          action={
            <Link to="/student/matches">
              <Button size="sm">Check Potential Matches</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const fileEvidences = claim.evidences.filter((ev) => ev.hasPrivateFile);
            return (
              <article
                key={claim.id}
                className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F1F5F9] pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                      <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                        {claim.claimCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {claim.itemReferenceCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{claim.itemCategory}</span>
                    </div>
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      <Link
                        to={`/student/items/${claim.itemId}`}
                        className="hover:text-[#1E40AF]"
                      >
                        {claim.itemTitle}
                      </Link>
                    </h2>
                  </div>

                  <ClaimStatusLabel status={claim.status} />
                </div>

                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-[#64748B]">
                        Submitted Ownership Explanation
                      </p>
                      <p className="mt-0.5 text-[#334155] leading-relaxed">
                        {claim.ownershipStatement}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#64748B]">
                        Private Identifying Proof
                      </p>
                      <p className="mt-0.5 text-[#334155] leading-relaxed">
                        {claim.identifyingProof}
                      </p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Serial / Mark:{' '}
                        <span className="font-medium text-[#0F172A]">
                          {claim.serialOrMark}
                        </span>
                      </p>
                    </div>

                    {fileEvidences.length > 0 ? (
                      <div className="border-t border-[#F1F5F9] pt-2.5 space-y-1.5">
                        <p className="text-xs font-medium text-[#64748B]">
                          Attached Private Evidence ({fileEvidences.length})
                        </p>
                        <ul className="space-y-1.5">
                          {fileEvidences.map((ev) => {
                            const signedUrl = signedUrls[ev.id];
                            return (
                              <li
                                key={ev.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs"
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
                                    <span>Open Signed File</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
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
                                      ? 'Authorizing...'
                                      : 'Generate Access Link'}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                        <ShieldCheck
                          className="h-4 w-4 text-[#1E40AF]"
                          aria-hidden="true"
                        />
                        <span>Campus Safety Desk Review</span>
                      </div>
                      {claim.reviewedAt ? (
                        <span className="text-[11px] text-[#64748B] tabular-nums">
                          Updated {formatDateTime(claim.reviewedAt)}
                        </span>
                      ) : null}
                    </div>

                    {claim.status === 'REJECTED' && claim.rejectionReason ? (
                      <div className="flex items-start gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-xs text-[#991B1B]">
                        <XCircle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold">Rejection Reason</p>
                          <p className="mt-0.5">{claim.rejectionReason}</p>
                        </div>
                      </div>
                    ) : null}

                    <p className="text-xs leading-relaxed text-[#475569]">
                      {claim.reviewerNote ??
                        (claim.status === 'UNDER_REVIEW'
                          ? 'A Campus Safety property officer is currently reviewing your ownership evidence.'
                          : claim.status === 'APPROVED'
                            ? 'Ownership verification approved. Present your physical University ID card at the assigned custody desk to complete handover.'
                            : claim.status === 'RETURNED'
                              ? 'Physical University ID verified and item custody returned.'
                              : 'Awaiting property officer review. You will see feedback here once verification begins.')}
                    </p>

                    {claim.status === 'APPROVED' ? (
                      <div className="rounded border border-[#BBF7D0] bg-[#F0FDF4] p-2.5 text-xs text-[#166534]">
                        Approved for pickup — final custody release is recorded once your physical Campus ID is verified at the desk.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#64748B]">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {claim.pickupDesk ?? claim.custodyLocation ?? claim.building}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {claim.collectedAt
                          ? `Returned ${formatDateTime(claim.collectedAt)}`
                          : `Submitted ${formatDateTime(claim.submittedAt)}`}
                      </span>
                    </div>
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
