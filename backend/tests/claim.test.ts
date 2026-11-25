import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import bcrypt from 'bcrypt';
import {
  AuditAction,
  ClaimStatus,
  ItemStatus,
  ReportType,
  UserRole,
  type ClaimEvidence,
  type ItemImage,
  type User,
} from '@prisma/client';
import { createApp } from '../src/app.js';
import type {
  AuditLogFilterCriteria,
  AuditLogRepository,
  AuditLogWithActor,
  AuthRepository,
  CategoryDto,
  ClaimFilterCriteria,
  ClaimRepository,
  ClaimWithRelations,
  CreateClaimRecord,
  CreateItemRecord,
  CreateStudentUserRecord,
  ItemFilterCriteria,
  ItemRepository,
  ItemWithRelations,
  LocationDto,
  ReturnItemCustodyRecord,
  ReviewClaimUpdateRecord,
  SafeAuditLogResponse,
  SafeClaimResponse,
  SafeUserProfile,
  UpdateItemRecord,
} from '../src/models/index.js';
import {
  validateUploadedEvidenceFile,
  type EvidenceStorageAdapter,
  type StorageAdapter,
  type StoredClaimEvidenceMetadata,
  type UploadImageFileInput,
} from '../src/services/storage.service.js';
import { ALLOWED_CATEGORY_NAMES } from '../src/validators/item.validator.js';

process.env.NODE_ENV = 'test';
process.env.ALLOWED_EMAIL_DOMAINS = 'university.edu,safety.university.edu';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const VALID_PDF_BYTES = Buffer.from('%PDF-1.4\n%CampusFindReceipt\n', 'ascii');

class InMemoryAuthRepository implements AuthRepository {
  public users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findByCampusId(campusId: string): Promise<SafeUserProfile | null> {
    const found = this.users.find((u) => u.campusId === campusId);
    if (!found) return null;
    const { passwordHash: _omitted, ...safe } = found;
    return safe;
  }

  async findSafeById(id: string): Promise<SafeUserProfile | null> {
    const found = this.users.find((u) => u.id === id);
    if (!found) return null;
    const { passwordHash: _omitted, ...safe } = found;
    return safe;
  }

  async createStudentAndAudit(
    data: CreateStudentUserRecord,
  ): Promise<SafeUserProfile> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email,
      campusId: data.campusId,
      fullName: data.fullName,
      department: data.department,
      role: UserRole.STUDENT,
      passwordHash: data.passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    const { passwordHash: _omitted, ...safe } = user;
    return safe;
  }

  seedUser(user: User) {
    this.users.push(user);
  }
}

class InMemoryEvidenceStorageAdapter
  implements StorageAdapter, EvidenceStorageAdapter
{
  public privateEvidenceKeys: string[] = [];
  public signedUrlCalls: string[] = [];

  async uploadItemImages() {
    return [];
  }
  async deleteItemImages() {}

  async uploadClaimEvidenceFiles(
    claimId: string,
    files: UploadImageFileInput[],
  ): Promise<StoredClaimEvidenceMetadata[]> {
    const results: StoredClaimEvidenceMetadata[] = [];
    for (const file of files) {
      const format = validateUploadedEvidenceFile(file);
      const storageKey = `claims/${claimId}/${randomUUID()}.${format.extension}`;
      this.privateEvidenceKeys.push(storageKey);
      results.push({
        storageKey,
        mimeType: format.mimeType,
        fileSize: file.size,
        extension: format.extension,
      });
    }
    return results;
  }

  async deleteClaimEvidenceFiles(storageKeys: string[]): Promise<void> {
    this.privateEvidenceKeys = this.privateEvidenceKeys.filter(
      (k) => !storageKeys.includes(k),
    );
  }

  async createSignedEvidenceUrl(
    storageKey: string,
    expiresInSeconds = 120,
  ): Promise<string | null> {
    this.signedUrlCalls.push(storageKey);
    if (!this.privateEvidenceKeys.includes(storageKey)) return null;
    return `https://example.supabase.co/storage/v1/object/sign/campusfind-claim-evidence/${storageKey}?token=signed-ttl-${expiresInSeconds}`;
  }
}

