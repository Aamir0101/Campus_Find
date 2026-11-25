import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Router } from 'express';
import helmet from 'helmet';
import { loadEnv } from './config/env.js';
import { apiRateLimiter, errorHandler, notFoundHandler } from './middleware/index.js';
import type {
  AuditLogRepository,
  AuthRepository,
  ClaimRepository,
  ItemRepository,
  MatchRepository,
} from './models/index.js';
import { createApiRouter } from './routes/index.js';
import type {
  EvidenceStorageAdapter,
  StorageAdapter,
} from './services/storage.service.js';

export function createApp(options?: {
  authRepo?: AuthRepository;
  itemRepo?: ItemRepository;
  matchRepo?: MatchRepository;
  claimRepo?: ClaimRepository;
  auditRepo?: AuditLogRepository;
  storage?: StorageAdapter;
  evidenceStorage?: EvidenceStorageAdapter;
  extraRouter?: Router;
}): Application {
  const env = loadEnv();
  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const app = express();

  app.disable('x-powered-by');
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(apiRateLimiter);

  app.use(
    '/api/v1',
    createApiRouter({
      authRepo: options?.authRepo,
      itemRepo: options?.itemRepo,
      matchRepo: options?.matchRepo,
      claimRepo: options?.claimRepo,
      auditRepo: options?.auditRepo,
      storage: options?.storage,
      evidenceStorage: options?.evidenceStorage,
      extraRouter: options?.extraRouter,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
