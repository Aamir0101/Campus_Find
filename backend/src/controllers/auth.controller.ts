import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  setAuthCookies,
} from '../utils/cookies.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js';

export function createAuthController(service = authService) {
  return {
    register: asyncHandler(async (req: Request, res: Response) => {
      const input = req.body as RegisterInput;
      const { user, tokens } = await service.registerStudent(input);

      // Tokens are issued strictly via HttpOnly cookies and never returned in JSON bodies
      setAuthCookies(req, res, tokens);

      res.status(201).json({
        ok: true,
        data: { user },
      });
    }),

    login: asyncHandler(async (req: Request, res: Response) => {
      const input = req.body as LoginInput;
      const { user, tokens } = await service.login(input);

      setAuthCookies(req, res, tokens);

      res.status(200).json({
        ok: true,
        data: { user },
      });
    }),

    refresh: asyncHandler(async (req: Request, res: Response) => {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      const { user, tokens } = await service.refreshSession(refreshToken);

      setAuthCookies(req, res, tokens);

      res.status(200).json({
        ok: true,
        data: { user },
      });
    }),

    logout: asyncHandler(async (req: Request, res: Response) => {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
      service.logout(refreshToken);
      clearAuthCookies(req, res);

      res.status(200).json({
        ok: true,
        data: { message: 'Logged out successfully.' },
      });
    }),

    me: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.id ?? '';
      const user = await service.getCurrentUser(userId);

      res.status(200).json({
        ok: true,
        data: { user },
      });
    }),
  };
}

export const authController = createAuthController();
