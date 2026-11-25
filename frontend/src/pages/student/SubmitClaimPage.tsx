import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lock,
  Paperclip,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import {
  InputField,
  SelectField,
  TextareaField,
} from '../../components/ui/FormControls';
import { ImageWithFallback } from '../../components/ui/ImageWithFallback';
import { ItemStatusLabel } from '../../components/ui/StatusLabel';
import {
  useCurrentUserQuery,
  useItemByIdQuery,
  useItemsQuery,
  useSubmitClaimMutation,
} from '../../hooks/useCampusFindQueries';
import type { ClaimRecord } from '../../types/domain';
import { formatShortDate } from '../../utils/formatters';
import {
  MAX_EVIDENCE_FILES,
  validateClaimForm,
  validateEvidenceFiles,
  type ValidationErrors,
} from '../../utils/validators';

export function SubmitClaimPage() {
  const { itemId: routeItemId } = useParams<{ itemId?: string }>();
  const [searchParams] = useSearchParams();
  const initialItemId = routeItemId ?? searchParams.get('itemId') ?? '';

  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUserQuery();
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);

  const foundItemsQuery = useItemsQuery({
    reportType: 'FOUND',
    limit: 50,
  });
  const selectedItemQuery = useItemByIdQuery(selectedItemId);
  const submitClaim = useSubmitClaimMutation();

  const [ownershipStatement, setOwnershipStatement] = useState('');
  const [identifyingProof, setIdentifyingProof] = useState('');
  const [serialOrMark, setSerialOrMark] = useState('');
  const [preferredPickupWindow, setPreferredPickupWindow] = useState(
    'Weekdays 09:00 - 16:30',
  );
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<ValidationErrors<string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedClaim, setSubmittedClaim] = useState<ClaimRecord | null>(null);

  const claimableFoundItems = (foundItemsQuery.data?.items ?? []).filter(
    (entry) =>
      entry.reportType === 'FOUND' &&
      entry.status !== 'RETURNED' &&
      entry.status !== 'CLOSED' &&
      !entry.isOwner,
  );

  const selectedItem =
    selectedItemQuery.data ??
    claimableFoundItems.find((entry) => entry.id === selectedItemId) ??
    null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length === 0) return;

    const combined = [...evidenceFiles, ...picked].slice(0, MAX_EVIDENCE_FILES);
    const fileError = validateEvidenceFiles(combined);
    if (fileError) {
      setErrors((prev) => ({ ...prev, evidenceFiles: fileError }));
      return;
    }

    setErrors((prev) => ({ ...prev, evidenceFiles: undefined }));
    setEvidenceFiles(combined);
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== index));
    setErrors((prev) => ({ ...prev, evidenceFiles: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);

    if (!selectedItemId) {
      setErrors({ itemId: 'Select the found item you are claiming.' });
      return;
    }

    const validationErrors = validateClaimForm({
      ownershipStatement,
      identifyingProof,
      serialOrMark,
      preferredPickupWindow,
      evidenceNote,
      evidenceFiles,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
      const created = await submitClaim.mutateAsync({
        itemId: selectedItemId,
        ownershipStatement,
        identifyingProof,
        serialOrMark,
        preferredPickupWindow,
        evidenceNote: evidenceNote.trim() || undefined,
        evidenceFiles,
      });
      setSubmittedClaim(created);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : 'Unable to submit your ownership claim. Please review your entries.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/student/claims"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#475569] hover:text-[#0F172A]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to My Claims</span>
        </Link>
      </div>

      <PageHeader
        title="Submit Ownership Claim"
        description="Provide private identifying details and optional supporting documents so Campus Safety staff can verify ownership before releasing the item."
      />

      {isAuthLoading ? (
        <TableSkeleton rows={5} />
      ) : !currentUser ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-[#0F172A]">
            Sign in with your university account to submit a claim
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#64748B]">
            Ownership claims and private verification evidence are linked to your verified campus identity.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/login">
              <Button size="sm">Sign In</Button>
            </Link>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Browse Found Items
              </Button>
            </Link>
          </div>
        </div>
      ) : currentUser.role !== 'STUDENT' ? (
        <ErrorState message="Only student accounts can submit ownership claims." />
      ) : submittedClaim ? (
        <div className="rounded-lg border border-[#BBF7D0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-[#16A34A]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-[#0F172A]">
                Claim {submittedClaim.claimCode} Submitted for Verification
              </h2>
              <p className="text-sm text-[#475569]">
                Your claim for <strong>{submittedClaim.itemTitle}</strong> ({submittedClaim.itemReferenceCode}) is now pending review by Campus Safety property staff. You will be asked to present your physical University ID card once approved.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-4">
            <Link to="/student/claims">
              <Button size="sm">Track in My Claims</Button>
            </Link>
            <Link to="/student/browse">
              <Button variant="outline" size="sm">
                Return to Browse Inventory
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5 lg:col-span-7"
          >
            {serverError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            ) : null}

            <SelectField
              id="submit-claim-item"
              label="Found Item Being Claimed"
              required
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setErrors((prev) => ({ ...prev, itemId: undefined }));
              }}
              error={errors.itemId}
            >
              <option value="">Select an active found item...</option>
              {claimableFoundItems.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.referenceCode} · {entry.title} ({entry.building})
                </option>
              ))}
            </SelectField>

            <TextareaField
              id="submit-claim-statement"
              label="When and where did you misplace this item?"
              required
              rows={3}
              placeholder="Explain the exact building, room, date, and circumstances..."
              value={ownershipStatement}
              onChange={(e) => setOwnershipStatement(e.target.value)}
              error={errors.ownershipStatement}
            />

            <TextareaField
              id="submit-claim-proof"
              label="Private identifying details"
              required
              rows={3}
              placeholder="Describe non-public contents, engravings, lock screen, or distinctive marks..."
              value={identifyingProof}
              onChange={(e) => setIdentifyingProof(e.target.value)}
              error={errors.identifyingProof}
            />

            <InputField
              id="submit-claim-serial"
              label="Serial fragment, engraving, or monogram"
              required
              placeholder="e.g., Last 4 digits 7Q4M or Not applicable"
              value={serialOrMark}
              onChange={(e) => setSerialOrMark(e.target.value)}
              error={errors.serialOrMark}
            />

            <SelectField
              id="submit-claim-pickup"
              label="Preferred Campus Safety Desk Pickup Window"
              required
              value={preferredPickupWindow}
              onChange={(e) => setPreferredPickupWindow(e.target.value)}
              error={errors.preferredPickupWindow}
            >
              <option value="Weekdays 09:00 - 12:00">Weekdays 09:00 - 12:00</option>
              <option value="Weekdays 12:00 - 16:30">Weekdays 12:00 - 16:30</option>
              <option value="Weekdays 09:00 - 16:30">
                Any Weekday Desk Hours (09:00 - 16:30)
              </option>
            </SelectField>

            <div className="space-y-2.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="page-evidence-files"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]"
                >
                  <Paperclip className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
                  <span>Private Supporting Evidence (Optional)</span>
                </label>
                <span className="text-[11px] text-[#64748B]">
                  JPEG, PNG, WebP, PDF · Up to {MAX_EVIDENCE_FILES} files (5 MB max)
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Supporting documents are encrypted in private evidence storage and never shown on public listings.
              </p>

              <input
                id="page-evidence-files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={evidenceFiles.length >= MAX_EVIDENCE_FILES}
                className="block w-full text-xs text-[#475569] file:mr-3 file:rounded file:border file:border-[#CBD5E1] file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#0F172A] hover:file:bg-[#F1F5F9] disabled:opacity-50"
              />

              {errors.evidenceFiles ? (
                <p className="text-xs text-[#DC2626]">{errors.evidenceFiles}</p>
              ) : null}

              {evidenceFiles.length > 0 ? (
                <ul className="space-y-1.5 pt-1">
                  {evidenceFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate text-[#0F172A]">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[#1E40AF]" aria-hidden="true" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-[#64748B] tabular-nums">
                          ({Math.max(1, Math.round(file.size / 1024))} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        aria-label={`Remove ${file.name}`}
                        className="text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {evidenceFiles.length > 0 ? (
                <InputField
                  id="page-evidence-note"
                  label="Evidence Description (Optional)"
                  placeholder="e.g., Campus bookstore invoice or prior laptop photo"
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                />
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Link to="/student/browse">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitClaim.isPending}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>
                  {submitClaim.isPending ? 'Submitting Claim...' : 'Submit Ownership Claim'}
                </span>
              </Button>
            </div>
          </form>

          <aside className="space-y-4 lg:col-span-5">
            {selectedItem ? (
              <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
                <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                    {selectedItem.referenceCode}
                  </span>
                  <ItemStatusLabel status={selectedItem.status} />
                </div>

                <div className="aspect-[4/3] overflow-hidden rounded border border-[#E2E8F0] bg-[#F1F5F9]">
                  <ImageWithFallback
                    src={selectedItem.images?.[0]?.publicUrl ?? selectedItem.imageUrl}
                    alt={selectedItem.title}
                    category={selectedItem.category}
                  />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    {selectedItem.title}
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    {selectedItem.category} · {selectedItem.building} ·{' '}
                    {formatShortDate(selectedItem.dateOccurred)}
                  </p>
                  <p className="text-sm leading-relaxed text-[#475569]">
                    {selectedItem.description}
                  </p>
                </div>

                <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#475569] space-y-1">
                  <p className="font-semibold text-[#0F172A]">
                    Verification Notice
                  </p>
                  <p>
                    Private intake identifiers are withheld from public view. Claim approval authorizes pickup; Campus Safety marks the item returned only after checking your physical University ID at handover.
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a found item"
                description="Choose a found item from the dropdown to inspect its public summary and submit your ownership claim."
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
