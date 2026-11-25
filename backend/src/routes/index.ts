import { Router } from 'express';
import type {
  AuditLogRepository,
  AuthRepository,
  ClaimRepository,
  ItemRepository,
  MatchRepository,
} from '../models/index.js';
import { prismaAuthRepository } from '../services/auth.service.js';
import {
  prismaAuditLogRepository,
  prismaClaimRepository,
} from '../services/claim.service.js';
import { prismaItemRepository } from '../services/item.service.js';
import { prismaMatchRepository } from '../services/matching.service.js';
import {
  storageService,
  type EvidenceStorageAdapter,
  type StorageAdapter,
} from '../services/storage.service.js';
import { createAdminRouter } from './admin.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createClaimRouter } from './claim.routes.js';
import { healthRouter } from './health.routes.js';
import { createItemRouter } from './item.routes.js';
import { createMatchRouter } from './match.routes.js';

export function createApiRouter(options?: {
  authRepo?: AuthRepository;
  itemRepo?: ItemRepository;
  matchRepo?: MatchRepository;
  claimRepo?: ClaimRepository;
  auditRepo?: AuditLogRepository;
  storage?: StorageAdapter;
  evidenceStorage?: EvidenceStorageAdapter;
  extraRouter?: Router;
}) {
  const router = Router();
  const authRepo = options?.authRepo ?? prismaAuthRepository;
  const itemMatchRepo =
    options?.matchRepo ?? (options?.itemRepo ? undefined : prismaMatchRepository);
  const matchRepo = options?.matchRepo ?? prismaMatchRepository;
  const claimRepo = options?.claimRepo ?? prismaClaimRepository;
  const auditRepo = options?.auditRepo ?? prismaAuditLogRepository;
  const evidenceStorage = options?.evidenceStorage ?? storageService;

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(authRepo));
  router.use(
    '/items',
    createItemRouter({
      authRepo,
      itemRepo: options?.itemRepo ?? prismaItemRepository,
      matchRepo: itemMatchRepo,
      storage: options?.storage ?? storageService,
    }),
  );
  router.use(
    '/matches',
    createMatchRouter({
      authRepo,
      matchRepo,
    }),
  );
  router.use(
    '/claims',
    createClaimRouter({
      authRepo,
      claimRepo,
      auditRepo,
      evidenceStorage,
    }),
  );
  router.use(
    '/admin',
    createAdminRouter({
      authRepo,
      claimRepo,
      auditRepo,
      evidenceStorage,
    }),
  );

  if (options?.extraRouter) {
    router.use('/__test', options.extraRouter);
  }

  router.get('/', (_req, res) => {
    res.status(200).json({
      ok: true,
      data: {
        name: 'CampusFind API',
        phase: 6,
        status: 'secure-claims-verification-active',
        message:
          'Authentication, Lost & Found reporting, Smart Item Matching, and Secure Claim & Verification endpoints are active.',
      },
    });
  });

  return router;
}

export const apiRouter = createApiRouter();
