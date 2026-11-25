import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { ItemCard } from '../../components/items/ItemCard';
import { Button } from '../../components/ui/Button';
import {
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from '../../components/ui/DataStates';
import {
  useItemMetadataQuery,
  useItemsQuery,
} from '../../hooks/useCampusFindQueries';
import type {
  ItemCategory,
  ItemFilters,
  ItemStatus,
  ReportType,
} from '../../types/domain';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES } from '../../utils/formatters';

const DEFAULT_FILTERS: ItemFilters = {
  search: '',
  reportType: 'ALL',
  category: 'ALL',
  building: 'ALL',
  status: 'ALL',
  page: 1,
  limit: 12,
};

export function BrowseItemsPage() {
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const { data, isLoading, error, refetch } = useItemsQuery(filters);
  const metadataQuery = useItemMetadataQuery();

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const categoryOptions = useMemo(() => {
    if (metadataQuery.data?.categories.length) {
      return metadataQuery.data.categories.map((c) => c.name);
    }
    return ITEM_CATEGORIES;
  }, [metadataQuery.data]);

  const buildingOptions = useMemo(() => {
    if (metadataQuery.data?.locations.length) {
      return Array.from(
        new Set(metadataQuery.data.locations.map((l) => l.buildingName)),
      );
    }
    return CAMPUS_BUILDINGS;
  }, [metadataQuery.data]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.reportType !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.building !== 'ALL' ||
    filters.status !== 'ALL';

  const currentPage = pagination?.page ?? filters.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse Campus Inventory"
        description="Search active lost and found property reports across all university buildings and Campus Safety desks."
        actions={
          <Link to="/student/report-lost">
            <Button size="sm">Report Missing Item</Button>
          </Link>
        }
      />

      {/* Search & Filter Toolbar */}
      <section
        aria-label="Filter items"
        className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search by item title, building, or reference code"
              placeholder="Search by item name, building, spot, or reference code..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
              }
              className="h-[42px] w-full rounded-md border border-[#CBD5E1] bg-white pl-10 pr-4 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E40AF] focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/20"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by report type"
            className="inline-flex items-center rounded-md border border-[#CBD5E1] bg-[#F8FAFC] p-1 shrink-0"
          >
            {(['ALL', 'FOUND', 'LOST'] as const).map((type) => {
              const active = filters.reportType === type;
              const label =
                type === 'ALL'
                  ? 'All Records'
                  : type === 'FOUND'
                    ? 'Found Items'
                    : 'Lost Reports';
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      reportType: type as 'ALL' | ReportType,
                      page: 1,
                    }))
                  }
                  className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-[#0F172A] shadow-xs border border-[#E2E8F0]'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[#F1F5F9] pt-3 sm:grid-cols-3 lg:grid-cols-4">
          <select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: e.target.value as 'ALL' | ItemCategory,
                page: 1,
              }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E40AF] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by building"
            value={filters.building}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, building: e.target.value, page: 1 }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E40AF] focus:outline-none"
          >
            <option value="ALL">All Campus Buildings</option>
            {buildingOptions.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as 'ALL' | ItemStatus,
                page: 1,
              }))
            }
            className="h-[40px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E40AF] focus:outline-none"
          >
            <option value="ALL">All Active Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="POTENTIAL_MATCH">Potential Match</option>
            <option value="CLAIM_PENDING">Claim Pending</option>
            <option value="UNDER_VERIFICATION">Under Verification</option>
            <option value="RETURNED">Returned</option>
          </select>

          <div className="flex items-center justify-between sm:justify-end">
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Filters</span>
              </Button>
            ) : (
              <span className="text-xs text-[#64748B] tabular-nums">
                {pagination ? `${pagination.total} records` : ''}
              </span>
            )}
          </div>
        </div>
      </section>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No matching campus items found"
          description="Try broadening your search terms or clearing active building and category filters."
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear Active Filters
              </Button>
            ) : (
              <Link to="/student/report-lost">
                <Button size="sm">File a Lost Item Report</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#475569]">
              <span className="tabular-nums">
                Page {currentPage} of {totalPages} ({pagination?.total ?? items.length} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))
                  }
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      page: Math.min(totalPages, currentPage + 1),
                    }))
                  }
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
