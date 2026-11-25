import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import bcrypt from 'bcrypt';
import {
  ItemStatus,
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
  SafeUserProfile,
  UpdateItemRecord,
} from '../src/models/index.js';
import {
  type StorageAdapter,
  type StoredItemImageMetadata,
  type UploadImageFileInput,
  validateUploadedImageFile,
} from '../src/services/storage.service.js';
import { ALLOWED_CATEGORY_NAMES } from '../src/validators/item.validator.js';

process.env.NODE_ENV = 'test';
process.env.ALLOWED_EMAIL_DOMAINS = 'university.edu,safety.university.edu';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Minimal valid 1x1 PNG binary header + IHDR/IDAT bytes for magic-byte tests
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

const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
]);

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

class InMemoryStorageAdapter implements StorageAdapter {
  public storedKeys: string[] = [];
  public deletedKeys: string[] = [];

  async uploadItemImages(
    itemId: string,
    files: UploadImageFileInput[],
    startingOrder = 0,
  ): Promise<StoredItemImageMetadata[]> {
    const result: StoredItemImageMetadata[] = [];
    for (let idx = 0; idx < files.length; idx += 1) {
      const format = validateUploadedImageFile(files[idx]);
      const storageKey = `items/${itemId}/${randomUUID()}.${format.extension}`;
      this.storedKeys.push(storageKey);
      result.push({
        storageKey,
        publicUrl: `https://example.supabase.co/storage/v1/object/public/campusfind-item-images/${storageKey}`,
        mimeType: format.mimeType,
        displayOrder: startingOrder + idx,
        isPrimary: startingOrder + idx === 0,
      });
    }
    return result;
  }

  async deleteItemImages(storageKeys: string[]): Promise<void> {
    this.deletedKeys.push(...storageKeys);
    this.storedKeys = this.storedKeys.filter((k) => !storageKeys.includes(k));
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
    {
      id: randomUUID(),
      code: 'LOC-SCI',
      buildingName: 'Science & Innovation Center',
      zoneName: 'North Lab Wing',
      custodyDesk: 'Science Center Security Kiosk',
    },
  ];

  public items: ItemWithRelations[] = [];
  public auditEntries: Array<{ action: string; entityId: string; actorId: string }> = [];

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

    if (criteria.status !== 'ALL') {
      if (!criteria.includeClosed && criteria.status === ItemStatus.CLOSED) {
        return { items: [], total: 0 };
      }
      filtered = filtered.filter((i) => i.status === criteria.status);
    } else if (!criteria.includeClosed) {
      filtered = filtered.filter((i) =>
        [
          ItemStatus.ACTIVE,
          ItemStatus.POTENTIAL_MATCH,
          ItemStatus.CLAIM_PENDING,
          ItemStatus.UNDER_VERIFICATION,
        ].includes(i.status),
      );
    }

