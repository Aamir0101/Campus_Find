import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Lock,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useCurrentUserQuery,
  useSubmitClaimMutation,
} from '../../hooks/useCampusFindQueries';
import type { CampusItem, ClaimRecord } from '../../types/domain';
import {
  MAX_EVIDENCE_FILES,
  validateClaimForm,
  validateEvidenceFiles,
  type ValidationErrors,
} from '../../utils/validators';
import { Button } from '../ui/Button';
import { InputField, SelectField, TextareaField } from '../ui/FormControls';
import { Modal } from '../ui/Modal';

interface ClaimVerificationModalProps {
  item: CampusItem;
  isOpen: boolean;
  onClose: () => void;
}

export function ClaimVerificationModal({
  item,
  isOpen,
  onClose,
}: ClaimVerificationModalProps) {
  const { data: currentUser } = useCurrentUserQuery();
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
        itemId: item.id,
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
          : 'Unable to submit your ownership claim. Please check your entries and try again.',
      );
    }
  };

  const handleClose = () => {
    setSubmittedClaim(null);
    setErrors({});
    setServerError(null);
    onClose();
  };

  const isEligibleStudent = Boolean(currentUser && currentUser.role === 'STUDENT');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Submit Ownership Claim · ${item.referenceCode}`}
      subtitle={item.title}
    >
      {!currentUser ? (
        <div className="space-y-4 py-3 text-center">
          <Lock className="mx-auto h-7 w-7 text-[#1E40AF]" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Student sign-in required
            </p>
            <p className="text-sm text-[#475569]">
              Sign in with your verified university account to submit an ownership claim and upload private proof.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Link to="/login" onClick={handleClose}>
              <Button size="sm">Sign In to Claim</Button>
            </Link>
          </div>
        </div>
      ) : !isEligibleStudent ? (
        <div className="space-y-4 py-3 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-[#B45309]" aria-hidden="true" />
          <p className="text-sm text-[#475569]">
            Ownership claims can only be submitted from a student account.
          </p>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : item.isOwner ? (
        <div className="space-y-4 py-3 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-[#B45309]" aria-hidden="true" />
          <p className="text-sm text-[#475569]">
            You reported this found item and cannot submit an ownership claim against your own report.
          </p>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : submittedClaim ? (
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-[#16A34A]"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0F172A]">
                Claim {submittedClaim.claimCode} Submitted for Review
              </p>
              <p className="text-sm text-[#475569]">
                Campus Safety property staff will verify your identifying evidence against the physical intake log before approving pickup.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Close
            </Button>
            <Link to="/student/claims" onClick={handleClose}>
              <Button size="sm">Track in My Claims</Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          ) : null}

          <TextareaField
            id="claim-statement"
            label="When and where did you misplace this item?"
            required
            rows={3}
            placeholder="Describe the exact building floor, class, or seat where you last had it..."
            value={ownershipStatement}
            onChange={(e) => setOwnershipStatement(e.target.value)}
            error={errors.ownershipStatement}
          />

          <TextareaField
            id="claim-proof"
            label="Private identifying details"
            required
            rows={3}
            placeholder="Describe non-public contents, lock screen wallpaper, stickers, or specific wear..."
            value={identifyingProof}
            onChange={(e) => setIdentifyingProof(e.target.value)}
            error={errors.identifyingProof}
          />

          <InputField
            id="claim-serial"
            label="Serial fragment, engraving, or monogram"
            required
            placeholder="e.g., Last 4 digits 7Q4M or initials M.L."
            value={serialOrMark}
            onChange={(e) => setSerialOrMark(e.target.value)}
            error={errors.serialOrMark}
          />

          <SelectField
            id="claim-pickup"
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

          <div className="space-y-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="claim-evidence-files"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]"
              >
                <Paperclip className="h-3.5 w-3.5 text-[#1E40AF]" aria-hidden="true" />
                <span>Supporting Evidence Files (Optional)</span>
              </label>
              <span className="text-[11px] text-[#64748B]">
                JPEG, PNG, WebP, PDF · Max {MAX_EVIDENCE_FILES} files (5 MB each)
              </span>
            </div>

            <p className="text-xs text-[#64748B]">
              Attach purchase receipts, serial screenshots, or prior photos. Files are stored in private evidence storage accessible only to you and reviewing staff.
            </p>

            <input
              id="claim-evidence-files"
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
                    className="flex items-center justify-between gap-2 rounded border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs"
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
                id="claim-evidence-note"
                label="Evidence Note (Optional)"
                placeholder="e.g., Original campus bookstore receipt from Oct 2026"
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
              />
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitClaim.isPending}>
              {submitClaim.isPending ? 'Submitting Claim...' : 'Submit Verification Claim'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
