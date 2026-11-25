import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { ItemStatusLabel } from '../../components/ui/StatusLabel';
import { useItemsQuery } from '../../hooks/useCampusFindQueries';
import type { ItemFilters, ItemStatus, ReportType } from '../../types/domain';
import {
  CAMPUS_BUILDINGS,
  formatReportTypeLabel,
  formatShortDate,
} from '../../utils/formatters';

const STATUS_OPTIONS: ItemStatus[] = [
  'ACTIVE',
  'POTENTIAL_MATCH',
  'CLAIM_PENDING',
  'UNDER_VERIFICATION',
  'RETURNED',
  'CLOSED',
];

export function ManageReportsPage() {
  const [filters, setFilters] = useState<ItemFilters>({
    search: '',
    reportType: 'ALL',
    category: 'ALL',
    building: 'ALL',
    status: 'ALL',
  });

  const { data, isLoading, error, refetch } = useItemsQuery(filters);
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Campus Reports"
        description="Inspect lost and found intake logs, filter by building custody location, and jump to active claim verification queues."
      />

      {/* Filter Bar */}
      <section className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search reports"
              placeholder="Search reference code, item, or reporter..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              className="h-[40px] w-full rounded-md border border-[#CBD5E1] bg-white pl-10 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by report type"
            value={filters.reportType}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                reportType: e.target.value as 'ALL' | ReportType,
              }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] md:col-span-2"
          >
            <option value="ALL">All Types</option>
            <option value="FOUND">Found Items</option>
            <option value="LOST">Lost Reports</option>
          </select>

          <select
            aria-label="Filter by campus building"
            value={filters.building}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, building: e.target.value }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] md:col-span-3"
          >
            <option value="ALL">All Buildings</option>
            {CAMPUS_BUILDINGS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by lifecycle status"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as 'ALL' | ItemStatus,
              }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] md:col-span-2"
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          title="No reports match your filter"
          description="Adjust search keywords or status filters to view campus lost and found records."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#475569]">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Item &amp; Category</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Building / Custody</th>
                <th className="px-5 py-3.5">Occurred</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                    <Link
                      to={`/student/items/${item.id}`}
                      className="hover:text-[#1E40AF] hover:underline"
                    >
                      {item.referenceCode}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#0F172A]">{item.title}</p>
                    <p className="text-xs text-[#64748B]">
                      {item.category} · {item.reporterAffiliation}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#475569] whitespace-nowrap">
                    {formatReportTypeLabel(item.reportType)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#475569]">
                    <p className="font-medium text-[#0F172A]">{item.building}</p>
                    <p className="text-[#64748B]">
                      {item.custodyLocation ?? item.specificLocation}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                    {formatShortDate(item.dateOccurred)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <ItemStatusLabel status={item.status} />
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                    {item.status === 'CLAIM_PENDING' ||
                    item.status === 'UNDER_VERIFICATION' ? (
                      <Link
                        to="/admin/claims"
                        className="inline-flex items-center gap-1 font-medium text-[#1E40AF] hover:underline"
                      >
                        <span>Review Claim</span>
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : (
                      <Link
                        to={`/student/items/${item.id}`}
                        className="font-medium text-[#475569] hover:text-[#0F172A] hover:underline"
                      >
                        Inspect Record
                      </Link>
                    )}
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
