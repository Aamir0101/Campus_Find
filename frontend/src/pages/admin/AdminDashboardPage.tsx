import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { Button } from '../../components/ui/Button';
import { ClaimStatusLabel, ItemStatusLabel } from '../../components/ui/StatusLabel';
import {
  useAllClaimsQuery,
  useAuditLogsQuery,
  useCurrentUserQuery,
  useItemsQuery,
} from '../../hooks/useCampusFindQueries';
import {
  formatAuditActionLabel,
  formatDateTime,
  formatShortDate,
} from '../../utils/formatters';

export function AdminDashboardPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const isAdmin = Boolean(currentUser && currentUser.role === 'ADMIN');

  const itemsQuery = useItemsQuery({ limit: 50 });
  const claimsQuery = useAllClaimsQuery({ limit: 50 }, { enabled: isAdmin });
  const auditQuery = useAuditLogsQuery({ limit: 25 }, { enabled: isAdmin });

  const items = itemsQuery.data?.items ?? [];
  const claims = claimsQuery.data?.claims ?? [];
  const logs = auditQuery.data?.logs ?? [];

  const isLoading =
    isAuthLoading ||
    itemsQuery.isLoading ||
    (isAdmin && (claimsQuery.isLoading || auditQuery.isLoading));
  const error =
    itemsQuery.error ||
    (isAdmin ? claimsQuery.error || auditQuery.error : null);

  const pendingClaimsCount = claims.filter(
    (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW',
  ).length;
  const openReportsCount = items.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'POTENTIAL_MATCH',
  ).length;
  const returnedCount = items.filter((i) => i.status === 'RETURNED').length;

  const handleRetry = () => {
    void itemsQuery.refetch();
    void claimsQuery.refetch();
    void auditQuery.refetch();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campus Safety Property Control"
        description="Operational overview of lost and found intake logs, pending ownership verifications, and custodial audit trails."
        actions={
          <>
            <Link to="/admin/reports">
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                <span>Manage Reports</span>
              </Button>
            </Link>
            <Link to="/admin/claims">
              <Button variant="secondary" size="sm">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                <span>Review Claims</span>
              </Button>
            </Link>
          </>
        }
      />

      {!isAuthLoading && !currentUser ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Administrator sign-in required
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Sign in with a Campus Safety administrator account to view ownership claim queues and audit history.
          </p>
          <div className="mt-5 flex justify-center">
            <Link to="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      ) : !isAuthLoading && !isAdmin ? (
        <div className="rounded-lg border border-[#FECACA] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ShieldAlert className="mx-auto h-7 w-7 text-[#DC2626]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Administrator Access Restricted
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            The Campus Safety Property Control console is restricted to administrator accounts.
          </p>
          <div className="mt-5 flex justify-center">
            <Link to="/student">
              <Button variant="outline" size="sm">
                Return to Student Portal
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 4-column Admin KPIs */}
          <div className="grid grid-cols-1 divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">
                Total Intake Records
              </p>
              <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
                {isLoading ? '—' : (itemsQuery.data?.pagination.total ?? items.length)}
              </p>
              <p className="mt-1 text-xs text-[#475569]">Across campus desks</p>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">
                Open &amp; Matched
              </p>
              <p className="mt-2 text-2xl font-bold text-[#0F172A] tabular-nums">
                {isLoading ? '—' : openReportsCount}
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Awaiting claim verification
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">
                Claims Pending Review
              </p>
              <p className="mt-2 text-2xl font-bold text-[#B45309] tabular-nums">
                {isLoading ? '—' : pendingClaimsCount}
              </p>
              <Link
                to="/admin/claims"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
              >
                <span>Open review queue</span>
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>

            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">
                Custody Returned
              </p>
              <p className="mt-2 text-2xl font-bold text-[#15803D] tabular-nums">
                {isLoading ? '—' : returnedCount}
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Verified ID release complete
              </p>
            </div>
          </div>

          {error ? (
            <ErrorState message={(error as Error).message} onRetry={handleRetry} />
          ) : isLoading ? (
            <div className="space-y-6">
              <TableSkeleton rows={4} />
              <TableSkeleton rows={4} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Claims Queue Summary */}
              <section className="space-y-4 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    Recent Ownership Claims
                  </h2>
                  <Link
                    to="/admin/claims"
                    className="text-xs font-medium text-[#1E40AF] hover:underline"
                  >
                    Open Review Queue
                  </Link>
                </div>

                {claims.length === 0 ? (
                  <EmptyState
                    title="No ownership claims in queue"
                    description="Submitted student verification requests will appear here for staff review."
                  />
                ) : (
                  <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    {claims.slice(0, 4).map((claim) => (
                      <div
                        key={claim.id}
                        className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-[#64748B]">
                            <span className="font-mono font-medium text-[#0F172A] tabular-nums">
                              {claim.claimCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{claim.claimantName ?? 'Student Claimant'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {claim.claimantCampusId ?? '—'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#0F172A] truncate">
                            {claim.itemTitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <ClaimStatusLabel status={claim.status} />
                          <Link
                            to="/admin/claims"
                            className="text-xs font-medium text-[#1E40AF] hover:underline"
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Reports Table */}
                <div className="flex items-center justify-between pt-2">
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    Latest Campus Intake Reports
                  </h2>
                  <Link
                    to="/admin/reports"
                    className="text-xs font-medium text-[#1E40AF] hover:underline"
                  >
                    Manage all reports
                  </Link>
                </div>

                {items.length === 0 ? (
                  <EmptyState
                    title="No reports logged"
                    description="Campus lost and found intake items will populate this table."
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] font-semibold text-[#475569]">
                          <th className="px-4 py-3">Ref</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {items.slice(0, 5).map((item) => (
                          <tr key={item.id} className="hover:bg-[#F8FAFC]">
                            <td className="px-4 py-3 font-mono font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                              {item.referenceCode}
                            </td>
                            <td className="px-4 py-3 text-[#0F172A] font-medium">
                              {item.title}
                            </td>
                            <td className="px-4 py-3 text-[#64748B] tabular-nums whitespace-nowrap">
                              {formatShortDate(item.dateOccurred)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <ItemStatusLabel status={item.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Audit Trail Column */}
              <section className="space-y-4 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History
                      className="h-4 w-4 text-[#1E40AF]"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      Recent Audit Activity
                    </h2>
                  </div>
                  <Link
                    to="/admin/audit"
                    className="text-xs font-medium text-[#1E40AF] hover:underline"
                  >
                    Full ledger
                  </Link>
                </div>

                {logs.length === 0 ? (
                  <EmptyState
                    title="No audit events recorded"
                    description="Status changes, claim decisions, and custody releases are recorded here."
                  />
                ) : (
                  <div className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    {logs.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#0F172A]">
                            {formatAuditActionLabel(entry.action)}
                          </span>
                          <span className="font-mono text-[#64748B] tabular-nums">
                            {entry.targetCode}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] leading-relaxed">
                          {entry.details}
                        </p>
                        <p className="text-[11px] text-[#64748B] tabular-nums">
                          {entry.actorName} · {formatDateTime(entry.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