class InMemoryItemRepository implements ItemRepository {
  public categories: CategoryDto[] = ALLOWED_CATEGORY_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: `${name} items`,
  }));

  public locations: LocationDto[] = [
    {
      id: randomUUID(),
      code: 'LOC-LIB',
      buildingName: 'Main University Library',
      zoneName: 'Academic Commons',
      custodyDesk: 'Main Library Front Desk',
    },
  ];

  public items: ItemWithRelations[] = [];

  constructor(private readonly authRepo: InMemoryAuthRepository) {}

  async listActiveCategories() {
    return this.categories;
  }
  async listActiveLocations() {
    return this.locations;
  }
  async findCategoryByIdOrName(input: {
    categoryId?: string;
    categoryName?: string;
  }) {
    if (input.categoryId) {
      return this.categories.find((c) => c.id === input.categoryId) ?? null;
    }
    if (input.categoryName) {
      return (
        this.categories.find(
          (c) => c.name.toLowerCase() === input.categoryName?.toLowerCase(),
        ) ?? null
      );
    }
    return null;
  }
  async findLocationByIdOrBuilding(input: {
    locationId?: string;
    building?: string;
  }) {
    if (input.locationId) {
      return this.locations.find((l) => l.id === input.locationId) ?? null;
    }
    if (input.building) {
      return (
        this.locations.find(
          (l) => l.buildingName.toLowerCase() === input.building?.toLowerCase(),
        ) ?? null
      );
    }
    return null;
  }
  async listItems(criteria: ItemFilterCriteria) {
    return { items: this.items.slice(0, criteria.limit), total: this.items.length };
  }
  async findByIdWithRelations(id: string) {
    return this.items.find((i) => i.id === id) ?? null;
  }
  async createItemAndAudit(data: CreateItemRecord): Promise<ItemWithRelations> {
    const now = new Date();
    const cat = this.categories.find((c) => c.id === data.categoryId)!;
    const loc = this.locations.find((l) => l.id === data.locationId)!;
    const user = this.authRepo.users.find((u) => u.id === data.reportedById)!;
    const images: ItemImage[] = [];
    const item: ItemWithRelations = {
      id: data.id,
      referenceCode: data.referenceCode,
      reportType: data.reportType,
      title: data.title,
      description: data.description,
      distinguishingFeatures: data.distinguishingFeatures,
      verificationPrompt: data.verificationPrompt ?? null,
      specificSpot: data.specificSpot,
      custodyLocation: data.custodyLocation ?? null,
      occurredDate: data.occurredDate,
      timeWindow: data.timeWindow,
      status: ItemStatus.ACTIVE,
      reportedById: data.reportedById,
      categoryId: data.categoryId,
      locationId: data.locationId,
      createdAt: now,
      updatedAt: now,
      category: { ...cat, isActive: true, createdAt: now, updatedAt: now },
      location: { ...loc, isActive: true, createdAt: now, updatedAt: now },
      images,
      reportedBy: {
        id: user.id,
        fullName: user.fullName,
        department: user.department,
      },
    };
    this.items.push(item);
    return item;
  }
  async updateItemAndAudit(id: string, _actorId: string, _data: UpdateItemRecord) {
    return {
      item: this.items.find((i) => i.id === id)!,
      removedStorageKeys: [],
    };
  }
  async withdrawItemAndAudit(id: string) {
    const item = this.items.find((i) => i.id === id)!;
    item.status = ItemStatus.CLOSED;
    return item;
  }
}

