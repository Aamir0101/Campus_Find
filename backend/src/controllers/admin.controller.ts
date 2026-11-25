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
} from '../services/storage.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  AdminAuditLogsQuery,
  AdminListClaimsQuery,
  AdminReturnItemInput,
  AdminReviewClaimInput,
} from '../validators/claim.validator.js';

export function createAdminController(
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
    async listClaims(
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

        const query = req.query as unknown as AdminListClaimsQuery;
        const result = await service.adminListClaims(query, req.user);

        return res.status(200).json({
          ok: true,
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    async reviewClaim(
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

        const body = req.body as AdminReviewClaimInput;
        const claim = await service.adminReviewClaim(
          req.params.id,
          body,
          req.user,
        );

        return res.status(200).json({
          ok: true,
          data: { claim },
        });
      } catch (error) {
        return next(error);
      }
    },

    async markItemReturned(
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

        const body = req.body as AdminReturnItemInput;
        const result = await service.adminMarkItemReturned(
          req.params.id,
          body,
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

    async listAuditLogs(
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

        const query = req.query as unknown as AdminAuditLogsQuery;
        const result = await service.adminListAuditLogs(query, req.user);

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

export const adminController = createAdminController();
