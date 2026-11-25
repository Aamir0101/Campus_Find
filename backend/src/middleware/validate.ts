import type { NextFunction, Request, Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

export function validateBody<T>(schema: ZodType<T, ZodTypeDef, unknown>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T, ZodTypeDef, unknown>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.query);
    req.query = parsed as Request['query'];
    next();
  };
}

export function validateParams<T>(schema: ZodType<T, ZodTypeDef, unknown>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.params);
    req.params = parsed as Request['params'];
    next();
  };
}
