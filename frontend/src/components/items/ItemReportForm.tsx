import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  LogIn,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  useCreateItemReportMutation,
  useCurrentUserQuery,
  useItemMetadataQuery,
} from '../../hooks/useCampusFindQueries';
import type {
  CampusItem,
  CreateItemReportInput,
  ItemCategory,
  ReportType,
} from '../../types/domain';
import { CAMPUS_BUILDINGS, ITEM_CATEGORIES } from '../../utils/formatters';
import {
  MAX_UPLOAD_IMAGES,
  validateItemReportForm,
  validateSelectedImages,
  type ValidationErrors,
} from '../../utils/validators';
import { Button } from '../ui/Button';
import { InputField, SelectField, TextareaField } from '../ui/FormControls';

const TIME_WINDOWS = [
  '06:00 - 08:00',
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 23:00',
];

interface SelectedImagePreview {
  file: File;
  previewUrl: string;
}

export function ItemReportForm({ reportType }: { reportType: ReportType }) {
  const isLost = reportType === 'LOST';
  const createMutation = useCreateItemReportMutation();
  const metadataQuery = useItemMetadataQuery();
  const { data: currentUser } = useCurrentUserQuery();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const categories = useMemo(() => {
    if (metadataQuery.data?.categories.length) {
      return metadataQuery.data.categories;
    }
    return ITEM_CATEGORIES.map((name) => ({
      id: '',
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: null,
    }));
  }, [metadataQuery.data]);

  const locations = useMemo(() => {
    if (metadataQuery.data?.locations.length) {
      return metadataQuery.data.locations;
    }
    return CAMPUS_BUILDINGS.map((buildingName) => ({
      id: '',
      code: '',
      buildingName,
      zoneName: 'Campus Zone',
      custodyDesk: `${buildingName} Desk`,
    }));
  }, [metadataQuery.data]);

  const [formState, setFormState] = useState<CreateItemReportInput>({
    reportType,
    title: '',
    category: 'Electronics',
    building: CAMPUS_BUILDINGS[0],
    specificLocation: '',
    dateOccurred: todayIso,
    timeWindow: '10:00 - 12:00',
    description: '',
    distinguishingFeatures: '',
    verificationQuestion: '',
    custodyLocation: '',
    imageFiles: [],
  });

  const [selectedImages, setSelectedImages] = useState<SelectedImagePreview[]>([]);
  const [errors, setErrors] = useState<ValidationErrors<string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [createdRecord, setCreatedRecord] = useState<CampusItem | null>(null);

  useEffect(() => {
    if (!metadataQuery.data) return;
    setFormState((prev) => {
      const matchedCat =
        metadataQuery.data.categories.find((c) => c.name === prev.category) ??
        metadataQuery.data.categories[0];
      const matchedLoc =
        metadataQuery.data.locations.find((l) => l.buildingName === prev.building) ??
        metadataQuery.data.locations[0];
      return {
        ...prev,
        category: matchedCat?.name ?? prev.category,
        categoryId: matchedCat?.id || undefined,
        building: matchedLoc?.buildingName ?? prev.building,
        locationId: matchedLoc?.id || undefined,
      };
    });
  }, [metadataQuery.data]);

  useEffect(() => {
    return () => {
      for (const item of selectedImages) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [selectedImages]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (incoming.length === 0) return;

    const combinedFiles = [...selectedImages.map((s) => s.file), ...incoming];
    const imageError = validateSelectedImages(combinedFiles, 0);
    if (imageError) {
      setErrors((prev) => ({ ...prev, images: imageError }));
      return;
    }

    const nextPreviews = incoming.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const updated = [...selectedImages, ...nextPreviews];
    setSelectedImages(updated);
    setFormState((prev) => ({
      ...prev,
      imageFiles: updated.map((item) => item.file),
    }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.images;
      return copy;
    });
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((_, idx) => idx !== index);
      setFormState((f) => ({ ...f, imageFiles: next.map((item) => item.file) }));
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);

    const validationErrors = validateItemReportForm(formState);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    try {
      const created = await createMutation.mutateAsync(formState);
      for (const item of selectedImages) {
        URL.revokeObjectURL(item.previewUrl);
      }
      setSelectedImages([]);
      setCreatedRecord(created);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : 'Unable to submit item report. Please try again.',
      );
    }
  };

  if (createdRecord) {
    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              {isLost ? 'Lost Item Report Submitted' : 'Found Item Report Submitted'}
            </h2>
            <p className="text-sm text-[#475569]">
              Reference code{' '}
              <span className="font-mono font-semibold text-[#0F172A]">
                {createdRecord.referenceCode}
              </span>{' '}
              has been saved for{' '}
              <span className="font-medium text-[#0F172A]">{createdRecord.building}</span>.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Link to={`/student/items/${createdRecord.id}`}>
                <Button size="sm">View Item Record</Button>
              </Link>
              <Link to="/student/reports">
                <Button variant="outline" size="sm">
                  Go to My Reports
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreatedRecord(null);
                  setFormState((prev) => ({
                    ...prev,
                    title: '',
                    specificLocation: '',
                    description: '',
                    distinguishingFeatures: '',
                    verificationQuestion: '',
                    custodyLocation: '',
                    imageFiles: [],
                  }));
                }}
              >
                File Another Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      {!currentUser ? (
        <div className="lg:col-span-12 flex flex-col gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-xs text-[#1E3A8A]">
            <LogIn className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Student authentication is required to submit lost or found reports. Sign in with your university email before submitting.
            </span>
          </div>
          <Link to="/login" className="shrink-0">
            <Button size="sm" variant="primary">
              Sign In to Submit
            </Button>
          </Link>
        </div>
      ) : null}

      {apiError ? (
        <div
          role="alert"
          className="lg:col-span-12 flex items-start gap-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-xs text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      ) : null}

      <div className="space-y-6 lg:col-span-8">
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
          <div className="border-b border-[#F1F5F9] pb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">
              01. Item Identification
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Provide accurate public descriptors so campus staff and fellow students can identify matching records.
            </p>
          </div>

          <InputField
            id="report-title"
            label="Item Name"
            required
            placeholder={
              isLost
                ? 'e.g., Silver 14-inch Laptop in Navy Sleeve'
                : 'e.g., Matte Black Over-Ear Headphones'
            }
            value={formState.title}
            onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
            error={errors.title}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="report-category"
              label="Category"
              required
              value={formState.category}
              onChange={(e) => {
                const selectedName = e.target.value as ItemCategory;
                const matched = categories.find((c) => c.name === selectedName);
                setFormState((prev) => ({
                  ...prev,
                  category: selectedName,
                  categoryId: matched?.id || undefined,
                }));
              }}
              error={errors.category}
            >
              {categories.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="report-building"
              label="Campus Building / Zone"
              required
              value={formState.locationId || formState.building}
              onChange={(e) => {
                const val = e.target.value;
                const matched =
                  locations.find((l) => l.id && l.id === val) ??
                  locations.find((l) => l.buildingName === val);
                setFormState((prev) => ({
                  ...prev,
                  building: matched?.buildingName ?? val,
                  locationId: matched?.id || undefined,
                }));
              }}
              error={errors.building}
            >
              {locations.map((loc) => (
                <option key={loc.id || loc.buildingName} value={loc.id || loc.buildingName}>
                  {loc.buildingName} ({loc.zoneName})
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <InputField
                id="report-date"
                label={isLost ? 'Date Lost' : 'Date Found'}
                type="date"
                required
                value={formState.dateOccurred}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, dateOccurred: e.target.value }))
                }
                error={errors.dateOccurred}
              />
            </div>

            <div className="sm:col-span-1">
              <SelectField
                id="report-time"
                label="Approximate Time"
                required
                value={formState.timeWindow}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, timeWindow: e.target.value }))
                }
                error={errors.timeWindow}
              >
                {TIME_WINDOWS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="sm:col-span-1">
              <InputField
                id="report-location"
                label="Floor / Room / Spot"
                required
                placeholder="e.g., 2nd Floor Study Table 14"
                value={formState.specificLocation}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    specificLocation: e.target.value,
                  }))
                }
                error={errors.specificLocation}
              />
            </div>
          </div>

          <TextareaField
            id="report-description"
            label="Public Description"
            required
            rows={3}
            placeholder="Describe color, brand, size, and surrounding context when lost or found..."
            value={formState.description}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, description: e.target.value }))
            }
            error={errors.description}
          />
        </section>

        <section className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
          <div className="border-b border-[#F1F5F9] pb-4">
            <h2 className="text-base font-semibold text-[#0F172A]">
              02. Verification &amp; Custody Details
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Distinguishing details stay private from public browsing and are used to verify rightful ownership.
            </p>
          </div>

          <TextareaField
            id="report-features"
            label="Distinguishing Marks or Private Contents"
            required
            rows={3}
            placeholder="Stickers, serial tail digits, scratches, engraved initials, or items inside pockets..."
            hint="Avoid posting full government ID numbers or passwords."
            value={formState.distinguishingFeatures}
            onChange={(e) =>
              setFormState((prev) => ({
                ...prev,
                distinguishingFeatures: e.target.value,
              }))
            }
            error={errors.distinguishingFeatures}
          />

          {!isLost ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="report-question"
                label="Ownership Challenge Prompt (Optional)"
                placeholder="e.g., What sticker is inside the sleeve flap?"
                value={formState.verificationQuestion ?? ''}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    verificationQuestion: e.target.value,
                  }))
                }
              />

              <InputField
                id="report-custody"
                label="Custody Drop-Off Desk (Optional)"
                placeholder="e.g., Main Library Front Desk"
                value={formState.custodyLocation ?? ''}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    custodyLocation: e.target.value,
                  }))
                }
              />
            </div>
          ) : null}
        </section>
      </div>

      <aside className="space-y-6 lg:col-span-4">
        <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#0F172A]">Item Photographs</h2>
            <span className="text-xs text-[#64748B] tabular-nums">
              {selectedImages.length}/{MAX_UPLOAD_IMAGES}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[#64748B]">
            Upload up to {MAX_UPLOAD_IMAGES} photos (JPEG, PNG, or WebP, max 5 MB each). For found items, avoid showing full serial numbers.
          </p>

          {selectedImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {selectedImages.map((img, index) => (
                <div
                  key={`${img.file.name}-${index}`}
                  className="group relative overflow-hidden rounded-md border border-[#E2E8F0] bg-[#F8FAFC]"
                >
                  <img
                    src={img.previewUrl}
                    alt={`Selected upload ${index + 1}`}
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    aria-label={`Remove photograph ${index + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded bg-[#0F172A]/75 text-white hover:bg-[#DC2626] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {selectedImages.length < MAX_UPLOAD_IMAGES ? (
            <label
              htmlFor="report-photo-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center transition-colors hover:border-[#1E40AF] hover:bg-[#EFF6FF]/40"
            >
              <ImagePlus className="mb-2 h-6 w-6 text-[#64748B]" aria-hidden="true" />
              <span className="text-xs font-medium text-[#1E40AF]">
                {selectedImages.length > 0
                  ? 'Add another photograph'
                  : 'Select photographs from device'}
              </span>
              <span className="mt-1 text-[11px] text-[#64748B]">
                JPEG, PNG, or WebP up to 5 MB
              </span>
              <input
                id="report-photo-upload"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="sr-only"
              />
            </label>
          ) : null}

          {errors.images ? (
            <p className="text-xs text-[#DC2626]" role="alert">
              {errors.images}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#0F172A]">
                Privacy &amp; Custody Safeguard
              </h3>
              <p className="text-xs leading-relaxed text-[#475569]">
                Your email and Campus ID remain hidden from public listings. Private distinguishing marks are visible only to you and Campus Safety reviewers.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? 'Submitting Report...'
                : isLost
                  ? 'Submit Lost Item Report'
                  : 'Submit Found Item Report'}
            </Button>
          </div>
        </div>
      </aside>
    </form>
  );
}