    if (criteria.category && criteria.category !== 'ALL') {
      const target = criteria.category.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.category.name.toLowerCase() === target ||
          i.category.slug.toLowerCase() === target,
      );
    }

    if (criteria.locationId) {
      filtered = filtered.filter((i) => i.locationId === criteria.locationId);
    } else if (criteria.building && criteria.building !== 'ALL') {
      const b = criteria.building.toLowerCase();
      filtered = filtered.filter((i) => i.location.buildingName.toLowerCase() === b);
    }

    if (criteria.search) {
      const q = criteria.search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.specificSpot.toLowerCase().includes(q) ||
          i.referenceCode.toLowerCase().includes(q),
      );
    }

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const skip = (criteria.page - 1) * criteria.limit;
    return {
      items: filtered.slice(skip, skip + criteria.limit),
      total,
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
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: loc.id,
        code: loc.code,
        buildingName: loc.buildingName,
        zoneName: loc.zoneName,
        custodyDesk: loc.custodyDesk,
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
    this.auditEntries.push({
      action: 'REPORT_CREATED',
      entityId: item.id,
      actorId: data.reportedById,
    });
    return item;
  }

  async updateItemAndAudit(
    id: string,
    actorId: string,
    data: UpdateItemRecord,
  ): Promise<{ item: ItemWithRelations; removedStorageKeys: string[] }> {
    const idx = this.items.findIndex((i) => i.id === id);
    const existing = this.items[idx];
    const now = new Date();

    const removeSet = new Set(data.removeImageIds ?? []);
    const removedStorageKeys = existing.images
      .filter((img) => removeSet.has(img.id))
      .map((img) => img.storageKey);

    let nextImages = existing.images.filter((img) => !removeSet.has(img.id));
    if (data.addImages && data.addImages.length > 0) {
      nextImages = [
        ...nextImages,
        ...data.addImages.map((img) => ({
          id: randomUUID(),
          itemId: id,
          storageKey: img.storageKey,
          publicUrl: img.publicUrl,
          mimeType: img.mimeType,
          altText: img.altText ?? null,
          displayOrder: img.displayOrder,
          isPrimary: false,
          createdAt: now,
        })),
      ];
    }

    nextImages = nextImages.map((img, order) => ({
      ...img,
      displayOrder: order,
      isPrimary: order === 0,
    }));

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
      verificationPrompt:
        data.verificationPrompt !== undefined
          ? data.verificationPrompt
          : existing.verificationPrompt,
      custodyLocation:
        data.custodyLocation !== undefined
          ? data.custodyLocation
          : existing.custodyLocation,
      updatedAt: now,
      category: {
        ...existing.category,
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
      location: {
        ...existing.location,
        id: loc.id,
        code: loc.code,
        buildingName: loc.buildingName,
        zoneName: loc.zoneName,
        custodyDesk: loc.custodyDesk,
      },
      images: nextImages,
    };

    this.items[idx] = updated;
    this.auditEntries.push({
      action: 'REPORT_UPDATED',
      entityId: id,
      actorId,
    });
    return { item: updated, removedStorageKeys };
  }

  async withdrawItemAndAudit(
    id: string,
    actorId: string,
  ): Promise<ItemWithRelations> {
    const idx = this.items.findIndex((i) => i.id === id);
    const updated: ItemWithRelations = {
      ...this.items[idx],
      status: ItemStatus.CLOSED,
      updatedAt: new Date(),
    };
    this.items[idx] = updated;
    this.auditEntries.push({
      action: 'REPORT_STATUS_CHANGED',
      entityId: id,
      actorId,
    });
    return updated;
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

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
const authRepo = new InMemoryAuthRepository();
const storageAdapter = new InMemoryStorageAdapter();
const itemRepo = new InMemoryItemRepository(authRepo);

let studentOneId = '';
let studentTwoId = '';

before(async () => {
  const passwordHash = await bcrypt.hash('StudentPass!123', 10);
  studentOneId = randomUUID();
  studentTwoId = randomUUID();

  authRepo.seedUser({
    id: studentOneId,
    email: 'maya.lin@university.edu',
    campusId: 'STU-10001',
    fullName: 'Maya Lin',
    department: 'Computer Science',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: studentTwoId,
    email: 'noah.patel@university.edu',
    campusId: 'STU-10002',
    fullName: 'Noah Patel',
    department: 'Mechanical Engineering',
    role: UserRole.STUDENT,
    passwordHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  authRepo.seedUser({
    id: randomUUID(),
    email: 'admin.ops@safety.university.edu',
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
    storage: storageAdapter,
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

test('GET /api/v1/items/metadata returns the 9 standard categories and active campus locations', async () => {
  const res = await fetch(`${baseUrl}/api/v1/items/metadata`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    ok: boolean;
    data: { categories: CategoryDto[]; locations: LocationDto[] };
  };
  assert.equal(body.ok, true);
  assert.deepEqual(
    body.data.categories.map((c) => c.name),
    [...ALLOWED_CATEGORY_NAMES],
  );
  assert.equal(body.data.locations.length, 2);
});

test('Student can create a LOST report with photo upload, randomized storage key, and audit entry', async () => {
  const auth = await loginAs(baseUrl, 'maya.lin@university.edu', 'StudentPass!123');

  const form = new FormData();
  form.set('reportType', 'LOST');
  form.set('title', 'Space Gray MacBook Pro 14-inch');
  form.set('category', 'Electronics');
  form.set('building', 'Main University Library');
  form.set('specificSpot', '3rd Floor quiet study desk near window');
  form.set('occurredDate', '2026-11-24');
  form.set('timeWindow', '14:00 - 15:30');
  form.set(
    'description',
    'Silver aluminum laptop inside a charcoal felt sleeve with charger.',
  );
  form.set(
    'distinguishingFeatures',
    'Small robotics sticker inside bottom corner and serial ending X92Q.',
  );
  form.set('verificationPrompt', 'Describe the sticker inside the lid.');
  form.append(
    'images',
    new Blob([VALID_PNG_BYTES], { type: 'image/png' }),
    '../../malicious-path/secret.png',
  );

  const res = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: auth.cookieHeader,
      'X-CSRF-Token': auth.csrfToken,
    },
    body: form,
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    ok: boolean;
    data: { item: Record<string, unknown> };
  };

  assert.equal(body.ok, true);
  assert.equal(body.data.item.status, ItemStatus.ACTIVE);
  assert.equal(body.data.item.isOwner, true);
  assert.equal(body.data.item.category, 'Electronics');
  assert.equal(
    body.data.item.distinguishingFeatures,
    'Small robotics sticker inside bottom corner and serial ending X92Q.',
  );
  assert.equal(storageAdapter.storedKeys.length, 1);
  // Ensure randomized storage key never contains untrusted uploaded filename
  assert.equal(storageAdapter.storedKeys[0].includes('malicious'), false);
  assert.match(storageAdapter.storedKeys[0], /^items\/[0-9a-f-]+\/[0-9a-f-]+\.png$/);
  assert.equal(itemRepo.auditEntries.at(-1)?.action, 'REPORT_CREATED');
});

test('Unauthenticated users and ADMIN role cannot create student item reports', async () => {
  const unauthRes = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Test' }),
  });
  assert.equal(unauthRes.status, 401);

  const adminAuth = await loginAs(
    baseUrl,
    'admin.ops@safety.university.edu',
    'StudentPass!123',
  );
  const adminRes = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: adminAuth.cookieHeader,
      'X-CSRF-Token': adminAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reportType: 'FOUND',
      title: 'Admin Report Attempt',
      category: 'Keys',
      building: 'Main University Library',
      specificSpot: 'Lobby counter',
      occurredDate: '2026-11-24',
      timeWindow: '10:00',
      description: 'Attempting to create a report with admin account.',
      distinguishingFeatures: 'Silver keyring with two brass keys.',
    }),
  });
  assert.equal(adminRes.status, 403);
});

