import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthenticateMiddleware } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthRepository } from '../models/index.js';
import { createAuthService, prismaAuthRepository } from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.validator.js';

export function createAuthRouter(repo: AuthRepository = prismaAuthRepository) {
  const router = Router();
  const service = createAuthService(repo);
  const controller = createAuthController(service);
  const authenticate = createAuthenticateMiddleware(repo);

  router.post(
    '/register',
    authRateLimiter,
    csrfProtection,
    validateBody(registerSchema),
    controller.register,
  );

  router.post(
    '/login',
    authRateLimiter,
    csrfProtection,
    validateBody(loginSchema),
    controller.login,
  );

  router.post('/refresh', authRateLimiter, csrfProtection, controller.refresh);

  router.post('/logout', csrfProtection, controller.logout);

  router.get('/me', authenticate, controller.me);

  return router;
}

export const authRouter = createAuthRouter();
