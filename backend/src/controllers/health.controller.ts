import type { Request, Response } from 'express';
import { healthService } from '../services/health.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthController = {
  getHealth(_req: Request, res: Response) {
    const payload = healthService.getServiceStatus();
    res.status(200).json({ ok: true, data: payload });
  },

  getDatabaseHealth: asyncHandler(async (_req: Request, res: Response) => {
    const readiness = await healthService.getDatabaseReadiness();
    const statusCode = readiness.status === 'connected' ? 200 : 503;
    res.status(statusCode).json({
      ok: readiness.status === 'connected',
      data: readiness,
    });
  }),
};
