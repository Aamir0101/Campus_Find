import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from './authenticate.js';

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Access denied.', 403, 'FORBIDDEN'));
    }

    return next();
  };
}

export function requireOwnership(
  resolveOwnerId: (req: Request) => Promise<string | null> | string | null,
  allowAdminOverride = true,
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(
          new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
        );
      }

      if (allowAdminOverride && req.user.role === UserRole.ADMIN) {
        return next();
      }

      const ownerId = await resolveOwnerId(req);
      if (!ownerId) {
        return next(new AppError('Resource not found.', 404, 'RESOURCE_NOT_FOUND'));
      }

      if (ownerId !== req.user.id) {
        return next(new AppError('Access denied.', 403, 'OWNERSHIP_REQUIRED'));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
