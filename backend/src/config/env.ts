import { randomBytes } from 'node:crypto';
import 'dotenv/config';
import { z } from 'zod';

const postgresUrlSchema = z
  .string()
  .trim()
  .min(1, 'Database URL is required')
  .refine(
    (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
    'Must be a valid PostgreSQL connection string (postgresql:// or postgres://)',
  );

const httpsUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine(
    (val) => val.startsWith('https://') || val.startsWith('http://'),
    'Must use http:// or https://',
  );

// Process-scoped fallback signing keys for local dev/test when env secrets are unset.
// Production startup requires explicit >= 32-character secrets from process.env.
const ephemeralAccessSecret = randomBytes(32).toString('hex');
const ephemeralRefreshSecret = randomBytes(32).toString('hex');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().trim().min(1).default('http://localhost:3000'),
  DATABASE_URL: postgresUrlSchema.optional(),
  DIRECT_URL: postgresUrlSchema.optional(),
  SUPABASE_URL: httpsUrlSchema.optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().trim().min(1).default('campusfind-item-images'),
  SUPABASE_EVIDENCE_BUCKET: z.string().trim().min(1).default('campusfind-claim-evidence'),
  ALLOWED_EMAIL_DOMAINS: z.string().trim().min(1).default('university.edu'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(2).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().min(2).default('7d'),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
});

export interface BackendEnv extends z.infer<typeof envSchema> {
  resolvedAccessSecret: string;
  resolvedRefreshSecret: string;
  allowedEmailDomainsList: string[];
}

export function loadEnv(): BackendEnv {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    DIRECT_URL: process.env.DIRECT_URL || undefined,
    SUPABASE_URL: process.env.SUPABASE_URL || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || undefined,
    SUPABASE_EVIDENCE_BUCKET: process.env.SUPABASE_EVIDENCE_BUCKET || undefined,
    ALLOWED_EMAIL_DOMAINS: process.env.ALLOWED_EMAIL_DOMAINS || undefined,
    BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || undefined,
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || undefined,
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || undefined,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || undefined,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || undefined,
  });

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend environment configuration: ${formatted}`);
  }

  const data = parsed.data;

  if (data.NODE_ENV === 'production') {
    if (!data.JWT_ACCESS_SECRET || !data.JWT_REFRESH_SECRET) {
      throw new Error(
        'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (min 32 chars) must be set in production.',
      );
    }
  }

  const allowedEmailDomainsList = data.ALLOWED_EMAIL_DOMAINS.split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  if (allowedEmailDomainsList.length === 0) {
    throw new Error('ALLOWED_EMAIL_DOMAINS must include at least one domain.');
  }

  return {
    ...data,
    resolvedAccessSecret: data.JWT_ACCESS_SECRET ?? ephemeralAccessSecret,
    resolvedRefreshSecret: data.JWT_REFRESH_SECRET ?? ephemeralRefreshSecret,
    allowedEmailDomainsList,
  };
}

export function assertDatabaseEnvConfigured(): {
  databaseUrl: string;
  directUrl: string;
} {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Configure your Supabase pooled PostgreSQL connection string in backend/.env.',
    );
  }
  if (!env.DIRECT_URL) {
    throw new Error(
      'DIRECT_URL is not set. Configure your Supabase direct PostgreSQL connection string in backend/.env.',
    );
  }
  return {
    databaseUrl: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  };
}

export function assertSupabaseStorageConfigured(): {
  supabaseUrl: string;
  serviceRoleKey: string;
  itemBucket: string;
  evidenceBucket: string;
} {
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.',
    );
  }
  return {
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    itemBucket: env.SUPABASE_STORAGE_BUCKET,
    evidenceBucket: env.SUPABASE_EVIDENCE_BUCKET,
  };
}
