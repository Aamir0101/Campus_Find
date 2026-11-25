import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Lock,
  Pencil,
  ShieldCheck,
  User,
} from 'lucide-react';
import { ClaimVerificationModal } from '../../components/items/ClaimVerificationModal';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { ItemStatusLabel } from '../../components/ui/StatusLabel';
import { useItemByIdQuery } from '../../hooks/useCampusFindQueries';
import {
  formatDateTime,
  formatReportTypeLabel,
  formatShortDate,
} from '../../utils/formatters';

export function ItemDetailsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: item, isLoading, error, refetch } = useItemByIdQuery(id);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const images = item?.images ?? [];
  const activeImageUrl =
    images[selectedImageIndex]?.publicUrl ?? item?.imageUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/student/browse"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#475569] hover:text-[#0F172A]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Browse Inventory</span>
        </Link>

        {item?.isOwner && item.isEditable ? (
          <Link to="/student/reports">
            <Button variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Manage in My Reports</span>
            </Button>
          </Link>
        ) : null}
      </div>

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : !item ? (
        <EmptyState
          title="Item record not found"
          description="This item report does not exist or has been withdrawn by the reporter."
          action={
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Return to Browse Items
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Media & Description */}
            <div className="space-y-6 lg:col-span-7">
              <div className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                <div className="aspect-[4/3] w-full bg-[#F1F5F9]">
                  <ImageWithFallback
                    src={activeImageUrl}
                    alt={item.title}
                    category={item.category}
                  />
                </div>

                {images.length > 1 ? (
                  <div className="flex items-center gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] p-3 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`h-14 w-16 shrink-0 overflow-hidden rounded border transition-colors cursor-pointer ${
                          selectedImageIndex === idx
                            ? 'border-[#1E40AF] ring-2 ring-[#1E40AF]/20'
                            : 'border-[#CBD5E1] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img.publicUrl}
                          alt={img.altText ?? `${item.title} photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Public Description
                </h2>
                <p className="text-sm leading-relaxed text-[#334155]">
                  {item.description}
                </p>

                <div className="border-t border-[#F1F5F9] pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                    <Lock className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
                    <span>Verification Details (Protected for Claim Review)</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#475569]">
                    {item.distinguishingFeatures
                      ? item.distinguishingFeatures
                      : 'Private intake identifiers are withheld from public view and matched against ownership claims by Campus Safety staff.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Structured Metadata & Actions */}
            <div className="space-y-6 lg:col-span-5">
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
                <div className="space-y-2 border-b border-[#F1F5F9] pb-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                      {item.referenceCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatReportTypeLabel(item.reportType)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.category}</span>
                  </div>

                  <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                    {item.title}
                  </h1>

                  <div className="pt-1">
                    <ItemStatusLabel status={item.status} />
                  </div>
                </div>

                <dl className="space-y-3.5 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-[#64748B]">
                      <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Building</span>
                    </dt>
                    <dd className="text-right font-medium text-[#0F172A]">
                      {item.building}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-[#64748B]">Location Detail</dt>
                    <dd className="text-right font-medium text-[#0F172A]">
                      {item.specificLocation}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-[#64748B]">
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Date Occurred</span>
                    </dt>
                    <dd className="text-right font-medium text-[#0F172A] tabular-nums">
                      {formatShortDate(item.dateOccurred)}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-[#64748B]">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Time Window</span>
                    </dt>
                    <dd className="text-right font-medium text-[#0F172A] tabular-nums">
                      {item.timeWindow}
                    </dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-[#64748B]">
                      <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Reporter</span>
                    </dt>
                    <dd className="text-right font-medium text-[#0F172A]">
                      {item.reporterAffiliation}
                    </dd>
                  </div>

                  {item.custodyLocation ? (
                    <div className="flex items-start justify-between gap-4 border-t border-[#F1F5F9] pt-3">
                      <dt className="text-[#64748B]">Custody Desk</dt>
                      <dd className="text-right font-medium text-[#0F172A]">
                        {item.custodyLocation}
                      </dd>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-4 border-t border-[#F1F5F9] pt-3 text-xs">
                    <dt className="text-[#64748B]">Logged Timestamp</dt>
                    <dd className="text-right text-[#475569] tabular-nums">
                      {formatDateTime(item.createdAt)}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-[#E2E8F0] pt-5 space-y-3">
                  {item.reportType === 'FOUND' &&
                  item.status !== 'RETURNED' &&
                  item.status !== 'CLOSED' ? (
                    item.isOwner ? (
                      <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569]">
                        You reported this found item. Reporters cannot submit an ownership claim on their own report.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => setClaimModalOpen(true)}
                        >
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          <span>Submit Ownership Claim</span>
                        </Button>
                        <Link
                          to={`/student/claims/new/${item.id}`}
                          className="block text-center text-xs font-medium text-[#1E40AF] hover:underline"
                        >
                          Open dedicated claim form
                        </Link>
                      </div>
                    )
                  ) : (
                    <Link to="/student/matches" className="block">
                      <Button variant="outline" size="lg" className="w-full">
                        Check Potential Matches
                      </Button>
                    </Link>
                  )}

                  <p className="text-xs leading-relaxed text-[#64748B]">
                    Approved claimants must present a valid physical University ID card at the assigned Campus Safety desk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ClaimVerificationModal
            item={item}
            isOpen={claimModalOpen}
            onClose={() => setClaimModalOpen(false)}
          />
        </>
      )}
    </div>
  );
}
