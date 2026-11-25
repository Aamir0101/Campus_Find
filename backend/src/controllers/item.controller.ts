import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/authenticate.js';
import type { ItemRepository, MatchRepository } from '../models/index.js';
import {
  createItemService,
  prismaItemRepository,
} from '../services/item.service.js';
import {
  createMatchingService,
  prismaMatchRepository,
} from '../services/matching.service.js';
import {
  storageService,
  type StorageAdapter,
  type UploadImageFileInput,
} from '../services/storage.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  CreateItemInput,
  ListItemsQuery,
  UpdateItemInput,
} from '../validators/item.validator.js';

function extractUploadedFiles(req: AuthenticatedRequest): UploadImageFileInput[] {
  if (!req.files || !Array.isArray(req.files)) {
    return [];
  }

  return req.files.map((file) => ({
    buffer: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
  }));
}

export function createItemController(
  repo: ItemRepository = prismaItemRepository,
  storage: StorageAdapter = storageService,
  matchRepo: MatchRepository = prismaMatchRepository,
) {
  const matchingHook = createMatchingService(matchRepo);
  const service = createItemService(repo, storage, matchingHook);

  return {
    async getMetadata(
      _req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const metadata = await service.listMetadata();
        return res.status(200).json({
          ok: true,
          data: metadata,
        });
      } catch (error) {
        return next(error);
      }
    },

    async listItems(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const query = req.query as unknown as ListItemsQuery;
        const result = await service.listItems(query, req.user);
        return res.status(200).json({
          ok: true,
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    async getItemById(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        const item = await service.getItemById(req.params.id, req.user);
        return res.status(200).json({
          ok: true,
          data: { item },
        });
      } catch (error) {
        return next(error);
      }
    },

    async createItem(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const input = req.body as CreateItemInput;
        const files = extractUploadedFiles(req);
        const item = await service.createItem(input, files, req.user);

        return res.status(201).json({
          ok: true,
          data: { item },
        });
      } catch (error) {
        return next(error);
      }
    },

    async updateItem(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const input = req.body as UpdateItemInput;
        const files = extractUploadedFiles(req);
        const item = await service.updateItem(
          req.params.id,
          input,
          files,
          req.user,
        );

        return res.status(200).json({
          ok: true,
          data: { item },
        });
      } catch (error) {
        return next(error);
      }
    },

    async withdrawItem(
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction,
    ) {
      try {
        if (!req.user) {
          return next(
            new AppError('Authentication required.', 401, 'AUTHENTICATION_REQUIRED'),
          );
        }

        const item = await service.withdrawItem(req.params.id, req.user);

        return res.status(200).json({
          ok: true,
          data: { item },
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

export const itemController = createItemController();