class InMemoryClaimAndAuditRepository
  implements ClaimRepository, AuditLogRepository
{
  public claims: ClaimWithRelations[] = [];
  public auditLogs: AuditLogWithActor[] = [];

  constructor(
    private readonly authRepo: InMemoryAuthRepository,
    private readonly itemRepo: InMemoryItemRepository,
  ) {}

  private appendAudit(entry: {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    summary: string;
    itemId?: string | null;
    claimId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const actor = this.authRepo.users.find((u) => u.id === entry.actorId)!;
    const item = entry.itemId
      ? this.itemRepo.items.find((i) => i.id === entry.itemId) ?? null
      : null;
    const claim = entry.claimId
      ? this.claims.find((c) => c.id === entry.claimId) ?? null
      : null;

    this.auditLogs.unshift({
      id: randomUUID(),
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      metadata: entry.metadata ?? null,
      itemId: entry.itemId ?? null,
      matchId: null,
      claimId: entry.claimId ?? null,
      createdAt: new Date(),
      actor: {
        id: actor.id,
        fullName: actor.fullName,
        role: actor.role,
      },
      item: item
        ? { referenceCode: item.referenceCode, title: item.title }
        : null,
      claim: claim ? { claimCode: claim.claimCode } : null,
    });
  }

  async findTargetItemForClaim(itemId: string) {
    return this.itemRepo.items.find((i) => i.id === itemId) ?? null;
  }

  async findActiveClaimForItemAndClaimant(
    itemId: string,
    claimantId: string,
  ) {
    return (
      this.claims.find(
        (c) =>
          c.itemId === itemId &&
          c.claimantId === claimantId &&
          (c.status === ClaimStatus.PENDING ||
            c.status === ClaimStatus.UNDER_REVIEW ||
            c.status === ClaimStatus.APPROVED),
      ) ?? null
    );
  }

  async findApprovedClaimForItem(itemId: string) {
    return (
      this.claims.find(
        (c) => c.itemId === itemId && c.status === ClaimStatus.APPROVED,
      ) ?? null
    );
  }

  async createClaimAndAudit(
    data: CreateClaimRecord,
  ): Promise<ClaimWithRelations> {
    const now = new Date();
    const item = this.itemRepo.items.find((i) => i.id === data.itemId)!;
    const claimant = this.authRepo.users.find((u) => u.id === data.claimantId)!;

    const evidences: ClaimEvidence[] = data.evidences.map((ev) => ({
      id: randomUUID(),
      claimId: data.id,
      evidenceType: ev.evidenceType,
      label: ev.label,
      details: ev.details,
      storageKey: ev.storageKey ?? null,
      mimeType: ev.mimeType ?? null,
      fileSize: ev.fileSize ?? null,
      externalUrl: null,
      verifiedByReviewer: false,
      createdAt: now,
    }));

    const claim: ClaimWithRelations = {
      id: data.id,
      claimCode: data.claimCode,
      itemId: data.itemId,
      claimantId: data.claimantId,
      ownershipStatement: data.ownershipStatement,
      preferredPickupWindow: data.preferredPickupWindow,
      pickupDesk: data.pickupDesk,
      status: ClaimStatus.PENDING,
      reviewedById: null,
      reviewerNote: null,
      rejectionReason: null,
      reviewedAt: null,
      collectedAt: null,
      createdAt: now,
      updatedAt: now,
      item,
      claimant: {
        id: claimant.id,
        fullName: claimant.fullName,
        email: claimant.email,
        campusId: claimant.campusId,
        department: claimant.department,
      },
      reviewedBy: null,
      evidences,
    };

    if (
      item.status === ItemStatus.ACTIVE ||
      item.status === ItemStatus.POTENTIAL_MATCH
    ) {
      item.status = ItemStatus.CLAIM_PENDING;
    }

    this.claims.unshift(claim);
    this.appendAudit({
      actorId: data.claimantId,
      action: AuditAction.CLAIM_SUBMITTED,
      entityType: 'Claim',
      entityId: claim.id,
      claimId: claim.id,
      itemId: item.id,
      summary: `Submitted ownership claim ${claim.claimCode} for ${item.referenceCode}.`,
      metadata: {
        claimCode: claim.claimCode,
        referenceCode: item.referenceCode,
      },
    });

    return claim;
  }

  async listClaims(criteria: ClaimFilterCriteria) {
    let filtered = [...this.claims];
    if (criteria.claimantId) {
      filtered = filtered.filter((c) => c.claimantId === criteria.claimantId);
    }
    if (criteria.status !== 'ALL') {
      filtered = filtered.filter((c) => c.status === criteria.status);
    }
    if (criteria.search) {
      const q = criteria.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.claimCode.toLowerCase().includes(q) ||
          c.item.title.toLowerCase().includes(q) ||
          c.claimant.fullName.toLowerCase().includes(q),
      );
    }
    const total = filtered.length;
    const skip = (criteria.page - 1) * criteria.limit;
    return {
      claims: filtered.slice(skip, skip + criteria.limit),
      total,
    };
  }

  async findClaimByIdWithRelations(id: string) {
    return this.claims.find((c) => c.id === id) ?? null;
  }

  async reviewClaimAndAudit(
    data: ReviewClaimUpdateRecord,
  ): Promise<ClaimWithRelations> {
    const claim = this.claims.find((c) => c.id === data.claimId)!;
    const reviewer = this.authRepo.users.find((u) => u.id === data.reviewerId)!;
    const now = new Date();

    claim.status = data.nextStatus;
    claim.reviewedById = data.reviewerId;
    claim.reviewedAt = now;
    claim.updatedAt = now;
    if (data.reviewerNote !== undefined) {
      claim.reviewerNote = data.reviewerNote;
    }
    if (data.rejectionReason !== undefined) {
      claim.rejectionReason = data.rejectionReason;
    }
    claim.reviewedBy = {
      id: reviewer.id,
      fullName: reviewer.fullName,
      campusId: reviewer.campusId,
    };

    if (
      data.nextStatus === ClaimStatus.UNDER_REVIEW ||
      data.nextStatus === ClaimStatus.APPROVED
    ) {
      claim.item.status = ItemStatus.UNDER_VERIFICATION;
    } else if (data.nextStatus === ClaimStatus.REJECTED) {
      const hasOtherActive = this.claims.some(
        (c) =>
          c.itemId === claim.itemId &&
          c.id !== claim.id &&
          (c.status === ClaimStatus.PENDING ||
            c.status === ClaimStatus.UNDER_REVIEW ||
            c.status === ClaimStatus.APPROVED),
      );
      if (!hasOtherActive) {
        claim.item.status = ItemStatus.ACTIVE;
      }
    }

    this.appendAudit({
      actorId: data.reviewerId,
      action: data.auditAction,
      entityType: 'Claim',
      entityId: claim.id,
      claimId: claim.id,
      itemId: claim.itemId,
      summary: data.auditSummary,
      metadata: {
        claimCode: claim.claimCode,
        referenceCode: claim.item.referenceCode,
      },
    });

    return claim;
  }

  async markItemReturnedAndAudit(data: ReturnItemCustodyRecord) {
    const claim = this.claims.find((c) => c.id === data.claimId)!;
    const item = this.itemRepo.items.find((i) => i.id === data.itemId)!;
    const reviewer = this.authRepo.users.find((u) => u.id === data.adminId)!;
    const now = new Date();

    claim.status = ClaimStatus.RETURNED;
    claim.collectedAt = now;
    claim.reviewedById = data.adminId;
    claim.reviewedBy = {
      id: reviewer.id,
      fullName: reviewer.fullName,
      campusId: reviewer.campusId,
    };
    const handover = data.handoverNote?.trim()
      ? data.handoverNote.trim()
      : 'Physical Campus ID verified in person and custody released.';
    claim.reviewerNote = claim.reviewerNote
      ? `${claim.reviewerNote} · Handover: ${handover}`
      : handover;
    claim.updatedAt = now;

    // Reject competing open claims
    for (const other of this.claims) {
      if (
        other.itemId === item.id &&
        other.id !== claim.id &&
        (other.status === ClaimStatus.PENDING ||
          other.status === ClaimStatus.UNDER_REVIEW)
      ) {
        other.status = ClaimStatus.REJECTED;
        other.rejectionReason =
          'Item custody has been physically returned to the verified owner.';
        other.reviewedAt = now;
      }
    }

    item.status = ItemStatus.RETURNED;
    item.updatedAt = now;

    this.appendAudit({
      actorId: data.adminId,
      action: AuditAction.CUSTODY_RELEASED,
      entityType: 'Item',
      entityId: item.id,
      itemId: item.id,
      claimId: claim.id,
      summary: `Verified physical ID and returned ${item.referenceCode} via claim ${claim.claimCode}. ${handover}`,
      metadata: {
        referenceCode: item.referenceCode,
        claimCode: claim.claimCode,
      },
    });

    return { claim, item };
  }

  async listAuditLogs(criteria: AuditLogFilterCriteria) {
    let filtered = [...this.auditLogs];
    if (criteria.action !== 'ALL') {
      filtered = filtered.filter((l) => l.action === criteria.action);
    }
    if (criteria.entityType) {
      filtered = filtered.filter((l) => l.entityType === criteria.entityType);
    }
    const total = filtered.length;
    const skip = (criteria.page - 1) * criteria.limit;
    return {
      logs: filtered.slice(skip, skip + criteria.limit),
      total,
    };
  }
}

