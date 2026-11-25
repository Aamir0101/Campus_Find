export type UserRole = 'STUDENT' | 'STAFF' | 'ADMIN';

export type PreviewStateMode = 'populated' | 'loading' | 'empty' | 'error';

export type ReportType = 'LOST' | 'FOUND';

export type ItemCategory =
  | 'Electronics'
  | 'ID Cards'
  | 'Wallets'
  | 'Bags'
  | 'Books'
  | 'Clothing'
  | 'Accessories'
  | 'Keys'
  | 'Other';

export type ItemStatus =
  | 'ACTIVE'
  | 'POTENTIAL_MATCH'
  | 'CLAIM_PENDING'
  | 'UNDER_VERIFICATION'
  | 'RETURNED'
  | 'CLOSED';

export type MatchClassification = 'HIGH MATCH' | 'POSSIBLE MATCH' | 'LOW MATCH';

export type MatchStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED' | 'RESOLVED';

export type ClaimStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED';

export type EvidenceType =
  | 'SERIAL_NUMBER'
  | 'RECEIPT'
  | 'PHOTO'
  | 'IDENTIFYING_MARK'
  | 'OTHER';

export type AuditActionType =
  | 'USER_REGISTERED'
  | 'REPORT_CREATED'
  | 'REPORT_UPDATED'
  | 'REPORT_STATUS_CHANGED'
  | 'MATCH_CREATED'
  | 'MATCH_REVIEWED'
  | 'CLAIM_SUBMITTED'
  | 'CLAIM_REVIEWED'
  | 'CLAIM_APPROVED'
  | 'CLAIM_REJECTED'
  | 'CUSTODY_RELEASED';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  campusId: string;
  department: string;
  role: UserRole;
  isActive?: boolean;
}

export interface CategoryOption {
  id: string;
  name: ItemCategory;
  slug: string;
  description: string | null;
}

export interface LocationOption {
  id: string;
  code: string;
  buildingName: string;
  zoneName: string;
  custodyDesk: string | null;
}

export interface ItemMetadataResponse {
  categories: CategoryOption[];
  locations: LocationOption[];
}

export interface ItemImageRecord {
  id: string;
  publicUrl: string;
  mimeType: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface CampusItem {
  id: string;
  referenceCode: string;
  reportType: ReportType;
  title: string;
  categoryId?: string;
  category: ItemCategory;
  locationId?: string;
  building: string;
  zoneName?: string;
  specificLocation: string;
  custodyLocation?: string | null;
  dateOccurred: string;
  timeWindow: string;
  description: string;
  distinguishingFeatures?: string;
  verificationPrompt?: string | null;
  status: ItemStatus;
  reporterAffiliation: string;
  isOwner?: boolean;
  isEditable?: boolean;
  images: ItemImageRecord[];
  imageUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ItemFilters {
  search: string;
  reportType: 'ALL' | ReportType;
  category: 'ALL' | ItemCategory;
  building: string;
  status: 'ALL' | ItemStatus;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedItemsResponse {
  items: CampusItem[];
  pagination: PaginationMeta;
}

export interface CreateItemReportInput {
  reportType: ReportType;
  title: string;
  category: ItemCategory;
  categoryId?: string;
  building: string;
  locationId?: string;
  specificLocation: string;
  dateOccurred: string;
  timeWindow: string;
  description: string;
  distinguishingFeatures: string;
  verificationQuestion?: string;
  custodyLocation?: string;
  imageFiles?: File[];
}

export interface UpdateItemReportInput {
  id: string;
  title?: string;
  category?: ItemCategory;
  categoryId?: string;
  building?: string;
  locationId?: string;
  specificLocation?: string;
  dateOccurred?: string;
  timeWindow?: string;
  description?: string;
  distinguishingFeatures?: string;
  verificationQuestion?: string;
  custodyLocation?: string;
  removeImageIds?: string[];
  imageFiles?: File[];
}

export interface MatchSignal {
  label: string;
  weight: number;
  score: number;
  detail: string;
  matched: boolean;
}

export interface PotentialMatch {
  id: string;
  lostItemId: string;
  foundItemId: string;
  lostItem: CampusItem;
  foundItem: CampusItem;
  similarityScore: number;
  classification: MatchClassification;
  status: MatchStatus;
  notice: string;
  signals: MatchSignal[];
  detectedAt: string;
  updatedAt: string;
}

export interface PaginatedMatchesResponse {
  matches: PotentialMatch[];
  pagination: PaginationMeta;
}

export interface ClaimEvidenceRecord {
  id: string;
  evidenceType: EvidenceType;
  label: string;
  details: string;
  mimeType: string | null;
  fileSize: number | null;
  hasPrivateFile: boolean;
  signedUrl?: string | null;
  verifiedByReviewer: boolean;
  createdAt: string;
}

export interface ClaimRecord {
  id: string;
  claimCode: string;
  itemId: string;
  itemTitle: string;
  itemReferenceCode: string;
  itemCategory: ItemCategory;
  itemStatus: ItemStatus;
  building: string;
  custodyLocation: string | null;
  itemDistinguishingFeatures?: string;
  itemVerificationPrompt?: string | null;
  claimantId?: string;
  claimantName?: string;
  claimantEmail?: string;
  claimantCampusId?: string;
  claimantDepartment?: string;
  ownershipStatement: string;
  identifyingProof: string;
  serialOrMark: string;
  preferredPickupWindow: string;
  pickupDesk: string | null;
  status: ClaimStatus;
  reviewerNote: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  collectedAt: string | null;
  submittedAt: string;
  updatedAt: string;
  evidences: ClaimEvidenceRecord[];
}

export interface PaginatedClaimsResponse {
  claims: ClaimRecord[];
  pagination: PaginationMeta;
}

export interface SubmitClaimInput {
  itemId: string;
  ownershipStatement: string;
  identifyingProof: string;
  serialOrMark: string;
  preferredPickupWindow: string;
  evidenceNote?: string;
  evidenceFiles?: File[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditActionType;
  entityType: string;
  entityId: string;
  targetCode: string;
  targetSummary: string;
  details: string;
  metadata?: unknown;
}

export interface PaginatedAuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: PaginationMeta;
}
