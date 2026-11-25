import { PrismaClient } from '@prisma/client';
import { assertDatabaseEnvConfigured } from './env.js';

declare global {
  var __campusFindPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient =
  globalThis.__campusFindPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__campusFindPrisma = prisma;
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    assertDatabaseEnvConfigured();
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Database connectivity check failed';
    return {
      connected: false,
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
