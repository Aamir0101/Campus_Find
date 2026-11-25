import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import bcrypt from 'bcrypt';
import {
  ItemStatus,
  MatchStatus,
  ReportType,
  UserRole,
  type ItemImage,
  type User,
} from '@prisma/client';
import { createApp } from '../src/app.js';
import type {
  AuthRepository,
  CategoryDto,
  CreateItemRecord,
  CreateStudentUserRecord,
  ItemFilterCriteria,
  ItemRepository,
  ItemWithRelations,
  LocationDto,
  MatchFilterCriteria,
  MatchRepository,
  MatchWithRelations,
  SafeMatchResponse,
  SafeUserProfile,
  UpdateItemRecord,
  UpsertMatchRecord,
} from '../src/models/index.js';
import {
  evaluateItemMatch,
  MATCH_ADVISORY_NOTICE,
  MIN_PERSISTED_MATCH_SCORE,
} from '../src/services/matching.service.js';
import type { StorageAdapter } from '../src/services/storage.service.js';
import { ALLOWED_CATEGORY_NAMES } from '../src/validators/item.validator.js';

process.env.NODE_ENV = 'test';
process.env.ALLOWED_EMAIL_DOMAINS = 'university.edu,safety.university.edu';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:3000';

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

class NoopStorageAdapter implements StorageAdapter {
  async uploadItemImages() {
    return [];
  }
  async deleteItemImages() {}
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
    {
      id: randomUUID(),
      code: 'LOC-SCI',
      buildingName: 'Science & Innovation Center',
      zoneName: 'North Lab Wing',
      custodyDesk: 'Science Center Security Kiosk',
    },
    {
      id: randomUUID(),
      code: 'LOC-ARC',
      buildingName: 'Athletics & Recreation Center',
      zoneName: 'South Campus Athletics',
      custodyDesk: 'Recreation Front Desk',
    },
  ];

  public items: ItemWithRelations[] = [];

  constructor(private readonly authRepo: InMemoryAuthRepository) {}

  async listActiveCategories(): Promise<CategoryDto[]> {
    return this.categories;
  }

  async listActiveLocations(): Promise<LocationDto[]> {
    return this.locations;
  }

  async findCategoryByIdOrName(input: {
    categoryId?: string;
    categoryName?: string;
  }): Promise<CategoryDto | null> {
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
  }): Promise<LocationDto | null> {
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
    let filtered = [...this.items];
    if (criteria.reportedById) {
      filtered = filtered.filter((i) => i.reportedById === criteria.reportedById);
    }
    if (criteria.reportType !== 'ALL') {
      filtered = filtered.filter((i) => i.reportType === criteria.reportType);
    }
    if (!criteria.includeClosed) {
      filtered = filtered.filter(
        (i) =>
          i.status !== ItemStatus.CLOSED && i.status !== ItemStatus.RETURNED,
      );
    }
    return {
      items: filtered,
      total: filtered.length,
    };
  }

  async findByIdWithRelations(id: string): Promise<ItemWithRelations | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async createItemAndAudit(data: CreateItemRecord): Promise<ItemWithRelations> {
    const now = new Date();
    const cat = this.categories.find((c) => c.id === data.categoryId)!;
    const loc = this.locations.find((l) => l.id === data.locationId)!;
    const user = this.authRepo.users.find((u) => u.id === data.reportedById)!;
    const images: ItemImage[] = data.images.map((img) => ({
      id: randomUUID(),
      itemId: data.id,
      storageKey: img.storageKey,
      publicUrl: img.publicUrl,
      mimeType: img.mimeType,
      altText: img.altText ?? null,
      displayOrder: img.displayOrder,
      isPrimary: img.isPrimary,
      createdAt: now,
    }));

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
      category: {
        ...cat,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        ...loc,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
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

  async updateItemAndAudit(
    id: string,
    _actorId: string,
    data: UpdateItemRecord,
  ): Promise<{ item: ItemWithRelations; removedStorageKeys: string[] }> {
    const idx = this.items.findIndex((i) => i.id === id);
    const existing = this.items[idx];
    const now = new Date();
    const cat = data.categoryId
      ? this.categories.find((c) => c.id === data.categoryId)!
      : existing.category;
    const loc = data.locationId
      ? this.locations.find((l) => l.id === data.locationId)!
      : existing.location;

    const updated: ItemWithRelations = {
      ...existing,
      title: data.title ?? existing.title,
      categoryId: data.categoryId ?? existing.categoryId,
      locationId: data.locationId ?? existing.locationId,
      specificSpot: data.specificSpot ?? existing.specificSpot,
      occurredDate: data.occurredDate ?? existing.occurredDate,
      timeWindow: data.timeWindow ?? existing.timeWindow,
      description: data.description ?? existing.description,
      distinguishingFeatures:
        data.distinguishingFeatures ?? existing.distinguishingFeatures,
      updatedAt: now,
      category: { ...existing.category, ...cat },
      location: { ...existing.location, ...loc },
    };

    this.items[idx] = updated;
    return { item: updated, removedStorageKeys: [] };
  }

  async withdrawItemAndAudit(
    id: string,
  ): Promise<ItemWithRelations> {
    const idx = this.items.findIndex((i) => i.id === id);
    const updated: ItemWithRelations = {
      ...this.items[idx],
      status: ItemStatus.CLOSED,
      updatedAt: new Date(),
    };
    this.items[idx] = updated;
    return updated;
  }
}

class InMemoryMatchRepository implements MatchRepository {
  public matches: Array<{
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
  }> = [];

  public auditEntries: Array<{ action: string; matchId: string; actorId: string }> =
    [];

  constructor(private readonly itemRepo: InMemoryItemRepository) {}

  private hydrate(
    raw: InMemoryMatchRepository['matches'][number],
  ): MatchWithRelations {
    const lostItem = this.itemRepo.items.find((i) => i.id === raw.lostItemId)!;
    const foundItem = this.itemRepo.items.find((i) => i.id === raw.foundItemId)!;
    return {
      ...raw,
      lostItem,
      foundItem,
    };
  }

  async findSourceItem(itemId: string): Promise<ItemWithRelations | null> {
    return this.itemRepo.items.find((i) => i.id === itemId) ?? null;
  }

  async findActiveOppositeItems(
    oppositeType: ReportType,
    excludeItemId: string,
  ): Promise<ItemWithRelations[]> {
    return this.itemRepo.items.filter(
      (i) =>
        i.reportType === oppositeType &&
        i.id !== excludeItemId &&
        i.status !== ItemStatus.CLOSED &&
        i.status !== ItemStatus.RETURNED,
    );
  }

  async upsertMatch(data: UpsertMatchRecord): Promise<MatchWithRelations> {
    const now = new Date();
    const existing = this.matches.find(
      (m) =>
        m.lostItemId === data.lostItemId && m.foundItemId === data.foundItemId,
    );

    if (existing) {
      existing.similarityScore = data.similarityScore;
      existing.matchedSignals = data.matchedSignals;
      existing.updatedAt = now;
      return this.hydrate(existing);
    }

    const created = {
      id: randomUUID(),
      lostItemId: data.lostItemId,
      foundItemId: data.foundItemId,
      similarityScore: data.similarityScore,
      matchedSignals: data.matchedSignals,
      status: MatchStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.matches.push(created);
    return this.hydrate(created);
  }

  async deleteStalePendingMatches(
    sourceItemId: string,
    keepPairItemIds: string[],
  ): Promise<number> {
    const keepSet = new Set(keepPairItemIds);
    const before = this.matches.length;
    this.matches = this.matches.filter((m) => {
      if (m.status !== MatchStatus.PENDING) return true;
      if (m.lostItemId === sourceItemId) return keepSet.has(m.foundItemId);
      if (m.foundItemId === sourceItemId) return keepSet.has(m.lostItemId);
      return true;
    });
    return before - this.matches.length;
  }

  async countActiveMatchesForItem(itemId: string): Promise<number> {
    return this.matches.filter((m) => {
      if (m.similarityScore < MIN_PERSISTED_MATCH_SCORE) return false;
      if (m.status === MatchStatus.DISMISSED) return false;
      if (m.lostItemId !== itemId && m.foundItemId !== itemId) return false;
      const hydrated = this.hydrate(m);
      return (
        hydrated.lostItem.status !== ItemStatus.CLOSED &&
        hydrated.lostItem.status !== ItemStatus.RETURNED &&
        hydrated.foundItem.status !== ItemStatus.CLOSED &&
        hydrated.foundItem.status !== ItemStatus.RETURNED
      );
    }).length;
  }

  async syncItemPotentialMatchStatus(itemId: string): Promise<void> {
    const item = this.itemRepo.items.find((i) => i.id === itemId);
    if (!item) return;
    if (
      item.status !== ItemStatus.ACTIVE &&
      item.status !== ItemStatus.POTENTIAL_MATCH
    ) {
      return;
    }
    const activeCount = await this.countActiveMatchesForItem(itemId);
    item.status =
      activeCount > 0 ? ItemStatus.POTENTIAL_MATCH : ItemStatus.ACTIVE;
  }

  async listMatches(criteria: MatchFilterCriteria) {
    const hydrated = this.matches.map((m) => this.hydrate(m));
    const filtered = hydrated.filter((m) => {
      if (m.similarityScore < MIN_PERSISTED_MATCH_SCORE) return false;
      if (
        m.lostItem.status === ItemStatus.CLOSED ||
        m.lostItem.status === ItemStatus.RETURNED ||
        m.foundItem.status === ItemStatus.CLOSED ||
        m.foundItem.status === ItemStatus.RETURNED
      ) {
        return false;
      }
      if (!criteria.isAdmin && criteria.viewerUserId) {
        if (
          m.lostItem.reportedById !== criteria.viewerUserId &&
          m.foundItem.reportedById !== criteria.viewerUserId
        ) {
          return false;
        }
      }
      if (criteria.itemId) {
        if (
          m.lostItemId !== criteria.itemId &&
          m.foundItemId !== criteria.itemId
        ) {
          return false;
        }
      }
      if (criteria.status === 'ACTIVE') {
        return (
          m.status === MatchStatus.PENDING || m.status === MatchStatus.CONFIRMED
        );
      }
      if (criteria.status !== 'ALL') {
        return m.status === criteria.status;
      }
      return true;
    });

    filtered.sort((a, b) => b.similarityScore - a.similarityScore);
    const total = filtered.length;
    const skip = (criteria.page - 1) * criteria.limit;
    return {
      matches: filtered.slice(skip, skip + criteria.limit),
      total,
    };
  }

  async findMatchById(id: string): Promise<MatchWithRelations | null> {
    const raw = this.matches.find((m) => m.id === id);
    return raw ? this.hydrate(raw) : null;
  }

  async updateMatchStatusAndAudit(
    id: string,
    status: MatchStatus,
    actorId: string,
  ): Promise<MatchWithRelations> {
    const raw = this.matches.find((m) => m.id === id)!;
    raw.status = status;
    raw.reviewedById = actorId;
    raw.reviewedAt = new Date();
    raw.updatedAt = new Date();
    this.auditEntries.push({ action: 'MATCH_REVIEWED', matchId: id, actorId });
    return this.hydrate(raw);
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

async function createReportViaApi(
  baseUrl: string,
  auth: { cookieHeader: string; csrfToken: string },
  payload: Record<string, string>,
) {
  const res = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: auth.cookieHeader,
      'X-CSRF-Token': auth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    ok: boolean;
    data: { item: { id: string; status: ItemStatus; referenceCode: string } };
  };
  return body.data.item;
}

const authRepo = new InMemoryAuthRepository();
const itemRepo = new InMemoryItemRepository(authRepo);
const matchRepo = new InMemoryMatchRepository(itemRepo);

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

const studentLostId = randomUUID();
const studentFoundId = randomUUID();
const studentThirdId = randomUUID();
const adminId = randomUUID();

before(async () => {
  const passwordHash = await bcrypt.hash('StudentPass!123', 10);

  authRepo.seedUser({
    id: studentLostId,
    email: 'maya.lin@university.edu',
    campusId: 'STU-20001',
    fullName: 'Maya Lin',
    department: 'Computer Science',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: studentFoundId,
    email: 'noah.patel@university.edu',
    campusId: 'STU-20002',
    fullName: 'Noah Patel',
    department: 'Electrical Engineering',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: studentThirdId,
    email: 'elena.gomez@university.edu',
    campusId: 'STU-20003',
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
    email: 'safety.admin@safety.university.edu',
    campusId: 'STF-90001',
    fullName: 'Campus Safety Admin',
    department: 'Campus Safety',
    role: UserRole.ADMIN,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const app = createApp({
    authRepo,
    itemRepo,
    matchRepo,
    storage: new NoopStorageAdapter(),
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

function buildTestItem(
  overrides: Partial<ItemWithRelations> & {
    reportType: ReportType;
    categoryName?: string;
    buildingName?: string;
    zoneName?: string;
  },
): ItemWithRelations {
  const now = new Date();
  const cat =
    itemRepo.categories.find(
      (c) => c.name === (overrides.categoryName ?? 'Electronics'),
    ) ?? itemRepo.categories[0];
  const loc =
    itemRepo.locations.find(
      (l) => l.buildingName === (overrides.buildingName ?? 'Main University Library'),
    ) ?? itemRepo.locations[0];

  return {
    id: overrides.id ?? randomUUID(),
    referenceCode: overrides.referenceCode ?? 'TST-001',
    reportType: overrides.reportType,
    title: overrides.title ?? 'Silver MacBook Pro 14-inch',
    description:
      overrides.description ??
      'Aluminum laptop inside a charcoal wool felt sleeve with USB-C charger.',
    distinguishingFeatures:
      overrides.distinguishingFeatures ?? 'Private sticker code XYZ-999 inside lid',
    verificationPrompt: overrides.verificationPrompt ?? null,
    specificSpot: overrides.specificSpot ?? '2nd Floor East Reading Table',
    custodyLocation: null,
    occurredDate: overrides.occurredDate ?? new Date('2026-11-24T00:00:00.000Z'),
    timeWindow: '14:00 - 15:30',
    status: overrides.status ?? ItemStatus.ACTIVE,
    reportedById: overrides.reportedById ?? studentLostId,
    categoryId: cat.id,
    locationId: loc.id,
    createdAt: now,
    updatedAt: now,
    category: { ...cat, isActive: true, createdAt: now, updatedAt: now },
    location: {
      ...loc,
      zoneName: overrides.zoneName ?? loc.zoneName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    images: [],
    reportedBy: {
      id: overrides.reportedById ?? studentLostId,
      fullName: 'Test Student',
      department: 'Computer Science',
    },
  };
}

test('Scoring engine evaluates weights accurately across category, name, description, location, date, and self/same-type rules', () => {
  const lostBase = buildTestItem({
    reportType: ReportType.LOST,
    categoryName: 'Electronics',
    buildingName: 'Main University Library',
    occurredDate: new Date('2026-11-24T00:00:00.000Z'),
  });

  // 1. High Match (80-100)
  const foundHigh = buildTestItem({
    reportType: ReportType.FOUND,
    categoryName: 'Electronics',
    buildingName: 'Main University Library',
    title: 'Space Gray MacBook Pro 14-inch Laptop',
    description:
      'Found aluminum laptop inside charcoal wool felt sleeve with USB-C charger on table.',
    specificSpot: '2nd Floor East Reading Table 4',
    occurredDate: new Date('2026-11-24T00:00:00.000Z'),
    reportedById: studentFoundId,
  });
  const highEval = evaluateItemMatch(lostBase, foundHigh);
  assert.ok(highEval.similarityScore >= 80 && highEval.similarityScore <= 100);
  assert.equal(highEval.classification, 'HIGH MATCH');

  // 2. Different categories drops 25 points (cannot hit HIGH MATCH)
  const diffCategory = buildTestItem({
    ...foundHigh,
    reportType: ReportType.FOUND,
    categoryName: 'Books',
    reportedById: studentFoundId,
  });
  const diffCatEval = evaluateItemMatch(lostBase, diffCategory);
  assert.equal(
    diffCatEval.signals.find((s) => s.label === 'Category')?.score,
    0,
  );
  assert.ok(diffCatEval.similarityScore <= highEval.similarityScore - 25);

  // 3. Different locations drops 20 points
  const diffLocation = buildTestItem({
    ...foundHigh,
    reportType: ReportType.FOUND,
    buildingName: 'Athletics & Recreation Center',
    reportedById: studentFoundId,
  });
  const diffLocEval = evaluateItemMatch(lostBase, diffLocation);
  assert.equal(
    diffLocEval.signals.find((s) => s.label === 'Campus Location')?.score,
    0,
  );
  assert.ok(diffLocEval.similarityScore <= highEval.similarityScore - 20);

  // 4. Date differences: 0d=10, 2d=6, 12d=0
  const foundTwoDays = buildTestItem({
    ...foundHigh,
    reportType: ReportType.FOUND,
    occurredDate: new Date('2026-11-22T00:00:00.000Z'),
  });
  const twoDaysEval = evaluateItemMatch(lostBase, foundTwoDays);
  assert.equal(
    twoDaysEval.signals.find((s) => s.label === 'Date Proximity')?.score,
    6,
  );

  const foundTwelveDays = buildTestItem({
    ...foundHigh,
    reportType: ReportType.FOUND,
    occurredDate: new Date('2026-11-12T00:00:00.000Z'),
  });
  const twelveDaysEval = evaluateItemMatch(lostBase, foundTwelveDays);
  assert.equal(
    twelveDaysEval.signals.find((s) => s.label === 'Date Proximity')?.score,
    0,
  );

  // 5. Possible Match (60-79): same category (25) + same location (20) + partial title (~8) + 2 days (6) + shared 'charger' keyword (~4-6) = ~65
  const foundPossible = buildTestItem({
    reportType: ReportType.FOUND,
    categoryName: 'Electronics',
    buildingName: 'Main University Library',
    title: 'MacBook Charger Adapter',
    description: 'White power charger brick left near a wooden study desk.',
    specificSpot: 'First Floor Reference Desk',
    occurredDate: new Date('2026-11-22T00:00:00.000Z'),
    reportedById: studentFoundId,
  });
  const possibleEval = evaluateItemMatch(lostBase, foundPossible);
  assert.ok(
    possibleEval.similarityScore >= 60 && possibleEval.similarityScore <= 79,
    `Expected POSSIBLE MATCH (60-79), got ${possibleEval.similarityScore}`,
  );
  assert.equal(possibleEval.classification, 'POSSIBLE MATCH');

  // 6. Low Match (<60)
  const foundLow = buildTestItem({
    reportType: ReportType.FOUND,
    categoryName: 'Keys',
    buildingName: 'Athletics & Recreation Center',
    title: 'Brass Dormitory Key Ring',
    description: 'Two brass keys on a blue shuttle lanyard.',
    specificSpot: 'Locker Bank 4',
    occurredDate: new Date('2026-11-01T00:00:00.000Z'),
    reportedById: studentFoundId,
  });
  const lowEval = evaluateItemMatch(lostBase, foundLow);
  assert.ok(lowEval.similarityScore < 60);
  assert.equal(lowEval.classification, 'LOW MATCH');

  // 7. Never matches item against itself or same reportType (LOST vs LOST)
  assert.equal(evaluateItemMatch(lostBase, lostBase).similarityScore, 0);
  const anotherLost = buildTestItem({
    ...foundHigh,
    reportType: ReportType.LOST,
  });
  assert.equal(evaluateItemMatch(lostBase, anotherLost).similarityScore, 0);

  // 8. Private distinguishingFeatures must never influence score
  const lostPrivate = buildTestItem({
    ...foundLow,
    reportType: ReportType.LOST,
    distinguishingFeatures: 'SUPERSECRET-TOKEN-ALPHA-BETA',
  });
  const foundPrivate = buildTestItem({
    ...lostBase,
    reportType: ReportType.FOUND,
    distinguishingFeatures: 'SUPERSECRET-TOKEN-ALPHA-BETA',
  });
  const evalWithPrivate = evaluateItemMatch(lostPrivate, foundPrivate);
  assert.equal(
    evalWithPrivate.signals.some((s) => s.detail.includes('supersecret')),
    false,
  );
});

test('Automatic lost-to-found and found-to-lost matching creates matches >= 60, excludes < 60, and redacts private data', async () => {
  const lostAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const foundAuth = await loginAs(
    baseUrl,
    'noah.patel@university.edu',
    'StudentPass!123',
  );

  // A. Lost-to-found: Lost item created first, then matching Found item
  const lostLaptop = await createReportViaApi(baseUrl, lostAuth, {
    reportType: 'LOST',
    title: 'Silver MacBook Pro 14-inch Laptop',
    category: 'Electronics',
    building: 'Main University Library',
    specificSpot: '2nd Floor East Reading Table 12',
    occurredDate: '2026-11-24',
    timeWindow: '14:00 - 15:30',
    description:
      'Silver aluminum laptop inside a charcoal wool felt sleeve with USB-C charger.',
    distinguishingFeatures: 'Secret Maya sticker inside bottom edge.',
  });

  // Unrelated low-match Found item (< 60) should NOT be saved
  await createReportViaApi(baseUrl, foundAuth, {
    reportType: 'FOUND',
    title: 'Yellow Spiral Chemistry Notebook',
    category: 'Books',
    building: 'Athletics & Recreation Center',
    specificSpot: 'Indoor Track Bleachers',
    occurredDate: '2026-11-05',
    timeWindow: '09:00 - 10:00',
    description: 'Spiral bound organic chemistry lab notebook with pen.',
    distinguishingFeatures: 'Coffee stain on page 12.',
  });

  // High-match Found item (>= 80)
  const foundLaptop = await createReportViaApi(baseUrl, foundAuth, {
    reportType: 'FOUND',
    title: 'Silver MacBook Pro 14-inch Laptop',
    category: 'Electronics',
    building: 'Main University Library',
    specificSpot: '2nd Floor East Reading Table 12',
    occurredDate: '2026-11-24',
    timeWindow: '15:00 - 16:00',
    description:
      'Silver aluminum laptop inside a charcoal wool felt sleeve with USB-C charger.',
    distinguishingFeatures: 'Secret Noah intake serial note 8821.',
  });

  // B. Found-to-lost: Found item created first, then Possible Match Lost item created after
  const foundFlask = await createReportViaApi(baseUrl, foundAuth, {
    reportType: 'FOUND',
    title: 'Slate HydroFlask Insulated Water Bottle',
    category: 'Accessories',
    building: 'Science & Innovation Center',
    specificSpot: 'Room 210 Lecture Desk',
    occurredDate: '2026-11-24',
    timeWindow: '11:00 - 12:00',
    description: 'Slate blue insulated stainless water bottle with black screw cap.',
    distinguishingFeatures: 'Dented base edge.',
  });

  const lostFlaskPossible = await createReportViaApi(baseUrl, lostAuth, {
    reportType: 'LOST',
    title: 'HydroFlask Bottle',
    category: 'Accessories',
    building: 'Science & Innovation Center',
    specificSpot: 'Atrium seating bench',
    occurredDate: '2026-11-22',
    timeWindow: '13:00 - 14:00',
    description: 'Metal drinking container left after morning seminar.',
    distinguishingFeatures: 'Rowing club sticker.',
  });

  // Only matches >= 60 should be persisted (no match for the Yellow Chemistry Notebook)
  assert.equal(matchRepo.matches.length, 2);
  assert.ok(matchRepo.matches.every((m) => m.similarityScore >= 60));

  // Verify Maya's GET /api/v1/matches response
  const listRes = await fetch(`${baseUrl}/api/v1/matches`, {
    headers: { Cookie: lostAuth.cookieHeader },
  });
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as {
    ok: boolean;
    data: { matches: SafeMatchResponse[]; pagination: { total: number } };
  };
  assert.equal(listBody.ok, true);
  assert.equal(listBody.data.pagination.total, 2);

  const highMatch = listBody.data.matches.find(
    (m) => m.lostItemId === lostLaptop.id && m.foundItemId === foundLaptop.id,
  );
  assert.ok(highMatch);
  assert.equal(highMatch.classification, 'HIGH MATCH');
  assert.ok(highMatch.similarityScore >= 80);
  assert.equal(highMatch.notice, MATCH_ADVISORY_NOTICE);
  assert.equal(highMatch.lostItem.status, ItemStatus.POTENTIAL_MATCH);
  assert.equal(highMatch.foundItem.status, ItemStatus.POTENTIAL_MATCH);
  // Owner sees own distinguishingFeatures, NEVER counterparty's distinguishingFeatures or email/campusId
  assert.equal(
    highMatch.lostItem.distinguishingFeatures,
    'Secret Maya sticker inside bottom edge.',
  );
  assert.equal('distinguishingFeatures' in highMatch.foundItem, false);
  assert.equal(JSON.stringify(listBody).includes('noah.patel@university.edu'), false);
  assert.equal(JSON.stringify(listBody).includes('STU-20002'), false);

  const possibleMatch = listBody.data.matches.find(
    (m) =>
      m.lostItemId === lostFlaskPossible.id && m.foundItemId === foundFlask.id,
  );
  assert.ok(possibleMatch);
  assert.equal(possibleMatch.classification, 'POSSIBLE MATCH');
  assert.ok(
    possibleMatch.similarityScore >= 60 && possibleMatch.similarityScore <= 79,
  );

  // Verify GET /api/v1/matches/:id works for participant
  const detailRes = await fetch(`${baseUrl}/api/v1/matches/${highMatch.id}`, {
    headers: { Cookie: foundAuth.cookieHeader },
  });
  assert.equal(detailRes.status, 200);
});

test('Concurrent recalculation prevents duplicate matches and item updates/withdrawals prune stale matches', async () => {
  const lostAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const laptopMatch = matchRepo.matches.find((m) => m.similarityScore >= 80)!;
  const lostId = laptopMatch.lostItemId;
  const initialMatchCount = matchRepo.matches.length;

  // Trigger 5 concurrent recalculations for the same item
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(`${baseUrl}/api/v1/matches/recalculate/${lostId}`, {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          Cookie: lostAuth.cookieHeader,
          'X-CSRF-Token': lostAuth.csrfToken,
        },
      }),
    ),
  );
  for (const res of results) {
    assert.equal(res.status, 200);
  }
  // Exact same count — zero duplicate (lostItemId, foundItemId) records
  assert.equal(matchRepo.matches.length, initialMatchCount);

  // Update lost laptop report so it no longer matches -> stale PENDING match removed & status returns to ACTIVE
  const updateRes = await fetch(`${baseUrl}/api/v1/items/${lostId}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: lostAuth.cookieHeader,
      'X-CSRF-Token': lostAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Red Umbrella',
      category: 'Other',
      building: 'Athletics & Recreation Center',
      description: 'Compact red folding umbrella with wooden handle.',
      occurredDate: '2026-10-01',
    }),
  });
  assert.equal(updateRes.status, 200);
  const updatedBody = (await updateRes.json()) as {
    data: { item: { status: ItemStatus } };
  };
  assert.equal(updatedBody.data.item.status, ItemStatus.ACTIVE);
  assert.equal(
    matchRepo.matches.some((m) => m.lostItemId === lostId),
    false,
  );

  // Withdraw the remaining lost item -> CLOSED items cannot participate in matching
  const remainingMatch = matchRepo.matches[0];
  assert.ok(remainingMatch);
  const withdrawRes = await fetch(
    `${baseUrl}/api/v1/items/${remainingMatch.lostItemId}`,
    {
      method: 'DELETE',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: lostAuth.cookieHeader,
        'X-CSRF-Token': lostAuth.csrfToken,
      },
    },
  );
  assert.equal(withdrawRes.status, 200);

  // Recalculating on CLOSED item is rejected with 409
  const closedRecalcRes = await fetch(
    `${baseUrl}/api/v1/matches/recalculate/${remainingMatch.lostItemId}`,
    {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: lostAuth.cookieHeader,
        'X-CSRF-Token': lostAuth.csrfToken,
      },
    },
  );
  assert.equal(closedRecalcRes.status, 409);
});

test('Unauthorized access, cross-student isolation, and score manipulation attempts are rejected', async () => {
  const lostAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const foundAuth = await loginAs(
    baseUrl,
    'noah.patel@university.edu',
    'StudentPass!123',
  );
  const thirdAuth = await loginAs(
    baseUrl,
    'elena.gomez@university.edu',
    'StudentPass!123',
  );

  // Recreate fresh high match pair for auth boundary tests
  const lostItem = await createReportViaApi(baseUrl, lostAuth, {
    reportType: 'LOST',
    title: 'Black Leather Bifold Wallet',
    category: 'Wallets',
    building: 'Main University Library',
    specificSpot: 'Ground Floor Cafe Counter',
    occurredDate: '2026-11-24',
    timeWindow: '10:00 - 11:00',
    description: 'Black leather bifold wallet containing transit pass.',
    distinguishingFeatures: 'Embossed gold initials ML.',
  });

  await createReportViaApi(baseUrl, foundAuth, {
    reportType: 'FOUND',
    title: 'Black Leather Bifold Wallet',
    category: 'Wallets',
    building: 'Main University Library',
    specificSpot: 'Ground Floor Cafe Counter',
    occurredDate: '2026-11-24',
    timeWindow: '11:15 - 12:00',
    description: 'Black leather bifold wallet found beside the cafe register.',
    distinguishingFeatures: 'Gold embossing on inside flap.',
  });

  const mayaList = await fetch(`${baseUrl}/api/v1/matches`, {
    headers: { Cookie: lostAuth.cookieHeader },
  });
  const mayaData = (await mayaList.json()) as {
    data: { matches: SafeMatchResponse[] };
  };
  const match = mayaData.data.matches[0];
  assert.ok(match);

  // 1. Unauthenticated requests -> 401
  assert.equal((await fetch(`${baseUrl}/api/v1/matches`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/v1/matches/${match.id}`)).status, 401);
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/matches/recalculate/${lostItem.id}`, {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000' },
      })
    ).status,
    401,
  );

  // 2. Uninvolved 3rd student cannot view someone else's match -> 403
  const thirdDetail = await fetch(`${baseUrl}/api/v1/matches/${match.id}`, {
    headers: { Cookie: thirdAuth.cookieHeader },
  });
  assert.equal(thirdDetail.status, 403);

  // 3. Uninvolved 3rd student gets empty list for GET /api/v1/matches
  const thirdList = await fetch(`${baseUrl}/api/v1/matches`, {
    headers: { Cookie: thirdAuth.cookieHeader },
  });
  assert.equal(thirdList.status, 200);
  const thirdData = (await thirdList.json()) as {
    data: { matches: SafeMatchResponse[] };
  };
  assert.equal(thirdData.data.matches.length, 0);

  // 4. Non-owner student cannot recalculate another student's item -> 403
  const thirdRecalc = await fetch(
    `${baseUrl}/api/v1/matches/recalculate/${lostItem.id}`,
    {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: thirdAuth.cookieHeader,
        'X-CSRF-Token': thirdAuth.csrfToken,
      },
    },
  );
  assert.equal(thirdRecalc.status, 403);

  // 5. Student cannot force CONFIRMED claim/match approval or inject similarityScore via PATCH -> 400
  const tamperPatch = await fetch(`${baseUrl}/api/v1/matches/${match.id}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: lostAuth.cookieHeader,
      'X-CSRF-Token': lostAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'CONFIRMED',
      similarityScore: 100,
    }),
  });
  assert.equal(tamperPatch.status, 400);

  // 6. Participant can dismiss suggestion (PATCH DISMISSED) and restore (PATCH PENDING)
  const dismissRes = await fetch(`${baseUrl}/api/v1/matches/${match.id}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: lostAuth.cookieHeader,
      'X-CSRF-Token': lostAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'DISMISSED' }),
  });
  assert.equal(dismissRes.status, 200);
  const dismissData = (await dismissRes.json()) as {
    data: { match: SafeMatchResponse };
  };
  assert.equal(dismissData.data.match.status, MatchStatus.DISMISSED);

  // Match never auto-creates or auto-approves claims; item stays ACTIVE/POTENTIAL_MATCH, never RETURNED/CLAIM_PENDING
  assert.notEqual(dismissData.data.match.foundItem.status, ItemStatus.RETURNED);
  assert.notEqual(
    dismissData.data.match.foundItem.status,
    ItemStatus.CLAIM_PENDING,
  );
});
