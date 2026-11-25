import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { createClaimController } from '../controllers/claim.controller.js';
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
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILES_PER_CLAIM,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  storageService,
  type EvidenceStorageAdapter,
} from '../services/storage.service.js';
import { AppError } from '../utils/AppError.js';
import {
  claimEvidenceParamSchema,
  claimIdParamSchema,
  createClaimSchema,
  listMyClaimsQuerySchema,
} from '../validators/claim.validator.js';

const uploadClaimEvidence = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_EVIDENCE_FILE_SIZE_BYTES,
    files: MAX_EVIDENCE_FILES_PER_CLAIM,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new AppError(
          'Supporting evidence files must be JPEG, PNG, WebP, or PDF documents.',
          400,
          'INVALID_EVIDENCE_MIME_TYPE',
        ),
      );
    }
    return callback(null, true);
  },
});

export function createClaimRouter(options?: {
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
  const controller = createClaimController(claimRepo, auditRepo, evidenceStorage);

  router.post(
    '/',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.STUDENT),
    uploadClaimEvidence.array('evidenceFiles', MAX_EVIDENCE_FILES_PER_CLAIM),
    validateBody(createClaimSchema),
    controller.submitClaim,
  );

  router.get(
    '/my',
    authenticate,
    authorizeRoles(UserRole.STUDENT),
    validateQuery(listMyClaimsQuerySchema),
    controller.listMyClaims,
  );

  router.get(
    '/:id/evidence/:evidenceId/url',
    authenticate,
    validateParams(claimEvidenceParamSchema),
    controller.getSignedEvidenceUrl,
  );

  router.get(
    '/:id',
    authenticate,
    validateParams(claimIdParamSchema),
    controller.getClaimById,
  );

  return router;
}

export const claimRouter = createClaimRouter();
