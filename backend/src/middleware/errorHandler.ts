import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'IMAGE_FILE_TOO_LARGE',
          message: 'Each item photograph must be 5 MB or smaller.',
        },
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'TOO_MANY_IMAGES',
          message: 'Maximum 4 item photographs are allowed per report.',
        },
      });
    }
    return res.status(400).json({
      ok: false,
      error: {
        code: 'IMAGE_UPLOAD_ERROR',
        message: 'Invalid image upload request.',
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (
    err instanceof jwt.TokenExpiredError ||
    err instanceof jwt.JsonWebTokenError
  ) {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required.',
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this unique identifier already exists.',
        },
      });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'FOREIGN_KEY_CONSTRAINT',
          message: 'Referenced relation record does not exist or cannot be removed.',
        },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found.',
        },
      });
    }

    logger.error('Prisma request error', { prismaCode: err.code });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database operation failed.',
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  logger.error('Unhandled backend error', {
    errorName: err instanceof Error ? err.name : 'UnknownError',
  });

  return res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
}
