import type {
  CreateItemReportInput,
  SubmitClaimInput,
  UpdateItemReportInput,
} from '../types/domain';

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

export const MAX_UPLOAD_IMAGES = 4;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const MAX_EVIDENCE_FILES = 3;
export const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export function isValidUniversityEmail(email: string): boolean {
  const trimmed = email.trim();
  const basicFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!basicFormat) return false;
  return (
    trimmed.toLowerCase().endsWith('.edu') ||
    trimmed.toLowerCase().includes('university')
  );
}

export function validateLoginForm(values: {
  email: string;
  password: string;
}): ValidationErrors<'email' | 'password'> {
  const errors: ValidationErrors<'email' | 'password'> = {};
  if (!values.email.trim()) {
    errors.email = 'Enter your university email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!values.password) {
    errors.password = 'Enter your account password.';
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }
  return errors;
}

export function validateRegistrationForm(values: {
  fullName: string;
  email: string;
  campusId: string;
  department: string;
  password: string;
  confirmPassword: string;
}): ValidationErrors<
  'fullName' | 'email' | 'campusId' | 'department' | 'password' | 'confirmPassword'
> {
  const errors: ValidationErrors<
    'fullName' | 'email' | 'campusId' | 'department' | 'password' | 'confirmPassword'
  > = {};

  if (values.fullName.trim().length < 2) {
    errors.fullName = 'Enter your full legal name as printed on your campus ID.';
  }
  if (!values.email.trim()) {
    errors.email = 'University email is required.';
  } else if (!isValidUniversityEmail(values.email)) {
    errors.email = 'Use an official .edu or university-issued email address.';
  }
  if (!/^[A-Z0-9-]{5,32}$/i.test(values.campusId.trim())) {
    errors.campusId = 'Enter a valid Campus ID (5-32 alphanumeric characters, e.g. STU-20481).';
  }
  if (!values.department.trim()) {
    errors.department = 'Select or enter your academic department.';
  }
  if (values.password.length < 8) {
    errors.password = 'Create a password with at least 8 characters.';
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(values.password)) {
    errors.password = 'Password must include uppercase, lowercase, and at least one number.';
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateSelectedImages(
  files: File[],
  existingCount = 0,
): string | undefined {
  if (existingCount + files.length > MAX_UPLOAD_IMAGES) {
    return `You can attach up to ${MAX_UPLOAD_IMAGES} photographs per report.`;
  }
  for (const file of files) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
      return `"${file.name}" is not a supported image format. Use JPEG, PNG, or WebP.`;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      return `"${file.name}" exceeds the 5 MB per-photo limit.`;
    }
  }
  return undefined;
}

export function validateItemReportForm(
  values: CreateItemReportInput,
): ValidationErrors<
  | 'title'
  | 'category'
  | 'building'
  | 'specificLocation'
  | 'dateOccurred'
  | 'timeWindow'
  | 'description'
  | 'distinguishingFeatures'
  | 'images'
> {
  const errors: ValidationErrors<
    | 'title'
    | 'category'
    | 'building'
    | 'specificLocation'
    | 'dateOccurred'
    | 'timeWindow'
    | 'description'
    | 'distinguishingFeatures'
    | 'images'
  > = {};

  if (values.title.trim().length < 4) {
    errors.title = 'Provide a clear item title (at least 4 characters).';
  }
  if (!values.category) {
    errors.category = 'Select an item category.';
  }
  if (!values.building) {
    errors.building = 'Select the campus building or zone.';
  }
  if (values.specificLocation.trim().length < 3) {
    errors.specificLocation = 'Specify the room, floor, or nearby landmark.';
  }
  if (!values.dateOccurred) {
    errors.dateOccurred = 'Select the date the item was lost or found.';
  }
  if (!values.timeWindow.trim()) {
    errors.timeWindow = 'Select an approximate time window.';
  }
  if (values.description.trim().length < 15) {
    errors.description = 'Add a concise description (at least 15 characters) to help matching.';
  }
  if (values.distinguishingFeatures.trim().length < 8) {
    errors.distinguishingFeatures =
      'Include unique marks, stickers, engraving, or contents for verification.';
  }

  if (values.imageFiles && values.imageFiles.length > 0) {
    const imgError = validateSelectedImages(values.imageFiles, 0);
    if (imgError) {
      errors.images = imgError;
    }
  }

  return errors;
}

