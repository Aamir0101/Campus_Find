import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { createAdminController } from '../controllers/admin.controller.js';
import {
  authorizeRoles,
  createAuthenticateMiddleware,
  csrfProtection,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/index.js';
import type {
  AuditLogRepository,
  AuthRepository,
  ClaimRepository,
} from '../models/index.js';
import { prismaAuthRepository } from '../services/auth.service.js';
import {
  prismaAuditLogRepository,
  prismaClaimRepository,
} from '../services/claim.service.js';
import {
  storageService,
  type EvidenceStorageAdapter,
} from '../services/storage.service.js';
import {
  adminAuditLogsQuerySchema,
  adminItemIdParamSchema,
  adminListClaimsQuerySchema,
  adminReturnItemSchema,
  adminReviewClaimSchema,
  claimIdParamSchema,
} from '../validators/claim.validator.js';

export function createAdminRouter(options?: {
  authRepo?: AuthRepository;
  claimRepo?: ClaimRepository;
  auditRepo?: AuditLogRepository;
  evidenceStorage?: EvidenceStorageAdapter;
}) {
  const router = Router();
  const authRepo = options?.authRepo ?? prismaAuthRepository;
  const claimRepo = options?.claimRepo ?? prismaClaimRepository;
  const auditRepo = options?.auditRepo ?? prismaAuditLogRepository;
  const evidenceStorage = options?.evidenceStorage ?? storageService;

  const authenticate = createAuthenticateMiddleware(authRepo);
  const controller = createAdminController(claimRepo, auditRepo, evidenceStorage);

  router.get(
    '/claims',
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    validateQuery(adminListClaimsQuerySchema),
    controller.listClaims,
  );

  router.patch(
    '/claims/:id/review',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    validateParams(claimIdParamSchema),
    validateBody(adminReviewClaimSchema),
    controller.reviewClaim,
  );

  router.patch(
    '/items/:id/return',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    validateParams(adminItemIdParamSchema),
    validateBody(adminReturnItemSchema),
    controller.markItemReturned,
  );

  router.get(
    '/audit-logs',
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    validateQuery(adminAuditLogsQuerySchema),
    controller.listAuditLogs,
  );

  return router;
}

export const adminRouter = createAdminRouter();