function parseSetCookieHeader(setCookies: string[]) {
  const jar: Record<string, string> = {};
  for (const rawCookie of setCookies) {
    const [pair] = rawCookie.split(';');
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      jar[pair.slice(0, eqIndex).trim()] = pair.slice(eqIndex + 1).trim();
    }
  }
  return jar;
}

async function loginAs(
  baseUrl: string,
  email: string,
  password: string,
): Promise<{ cookieHeader: string; csrfToken: string }> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  const cookies = parseSetCookieHeader(res.headers.getSetCookie());
  return {
    cookieHeader: `access_token=${cookies.access_token}; refresh_token=${cookies.refresh_token}; csrf_token=${cookies.csrf_token}`,
    csrfToken: cookies.csrf_token,
  };
}

const authRepo = new InMemoryAuthRepository();
const itemRepo = new InMemoryItemRepository(authRepo);
const claimAuditRepo = new InMemoryClaimAndAuditRepository(authRepo, itemRepo);
const evidenceStorage = new InMemoryEvidenceStorageAdapter();

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

const finderId = randomUUID();
const claimantId = randomUUID();
const thirdStudentId = randomUUID();
const adminId = randomUUID();

let foundItemId = '';
let lostItemId = '';

before(async () => {
  const passwordHash = await bcrypt.hash('StudentPass!123', 10);

  authRepo.seedUser({
    id: finderId,
    email: 'finder.noah@university.edu',
    campusId: 'STU-30001',
    fullName: 'Noah Patel',
    department: 'Electrical Engineering',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: claimantId,
    email: 'maya.lin@university.edu',
    campusId: 'STU-30002',
    fullName: 'Maya Lin',
    department: 'Computer Science',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: thirdStudentId,
    email: 'elena.gomez@university.edu',
    campusId: 'STU-30003',
    fullName: 'Elena Gomez',
    department: 'Architecture',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: adminId,
    email: 'admin.vance@safety.university.edu',
    campusId: 'STF-90001',
    fullName: 'Officer Daniel Vance',
    department: 'Campus Safety & Property Control',
    role: UserRole.ADMIN,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const foundItem = await itemRepo.createItemAndAudit({
    id: randomUUID(),
    referenceCode: 'FD-2026-8801',
    reportType: ReportType.FOUND,
    title: 'Silver 14-inch MacBook Pro',
    description: 'Silver laptop in dark navy felt sleeve left on library desk.',
    distinguishingFeatures:
      'SECRET-INTAKE-STICKER-HEXAGON and serial ending 7Q4M.',
    verificationPrompt: 'What sticker is inside the sleeve flap?',
    specificSpot: '2nd Floor East Reading Atrium',
    custodyLocation: 'Campus Safety Central Vault · Locker B-12',
    occurredDate: new Date('2026-11-24T00:00:00.000Z'),
    timeWindow: '14:00 - 15:30',
    reportedById: finderId,
    categoryId: itemRepo.categories[0].id,
    locationId: itemRepo.locations[0].id,
    images: [],
  });
  foundItemId = foundItem.id;

  const lostItem = await itemRepo.createItemAndAudit({
    id: randomUUID(),
    referenceCode: 'LF-2026-1101',
    reportType: ReportType.LOST,
    title: 'Lost MacBook Pro',
    description: 'Lost laptop in library.',
    distinguishingFeatures: 'Secret sticker',
    specificSpot: '2nd Floor',
    occurredDate: new Date('2026-11-24T00:00:00.000Z'),
    timeWindow: '14:00 - 15:30',
    reportedById: claimantId,
    categoryId: itemRepo.categories[0].id,
    locationId: itemRepo.locations[0].id,
    images: [],
  });
  lostItemId = lostItem.id;

  const app = createApp({
    authRepo,
    itemRepo,
    claimRepo: claimAuditRepo,
    auditRepo: claimAuditRepo,
    storage: evidenceStorage,
    evidenceStorage,
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('Claim submission validates inputs, blocks self-claims, blocks LOST reports, stores private evidence safely, and hides secret intake identifiers', async () => {
  const finderAuth = await loginAs(
    baseUrl,
    'finder.noah@university.edu',
    'StudentPass!123',
  );
  const claimantAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const adminAuth = await loginAs(
    baseUrl,
    'admin.vance@safety.university.edu',
    'StudentPass!123',
  );

  // 1. Unauthenticated -> 401
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/claims`, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId: foundItemId }),
      })
    ).status,
    401,
  );

  // 2. Admin cannot submit student claim -> 403
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/claims`, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          Cookie: adminAuth.cookieHeader,
          'X-CSRF-Token': adminAuth.csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: foundItemId,
          ownershipStatement: 'Admin testing claim submission blocked.',
          identifyingProof: 'Some proof string here.',
          serialOrMark: 'SN-1234',
          preferredPickupWindow: 'Weekdays 09:00 - 12:00',
        }),
      })
    ).status,
    403,
  );

  // 3. Finder cannot claim an item they reported as found -> 403
  const selfClaimRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: finderAuth.cookieHeader,
      'X-CSRF-Token': finderAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: foundItemId,
      ownershipStatement: 'Trying to claim the found item I reported myself.',
      identifyingProof: 'I saw the sticker when I picked it up.',
      serialOrMark: '7Q4M',
      preferredPickupWindow: 'Weekdays 09:00 - 12:00',
    }),
  });
  assert.equal(selfClaimRes.status, 403);
  assert.equal(
    ((await selfClaimRes.json()) as { error: { code: string } }).error.code,
    'CANNOT_CLAIM_OWN_FOUND_ITEM',
  );

  // 4. Cannot claim a LOST report -> 400
  const lostClaimRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: claimantAuth.cookieHeader,
      'X-CSRF-Token': claimantAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: lostItemId,
      ownershipStatement: 'Trying to submit a claim on a LOST report item.',
      identifyingProof: 'Hidden mark inside sleeve pocket.',
      serialOrMark: '7Q4M',
      preferredPickupWindow: 'Weekdays 09:00 - 12:00',
    }),
  });
  assert.equal(lostClaimRes.status, 400);

  // 5. Mass assignment attempt (status=APPROVED) -> 400
  const massRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: claimantAuth.cookieHeader,
      'X-CSRF-Token': claimantAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: foundItemId,
      ownershipStatement: 'Left my MacBook on table 14 after study session.',
      identifyingProof: 'Hexagon sticker inside sleeve flap.',
      serialOrMark: '7Q4M',
      preferredPickupWindow: 'Weekdays 09:00 - 12:00',
      status: 'APPROVED',
    }),
  });
  assert.equal(massRes.status, 400);

  // 6. Spoofed evidence signature (EXE/text pretending to be PDF) -> 400
  const spoofForm = new FormData();
  spoofForm.set('itemId', foundItemId);
  spoofForm.set(
    'ownershipStatement',
    'Left my MacBook on table 14 after CS study session.',
  );
  spoofForm.set(
    'identifyingProof',
    'Hexagon sticker inside sleeve flap and scuff on lid corner.',
  );
  spoofForm.set('serialOrMark', '7Q4M');
  spoofForm.set('preferredPickupWindow', 'Weekdays 09:00 - 12:00');
  spoofForm.append(
    'evidenceFiles',
    new Blob([Buffer.from('NOT-A-PDF-SCRIPT')], { type: 'application/pdf' }),
    '../../evil.pdf',
  );
  const spoofRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: claimantAuth.cookieHeader,
      'X-CSRF-Token': claimantAuth.csrfToken,
    },
    body: spoofForm,
  });
  assert.equal(spoofRes.status, 400);

  // 7. Valid multipart claim submission with PNG + PDF private evidence
  const form = new FormData();
  form.set('itemId', foundItemId);
  form.set(
    'ownershipStatement',
    'Left my Silver MacBook Pro on 2nd floor east table 14 after CS study group.',
  );
  form.set(
    'identifyingProof',
    'Hexagon robotics sticker inside magnetic sleeve flap and small lid scuff.',
  );
  form.set('serialOrMark', '7Q4M');
  form.set('preferredPickupWindow', 'Weekdays 09:00 - 12:00');
  form.append(
    'evidenceFiles',
    new Blob([VALID_PNG_BYTES], { type: 'image/png' }),
    '../../secret-wallpaper.png',
  );
  form.append(
    'evidenceFiles',
    new Blob([VALID_PDF_BYTES], { type: 'application/pdf' }),
    'purchase-receipt.pdf',
  );

  const submitRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: claimantAuth.cookieHeader,
      'X-CSRF-Token': claimantAuth.csrfToken,
    },
    body: form,
  });
  assert.equal(submitRes.status, 201);
  const submitBody = (await submitRes.json()) as {
    ok: boolean;
    data: { claim: SafeClaimResponse };
  };
  const claim = submitBody.data.claim;
  assert.equal(claim.status, ClaimStatus.PENDING);
  assert.equal(claim.itemStatus, ItemStatus.CLAIM_PENDING);
  assert.equal(claim.evidences.length, 4);

  // Hidden item-identification info must NEVER leak to claimant
  assert.equal('itemDistinguishingFeatures' in claim, false);
  assert.equal('itemVerificationPrompt' in claim, false);
  assert.equal(
    JSON.stringify(submitBody).includes('SECRET-INTAKE-STICKER-HEXAGON'),
    false,
  );

  // Private evidence keys are randomized and stored in private bucket
  assert.equal(evidenceStorage.privateEvidenceKeys.length, 2);
  assert.equal(
    evidenceStorage.privateEvidenceKeys.some((k) => k.includes('secret-wallpaper')),
    false,
  );
  assert.ok(
    claim.evidences.some((ev) => ev.hasPrivateFile && Boolean(ev.signedUrl)),
  );
});

