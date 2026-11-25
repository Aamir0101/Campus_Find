import type {
  AuditAction,
  AuditLog,
  Category,
  Claim,
  ClaimEvidence,
  ClaimStatus,
  EvidenceType,
  Item,
  ItemImage,
  ItemStatus,
  Location,
  MatchStatus,
  ReportType,
  User,
  UserRole,
} from '@prisma/client';

export {
  AuditAction,
  ClaimStatus,
  EvidenceType,
  ItemStatus,
  MatchStatus,
  Prisma,
  ReportType,
  UserRole,
  type AuditLog,
  type Category,
  type Claim,
  type ClaimEvidence,
  type Item,
  type ItemImage,
  type Location,
  type Match,
  type User,
} from '@prisma/client';

export type SafeUserProfile = Omit<User, 'passwordHash'>;

export interface AuthenticatedUser {
  id: string;
  email: string;
  campusId: string;
  fullName: string;
  department: string;
  role: UserRole;
  isActive: boolean;
}

export interface DatabaseReadinessReport {
  status: 'connected' | 'unconfigured_or_unreachable';
  latencyMs: number;
  message: string;
}

export interface CreateStudentUserRecord {
  email: string;
  campusId: string;
  fullName: string;
  department: string;
  passwordHash: string;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<User | null>;
  findByCampusId(campusId: string): Promise<SafeUserProfile | null>;
  findSafeById(id: string): Promise<SafeUserProfile | null>;
  createStudentAndAudit(data: CreateStudentUserRecord): Promise<SafeUserProfile>;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface LocationDto {
  id: string;
  code: string;
  buildingName: string;
  zoneName: string;
  custodyDesk: string | null;
}

export interface ItemImageDto {
  id: string;
  publicUrl: string;
  mimeType: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface SafeItemResponse {
  id: string;
  referenceCode: string;
  reportType: ReportType;
  title: string;
  categoryId: string;
  category: string;
  locationId: string;
  building: string;
  zoneName: string;
  specificSpot: string;
  custodyLocation: string | null;
  occurredDate: string;
  timeWindow: string;
  description: string;
  distinguishingFeatures?: string;
  verificationPrompt?: string | null;
  status: ItemStatus;
  reporterAffiliation: string;
  isOwner: boolean;
  isEditable: boolean;
  images: ItemImageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemWithRelations extends Item {
  category: Category;
  location: Location;
  images: ItemImage[];
  reportedBy: {
    id: string;
    fullName: string;
    department: string;
  };
}

export interface CreateItemImageRecord {
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  altText?: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface CreateItemRecord {
  id: string;
  referenceCode: string;
  reportType: ReportType;
  title: string;
  description: string;
  distinguishingFeatures: string;
  verificationPrompt?: string | null;
  specificSpot: string;
  custodyLocation?: string | null;
  occurredDate: Date;
  timeWindow: string;
  reportedById: string;
  categoryId: string;
  locationId: string;
  images: CreateItemImageRecord[];
}

export interface UpdateItemRecord {
  title?: string;
  categoryId?: string;
  locationId?: string;
  specificSpot?: string;
  occurredDate?: Date;
  timeWindow?: string;
  description?: string;
  distinguishingFeatures?: string;
  verificationPrompt?: string | null;
  custodyLocation?: string | null;
  removeImageIds?: string[];
  addImages?: CreateItemImageRecord[];
}

export interface ItemFilterCriteria {
  search?: string;
  reportType: 'ALL' | 'LOST' | 'FOUND';
  category?: string;
  building?: string;
  locationId?: string;
  status: 'ALL' | ItemStatus;
  reportedById?: string;
  includeClosed: boolean;
  page: number;
  limit: number;
}

export interface ItemRepository {
  listActiveCategories(): Promise<CategoryDto[]>;
  listActiveLocations(): Promise<LocationDto[]>;
  findCategoryByIdOrName(input: {
    categoryId?: string;
    categoryName?: string;
  }): Promise<CategoryDto | null>;
  findLocationByIdOrBuilding(input: {
    locationId?: string;
    building?: string;
  }): Promise<LocationDto | null>;
  listItems(criteria: ItemFilterCriteria): Promise<{
    items: ItemWithRelations[];
    total: number;
  }>;
  findByIdWithRelations(id: string): Promise<ItemWithRelations | null>;
  createItemAndAudit(data: CreateItemRecord): Promise<ItemWithRelations>;
  updateItemAndAudit(
    id: string,
    actorId: string,
    data: UpdateItemRecord,
  ): Promise<{ item: ItemWithRelations; removedStorageKeys: string[] }>;
  withdrawItemAndAudit(
    id: string,
    actorId: string,
    previousStatus: ItemStatus,
  ): Promise<ItemWithRelations>;
}

export type MatchClassification = 'HIGH MATCH' | 'POSSIBLE MATCH' | 'LOW MATCH';

export interface MatchSignalBreakdown {
  label: string;
  weight: number;
  score: number;
  detail: string;
  matched: boolean;
}

export interface MatchWithRelations {
  id: string;
  lostItemId: string;
  foundItemId: string;
  similarityScore: number;
  matchedSignals: unknown;
  status: MatchStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lostItem: ItemWithRelations;
  foundItem: ItemWithRelations;
}

export interface SafeMatchResponse {
  id: string;
  lostItemId: string;
  foundItemId: string;
  similarityScore: number;
  classification: MatchClassification;
  status: MatchStatus;
  notice: string;
  signals: MatchSignalBreakdown[];
  lostItem: SafeItemResponse;
  foundItem: SafeItemResponse;
  detectedAt: string;
  updatedAt: string;
}

export interface UpsertMatchRecord {
  lostItemId: string;
  foundItemId: string;
  similarityScore: number;
  matchedSignals: MatchSignalBreakdown[];
}

export interface MatchFilterCriteria {
  viewerUserId?: string;
  isAdmin: boolean;
  status: 'ALL' | 'ACTIVE' | MatchStatus;
  itemId?: string;
  page: number;
  limit: number;
}

export interface MatchRepository {
  findSourceItem(itemId: string): Promise<ItemWithRelations | null>;
  findActiveOppositeItems(
    oppositeType: ReportType,
    excludeItemId: string,
  ): Promise<ItemWithRelations[]>;
  upsertMatch(data: UpsertMatchRecord): Promise<MatchWithRelations>;
  deleteStalePendingMatches(
    sourceItemId: string,
    keepPairItemIds: string[],
  ): Promise<number>;
  countActiveMatchesForItem(itemId: string): Promise<number>;
  syncItemPotentialMatchStatus(itemId: string): Promise<void>;
  listMatches(criteria: MatchFilterCriteria): Promise<{
    matches: MatchWithRelations[];
    total: number;
  }>;
  findMatchById(id: string): Promise<MatchWithRelations | null>;
  updateMatchStatusAndAudit(
    id: string,
    status: MatchStatus,
    actorId: string,
  ): Promise<MatchWithRelations>;
}

export interface ClaimEvidenceDto {
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

export interface ClaimWithRelations extends Claim {
  item: ItemWithRelations;
  claimant: {
    id: string;
    fullName: string;
    email: string;
    campusId: string;
    department: string;
  };
  reviewedBy: {
    id: string;
    fullName: string;
    campusId: string;
  } | null;
  evidences: ClaimEvidence[];
}

export interface SafeClaimResponse {
  id: string;
  claimCode: string;
  itemId: string;
  itemTitle: string;
  itemReferenceCode: string;
  itemCategory: string;
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
  evidences: ClaimEvidenceDto[];
}

export interface CreateClaimEvidenceRecord {
  evidenceType: EvidenceType;
  label: string;
  details: string;
  storageKey?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface CreateClaimRecord {
  id: string;
  claimCode: string;
  itemId: string;
  claimantId: string;
  ownershipStatement: string;
  preferredPickupWindow: string;
  pickupDesk: string | null;
  evidences: CreateClaimEvidenceRecord[];
}

export interface ClaimFilterCriteria {
  claimantId?: string;
  status: 'ALL' | ClaimStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface ReviewClaimUpdateRecord {
  claimId: string;
  nextStatus: ClaimStatus;
  reviewerId: string;
  reviewerNote?: string | null;
  rejectionReason?: string | null;
  auditAction: AuditAction;
  auditSummary: string;
}

export interface ReturnItemCustodyRecord {
  itemId: string;
  claimId: string;
  adminId: string;
  handoverNote?: string | null;
}

export interface ClaimRepository {
  findTargetItemForClaim(itemId: string): Promise<ItemWithRelations | null>;
  findActiveClaimForItemAndClaimant(
    itemId: string,
    claimantId: string,
  ): Promise<ClaimWithRelations | null>;
  findApprovedClaimForItem(itemId: string): Promise<ClaimWithRelations | null>;
  createClaimAndAudit(data: CreateClaimRecord): Promise<ClaimWithRelations>;
  listClaims(criteria: ClaimFilterCriteria): Promise<{
    claims: ClaimWithRelations[];
    total: number;
  }>;
  findClaimByIdWithRelations(id: string): Promise<ClaimWithRelations | null>;
  reviewClaimAndAudit(
    data: ReviewClaimUpdateRecord,
  ): Promise<ClaimWithRelations>;
  markItemReturnedAndAudit(
    data: ReturnItemCustodyRecord,
  ): Promise<{ claim: ClaimWithRelations; item: ItemWithRelations }>;
}

export interface AuditLogWithActor extends AuditLog {
  actor: {
    id: string;
    fullName: string;
    role: UserRole;
  };
  item: { referenceCode: string; title: string } | null;
  claim: { claimCode: string } | null;
}

export interface SafeAuditLogResponse {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  targetCode: string;
  targetSummary: string;
  details: string;
  metadata: unknown;
}

export interface AuditLogFilterCriteria {
  action: 'ALL' | AuditAction;
  entityType?: string;
  page: number;
  limit: number;
}

export interface AuditLogRepository {
  listAuditLogs(criteria: AuditLogFilterCriteria): Promise<{
    logs: AuditLogWithActor[];
    total: number;
  }>;
}