test('Rejects spoofed image signatures, unsupported MIME types, and mass-assignment fields', async () => {
  const auth = await loginAs(baseUrl, 'maya.lin@university.edu', 'StudentPass!123');
  const initialCount = itemRepo.items.length;

  // 1. Spoofed bytes: JPEG magic header declared as image/png
  const spoofForm = new FormData();
  spoofForm.set('reportType', 'FOUND');
  spoofForm.set('title', 'Campus Student ID Card');
  spoofForm.set('category', 'ID Cards');
  spoofForm.set('building', 'Main University Library');
  spoofForm.set('specificSpot', 'Printing terminal 2');
  spoofForm.set('occurredDate', '2026-11-24');
  spoofForm.set('timeWindow', '11:15');
  spoofForm.set(
    'description',
    'University student card found near the second-floor printer kiosk.',
  );
  spoofForm.set('distinguishingFeatures', 'Lanyard clip has faded blue stripe.');
  spoofForm.append(
    'images',
    new Blob([VALID_JPEG_BYTES], { type: 'image/png' }),
    'spoofed.png',
  );

  const spoofRes = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: auth.cookieHeader,
      'X-CSRF-Token': auth.csrfToken,
    },
    body: spoofForm,
  });
  assert.equal(spoofRes.status, 400);
  const spoofBody = (await spoofRes.json()) as { error: { code: string } };
  assert.equal(spoofBody.error.code, 'INVALID_IMAGE_SIGNATURE');
  assert.equal(itemRepo.items.length, initialCount);

  // 2. Mass assignment attempt: trying to inject status=RETURNED
  const massRes = await fetch(`${baseUrl}/api/v1/items`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: auth.cookieHeader,
      'X-CSRF-Token': auth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reportType: 'FOUND',
      title: 'Black Leather Bifold Wallet',
      category: 'Wallets',
      building: 'Main University Library',
      specificSpot: 'Cafe entrance bench',
      occurredDate: '2026-11-24',
      timeWindow: '12:00',
      description: 'Found a black bifold wallet on the bench outside the cafe.',
      distinguishingFeatures: 'Embossed initials inside inner pocket.',
      status: 'RETURNED',
    }),
  });
  assert.equal(massRes.status, 400);
  const massBody = (await massRes.json()) as { error: { code: string } };
  assert.equal(massBody.error.code, 'VALIDATION_ERROR');
  assert.equal(itemRepo.items.length, initialCount);
});

test('Public browse & details redact private reporter identity and distinguishing details from non-owners', async () => {
  const item = itemRepo.items[0];
  assert.ok(item);

  // Unauthenticated / public view
  const listRes = await fetch(
    `${baseUrl}/api/v1/items?category=Electronics&search=MacBook`,
  );
  assert.equal(listRes.status, 200);
  const listBody = (await listRes.json()) as {
    data: { items: Array<Record<string, unknown>>; pagination: { total: number } };
  };
  assert.equal(listBody.data.pagination.total, 1);
  const listed = listBody.data.items[0];
  assert.equal('distinguishingFeatures' in listed, false);
  assert.equal('verificationPrompt' in listed, false);
  assert.equal('reportedById' in listed, false);
  assert.equal(listed.reporterAffiliation, 'Computer Science Member');

  // Another student viewing details also does NOT see private details or reporter email
  const otherAuth = await loginAs(
    baseUrl,
    'noah.patel@university.edu',
    'StudentPass!123',
  );
  const detailRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    headers: { Cookie: otherAuth.cookieHeader },
  });
  assert.equal(detailRes.status, 200);
  const detailBody = (await detailRes.json()) as {
    data: { item: Record<string, unknown> };
  };
  assert.equal(detailBody.data.item.isOwner, false);
  assert.equal('distinguishingFeatures' in detailBody.data.item, false);
  assert.equal(
    JSON.stringify(detailBody).includes('maya.lin@university.edu'),
    false,
  );
  assert.equal(JSON.stringify(detailBody).includes('STU-10001'), false);

  // mine=true without auth returns 401
  const unauthMine = await fetch(`${baseUrl}/api/v1/items?mine=true`);
  assert.equal(unauthMine.status, 401);
});

