import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test, { after, before } from 'node:test';
import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, type User } from '@prisma/client';
import { createApp } from '../src/app.js';
import {
  authorizeRoles,
  createAuthenticateMiddleware,
  requireOwnership,
} from '../src/middleware/index.js';
import type {
  AuthRepository,
  CreateStudentUserRecord,
  SafeUserProfile,
} from '../src/models/index.js';
import { createAuthService } from '../src/services/auth.service.js';
import { signAccessToken } from '../src/utils/jwt.js';

process.env.NODE_ENV = 'test';
process.env.ALLOWED_EMAIL_DOMAINS = 'university.edu,safety.university.edu';
process.env.BCRYPT_ROUNDS = '10';
process.env.CORS_ORIGIN = 'http://localhost:3000';

class InMemoryAuthRepository implements AuthRepository {
  public users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findByCampusId(campusId: string): Promise<SafeUserProfile | null> {
    const found = this.users.find((u) => u.campusId === campusId);
    if (!found) return null;
    const { passwordHash: _omitted, ...safe } = found;
    return safe;
  }

  async findSafeById(id: string): Promise<SafeUserProfile | null> {
    const found = this.users.find((u) => u.id === id);
    if (!found) return null;
    const { passwordHash: _omitted, ...safe } = found;
    return safe;
  }

  async createStudentAndAudit(
    data: CreateStudentUserRecord,
  ): Promise<SafeUserProfile> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email,
      campusId: data.campusId,
      fullName: data.fullName,
      department: data.department,
      role: UserRole.STUDENT,
      passwordHash: data.passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(user);
    const { passwordHash: _omitted, ...safe } = user;
    return safe;
  }

  seedAdmin(user: User) {
    this.users.push(user);
  }
}

function parseSetCookieHeader(setCookies: string[]) {
  const jar: Record<string, { value: string; raw: string }> = {};
  for (const rawCookie of setCookies) {
    const [pair] = rawCookie.split(';');
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const name = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      jar[name] = { value, raw: rawCookie };
    }
  }
  return jar;
}

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
const repo = new InMemoryAuthRepository();

before(async () => {
  const adminHash = await bcrypt.hash('AdminTestPass!99', 10);
  repo.seedAdmin({
    id: randomUUID(),
    email: 'admin.test@safety.university.edu',
    campusId: 'STF-90001',
    fullName: 'Safety Admin Test',
    department: 'Campus Safety',
    role: UserRole.ADMIN,
    passwordHash: adminHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const authenticate = createAuthenticateMiddleware(repo);

  // Test-only protected routes to verify RBAC and resource ownership middleware
  const testProtected = express.Router();
  testProtected.get(
    '/admin-only',
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    (_req, res) => {
      res.status(200).json({ ok: true, scope: 'admin' });
    },
  );
  testProtected.get(
    '/reports/:ownerId',
    authenticate,
    requireOwnership((req) => req.params.ownerId),
    (_req, res) => {
      res.status(200).json({ ok: true, scope: 'owner-or-admin' });
    },
  );

  const app = createApp({ authRepo: repo, extraRouter: testProtected });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('Registration creates STUDENT only, hashes password with bcrypt, and hides tokens/hash from JSON', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alex Rivera',
      email: 'alex.rivera@university.edu',
      campusId: 'STU-77101',
      department: 'Engineering',
      password: 'Password123',
    }),
  });

  assert.equal(res.status, 201);
  const body = (await res.json()) as {
    ok: boolean;
    data: { user: Record<string, unknown> };
  };

  assert.equal(body.ok, true);
  assert.equal(body.data.user.role, UserRole.STUDENT);
  assert.equal(body.data.user.email, 'alex.rivera@university.edu');
  assert.equal('passwordHash' in body.data.user, false);
  assert.equal('accessToken' in body.data, false);
  assert.equal('refreshToken' in body.data, false);

  const stored = await repo.findByEmail('alex.rivera@university.edu');
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, 'Password123');
  assert.equal(await bcrypt.compare('Password123', stored.passwordHash), true);

  const cookies = parseSetCookieHeader(res.headers.getSetCookie());
  assert.ok(cookies.access_token);
  assert.match(cookies.access_token.raw, /HttpOnly/i);
  assert.ok(cookies.refresh_token);
  assert.match(cookies.refresh_token.raw, /HttpOnly/i);
  assert.ok(cookies.csrf_token);
});

test('Privilege escalation via registration body (role: ADMIN) is rejected by strict Zod validation', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Malicious Escalation',
      email: 'escalate@university.edu',
      campusId: 'STU-77102',
      department: 'Engineering',
      password: 'Password123',
      role: 'ADMIN',
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(await repo.findByEmail('escalate@university.edu'), null);
});

test('Service-level registration enforces STUDENT role even if untyped extra role property is passed', async () => {
  const service = createAuthService(repo);
  const maliciousPayload = {
    fullName: 'Direct Service Test',
    email: 'direct.service@university.edu',
    campusId: 'STU-77103',
    department: 'Physics',
    password: 'Password123',
    role: 'ADMIN',
  } as unknown as Parameters<typeof service.registerStudent>[0];

  const result = await service.registerStudent(maliciousPayload);
  assert.equal(result.user.role, UserRole.STUDENT);
});

