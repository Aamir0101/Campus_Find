import bcrypt from 'bcrypt';
import {
  AuditAction,
  ClaimStatus,
  EvidenceType,
  ItemStatus,
  MatchStatus,
  PrismaClient,
  ReportType,
  UserRole,
} from '@prisma/client';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.info('Seeding CampusFind development database...');

  const studentSeedPassword = process.env.DEV_SEED_PASSWORD;
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!studentSeedPassword) {
    throw new Error(
      'Set DEV_SEED_PASSWORD in your environment before running the development seed script.',
    );
  }

  const studentPasswordHash = await bcrypt.hash(studentSeedPassword, BCRYPT_ROUNDS);

  // 1. Users (Students, Staff, and controlled Admin provisioning)
  const studentMaya = await prisma.user.upsert({
    where: { email: 'maya.lin@university.edu' },
    update: {
      fullName: 'Maya Lin',
      department: 'Computer Science & Engineering',
      role: UserRole.STUDENT,
    },
    create: {
      email: 'maya.lin@university.edu',
      campusId: 'STU-48291',
      fullName: 'Maya Lin',
      department: 'Computer Science & Engineering',
      role: UserRole.STUDENT,
      passwordHash: studentPasswordHash,
    },
  });

  const studentJordan = await prisma.user.upsert({
    where: { email: 'j.alvarez@university.edu' },
    update: {
      fullName: 'Jordan Alvarez',
      department: 'Mathematics & Physical Sciences',
      role: UserRole.STUDENT,
    },
    create: {
      email: 'j.alvarez@university.edu',
      campusId: 'STU-39104',
      fullName: 'Jordan Alvarez',
      department: 'Mathematics & Physical Sciences',
      role: UserRole.STUDENT,
      passwordHash: studentPasswordHash,
    },
  });

  const staffDesk = await prisma.user.upsert({
    where: { email: 'circulation@university.edu' },
    update: {
      fullName: 'Sterling Circulation Staff',
      department: 'University Libraries',
      role: UserRole.STAFF,
    },
    create: {
      email: 'circulation@university.edu',
      campusId: 'STF-00412',
      fullName: 'Sterling Circulation Staff',
      department: 'University Libraries',
      role: UserRole.STAFF,
      passwordHash: studentPasswordHash,
    },
  });

  let adminOfficerId = staffDesk.id;
  if (adminSeedPassword) {
    if (adminSeedPassword.length < 12) {
      throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters long.');
    }
    const adminPasswordHash = await bcrypt.hash(adminSeedPassword, BCRYPT_ROUNDS);
    const adminOfficer = await prisma.user.upsert({
      where: { email: 'd.vance@safety.university.edu' },
      update: {
        fullName: 'Officer Daniel Vance',
        department: 'Campus Safety & Property Control',
        role: UserRole.ADMIN,
        passwordHash: adminPasswordHash,
      },
      create: {
        email: 'd.vance@safety.university.edu',
        campusId: 'STF-00914',
        fullName: 'Officer Daniel Vance',
        department: 'Campus Safety & Property Control',
        role: UserRole.ADMIN,
        passwordHash: adminPasswordHash,
      },
    });
    adminOfficerId = adminOfficer.id;
  } else {
    console.info(
      'ADMIN_SEED_PASSWORD not provided; skipping ADMIN account provisioning.',
    );
  }

  // 2. Categories (9 standardized CampusFind categories)
  const categoryDefinitions = [
    {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Laptops, tablets, headphones, chargers, and portable devices.',
    },
    {
      name: 'ID Cards',
      slug: 'id-cards',
      description: 'University IDs, transit passes, and access badges.',
    },
    {
      name: 'Wallets',
      slug: 'wallets',
      description: 'Wallets, cardholders, and coin pouches.',
    },
    {
      name: 'Bags',
      slug: 'bags',
      description: 'Backpacks, laptop sleeves, messenger bags, and totes.',
    },
    {
      name: 'Books',
      slug: 'books',
      description: 'Textbooks, course readers, notebooks, and calculators.',
    },
    {
      name: 'Clothing',
      slug: 'clothing',
      description: 'Jackets, sweaters, scarves, hats, and athletic apparel.',
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Eyewear, watches, jewelry, and personal accessories.',
    },
    {
      name: 'Keys',
      slug: 'keys',
      description: 'Dormitory keys, keychains, lanyards, and bike lock keys.',
    },
    {
      name: 'Other',
      slug: 'other',
      description: 'Water bottles, umbrellas, lab gear, and miscellaneous items.',
    },
  ];

  const categoriesBySlug = new Map<string, string>();
  for (const cat of categoryDefinitions) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
    categoriesBySlug.set(cat.slug, record.id);
  }

  // 3. Locations
  const locationDefinitions = [
    {
      code: 'SML-2E',
      buildingName: 'Sterling Memorial Library',
      zoneName: '2nd Floor East Reading Atrium',
      custodyDesk: 'Library Circulation Desk · Main Lobby',
    },
    {
      code: 'NQL-102',
      buildingName: 'North Quad Lecture Center',
      zoneName: 'Lecture Hall 102',
      custodyDesk: 'North Quad Security Kiosk',
    },
    {
      code: 'SUC-01',
      buildingName: 'Student Union Commons',
      zoneName: 'Ground Floor Cafe Mezzanine',
      custodyDesk: 'Student Union Info Desk',
    },
    {
      code: 'SEH-304',
      buildingName: 'Science & Engineering Hall',
      zoneName: 'Room 304 Physics Lab',
      custodyDesk: 'Science Hall Main Office · Room 101',
    },
    {
      code: 'CTH-B2',
      buildingName: 'Campus Transit Hub',
      zoneName: 'Shuttle Bay 2',
      custodyDesk: 'Campus Safety Central Vault',
    },
  ];

  const locationsByCode = new Map<string, string>();
  for (const loc of locationDefinitions) {
    const record = await prisma.location.upsert({
      where: { code: loc.code },
      update: {
        buildingName: loc.buildingName,
        zoneName: loc.zoneName,
        custodyDesk: loc.custodyDesk,
      },
      create: loc,
    });
    locationsByCode.set(loc.code, record.id);
  }

  // 4. Items
  const foundLaptop = await prisma.item.upsert({
    where: { referenceCode: 'FND-2026-0418' },
    update: {},
    create: {
      referenceCode: 'FND-2026-0418',
      reportType: ReportType.FOUND,
      title: 'Silver 14-inch Laptop with Navy Felt Sleeve',
      description:
        'Found unattended on a reading table near the east glass atrium inside a dark navy wool felt sleeve.',
      distinguishingFeatures:
        'Small geometric sticker inside sleeve flap; faint scuff on lower-right corner of aluminum lid.',
      verificationPrompt: 'What emblem is stitched or affixed inside the sleeve flap?',
      specificSpot: 'Table 14 near East Windows',
      custodyLocation: 'Campus Safety Central Vault · Locker B-12',
      occurredDate: new Date('2026-11-24'),
      timeWindow: '14:00 - 16:00',
      status: ItemStatus.POTENTIAL_MATCH,
      reportedById: staffDesk.id,
      categoryId: categoriesBySlug.get('electronics')!,
      locationId: locationsByCode.get('SML-2E')!,
    },
  });

  const lostLaptop = await prisma.item.upsert({
    where: { referenceCode: 'LST-2026-0389' },
    update: {},
    create: {
      referenceCode: 'LST-2026-0389',
      reportType: ReportType.LOST,
      title: '14-inch Aluminum Laptop in Navy Wool Sleeve',
      description:
        'Left silver 14-inch laptop inside a navy felt sleeve after afternoon study group.',
      distinguishingFeatures:
        'Navy sleeve contains a hexagon emblem inside the magnetic flap; serial ends in 7Q4M.',
      specificSpot: '2nd Floor East Study Tables',
      occurredDate: new Date('2026-11-24'),
      timeWindow: '13:30 - 15:30',
      status: ItemStatus.POTENTIAL_MATCH,
      reportedById: studentMaya.id,
      categoryId: categoriesBySlug.get('electronics')!,
      locationId: locationsByCode.get('SML-2E')!,
    },
  });

  const foundBackpack = await prisma.item.upsert({
    where: { referenceCode: 'FND-2026-0415' },
    update: {},
    create: {
      referenceCode: 'FND-2026-0415',
      reportType: ReportType.FOUND,
      title: 'Navy Waxed Canvas Flap Backpack',
      description:
        'Structured navy canvas backpack with black leather-trimmed straps left near auditorium rear exit.',
      distinguishingFeatures:
        'Contains spiral linear algebra notebook and brass keychain clip inside front left pocket.',
      verificationPrompt: 'Name one item stored inside the front left pocket.',
      specificSpot: 'Back Row Seat K14',
      custodyLocation: 'North Quad Security Kiosk · Shelf 04',
      occurredDate: new Date('2026-11-23'),
      timeWindow: '10:00 - 12:00',
      status: ItemStatus.CLAIM_PENDING,
      reportedById: staffDesk.id,
      categoryId: categoriesBySlug.get('bags')!,
      locationId: locationsByCode.get('NQL-102')!,
    },
  });

  // 5. ItemImages
  await prisma.itemImage.upsert({
    where: { storageKey: 'items/fnd-2026-0418/primary.jpg' },
    update: {},
    create: {
      itemId: foundLaptop.id,
      storageKey: 'items/fnd-2026-0418/primary.jpg',
      publicUrl: '/src/assets/images/item_laptop_sleeve_1795608718634.jpg',
      mimeType: 'image/jpeg',
      altText: 'Silver 14-inch laptop resting beside navy wool felt sleeve',
      displayOrder: 0,
      isPrimary: true,
    },
  });

  await prisma.itemImage.upsert({
    where: { storageKey: 'items/fnd-2026-0415/primary.jpg' },
    update: {},
    create: {
      itemId: foundBackpack.id,
      storageKey: 'items/fnd-2026-0415/primary.jpg',
      publicUrl: '/src/assets/images/item_student_backpack_1795608719440.jpg',
      mimeType: 'image/jpeg',
      altText: 'Navy waxed canvas flap backpack on neutral stone table',
      displayOrder: 0,
      isPrimary: true,
    },
  });

  // 6. Match
  const laptopMatch = await prisma.match.upsert({
    where: {
      lostItemId_foundItemId: {
        lostItemId: lostLaptop.id,
        foundItemId: foundLaptop.id,
      },
    },
    update: {},
    create: {
      lostItemId: lostLaptop.id,
      foundItemId: foundLaptop.id,
      similarityScore: 94,
      matchedSignals: {
        categoryMatch: true,
        sameBuilding: true,
        timeDeltaMinutes: 45,
        keywords: ['14-inch', 'silver', 'navy', 'sleeve'],
      },
      status: MatchStatus.PENDING,
    },
  });

  // 7. Claim & 8. ClaimEvidence
  const existingClaim = await prisma.claim.findUnique({
    where: { claimCode: 'CLM-2026-0192' },
  });

  const backpackClaim =
    existingClaim ??
    (await prisma.claim.create({
      data: {
        claimCode: 'CLM-2026-0192',
        itemId: foundBackpack.id,
        claimantId: studentJordan.id,
        ownershipStatement:
          'Left my backpack under seat K14 after MATH 225 morning lecture before heading to lab.',
        preferredPickupWindow: 'Weekdays 09:00 - 12:00',
        pickupDesk: 'North Quad Security Kiosk',
        status: ClaimStatus.PENDING,
        evidences: {
          create: [
            {
              evidenceType: EvidenceType.TEXT_DESCRIPTION,
              label: 'Interior Pocket Contents',
              details:
                'Front left pocket holds a spiral blue linear algebra notebook and brass carabiner.',
            },
            {
              evidenceType: EvidenceType.SERIAL_NUMBER,
              label: 'Interior Care Tag Monogram',
              details: 'Monogram "JA" written in permanent ink on interior care tag.',
            },
          ],
        },
      },
    }));

  // 9. AuditLog
  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: staffDesk.id,
          action: AuditAction.REPORT_CREATED,
          entityType: 'Item',
          entityId: foundLaptop.id,
          itemId: foundLaptop.id,
          summary: 'Logged found electronics intake FND-2026-0418',
          metadata: {
            referenceCode: foundLaptop.referenceCode,
            custodyLocation: foundLaptop.custodyLocation,
          },
        },
        {
          actorId: adminOfficerId,
          action: AuditAction.MATCH_CREATED,
          entityType: 'Match',
          entityId: laptopMatch.id,
          matchId: laptopMatch.id,
          summary: 'Recorded 94% attribute match between LST-2026-0389 and FND-2026-0418',
          metadata: { similarityScore: 94 },
        },
        {
          actorId: studentJordan.id,
          action: AuditAction.CLAIM_SUBMITTED,
          entityType: 'Claim',
          entityId: backpackClaim.id,
          claimId: backpackClaim.id,
          itemId: foundBackpack.id,
          summary: 'Submitted ownership claim CLM-2026-0192 for FND-2026-0415',
          metadata: { claimCode: backpackClaim.claimCode },
        },
      ],
    });
  }

  console.info('CampusFind development seed completed.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
