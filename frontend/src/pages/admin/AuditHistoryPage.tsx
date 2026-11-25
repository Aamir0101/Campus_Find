import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import {
  useAuditLogsQuery,
  useCurrentUserQuery,
} from '../../hooks/useCampusFindQueries';
import type { AuditActionType } from '../../types/domain';
import { formatAuditActionLabel, formatDateTime } from '../../utils/formatters';

const AUDIT_ACTIONS: ('ALL' | AuditActionType)[] = [
  'ALL',
  'CLAIM_SUBMITTED',
  'CLAIM_REVIEWED',
  'CLAIM_APPROVED',
  'CLAIM_REJECTED',
  'CUSTODY_RELEASED',
  'REPORT_CREATED',
  'REPORT_UPDATED',
  'REPORT_STATUS_CHANGED',
  'MATCH_CREATED',
  'MATCH_REVIEWED',
  'USER_REGISTERED',
];

export function AuditHistoryPage() {
  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const isAdmin = Boolean(currentUser && currentUser.role === 'ADMIN');

  const [actionFilter, setActionFilter] = useState<'ALL' | AuditActionType>('ALL');
  const { data, isLoading, error, refetch } = useAuditLogsQuery(
    { action: actionFilter, limit: 50 },
    { enabled: isAdmin },
  );

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custodial Audit History"
        description="Chronological record of report intake, match flags, claim decisions, and verified physical custody releases."
        actions={
          isAdmin ? (
            <select
              aria-label="Filter audit events by action"
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(e.target.value as 'ALL' | AuditActionType)
              }
              className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] focus:border-[#1E40AF] focus:outline-none"
            >
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action === 'ALL'
                    ? 'All Audit Events'
                    : formatAuditActionLabel(action)}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {isAuthLoading || (isAdmin && isLoading) ? (
        <TableSkeleton rows={6} />
      ) : !currentUser ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Administrator sign-in required
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Sign in with an administrator account to inspect the campus custodial audit ledger.
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
            Custodial audit logs are accessible only to Campus Safety administrators.
          </p>
          <div className="mt-5 flex justify-center">
            <Link to="/student">
              <Button variant="outline" size="sm">
                Return to Student Portal
              </Button>
            </Link>
          </div>
        </div>
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit records found"
          description="Actions performed in item reporting, claim verification, and physical custody handover appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#475569]">
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Target Ref</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {logs.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                    {formatDateTime(entry.timestamp)}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold text-[#0F172A] whitespace-nowrap">
                    {formatAuditActionLabel(entry.action)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <p className="font-mono text-xs font-medium text-[#1E40AF] tabular-nums">
                      {entry.targetCode}
                    </p>
                    <p className="text-xs text-[#64748B] max-w-[200px] truncate">
                      {entry.targetSummary}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    <p className="font-medium text-[#0F172A]">{entry.actorName}</p>
                    <p className="text-[#64748B]">{entry.actorRole}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs leading-relaxed text-[#475569]">
                    {entry.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
