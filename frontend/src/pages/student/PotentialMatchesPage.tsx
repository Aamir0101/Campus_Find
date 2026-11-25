import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Lock,
  RotateCcw,
  X,
} from 'lucide-react';
import { ClaimVerificationModal } from '../../components/items/ClaimVerificationModal';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { MatchConfidenceLabel } from '../../components/ui/StatusLabel';
import {
  useCurrentUserQuery,
  useMatchesQuery,
  useUpdateMatchReviewMutation,
} from '../../hooks/useCampusFindQueries';
import { ApiClientError } from '../../services/apiClient';
import type { CampusItem, PotentialMatch } from '../../types/domain';
import { formatShortDate } from '../../utils/formatters';

const DEFAULT_MATCH_NOTICE =
  'Potential match found. This is an automated suggestion and does not establish ownership.';

function resolveViewerPerspective(match: PotentialMatch) {
  const ownsLost = Boolean(match.lostItem.isOwner);
  const ownsFound = Boolean(match.foundItem.isOwner);

  if (ownsFound && !ownsLost) {
    return {
      myItem: match.foundItem,
      matchedItem: match.lostItem,
      myColumnLabel: 'Your Found Report',
      matchedColumnLabel: 'Matched Lost Report',
      canClaimMatchedItem: false,
    };
  }

  return {
    myItem: match.lostItem,
    matchedItem: match.foundItem,
    myColumnLabel: 'Your Lost Report',
    matchedColumnLabel: 'Matched Found Item',
    canClaimMatchedItem: !match.foundItem.isOwner,
  };
}

