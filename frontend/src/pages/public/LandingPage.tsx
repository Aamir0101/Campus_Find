import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileSearch,
  GitCompareArrows,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { PREVIEW_CAMPUS_ITEMS, PREVIEW_HERO_IMAGE } from '../../services/previewData';

export function LandingPage() {
  const featuredItems = PREVIEW_CAMPUS_ITEMS.slice(0, 3);

  return (
    <div className="bg-[#F8F9FA]">
      {/* Hero Section */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-between space-y-8 lg:col-span-6">
              <div className="space-y-5">
                <p className="text-xs font-semibold tracking-wide text-[#1E40AF]">
                  University Property Control &amp; Student Recovery
                </p>
                <h1
                  className="text-3xl font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-4xl lg:text-[46px]"
                  style={{ textWrap: 'balance' }}
                >
                  Recover lost campus belongings with verified custody.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-[#475569]">
                  CampusFind connects students, building desks, and Campus Safety officers in one structured workflow—from initial loss reporting to attribute matching and ID-verified pickup.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Link to="/student">
                    <Button size="lg">
                      <span>Open Student Portal</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link to="/student/report-lost">
                    <Button variant="outline" size="lg">
                      Report Lost Item
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-[#64748B]">
                  Campus Safety Staff?{' '}
                  <Link
                    to="/admin"
                    className="font-medium text-[#1E40AF] underline underline-offset-4 hover:text-[#1D4ED8]"
                  >
                    Open Admin Console
                  </Link>{' '}
                  or{' '}
                  <Link
                    to="/register"
                    className="font-medium text-[#0F172A] underline underline-offset-4 hover:text-[#1E40AF]"
                  >
                    register a student account
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[280px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F1F5F9]">
                <ImageWithFallback
                  src={PREVIEW_HERO_IMAGE}
                  alt="Modern university library commons and study atrium"
                  className="h-full w-full object-cover lg:h-full"
                />
              </div>
            </div>
          </div>

          {/* 4-column Campus Coverage Strip */}
          <div className="mt-12 grid grid-cols-1 divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">Campus Intake Desks</p>
              <p className="mt-1.5 text-xl font-semibold text-[#0F172A] tabular-nums">
                7 Buildings
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Library, Science Hall, Union, Quads &amp; Transit
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">Core Modules</p>
              <p className="mt-1.5 text-xl font-semibold text-[#0F172A] tabular-nums">
                3 Workflows
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Reporting, Smart Matching &amp; Claim Verification
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">Identity Requirement</p>
              <p className="mt-1.5 text-xl font-semibold text-[#0F172A]">University ID</p>
              <p className="mt-1 text-xs text-[#475569]">
                Verified .edu accounts and physical desk check
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-[#64748B]">Audit Accountability</p>
              <p className="mt-1.5 text-xl font-semibold text-[#0F172A]">Full Chain</p>
              <p className="mt-1 text-xs text-[#475569]">
                Timestamped intake, review, and release logs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl space-y-2.5">
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            Three coordinated modules built for campus accountability
          </h2>
          <p className="text-sm leading-relaxed text-[#475569] sm:text-base">
            Every lost report, found intake, match suggestion, and property release follows a transparent institutional workflow.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Primary Wide Card */}
          <div className="flex flex-col justify-between rounded-lg border border-[#E2E8F0] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-7">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-[#1E40AF]">
                  01. Lost &amp; Found Reporting
                </span>
                <FileSearch className="h-5 w-5 text-[#1E40AF]" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold text-[#0F172A]">
                Structured intake by building, time window, and private descriptors
              </h3>
              <p className="text-sm leading-relaxed text-[#475569]">
                Students and desk staff log lost or found items using standardized campus buildings, categories, and hidden verification details kept confidential until a claim is reviewed.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 border-t border-[#F1F5F9] pt-5 sm:grid-cols-2">
              <Link
                to="/student/report-lost"
                className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#0F172A] hover:border-[#1E40AF] hover:text-[#1E40AF] transition-colors"
              >
                <span>File a Lost Report</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/student/report-found"
                className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#0F172A] hover:border-[#1E40AF] hover:text-[#1E40AF] transition-colors"
              >
                <span>Log a Found Item</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Secondary Stacked Cards */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            <div className="flex-1 rounded-lg border border-[#E2E8F0] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-[#1E40AF]">
                  02. Smart Item Matching
                </span>
                <GitCompareArrows className="h-5 w-5 text-[#1E40AF]" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A]">
                Side-by-side comparison across location and keywords
              </h3>
              <p className="text-sm leading-relaxed text-[#475569]">
                Automatically surfaces candidate matches between open lost reports and found inventory using category, building proximity, time window, and descriptor signals.
              </p>
              <div className="pt-2">
                <Link
                  to="/student/matches"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:text-[#1D4ED8]"
                >
                  <span>Inspect Potential Matches</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="flex-1 rounded-lg border border-[#E2E8F0] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-[#1E40AF]">
                  03. Secure Claim &amp; Verification
                </span>
                <ShieldCheck className="h-5 w-5 text-[#1E40AF]" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-[#0F172A]">
                Evidence review before any property leaves custody
              </h3>
              <p className="text-sm leading-relaxed text-[#475569]">
                Claimants submit serial digits, contents, or non-public marks. Campus Safety administrators approve, request proof, or decline with full audit logging.
              </p>
              <div className="pt-2">
                <Link
                  to="/admin/claims"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1E40AF] hover:text-[#1D4ED8]"
                >
                  <span>View Admin Review Queue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Catalog Showcase */}
      <section className="border-y border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
                Sample Campus Inventory Preview
              </h2>
              <p className="text-sm text-[#475569]">
                Representative Phase 1 preview records from Campus Safety intake desks.
              </p>
            </div>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse All Preview Items
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {featuredItems.map((item) => (
              <article
                key={item.id}
                className="flex flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#E2E8F0] bg-white">
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.title}
                    category={item.category}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-5 space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#64748B]">
                      <span className="font-mono font-medium text-[#0F172A]">
                        {item.referenceCode}
                      </span>{' '}
                      · {item.category}
                    </p>
                    <h3 className="text-base font-semibold text-[#0F172A]">{item.title}</h3>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs text-[#475569]">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.building}</span>
                    </span>
                    <Link
                      to={`/student/items/${item.id}`}
                      className="font-medium text-[#1E40AF] hover:underline shrink-0"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Verification & Portal Entry */}
      <section id="workflow" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#1E40AF]">For Students &amp; Faculty</p>
              <h2 className="text-xl font-semibold text-[#0F172A]">
                Self-Service Lost &amp; Found Portal
              </h2>
              <p className="text-sm leading-relaxed text-[#475569]">
                File lost or found reports in under two minutes, browse campus-wide intake logs, review automated match suggestions, and track verification claims.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link to="/student">
                <Button>Enter Student Portal</Button>
              </Link>
              <Link to="/register">
                <Button variant="outline">Create Student Account</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#E2E8F0] bg-[#0F172A] p-8 text-white space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#93C5FD]">
                For Campus Safety &amp; Desk Staff
              </p>
              <h2 className="text-xl font-semibold text-white">
                Property Control &amp; Claims Administration
              </h2>
              <p className="text-sm leading-relaxed text-[#CBD5E1]">
                Manage building intake queues, validate claimant ownership evidence side-by-side against private descriptors, authorize desk pickups, and audit custody releases.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link to="/admin">
                <Button variant="primary">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Open Admin Console</span>
                </Button>
              </Link>
              <Link to="/admin/audit">
                <Button
                  variant="outline"
                  className="border-[#334155] bg-[#1E293B] text-white hover:bg-[#334155] hover:border-[#475569]"
                >
                  View Audit History
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
