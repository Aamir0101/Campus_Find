import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { CampusItem } from '../../types/domain';
import { formatReportTypeLabel, formatShortDate } from '../../utils/formatters';
import { ImageWithFallback } from '../ui/ImageWithFallback';
import { ItemStatusLabel } from '../ui/StatusLabel';

export function ItemCard({ item }: { item: CampusItem }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 hover:border-[#CBD5E1]">
      <Link
        to={`/student/items/${item.id}`}
        className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#E2E8F0] bg-[#F1F5F9] block focus-visible:outline-2 focus-visible:outline-[#1E40AF]"
      >
        <ImageWithFallback
          src={item.imageUrl}
          alt={item.title}
          category={item.category}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B]">
            <span className="font-mono font-medium text-[#0F172A] tabular-nums">
              {item.referenceCode}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatReportTypeLabel(item.reportType)}</span>
            <span aria-hidden="true">·</span>
            <span>{item.category}</span>
          </div>

          <h3 className="text-base font-semibold leading-snug text-[#0F172A]">
            <Link
              to={`/student/items/${item.id}`}
              className="hover:text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-[#1E40AF]"
            >
              {item.title}
            </Link>
          </h3>

          <p className="line-clamp-2 text-sm leading-relaxed text-[#475569]">
            {item.description}
          </p>
        </div>

        <div className="space-y-3 border-t border-[#F1F5F9] pt-3.5">
          <div className="flex items-center justify-between gap-3 text-xs text-[#64748B]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#64748B]" aria-hidden="true" />
              <span className="truncate">{item.building}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatShortDate(item.dateOccurred)}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <ItemStatusLabel status={item.status} />
            <Link
              to={`/student/items/${item.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:text-[#1D4ED8] whitespace-nowrap shrink-0"
            >
              <span>View Details</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
