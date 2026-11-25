import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  FilePlus2,
  FileSearch,
  ImagePlus,
  LogIn,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
} from '../../components/ui/DataStates';
import { InputField, SelectField, TextareaField } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Modal';
import { ItemStatusLabel } from '../../components/ui/StatusLabel';
import {
  useItemMetadataQuery,
  useStudentReportsQuery,
  useUpdateItemReportMutation,
  useWithdrawItemReportMutation,
} from '../../hooks/useCampusFindQueries';
import { ApiClientError } from '../../services/apiClient';
import type { CampusItem, ItemCategory, ReportType } from '../../types/domain';
import {
  CAMPUS_BUILDINGS,
  ITEM_CATEGORIES,
  formatReportTypeLabel,
  formatShortDate,
} from '../../utils/formatters';
import {
  MAX_UPLOAD_IMAGES,
  validateEditItemForm,
  validateSelectedImages,
  type ValidationErrors,
} from '../../utils/validators';

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

export function MyReportsPage() {
  const [typeFilter, setTypeFilter] = useState<'ALL' | ReportType>('ALL');
  const { data, isLoading, error, refetch } = useStudentReportsQuery({
    reportType: typeFilter,
  });
  const metadataQuery = useItemMetadataQuery();
  const updateMutation = useUpdateItemReportMutation();
  const withdrawMutation = useWithdrawItemReportMutation();

  const [editingItem, setEditingItem] = useState<CampusItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<ItemCategory>('Electronics');
  const [editBuilding, setEditBuilding] = useState('');
  const [editLocationId, setEditLocationId] = useState<string | undefined>(undefined);
  const [editSpot, setEditSpot] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTimeWindow, setEditTimeWindow] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFeatures, setEditFeatures] = useState('');
  const [editVerificationPrompt, setEditVerificationPrompt] = useState('');
  const [editCustodyLocation, setEditCustodyLocation] = useState('');
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [editErrors, setEditErrors] = useState<ValidationErrors<string>>({});
  const [editApiError, setEditApiError] = useState<string | null>(null);

  const [withdrawingItem, setWithdrawingItem] = useState<CampusItem | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const reports = data?.items ?? [];

  const categories = useMemo(() => {
    if (metadataQuery.data?.categories.length) {
      return metadataQuery.data.categories;
    }
    return ITEM_CATEGORIES.map((name) => ({ id: '', name, slug: '', description: null }));
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
      custodyDesk: null,
    }));
  }, [metadataQuery.data]);

  const isAuthError = error instanceof ApiClientError && error.status === 401;

  const openEditModal = (item: CampusItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditBuilding(item.building);
    setEditLocationId(item.locationId);
    setEditSpot(item.specificLocation);
    setEditDate(item.dateOccurred);
    setEditTimeWindow(item.timeWindow);
    setEditDescription(item.description);
    setEditFeatures(item.distinguishingFeatures ?? '');
    setEditVerificationPrompt(item.verificationPrompt ?? '');
    setEditCustodyLocation(item.custodyLocation ?? '');
    setRemovedImageIds([]);
    setNewFiles([]);
    setEditErrors({});
    setEditApiError(null);
  };

  const remainingExistingImages = useMemo(() => {
    if (!editingItem) return [];
    const removed = new Set(removedImageIds);
    return editingItem.images.filter((img) => !removed.has(img.id));
  }, [editingItem, removedImageIds]);

  const handleEditFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (incoming.length === 0) return;

    const combined = [...newFiles, ...incoming];
    const imgErr = validateSelectedImages(combined, remainingExistingImages.length);
    if (imgErr) {
      setEditErrors((prev) => ({ ...prev, images: imgErr }));
      return;
    }

    setNewFiles(combined);
    setEditErrors((prev) => {
      const next = { ...prev };
      delete next.images;
      return next;
    });
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;
    setEditApiError(null);

    const payload = {
      title: editTitle,
      category: editCategory,
      categoryId: categories.find((c) => c.name === editCategory)?.id || undefined,
      building: editBuilding,
      locationId: editLocationId,
      specificLocation: editSpot,
      dateOccurred: editDate,
      timeWindow: editTimeWindow,
      description: editDescription,
      distinguishingFeatures: editFeatures,
      verificationQuestion:
        editingItem.reportType === 'FOUND' ? editVerificationPrompt : undefined,
      custodyLocation:
        editingItem.reportType === 'FOUND' ? editCustodyLocation : undefined,
      removeImageIds: removedImageIds.length > 0 ? removedImageIds : undefined,
      imageFiles: newFiles.length > 0 ? newFiles : undefined,
    };

    const validationErrors = validateEditItemForm(
      payload,
      remainingExistingImages.length,
    );
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    setEditErrors({});
    try {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        ...payload,
      });
      setEditingItem(null);
    } catch (err) {
      setEditApiError(
        err instanceof Error ? err.message : 'Unable to save report changes.',
      );
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!withdrawingItem) return;
    setWithdrawError(null);
    try {
      await withdrawMutation.mutateAsync(withdrawingItem.id);
      setWithdrawingItem(null);
    } catch (err) {
      setWithdrawError(
        err instanceof Error ? err.message : 'Unable to withdraw this report.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Reports"
        description="Manage lost and found submissions filed under your university account, update eligible details, or withdraw active reports."
        actions={
          <>
            <Link to="/student/report-found">
              <Button variant="outline" size="sm">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Report Found</span>
              </Button>
            </Link>
            <Link to="/student/report-lost">
              <Button size="sm">
                <FileSearch className="h-4 w-4" aria-hidden="true" />
                <span>Report Lost</span>
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Filter personal reports"
          className="inline-flex items-center rounded-md border border-[#CBD5E1] bg-white p-1"
        >
          {(['ALL', 'LOST', 'FOUND'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                typeFilter === type
                  ? 'bg-[#1E40AF] text-white'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {type === 'ALL' ? 'All Reports' : type === 'LOST' ? 'Lost' : 'Found'}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#64748B] tabular-nums">
          {reports.length} {reports.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {isAuthError ? (
        <EmptyState
          title="Sign in to view your reports"
          description="Your personal lost and found reports are protected. Sign in with your university email to review, edit, or withdraw reports."
          action={
            <Link to="/login">
              <Button size="sm">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Sign In</span>
              </Button>
            </Link>
          }
        />
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TableSkeleton rows={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports filed yet"
          description="Any lost item or found property reports you submit will appear in this log."
          action={
            <Link to="/student/report-lost">
              <Button size="sm">File First Lost Report</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#475569]">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Item</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Campus Location</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-[#0F172A] tabular-nums whitespace-nowrap">
                    {report.referenceCode}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#0F172A]">{report.title}</p>
                    <p className="text-xs text-[#64748B]">{report.category}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#475569] whitespace-nowrap">
                    {formatReportTypeLabel(report.reportType)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#475569]">
                    {report.building}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                    {formatShortDate(report.dateOccurred)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <ItemStatusLabel status={report.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      {report.isEditable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(report)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#334155] hover:text-[#1E40AF] cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWithdrawError(null);
                              setWithdrawingItem(report);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C] hover:underline cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Withdraw</span>
                          </button>
                        </>
                      ) : null}
                      <Link
                        to={`/student/items/${report.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1E40AF] hover:underline"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Eligible Report Modal */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={`Edit Report ${editingItem?.referenceCode ?? ''}`}
        subtitle="Only active reports or reports with pending match suggestions can be edited."
      >
        <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
          {editApiError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
              <span>{editApiError}</span>
            </div>
          ) : null}

          <InputField
            id="edit-title"
            label="Item Name"
            required
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            error={editErrors.title}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="edit-category"
              label="Category"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as ItemCategory)}
            >
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="edit-building"
              label="Campus Building"
              value={editLocationId || editBuilding}
              onChange={(e) => {
                const val = e.target.value;
                const matched =
                  locations.find((l) => l.id && l.id === val) ??
                  locations.find((l) => l.buildingName === val);
                setEditBuilding(matched?.buildingName ?? val);
                setEditLocationId(matched?.id || undefined);
              }}
            >
              {locations.map((loc) => (
                <option key={loc.id || loc.buildingName} value={loc.id || loc.buildingName}>
                  {loc.buildingName}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InputField
              id="edit-date"
              label="Date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              error={editErrors.dateOccurred}
            />
            <SelectField
              id="edit-time"
              label="Time Window"
              value={editTimeWindow}
              onChange={(e) => setEditTimeWindow(e.target.value)}
              error={editErrors.timeWindow}
            >
              {TIME_WINDOWS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </SelectField>
            <InputField
              id="edit-spot"
              label="Room / Spot"
              value={editSpot}
              onChange={(e) => setEditSpot(e.target.value)}
              error={editErrors.specificLocation}
            />
          </div>

          <TextareaField
            id="edit-description"
            label="Public Description"
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            error={editErrors.description}
          />

          <TextareaField
            id="edit-features"
            label="Distinguishing Marks (Private)"
            rows={2}
            value={editFeatures}
            onChange={(e) => setEditFeatures(e.target.value)}
            error={editErrors.distinguishingFeatures}
          />

          {editingItem?.reportType === 'FOUND' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField
                id="edit-prompt"
                label="Verification Prompt"
                value={editVerificationPrompt}
                onChange={(e) => setEditVerificationPrompt(e.target.value)}
              />
              <InputField
                id="edit-custody"
                label="Custody Desk"
                value={editCustodyLocation}
                onChange={(e) => setEditCustodyLocation(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2 border-t border-[#E2E8F0] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0F172A]">
                Photographs ({remainingExistingImages.length + newFiles.length}/{MAX_UPLOAD_IMAGES})
              </span>
            </div>

            {remainingExistingImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {remainingExistingImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative overflow-hidden rounded border border-[#E2E8F0]"
                  >
                    <img
                      src={img.publicUrl}
                      alt={img.altText ?? 'Report photo'}
                      className="h-16 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setRemovedImageIds((prev) => [...prev, img.id])}
                      aria-label="Remove existing photograph"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-[#0F172A]/75 text-white hover:bg-[#DC2626] cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {newFiles.length > 0 ? (
              <div className="space-y-1 text-xs text-[#475569]">
                {newFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {remainingExistingImages.length + newFiles.length < MAX_UPLOAD_IMAGES ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#1E40AF] hover:bg-[#EFF6FF]">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                <span>Add Photograph</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleEditFilesChange}
                  className="sr-only"
                />
              </label>
            ) : null}

            {editErrors.images ? (
              <p className="text-xs text-[#DC2626]">{editErrors.images}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Withdraw Confirmation Modal */}
      <Modal
        isOpen={Boolean(withdrawingItem)}
        onClose={() => setWithdrawingItem(null)}
        title="Withdraw Active Report"
        subtitle={
          withdrawingItem
            ? `${withdrawingItem.referenceCode} · ${withdrawingItem.title}`
            : undefined
        }
      >
        <div className="space-y-4">
          {withdrawError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
              <span>{withdrawError}</span>
            </div>
          ) : null}

          <p className="text-sm text-[#475569] leading-relaxed">
            Withdrawing this report marks it as <strong className="text-[#0F172A]">CLOSED</strong> and removes it from public campus inventory search. This action is logged for audit accountability.
          </p>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWithdrawingItem(null)}
            >
              Keep Report Active
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={withdrawMutation.isPending}
              onClick={() => void handleConfirmWithdraw()}
            >
              {withdrawMutation.isPending ? 'Withdrawing...' : 'Confirm Withdrawal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