export function validateEditItemForm(
  values: Omit<UpdateItemReportInput, 'id'>,
  remainingExistingCount: number,
): ValidationErrors<
  | 'title'
  | 'specificLocation'
  | 'dateOccurred'
  | 'timeWindow'
  | 'description'
  | 'distinguishingFeatures'
  | 'images'
> {
  const errors: ValidationErrors<
    | 'title'
    | 'specificLocation'
    | 'dateOccurred'
    | 'timeWindow'
    | 'description'
    | 'distinguishingFeatures'
    | 'images'
  > = {};

  if ((values.title ?? '').trim().length < 4) {
    errors.title = 'Item title must be at least 4 characters.';
  }
  if ((values.specificLocation ?? '').trim().length < 3) {
    errors.specificLocation = 'Specify the room, floor, or nearby landmark.';
  }
  if (!values.dateOccurred) {
    errors.dateOccurred = 'Select a valid date.';
  }
  if (!(values.timeWindow ?? '').trim()) {
    errors.timeWindow = 'Select an approximate time window.';
  }
  if ((values.description ?? '').trim().length < 15) {
    errors.description = 'Description must be at least 15 characters.';
  }
  if ((values.distinguishingFeatures ?? '').trim().length < 8) {
    errors.distinguishingFeatures =
      'Distinguishing marks must be at least 8 characters.';
  }
  if (values.imageFiles && values.imageFiles.length > 0) {
    const imgError = validateSelectedImages(values.imageFiles, remainingExistingCount);
    if (imgError) {
      errors.images = imgError;
    }
  }
  return errors;
}

export function validateEvidenceFiles(files: File[]): string | undefined {
  if (files.length > MAX_EVIDENCE_FILES) {
    return `You can attach up to ${MAX_EVIDENCE_FILES} supporting evidence files per claim.`;
  }
  for (const file of files) {
    if (
      !ALLOWED_EVIDENCE_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number],
      )
    ) {
      return `"${file.name}" is not a supported evidence format. Use JPEG, PNG, WebP, or PDF.`;
    }
    if (file.size <= 0 || file.size > MAX_EVIDENCE_SIZE_BYTES) {
      return `"${file.name}" exceeds the 5 MB per-file limit.`;
    }
  }
  return undefined;
}

export function validateClaimForm(
  values: Omit<SubmitClaimInput, 'itemId'>,
): ValidationErrors<
  | 'ownershipStatement'
  | 'identifyingProof'
  | 'serialOrMark'
  | 'preferredPickupWindow'
  | 'evidenceFiles'
> {
  const errors: ValidationErrors<
    | 'ownershipStatement'
    | 'identifyingProof'
    | 'serialOrMark'
    | 'preferredPickupWindow'
    | 'evidenceFiles'
  > = {};

  if (values.ownershipStatement.trim().length < 20) {
    errors.ownershipStatement =
      'Explain when and where you misplaced the item (minimum 20 characters).';
  }
  if (values.identifyingProof.trim().length < 12) {
    errors.identifyingProof =
      'Describe hidden or non-public contents, lock screen, or wear marks.';
  }
  if (values.serialOrMark.trim().length < 2) {
    errors.serialOrMark = 'Provide a serial fragment, monogram, or "Not applicable".';
  }
  if (!values.preferredPickupWindow.trim()) {
    errors.preferredPickupWindow = 'Select a preferred Campus Safety desk pickup window.';
  }
  if (values.evidenceFiles && values.evidenceFiles.length > 0) {
    const fileError = validateEvidenceFiles(values.evidenceFiles);
    if (fileError) {
      errors.evidenceFiles = fileError;
    }
  }

  return errors;
}
