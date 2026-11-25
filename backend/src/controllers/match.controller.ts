import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import type { MatchRepository } from '../models/index.js';
import {
  createMatchingService,
  prismaMatchRepository,
} from '../services/matching.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  ListMatchesQuery,
  UpdateMatchVisibilityInput,
} from '../validators/match.validator.js';

export function createMatchController(
  repo: MatchRepository = prismaMatchRepository,
) {
  const service = createMatchingService(repo);

  return {
    async listMatches(
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

        const query = req.query as unknown as ListMatchesQuery;
        const result = await service.listMatches(query, req.user);

        return res.status(200).json({
          ok: true,
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    async getMatchById(
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

        const match = await service.getMatchById(req.params.id, req.user);

        return res.status(200).json({
          ok: true,
          data: { match },
        });
      } catch (error) {
        return next(error);
      }
    },

    async recalculateForItem(
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

        const result = await service.recalculateForItemAuthorized(
          req.params.itemId,
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

    async updateMatchVisibility(
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

        const body = req.body as UpdateMatchVisibilityInput;
        const match = await service.updateMatchVisibility(
          req.params.id,
          body.status,
          req.user,
        );

        return res.status(200).json({
          ok: true,
          data: { match },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

export const matchController = createMatchController();