test('Registration rejects non-university email domains not listed in ALLOWED_EMAIL_DOMAINS', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'External User',
      email: 'external.person@gmail.com',
      campusId: 'STU-77104',
      department: 'Physics',
      password: 'Password123',
    }),
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { ok: boolean; error: { code: string } };
  assert.equal(body.error.code, 'DISALLOWED_EMAIL_DOMAIN');
});

test('Login returns identical generic 401 error for unknown email and incorrect password', async () => {
  const wrongEmailRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nobody@university.edu',
      password: 'Password123',
    }),
  });

  const wrongPasswordRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.rivera@university.edu',
      password: 'WrongPassword999',
    }),
  });

  assert.equal(wrongEmailRes.status, 401);
  assert.equal(wrongPasswordRes.status, 401);

  const err1 = (await wrongEmailRes.json()) as { error: { message: string } };
  const err2 = (await wrongPasswordRes.json()) as { error: { message: string } };
  assert.equal(err1.error.message, 'Invalid email or password.');
  assert.equal(err2.error.message, err1.error.message);
});

test('Authenticated /me succeeds with HttpOnly cookie and rejects tampered or unauthenticated requests', async () => {
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.rivera@university.edu',
      password: 'Password123',
    }),
  });
  assert.equal(loginRes.status, 200);
  const cookies = parseSetCookieHeader(loginRes.headers.getSetCookie());

  const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: {
      Cookie: `access_token=${cookies.access_token.value}`,
    },
  });
  assert.equal(meRes.status, 200);
  const meBody = (await meRes.json()) as {
    ok: boolean;
    data: { user: { email: string; role: string } };
  };
  assert.equal(meBody.data.user.email, 'alex.rivera@university.edu');
  assert.equal(meBody.data.user.role, UserRole.STUDENT);

  const unauthRes = await fetch(`${baseUrl}/api/v1/auth/me`);
  assert.equal(unauthRes.status, 401);

  const forgedJwt = jwt.sign(
    { sub: 'fake-id', role: UserRole.ADMIN, type: 'access' },
    'wrong-signing-secret-at-least-32-chars',
    { algorithm: 'HS256' },
  );
  const forgedRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${forgedJwt}` },
  });
  assert.equal(forgedRes.status, 401);
});

test('Authorization blocks STUDENT from ADMIN routes and blocks cross-user resource access', async () => {
  const student = await repo.findByEmail('alex.rivera@university.edu');
  const admin = await repo.findByEmail('admin.test@safety.university.edu');
  assert.ok(student && admin);

  const studentToken = signAccessToken(student.id, UserRole.STUDENT);
  const adminToken = signAccessToken(admin.id, UserRole.ADMIN);

  // Student attempting to access ADMIN route -> 403
  const studentOnAdminRoute = await fetch(
    `${baseUrl}/api/v1/__test/admin-only`,
    {
      headers: { Authorization: `Bearer ${studentToken}` },
    },
  );
  assert.equal(studentOnAdminRoute.status, 403);

  // Admin accessing ADMIN route -> 200
  const adminOnAdminRoute = await fetch(
    `${baseUrl}/api/v1/__test/admin-only`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  assert.equal(adminOnAdminRoute.status, 200);

  // Student accessing another user's resource -> 403
  const otherUserResource = await fetch(
    `${baseUrl}/api/v1/__test/reports/${admin.id}`,
    {
      headers: { Authorization: `Bearer ${studentToken}` },
    },
  );
  assert.equal(otherUserResource.status, 403);

  // Student accessing own resource -> 200
  const ownResource = await fetch(
    `${baseUrl}/api/v1/__test/reports/${student.id}`,
    {
      headers: { Authorization: `Bearer ${studentToken}` },
    },
  );
  assert.equal(ownResource.status, 200);

  // Admin accessing student's resource -> 200
  const adminOverride = await fetch(
    `${baseUrl}/api/v1/__test/reports/${student.id}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  assert.equal(adminOverride.status, 200);
});

test('CSRF protection rejects cookie-authenticated logout without matching X-CSRF-Token and allows valid logout', async () => {
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.rivera@university.edu',
      password: 'Password123',
    }),
  });
  const cookies = parseSetCookieHeader(loginRes.headers.getSetCookie());

  // Missing CSRF header -> 403
  const missingCsrfRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: `access_token=${cookies.access_token.value}; refresh_token=${cookies.refresh_token.value}; csrf_token=${cookies.csrf_token.value}`,
    },
  });
  assert.equal(missingCsrfRes.status, 403);

  // Disallowed Origin -> 403
  const badOriginRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example.com',
      Cookie: `access_token=${cookies.access_token.value}; refresh_token=${cookies.refresh_token.value}; csrf_token=${cookies.csrf_token.value}`,
      'X-CSRF-Token': cookies.csrf_token.value,
    },
  });
  assert.equal(badOriginRes.status, 403);

  // Valid CSRF header + allowed Origin -> 200 and clears cookies
  const validLogoutRes = await fetch(`${baseUrl}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: `access_token=${cookies.access_token.value}; refresh_token=${cookies.refresh_token.value}; csrf_token=${cookies.csrf_token.value}`,
      'X-CSRF-Token': cookies.csrf_token.value,
    },
  });
  assert.equal(validLogoutRes.status, 200);

  // Replay of revoked refresh token -> 401
  const replayRefreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: `refresh_token=${cookies.refresh_token.value}; csrf_token=${cookies.csrf_token.value}`,
      'X-CSRF-Token': cookies.csrf_token.value,
    },
  });
  assert.equal(replayRefreshRes.status, 401);
});
