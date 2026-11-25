import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileCheck2,
  FilePlus2,
  FileSearch,
  GitCompareArrows,
  PackageSearch,
} from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { Button } from '../../components/ui/Button';
import {
  ClaimStatusLabel,
  ItemStatusLabel,
  MatchConfidenceLabel,
} from '../../components/ui/StatusLabel';
import {
  useCurrentUserQuery,
  useMatchesQuery,
  useStudentClaimsQuery,
  useStudentReportsQuery,
} from '../../hooks/useCampusFindQueries';
import { formatReportTypeLabel, formatShortDate } from '../../utils/formatters';

export function StudentDashboardPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const isSignedIn = Boolean(currentUser);
  const reportsQuery = useStudentReportsQuery(undefined, { enabled: isSignedIn });
  const matchesQuery = useMatchesQuery(
    { status: 'ACTIVE', limit: 5 },
    { enabled: isSignedIn },
  );
  const isStudent = Boolean(currentUser && currentUser.role === 'STUDENT');
  const claimsQuery = useStudentClaimsQuery(
    { limit: 5 },
    { enabled: isStudent },
  );

  const reports = isSignedIn ? (reportsQuery.data?.items ?? []) : [];
  const matches = isSignedIn ? (matchesQuery.data?.matches ?? []) : [];
  const claims = isStudent ? (claimsQuery.data?.claims ?? []) : [];

  const isLoading =
    isAuthLoading ||
    (isSignedIn && (reportsQuery.isLoading || matchesQuery.isLoading)) ||
    (isStudent && claimsQuery.isLoading);
  const error =
    (isSignedIn ? reportsQuery.error || matchesQuery.error : null) ||
    (isStudent ? claimsQuery.error : null);

  const handleRetry = () => {
    void reportsQuery.refetch();
    void matchesQuery.refetch();
    void claimsQuery.refetch();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={currentUser ? `Welcome back, ${currentUser.fullName}` : 'Student Lost & Found Portal'}
        description="Track your open lost and found reports, review automated campus matches, and monitor ownership claim verification."
        actions={
          <>
            <Link to="/student/report-found">
              <Button variant="outline" size="sm">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Report Found</span>
              </Button>
            </Link>
            <Link to="/student/report-lost">
              <Button size="sm">
                <FileSearch className="h-4 w-4" aria-hidden="true" />
                <span>Report Lost</span>
              </Button>
            </Link>
          </>
        }
      />

      {/* 4-column Summary Metrics */}
      <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        <div className="p-5">
          <p className="text-xs font-medium text-[#64748B]">My Active Reports</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
            {isLoading ? '—' : reports.length}
          </p>
          <Link
            to="/student/reports"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
          >
            <span>Manage reports</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-[#64748B]">Potential Matches</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
            {isLoading ? '—' : matches.filter((m) => m.status !== 'DISMISSED').length}
          </p>
          <Link
            to="/student/matches"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
          >
            <span>Review matches</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-[#64748B]">Submitted Claims</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
            {isLoading ? '—' : claims.length}
          </p>
          <Link
            to="/student/claims"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
          >
            <span>Track verification</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-[#64748B]">Campus Inventory</p>
          <p className="mt-2 text-2xl font-bold text-[#0F172A]">Open</p>
          <Link
            to="/student/browse"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
          >
            <span>Browse found items</span>
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={handleRetry} />
      ) : isLoading ? (
        <div className="space-y-6">
          <TableSkeleton rows={3} />
          <TableSkeleton rows={3} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Potential Matches Feed */}
          <section className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4 text-[#1E40AF]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Recent Potential Matches
                </h2>
              </div>
              <Link
                to="/student/matches"
                className="text-xs font-medium text-[#1E40AF] hover:underline"
              >
                View all matches
              </Link>
            </div>

            {matches.length === 0 ? (
              <EmptyState
                title="No match suggestions yet"
                description="When a found item shares category, building, or descriptor signals with your lost report, it will appear here."
                action={
                  <Link to="/student/browse">
                    <Button variant="outline" size="sm">
                      <PackageSearch className="h-4 w-4" aria-hidden="true" />
                      <span>Browse Campus Inventory</span>
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                {matches.map((match) => {
                  const matchedItem =
                    match.foundItem.isOwner && !match.lostItem.isOwner
                      ? match.lostItem
                      : match.foundItem;
                  return (
                    <div key={match.id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <MatchConfidenceLabel
                          classification={match.classification}
                          score={match.similarityScore}
                        />
                        <span className="text-xs text-[#64748B] font-mono tabular-nums">
                          {match.lostItem.referenceCode} ↔ {match.foundItem.referenceCode}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-[#0F172A]">
                          {matchedItem.title}
                        </h3>
                        <p className="text-xs text-[#475569]">
                          {matchedItem.category} · {matchedItem.building} ·{' '}
                          {formatShortDate(matchedItem.dateOccurred)}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          {match.notice}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                        <span className="text-xs text-[#64748B]">
                          {match.signals.filter((s) => s.matched).length} of{' '}
                          {match.signals.length} attribute signals aligned
                        </span>
                        <Link
                          to={`/student/items/${matchedItem.id}`}
                          className="text-xs font-medium text-[#1E40AF] hover:underline"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Claims & Reports Column */}
          <section className="space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-[#1E40AF]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[#0F172A]">
                  My Recent Reports &amp; Claims
                </h2>
              </div>
              <Link
                to="/student/claims"
                className="text-xs font-medium text-[#1E40AF] hover:underline"
              >
                All claims
              </Link>
            </div>

            {reports.length === 0 && claims.length === 0 ? (
              <EmptyState
                title="No personal activity"
                description="File a lost or found item report or submit a claim on a found item to track it here."
                action={
                  <Link to="/student/report-lost">
                    <Button size="sm">Report Lost Item</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                {reports.slice(0, 3).map((report) => (
                  <Link
                    key={report.id}
                    to={`/student/items/${report.id}`}
                    className="block p-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                      <span className="font-mono text-[#0F172A] tabular-nums">
                        {report.referenceCode}
                      </span>
                      <ItemStatusLabel status={report.status} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#0F172A] truncate">
                      {report.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {formatReportTypeLabel(report.reportType)} · {report.building}
                    </p>
                  </Link>
                ))}

                {claims.slice(0, 2).map((claim) => (
                  <Link
                    key={claim.id}
                    to="/student/claims"
                    className="block p-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                      <span className="font-mono text-[#0F172A] tabular-nums">
                        {claim.claimCode}
                      </span>
                      <ClaimStatusLabel status={claim.status} />
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#0F172A] truncate">
                      {claim.itemTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Claim verification · {claim.pickupDesk}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