export function PotentialMatchesPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const [filterState, setFilterState] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  const {
    data,
    isLoading: isMatchesLoading,
    error,
    refetch,
  } = useMatchesQuery(
    { status: filterState, limit: 25 },
    { enabled: Boolean(currentUser) },
  );

  const updateMatchReview = useUpdateMatchReviewMutation();
  const [selectedItemToClaim, setSelectedItemToClaim] =
    useState<CampusItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const matches = data?.matches ?? [];
  const isUnauthorized =
    !isAuthLoading &&
    (!currentUser ||
      (error instanceof ApiClientError && error.status === 401));

  const isLoading = isAuthLoading || (Boolean(currentUser) && isMatchesLoading);

  const handleVisibilityToggle = async (
    matchId: string,
    status: 'DISMISSED' | 'PENDING',
  ) => {
    setActionError(null);
    try {
      await updateMatchReview.mutateAsync({ matchId, status });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Unable to update match suggestion state.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Potential Matches"
        description="Automated side-by-side comparisons pairing active lost and found reports across campus using weighted category, name, description, location, and date signals."
        actions={
          currentUser ? (
            <div
              role="group"
              aria-label="Match filter"
              className="inline-flex items-center rounded-md border border-[#CBD5E1] bg-white p-1"
            >
              <button
                type="button"
                onClick={() => setFilterState('ACTIVE')}
                className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  filterState === 'ACTIVE'
                    ? 'bg-[#1E40AF] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Active Candidates
              </button>
              <button
                type="button"
                onClick={() => setFilterState('ALL')}
                className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  filterState === 'ALL'
                    ? 'bg-[#1E40AF] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Include Dismissed
              </button>
            </div>
          ) : undefined
        }
      />

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isUnauthorized ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock
            className="mx-auto h-7 w-7 text-[#1E40AF]"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Sign in to view your potential matches
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Potential match suggestions are scoped to your own lost and found
            reports to protect reporter privacy.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/login">
              <Button size="sm">Sign In</Button>
            </Link>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse Active Reports
              </Button>
            </Link>
          </div>
        </div>
      ) : error ? (
        <ErrorState
          message={(error as Error).message}
          onRetry={() => void refetch()}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          title="No potential match suggestions yet"
          description="Only matches scoring 60% or higher against active opposite-type reports are displayed. Suggestions appear automatically when matching reports are filed or updated."
          action={
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse Campus Inventory
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="flex items-start gap-2.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#1E3A8A]">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]"
              aria-hidden="true"
            />
            <span>{DEFAULT_MATCH_NOTICE}</span>
          </div>

          {matches.map((match) => {
            const {
              myItem,
              matchedItem,
              myColumnLabel,
              matchedColumnLabel,
              canClaimMatchedItem,
            } = resolveViewerPerspective(match);

            return (
              <article
                key={match.id}
                className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5">
                  <MatchConfidenceLabel
                    classification={match.classification}
                    score={match.similarityScore}
                  />
                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <span className="font-mono tabular-nums">
                      {match.lostItem.referenceCode} ↔{' '}
                      {match.foundItem.referenceCode}
                    </span>
                    {match.status === 'CONFIRMED' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reviewed</span>
                      </span>
                    ) : match.status === 'DISMISSED' ? (
                      <span className="font-medium text-[#64748B]">
                        Dismissed
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="border-b border-[#F1F5F9] bg-[#F8FAFC]/60 px-6 py-2.5 text-xs text-[#475569]">
                  {match.notice || DEFAULT_MATCH_NOTICE}
                </div>

                <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                  {/* Viewer's Report Column */}
                  <div className="space-y-2 p-6 lg:col-span-4">
                    <p className="text-xs font-semibold text-[#64748B]">
                      {myColumnLabel}
                    </p>
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      {myItem.title}
                    </h2>
                    <p className="text-xs font-medium text-[#334155]">
                      {myItem.category}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      {myItem.building} · {formatShortDate(myItem.dateOccurred)} (
                      {myItem.timeWindow})
                    </p>
                    <p className="pt-1 text-sm text-[#475569]">
                      {myItem.description}
                    </p>
                  </div>

                  {/* Matched Counterpart Item Column */}
                  <div className="space-y-3 p-6 lg:col-span-4">
                    <p className="text-xs font-semibold text-[#1E40AF]">
                      {matchedColumnLabel}
                    </p>
                    <div className="flex items-start gap-3.5">
                      <div className="h-20 w-24 shrink-0 overflow-hidden rounded border border-[#E2E8F0] bg-[#F1F5F9]">
                        <ImageWithFallback
                          src={matchedItem.imageUrl}
                          alt={matchedItem.title}
                          category={matchedItem.category}
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-[#0F172A]">
                          {matchedItem.title}
                        </h3>
                        <p className="text-xs font-medium text-[#334155]">
                          {matchedItem.category}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {matchedItem.building} ·{' '}
                          {formatShortDate(matchedItem.dateOccurred)}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {matchedItem.specificLocation}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-[#475569]">
                      {matchedItem.description}
                    </p>
                  </div>

                  {/* Match Signals & Actions */}
                  <div className="flex flex-col justify-between space-y-4 p-6 lg:col-span-4">
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-[#0F172A]">
                        Weighted Matching Breakdown ({match.similarityScore}%)
                      </p>
                      <ul className="space-y-2 text-xs text-[#475569]">
                        {match.signals.map((signal) => (
                          <li
                            key={signal.label}
                            className="flex items-start gap-2"
                          >
                            {signal.matched ? (
                              <Check
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]"
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CBD5E1]"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              <strong className="font-medium text-[#0F172A]">
                                {signal.label} ({signal.score}/{signal.weight}):
                              </strong>{' '}
                              {signal.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 border-t border-[#F1F5F9] pt-4">
                      <Link to={`/student/items/${matchedItem.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                      {canClaimMatchedItem ? (
                        <Button
                          size="sm"
                          onClick={() => setSelectedItemToClaim(matchedItem)}
                        >
                          Claim This Item
                        </Button>
                      ) : null}
                      {match.status !== 'DISMISSED' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateMatchReview.isPending}
                          onClick={() =>
                            void handleVisibilityToggle(match.id, 'DISMISSED')
                          }
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Not Mine</span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateMatchReview.isPending}
                          onClick={() =>
                            void handleVisibilityToggle(match.id, 'PENDING')
                          }
                        >
                          <RotateCcw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>Restore Suggestion</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedItemToClaim ? (
        <ClaimVerificationModal
          item={selectedItemToClaim}
          isOpen={Boolean(selectedItemToClaim)}
          onClose={() => setSelectedItemToClaim(null)}
        />
      ) : null}
    </div>
  );
}
