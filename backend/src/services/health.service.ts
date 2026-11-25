import { checkDatabaseConnection } from '../config/prisma.js';
import type { DatabaseReadinessReport } from '../models/index.js';

export const healthService = {
  getServiceStatus() {
    return {
      service: 'campusfind-backend',
      phase: 'phase-2-database-foundation',
      timestamp: new Date().toISOString(),
    };
  },

  async getDatabaseReadiness(): Promise<DatabaseReadinessReport> {
    const result = await checkDatabaseConnection();

    if (!result.connected) {
      return {
        status: 'unconfigured_or_unreachable',
        latencyMs: result.latencyMs,
        message:
          result.error ??
          'Database connection could not be verified. Check DATABASE_URL and DIRECT_URL.',
      };
    }

    return {
      status: 'connected',
      latencyMs: result.latencyMs,
      message: 'PostgreSQL connection verified via Prisma.',
    };
  },
};
