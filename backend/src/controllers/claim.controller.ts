import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import type { AuditLogRepository, ClaimRepository } from '../models/index.js';
import {
  claimService,
  createClaimService,
  prismaAuditLogRepository,
  prismaClaimRepository,
} from '../services/claim.service.js';
import {
  storageService,
  type EvidenceStorageAdapter,
  type UploadImageFileInput,
} from '../services/storage.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  CreateClaimInput,
  ListMyClaimsQuery,
} from '../validators/claim.validator.js';

export function createClaimController(
  claimRepo: ClaimRepository = prismaClaimRepository,
  auditRepo: AuditLogRepository = prismaAuditLogRepository,
  evidenceStorage: EvidenceStorageAdapter = storageService,
) {
  const service =
    claimRepo === prismaClaimRepository &&
    auditRepo === prismaAuditLogRepository &&
    evidenceStorage === storageService
      ? claimService
      : createClaimService(claimRepo, auditRepo, evidenceStorage);

  return {
    async submitClaim(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const files = (Array.isArray(req.files) ? req.files : []).map(
          (file): UploadImageFileInput => ({
            buffer: file.buffer,
            mimetype: file.mimetype,
            size: file.size,
          }),
        );

        const body = req.body as CreateClaimInput;
        const claim = await service.submitClaim(body, files, req.user);

        return res.status(201).json({
          ok: true,
          data: { claim },
        });
      } catch (error) {
        return next(error);
      }
    },

    async listMyClaims(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const query = req.query as unknown as ListMyClaimsQuery;
        const result = await service.listMyClaims(query, req.user);

        return res.status(200).json({
          ok: true,
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    async getClaimById(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const claim = await service.getClaimById(req.params.id, req.user);

        return res.status(200).json({
          ok: true,
          data: { claim },
        });
      } catch (error) {
        return next(error);
      }
    },

    async getSignedEvidenceUrl(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const result = await service.getSignedEvidenceUrl(
          req.params.id,
          req.params.evidenceId,
          req.user,
        );

        return res.status(200).json({
          ok: true,
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

export const claimController = createClaimController();
