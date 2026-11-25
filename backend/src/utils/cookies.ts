import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { loadEnv } from '../config/env.js';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const CSRF_COOKIE_NAME = 'csrf_token';

function isSecureRequest(req: Request): boolean {
  const env = loadEnv();
  return (
    env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https'
  );
}

function buildCookieOptions(req: Request, overrides: CookieOptions = {}): CookieOptions {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    ...(secure ? { partitioned: true } : {}),
    ...overrides,
  };
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString('hex');
}

export function setAuthCookies(
  req: Request,
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): string {
  const csrfToken = generateCsrfToken();

  res.cookie(
    ACCESS_COOKIE_NAME,
    tokens.accessToken,
    buildCookieOptions(req, {
      path: '/',
      maxAge: 15 * 60 * 1000,
    }),
  );

  res.cookie(
    REFRESH_COOKIE_NAME,
    tokens.refreshToken,
    buildCookieOptions(req, {
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }),
  );

  res.cookie(
    CSRF_COOKIE_NAME,
    csrfToken,
    buildCookieOptions(req, {
      httpOnly: false,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }),
  );

  return csrfToken;
}

export function clearAuthCookies(req: Request, res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, buildCookieOptions(req, { path: '/' }));
  res.clearCookie(
    REFRESH_COOKIE_NAME,
    buildCookieOptions(req, { path: '/api/v1/auth' }),
  );
  res.clearCookie(
    CSRF_COOKIE_NAME,
    buildCookieOptions(req, { httpOnly: false, path: '/' }),
  );
}