test('Ownership & status rules enforce edit/withdraw permissions and storage cleanup', async () => {
  const item = itemRepo.items[0];
  assert.ok(item);
  const existingImageId = item.images[0].id;
  const oldStorageKey = item.images[0].storageKey;

  const ownerAuth = await loginAs(
    baseUrl,
    'maya.lin@university.edu',
    'StudentPass!123',
  );
  const otherAuth = await loginAs(
    baseUrl,
    'noah.patel@university.edu',
    'StudentPass!123',
  );

  // Non-owner cannot edit -> 403
  const otherEditRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: otherAuth.cookieHeader,
      'X-CSRF-Token': otherAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Tampered Title' }),
  });
  assert.equal(otherEditRes.status, 403);

  // Non-owner cannot withdraw -> 403
  const otherDeleteRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    method: 'DELETE',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: otherAuth.cookieHeader,
      'X-CSRF-Token': otherAuth.csrfToken,
    },
  });
  assert.equal(otherDeleteRes.status, 403);

  // Owner can edit eligible ACTIVE report & replace photo
  const editForm = new FormData();
  editForm.set('title', 'Space Gray MacBook Pro 14-inch (M3)');
  editForm.set('removeImageIds', JSON.stringify([existingImageId]));
  editForm.append(
    'images',
    new Blob([VALID_JPEG_BYTES], { type: 'image/jpeg' }),
    'updated-photo.jpg',
  );

  const ownerEditRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: ownerAuth.cookieHeader,
      'X-CSRF-Token': ownerAuth.csrfToken,
    },
    body: editForm,
  });
  assert.equal(ownerEditRes.status, 200);
  const editedBody = (await ownerEditRes.json()) as {
    data: { item: { title: string; images: Array<{ mimeType: string }> } };
  };
  assert.equal(editedBody.data.item.title, 'Space Gray MacBook Pro 14-inch (M3)');
  assert.equal(editedBody.data.item.images.length, 1);
  assert.equal(editedBody.data.item.images[0].mimeType, 'image/jpeg');
  assert.equal(storageAdapter.deletedKeys.includes(oldStorageKey), true);

  // If report moves to UNDER_VERIFICATION, owner cannot edit or withdraw -> 409
  itemRepo.items[0].status = ItemStatus.UNDER_VERIFICATION;
  const blockedEditRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    method: 'PATCH',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: ownerAuth.cookieHeader,
      'X-CSRF-Token': ownerAuth.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: 'Should Fail Under Verification' }),
  });
  assert.equal(blockedEditRes.status, 409);

  // Restore to ACTIVE, withdraw via DELETE -> CLOSED, hidden from public browse, kept in mine=true
  itemRepo.items[0].status = ItemStatus.ACTIVE;
  const withdrawRes = await fetch(`${baseUrl}/api/v1/items/${item.id}`, {
    method: 'DELETE',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: ownerAuth.cookieHeader,
      'X-CSRF-Token': ownerAuth.csrfToken,
    },
  });
  assert.equal(withdrawRes.status, 200);
  const withdrawnBody = (await withdrawRes.json()) as {
    data: { item: { status: ItemStatus; isEditable: boolean } };
  };
  assert.equal(withdrawnBody.data.item.status, ItemStatus.CLOSED);
  assert.equal(withdrawnBody.data.item.isEditable, false);

  const publicAfterWithdraw = await fetch(`${baseUrl}/api/v1/items/${item.id}`);
  assert.equal(publicAfterWithdraw.status, 404);

  const mineAfterWithdraw = await fetch(`${baseUrl}/api/v1/items?mine=true`, {
    headers: { Cookie: ownerAuth.cookieHeader },
  });
  assert.equal(mineAfterWithdraw.status, 200);
  const mineBody = (await mineAfterWithdraw.json()) as {
    data: { items: Array<{ id: string; status: ItemStatus }> };
  };
  assert.equal(mineBody.data.items.length, 1);
  assert.equal(mineBody.data.items[0].status, ItemStatus.CLOSED);
});
