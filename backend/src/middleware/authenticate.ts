import type { NextFunction, Request, Response } from 'express';
import { prismaAuthRepository } from '../services/auth.service.js';
import type { AuthRepository, AuthenticatedUser } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { ACCESS_COOKIE_NAME } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

function extractAccessToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }

  return undefined;
}

export function createAuthenticateMiddleware(
  repo: Pick<AuthRepository, 'findSafeById'> = prismaAuthRepository,
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const token = extractAccessToken(req);
      if (!token) {
        return next(
          new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
        );
      }

      let payload;
      try {
        payload = verifyAccessToken(token);
      } catch {
        return next(
          new AppError('Authentication required.', 401, 'INVALID_ACCESS_TOKEN'),
        );
      }

      const user = await repo.findSafeById(payload.sub);
      if (!user || !user.isActive) {
        return next(
          new AppError('Authentication required.', 401, 'ACCOUNT_UNAVAILABLE'),
        );
      }

      req.user = {
        id: user.id,
        email: user.email,
        campusId: user.campusId,
        fullName: user.fullName,
        department: user.department,
        role: user.role,
        isActive: user.isActive,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function createOptionalAuthenticateMiddleware(
  repo: Pick<AuthRepository, 'findSafeById'> = prismaAuthRepository,
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const token = extractAccessToken(req);
      if (!token) {
        return next();
      }

      try {
        const payload = verifyAccessToken(token);
        const user = await repo.findSafeById(payload.sub);
        if (user && user.isActive) {
          req.user = {
            id: user.id,
            email: user.email,
            campusId: user.campusId,
            fullName: user.fullName,
            department: user.department,
            role: user.role,
            isActive: user.isActive,
          };
        }
      } catch {
        // Ignore invalid/expired token for optional public browse requests
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticateMiddleware();
export const optionalAuthenticate = createOptionalAuthenticateMiddleware();
