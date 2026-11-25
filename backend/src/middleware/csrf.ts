import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../utils/cookies.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Enforces CSRF protection for cookie-authenticated state-changing requests:
 * 1. Validates Origin header (when sent by a browser) against configured CORS_ORIGIN or request Host.
 * 2. Requires double-submit X-CSRF-Token matching the csrf_token cookie when auth cookies are present.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const hasAuthCookie = Boolean(
    req.cookies?.[ACCESS_COOKIE_NAME] || req.cookies?.[REFRESH_COOKIE_NAME],
  );

  // Validate Origin when supplied by browsers
  const originHeader = req.headers.origin;
  if (originHeader) {
    const env = loadEnv();
    const allowedOrigins = env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost ?? req.headers.host;

    let originMatchesHost = false;
    try {
      const parsedOrigin = new URL(originHeader);
      if (hostHeader && parsedOrigin.host === hostHeader) {
        originMatchesHost = true;
      }
    } catch {
      return next(new AppError('CSRF validation failed.', 403, 'CSRF_INVALID_ORIGIN'));
    }

    if (!allowedOrigins.includes(originHeader) && !originMatchesHost) {
      return next(new AppError('CSRF validation failed.', 403, 'CSRF_INVALID_ORIGIN'));
    }
  }

  // If authenticated via cookies, enforce double-submit CSRF token
  if (hasAuthCookie) {
    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers['x-csrf-token'];
    const headerValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;

    if (
      typeof csrfCookie !== 'string' ||
      typeof headerValue !== 'string' ||
      csrfCookie.length === 0 ||
      !tokensMatch(csrfCookie, headerValue)
    ) {
      return next(new AppError('CSRF validation failed.', 403, 'CSRF_TOKEN_MISMATCH'));
    }
  }

  return next();
}
