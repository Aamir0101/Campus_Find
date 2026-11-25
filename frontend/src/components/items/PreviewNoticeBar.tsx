import { Info } from 'lucide-react';
import { usePreviewState } from '../../hooks/usePreviewContext';
import type { PreviewStateMode } from '../../types/domain';

const MODES: { id: PreviewStateMode; label: string }[] = [
  { id: 'populated', label: 'Populated' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
];

export function PreviewNoticeBar() {
  const { previewStateMode, changePreviewStateMode } = usePreviewState();

  return (
    <div className="flex flex-col gap-2.5 border-b border-[#E2E8F0] bg-[#F1F5F9]/80 px-4 py-2.5 text-xs text-[#475569] sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <div className="flex items-center gap-2">
        <Info className="h-3.5 w-3.5 shrink-0 text-[#1E40AF]" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-[#0F172A]">CampusFind Live Services:</strong>{' '}
          Authentication, Lost &amp; Found reporting, Smart Matching, Claim Verification, and Audit History are connected to the CampusFind API.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-medium text-[#64748B] whitespace-nowrap">
          UI State:
        </span>
        <div
          role="group"
          aria-label="Simulate query UI state"
          className="inline-flex items-center rounded-md border border-[#CBD5E1] bg-white p-0.5"
        >
          {MODES.map((mode) => {
            const active = previewStateMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => changePreviewStateMode(mode.id)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
