import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-[28px]">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-[#475569]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white"
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-[#E2E8F0]/70" />
          <div className="space-y-3 p-5">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-[#E2E8F0]" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-[#E2E8F0]" />
            <div className="h-4 w-full animate-pulse rounded bg-[#F1F5F9]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#F1F5F9]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white"
      aria-busy="true"
    >
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5">
        <div className="h-4 w-48 animate-pulse rounded bg-[#E2E8F0]" />
      </div>
      <div className="divide-y divide-[#E2E8F0]">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-6 px-5 py-4">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 animate-pulse rounded bg-[#E2E8F0]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#F1F5F9]" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-[#E2E8F0]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-6 py-14 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-[#64748B]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load records',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-[#FECACA] bg-white px-6 py-12 text-center"
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-[#475569]">{message}</p>
      {onRetry ? (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Request</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
