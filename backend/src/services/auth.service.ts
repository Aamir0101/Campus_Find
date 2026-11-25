import bcrypt from 'bcrypt';
import { AuditAction, UserRole } from '@prisma/client';
import { loadEnv } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import type {
  AuthRepository,
  CreateStudentUserRecord,
  SafeUserProfile,
} from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js';

export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  campusId: true,
  fullName: true,
  department: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Precomputed valid bcrypt hash used strictly for timing-equalization when email does not exist
const DUMMY_BCRYPT_HASH =
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8uW0Q2R8P7Z1rB6U1y4xG2xL3aK8W2';

const revokedRefreshJtis = new Set<string>();

export const prismaAuthRepository: AuthRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findByCampusId(campusId: string) {
    return prisma.user.findUnique({
      where: { campusId },
      select: SAFE_USER_SELECT,
    });
  },

  findSafeById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
  },

  async createStudentAndAudit(data: CreateStudentUserRecord): Promise<SafeUserProfile> {
    return prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          campusId: data.campusId,
          fullName: data.fullName,
          department: data.department,
          passwordHash: data.passwordHash,
          // Hardcoded STUDENT role: public registration can never provision STAFF or ADMIN
          role: UserRole.STUDENT,
          isActive: true,
        },
        select: SAFE_USER_SELECT,
      });

      await tx.auditLog.create({
        data: {
          actorId: createdUser.id,
          action: AuditAction.USER_REGISTERED,
          entityType: 'User',
          entityId: createdUser.id,
          summary: `Student account registered for ${createdUser.campusId}`,
        },
      });

      return createdUser;
    });
  },
};

export function isAllowedEmailDomain(email: string, allowedDomains: string[]): boolean {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return allowedDomains.includes(domain);
}

export function createAuthService(repo: AuthRepository = prismaAuthRepository) {
  return {
    async registerStudent(input: RegisterInput): Promise<{
      user: SafeUserProfile;
      tokens: { accessToken: string; refreshToken: string };
    }> {
      const env = loadEnv();
      const normalizedEmail = input.email.trim().toLowerCase();

      if (!isAllowedEmailDomain(normalizedEmail, env.allowedEmailDomainsList)) {
        throw new AppError(
          'Registration requires an approved university email domain.',
          400,
          'DISALLOWED_EMAIL_DOMAIN',
        );
      }

      const [existingByEmail, existingByCampusId] = await Promise.all([
        repo.findByEmail(normalizedEmail),
        repo.findByCampusId(input.campusId),
      ]);

      if (existingByEmail || existingByCampusId) {
        throw new AppError(
          'An account with this university email or Campus ID already exists.',
          409,
          'ACCOUNT_ALREADY_EXISTS',
        );
      }

      const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

      const user = await repo.createStudentAndAudit({
        email: normalizedEmail,
        campusId: input.campusId,
        fullName: input.fullName,
        department: input.department,
        passwordHash,
      });

      const accessToken = signAccessToken(user.id, user.role);
      const { token: refreshToken } = signRefreshToken(user.id, user.role);

      return {
        user,
        tokens: { accessToken, refreshToken },
      };
    },

    async login(input: LoginInput): Promise<{
      user: SafeUserProfile;
      tokens: { accessToken: string; refreshToken: string };
    }> {
      const normalizedEmail = input.email.trim().toLowerCase();
      const userRecord = await repo.findByEmail(normalizedEmail);

      if (!userRecord) {
        // Equalize response timing against non-existent accounts
        await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }

      const passwordMatches = await bcrypt.compare(
        input.password,
        userRecord.passwordHash,
      );

      if (!passwordMatches || !userRecord.isActive) {
        throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      }

      const { passwordHash: _omitted, ...safeUser } = userRecord;
      const accessToken = signAccessToken(safeUser.id, safeUser.role);
      const { token: refreshToken } = signRefreshToken(safeUser.id, safeUser.role);

      return {
        user: safeUser,
        tokens: { accessToken, refreshToken },
      };
    },

    async refreshSession(refreshToken: string | undefined): Promise<{
      user: SafeUserProfile;
      tokens: { accessToken: string; refreshToken: string };
    }> {
      if (!refreshToken) {
        throw new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED');
      }

      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        throw new AppError('Authentication required.', 401, 'INVALID_REFRESH_TOKEN');
      }

      if (revokedRefreshJtis.has(payload.jti)) {
        throw new AppError('Authentication required.', 401, 'REVOKED_REFRESH_TOKEN');
      }

      const user = await repo.findSafeById(payload.sub);
      if (!user || !user.isActive) {
        throw new AppError('Authentication required.', 401, 'USER_UNAVAILABLE');
      }

      // Rotate refresh token: revoke old token ID before issuing new pair
      revokedRefreshJtis.add(payload.jti);

      const accessToken = signAccessToken(user.id, user.role);
      const { token: nextRefreshToken } = signRefreshToken(user.id, user.role);

      return {
        user,
        tokens: { accessToken, refreshToken: nextRefreshToken },
      };
    },

    logout(refreshToken: string | undefined): void {
      if (!refreshToken) return;
      try {
        const payload = verifyRefreshToken(refreshToken);
        revokedRefreshJtis.add(payload.jti);
      } catch {
        // Ignore invalid/expired token on logout; cookies are still cleared
      }
    },

    async getCurrentUser(userId: string): Promise<SafeUserProfile> {
      const user = await repo.findSafeById(userId);
      if (!user || !user.isActive) {
        throw new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED');
      }
      return user;
    },
  };
}

export const authService = createAuthService();