test('Prevents duplicate active claims, blocks IDOR access to claim details and signed evidence URLs, and blocks unauthorized approvals', async () => {
  const claimantAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const otherStudentAuth = await loginAs(
    baseUrl,
    'elena.gomez@university.edu',
    'StudentPass!123',
  );

  const myClaim = claimAuditRepo.claims[0];
  assert.ok(myClaim);
  const privateEvidence = myClaim.evidences.find((e) => Boolean(e.storageKey))!;
  assert.ok(privateEvidence);

  // 1. Duplicate active claim by Maya for the same found item -> 409
  const dupRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: claimantAuth.cookieHeader,
      'X-CSRF-Token': claimantAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: foundItemId,
      ownershipStatement: 'Submitting a duplicate active claim on same item.',
      identifyingProof: 'Hexagon sticker inside sleeve flap.',
      serialOrMark: '7Q4M',
      preferredPickupWindow: 'Weekdays 09:00 - 12:00',
    }),
  });
  assert.equal(dupRes.status, 409);
  assert.equal(
    ((await dupRes.json()) as { error: { code: string } }).error.code,
    'DUPLICATE_ACTIVE_CLAIM',
  );

  // 2. IDOR: Elena cannot view Maya's claim -> 403
  const idorDetailRes = await fetch(`${baseUrl}/api/v1/claims/${myClaim.id}`, {
    headers: { Cookie: otherStudentAuth.cookieHeader },
  });
  assert.equal(idorDetailRes.status, 403);

  // 3. IDOR: Elena cannot request a signed URL for Maya's private evidence -> 403
  const signedCountBefore = evidenceStorage.signedUrlCalls.length;
  const idorEvidenceRes = await fetch(
    `${baseUrl}/api/v1/claims/${myClaim.id}/evidence/${privateEvidence.id}/url`,
    {
      headers: { Cookie: otherStudentAuth.cookieHeader },
    },
  );
  assert.equal(idorEvidenceRes.status, 403);
  // Signed URL adapter must NOT have been invoked before authorization check
  assert.equal(evidenceStorage.signedUrlCalls.length, signedCountBefore);

  // 4. Claimant CAN fetch their own claim & signed evidence URL (and still sees NO hidden item features)
  const ownerDetailRes = await fetch(`${baseUrl}/api/v1/claims/${myClaim.id}`, {
    headers: { Cookie: claimantAuth.cookieHeader },
  });
  assert.equal(ownerDetailRes.status, 200);
  const ownerDetailBody = (await ownerDetailRes.json()) as {
    data: { claim: SafeClaimResponse };
  };
  assert.equal('itemDistinguishingFeatures' in ownerDetailBody.data.claim, false);

  const ownerEvidenceRes = await fetch(
    `${baseUrl}/api/v1/claims/${myClaim.id}/evidence/${privateEvidence.id}/url`,
    {
      headers: { Cookie: claimantAuth.cookieHeader },
    },
  );
  assert.equal(ownerEvidenceRes.status, 200);
  const signedData = (await ownerEvidenceRes.json()) as {
    data: { signedUrl: string; expiresInSeconds: number };
  };
  assert.ok(signedData.data.signedUrl.includes('token=signed-ttl-120'));

  // 5. Unauthorized student attempts to approve own claim or access admin endpoints -> 403
  const studentAdminQueue = await fetch(`${baseUrl}/api/v1/admin/claims`, {
    headers: { Cookie: claimantAuth.cookieHeader },
  });
  assert.equal(studentAdminQueue.status, 403);

  const studentApprove = await fetch(
    `${baseUrl}/api/v1/admin/claims/${myClaim.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: claimantAuth.cookieHeader,
        'X-CSRF-Token': claimantAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    },
  );
  assert.equal(studentApprove.status, 403);

  const studentReturn = await fetch(
    `${baseUrl}/api/v1/admin/items/${foundItemId}/return`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: claimantAuth.cookieHeader,
        'X-CSRF-Token': claimantAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimId: myClaim.id,
        physicalIdVerified: true,
      }),
    },
  );
  assert.equal(studentReturn.status, 403);

  const studentAudit = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
    headers: { Cookie: claimantAuth.cookieHeader },
  });
  assert.equal(studentAudit.status, 403);
});

test('Admin review enforces state transitions, separates approval from physical return, updates audit logs, and blocks claiming returned items', async () => {
  const adminAuth = await loginAs(
    baseUrl,
    'admin.vance@safety.university.edu',
    'StudentPass!123',
  );
  const claimantAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const otherStudentAuth = await loginAs(
    baseUrl,
    'elena.gomez@university.edu',
    'StudentPass!123',
  );

  // Competing claim from Elena while Maya's claim is PENDING
  const competingRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: otherStudentAuth.cookieHeader,
      'X-CSRF-Token': otherStudentAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: foundItemId,
      ownershipStatement: 'I think I lost my laptop in the library as well.',
      identifyingProof: 'Black protective cover with blue sticker.',
      serialOrMark: '9911',
      preferredPickupWindow: 'Weekdays 12:00 - 16:30',
    }),
  });
  assert.equal(competingRes.status, 201);
  const competingClaim = (
    (await competingRes.json()) as { data: { claim: SafeClaimResponse } }
  ).data.claim;

  // Admin queue returns full private intake identifiers + signed evidence URLs
  const adminQueueRes = await fetch(`${baseUrl}/api/v1/admin/claims`, {
    headers: { Cookie: adminAuth.cookieHeader },
  });
  assert.equal(adminQueueRes.status, 200);
  const adminQueueBody = (await adminQueueRes.json()) as {
    data: { claims: SafeClaimResponse[] };
  };
  assert.equal(adminQueueBody.data.claims.length, 2);
  const mayaAdminView = adminQueueBody.data.claims.find(
    (c) => c.claimantEmail === 'maya.lin@university.edu',
  )!;
  assert.equal(
    mayaAdminView.itemDistinguishingFeatures,
    'SECRET-INTAKE-STICKER-HEXAGON and serial ending 7Q4M.',
  );

  // Rejecting without reason -> 400
  const missingReasonRes = await fetch(
    `${baseUrl}/api/v1/admin/claims/${competingClaim.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'REJECTED' }),
    },
  );
  assert.equal(missingReasonRes.status, 400);

  // Reject competing claim with reason
  const rejectRes = await fetch(
    `${baseUrl}/api/v1/admin/claims/${competingClaim.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: 'Serial suffix and sleeve color do not match intake log.',
      }),
    },
  );
  assert.equal(rejectRes.status, 200);

  // Invalid transition: REJECTED -> APPROVED must fail with 409
  const resurrectRes = await fetch(
    `${baseUrl}/api/v1/admin/claims/${competingClaim.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    },
  );
  assert.equal(resurrectRes.status, 409);

  // Cannot mark item RETURNED via /review endpoint -> 400
  const invalidReturnViaReview = await fetch(
    `${baseUrl}/api/v1/admin/claims/${mayaAdminView.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'RETURNED' }),
    },
  );
  assert.equal(invalidReturnViaReview.status, 400);

  // Move Maya's claim PENDING -> UNDER_REVIEW
  const underReviewRes = await fetch(
    `${baseUrl}/api/v1/admin/claims/${mayaAdminView.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        reviewerNote: 'Inspecting receipt PDF and vault sleeve.',
      }),
    },
  );
  assert.equal(underReviewRes.status, 200);

  // Attempting physical return BEFORE approval -> 409
  const prematureReturn = await fetch(
    `${baseUrl}/api/v1/admin/items/${foundItemId}/return`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimId: mayaAdminView.id,
        physicalIdVerified: true,
      }),
    },
  );
  assert.equal(prematureReturn.status, 409);

  // Approve Maya's claim -> UNDER_VERIFICATION, NOT RETURNED!
  const approveRes = await fetch(
    `${baseUrl}/api/v1/admin/claims/${mayaAdminView.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'APPROVED',
        reviewerNote: 'Proof verified. Bring Campus ID to Central Vault.',
      }),
    },
  );
  assert.equal(approveRes.status, 200);
  const approveData = (await approveRes.json()) as {
    data: { claim: SafeClaimResponse };
  };
  assert.equal(approveData.data.claim.status, ClaimStatus.APPROVED);
  assert.equal(
    approveData.data.claim.itemStatus,
    ItemStatus.UNDER_VERIFICATION,
  );
  assert.notEqual(approveData.data.claim.itemStatus, ItemStatus.RETURNED);

  // Physical return without physicalIdVerified: true -> 400
  const unverifiedHandover = await fetch(
    `${baseUrl}/api/v1/admin/items/${foundItemId}/return`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimId: mayaAdminView.id,
        physicalIdVerified: false,
      }),
    },
  );
  assert.equal(unverifiedHandover.status, 400);

  // Complete physical verification and return
  const returnRes = await fetch(
    `${baseUrl}/api/v1/admin/items/${foundItemId}/return`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimId: mayaAdminView.id,
        physicalIdVerified: true,
        handoverNote: 'Checked STU-30002 photo ID at Central Vault.',
      }),
    },
  );
  assert.equal(returnRes.status, 200);
  const returnBody = (await returnRes.json()) as {
    data: {
      claim: SafeClaimResponse;
      item: { status: ItemStatus };
    };
  };
  assert.equal(returnBody.data.claim.status, ClaimStatus.RETURNED);
  assert.equal(returnBody.data.item.status, ItemStatus.RETURNED);

  // Cannot transition a RETURNED claim -> 409
  const postReturnReview = await fetch(
    `${baseUrl}/api/v1/admin/claims/${mayaAdminView.id}/review`,
    {
      method: 'PATCH',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: adminAuth.cookieHeader,
        'X-CSRF-Token': adminAuth.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: 'Too late to reject after return.',
      }),
    },
  );
  assert.equal(postReturnReview.status, 409);

  // Cannot claim a RETURNED item -> 409
  const claimReturnedRes = await fetch(`${baseUrl}/api/v1/claims`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: otherStudentAuth.cookieHeader,
      'X-CSRF-Token': otherStudentAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      itemId: foundItemId,
      ownershipStatement: 'Trying to claim an item that was already returned.',
      identifyingProof: 'Some details about the laptop.',
      serialOrMark: '9911',
      preferredPickupWindow: 'Weekdays 09:00 - 12:00',
    }),
  });
  assert.equal(claimReturnedRes.status, 409);

  // Claimant sees updated RETURNED status and reviewer feedback in GET /api/v1/claims/my
  const myClaimsRes = await fetch(`${baseUrl}/api/v1/claims/my`, {
    headers: { Cookie: claimantAuth.cookieHeader },
  });
  assert.equal(myClaimsRes.status, 200);
  const myClaimsBody = (await myClaimsRes.json()) as {
    data: { claims: SafeClaimResponse[] };
  };
  assert.equal(myClaimsBody.data.claims[0].status, ClaimStatus.RETURNED);
  assert.ok(myClaimsBody.data.claims[0].reviewerNote?.includes('STU-30002'));

  // Audit logs record submission, rejection, review, approval, and custody release
  const auditRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
    headers: { Cookie: adminAuth.cookieHeader },
  });
  assert.equal(auditRes.status, 200);
  const auditBody = (await auditRes.json()) as {
    data: { logs: SafeAuditLogResponse[] };
  };
  const actions = auditBody.data.logs.map((l) => l.action);
  assert.ok(actions.includes(AuditAction.CLAIM_SUBMITTED));
  assert.ok(actions.includes(AuditAction.CLAIM_REJECTED));
  assert.ok(actions.includes(AuditAction.CLAIM_REVIEWED));
  assert.ok(actions.includes(AuditAction.CLAIM_APPROVED));
  assert.ok(actions.includes(AuditAction.CUSTODY_RELEASED));
});
