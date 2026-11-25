import { Router } from 'express';
import { createMatchController } from '../controllers/match.controller.js';
import {
  createAuthenticateMiddleware,
  csrfProtection,
  recalculationRateLimiter,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/index.js';
import type { AuthRepository, MatchRepository } from '../models/index.js';
import { prismaAuthRepository } from '../services/auth.service.js';
import { prismaMatchRepository } from '../services/matching.service.js';
import {
  listMatchesQuerySchema,
  matchIdParamSchema,
  recalculateItemIdParamSchema,
  updateMatchVisibilitySchema,
} from '../validators/match.validator.js';

export function createMatchRouter(options?: {
  authRepo?: AuthRepository;
  matchRepo?: MatchRepository;
}) {
  const router = Router();
  const authRepo = options?.authRepo ?? prismaAuthRepository;
  const matchRepo = options?.matchRepo ?? prismaMatchRepository;

  const authenticate = createAuthenticateMiddleware(authRepo);
  const controller = createMatchController(matchRepo);

  router.get(
    '/',
    authenticate,
    validateQuery(listMatchesQuerySchema),
    controller.listMatches,
  );

  router.get(
    '/:id',
    authenticate,
    validateParams(matchIdParamSchema),
    controller.getMatchById,
  );

  router.post(
    '/recalculate/:itemId',
    csrfProtection,
    authenticate,
    recalculationRateLimiter,
    validateParams(recalculateItemIdParamSchema),
    controller.recalculateForItem,
  );

  router.patch(
    '/:id',
    csrfProtection,
    authenticate,
    validateParams(matchIdParamSchema),
    validateBody(updateMatchVisibilitySchema),
    controller.updateMatchVisibility,
  );

  return router;
}

export const matchRouter = createMatchRouter();
