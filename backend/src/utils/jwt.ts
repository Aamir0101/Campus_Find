import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { loadEnv } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  role: UserRole;
  jti: string;
  type: 'refresh';
}

const JWT_ISSUER = 'campusfind-api';
const JWT_AUDIENCE = 'campusfind-client';

export function signAccessToken(userId: string, role: UserRole): string {
  const env = loadEnv();
  return jwt.sign(
    { sub: userId, role, type: 'access' } satisfies AccessTokenPayload,
    env.resolvedAccessSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
}

export function signRefreshToken(
  userId: string,
  role: UserRole,
  jti = randomUUID(),
): { token: string; jti: string } {
  const env = loadEnv();
  const token = jwt.sign(
    { sub: userId, role, jti, type: 'refresh' } satisfies RefreshTokenPayload,
    env.resolvedRefreshSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.resolvedAccessSecret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    decoded.type !== 'access' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.role !== 'string'
  ) {
    throw new Error('Invalid access token payload.');
  }

  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.resolvedRefreshSecret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    decoded.type !== 'refresh' ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.role !== 'string' ||
    typeof decoded.jti !== 'string'
  ) {
    throw new Error('Invalid refresh token payload.');
  }

  return decoded as RefreshTokenPayload;
}
