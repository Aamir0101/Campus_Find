import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@prisma/client';
import { createItemController } from '../controllers/item.controller.js';
import {
  authorizeRoles,
  createAuthenticateMiddleware,
  createOptionalAuthenticateMiddleware,
  csrfProtection,
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/index.js';
import type {
  AuthRepository,
  ItemRepository,
  MatchRepository,
} from '../models/index.js';
import { prismaAuthRepository } from '../services/auth.service.js';
import { prismaItemRepository } from '../services/item.service.js';
import { prismaMatchRepository } from '../services/matching.service.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_ITEM_IMAGES_PER_REPORT,
  storageService,
  type StorageAdapter,
} from '../services/storage.service.js';
import { AppError } from '../utils/AppError.js';
import {
  createItemSchema,
  itemIdParamSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from '../validators/item.validator.js';

const uploadItemPhotos = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE_BYTES,
    files: MAX_ITEM_IMAGES_PER_REPORT,
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new AppError(
          'Only JPEG, PNG, and WebP photographs are permitted.',
          400,
          'INVALID_IMAGE_MIME_TYPE',
        ),
      );
    }
    return callback(null, true);
  },
});

export function createItemRouter(options?: {
  authRepo?: AuthRepository;
  itemRepo?: ItemRepository;
  matchRepo?: MatchRepository;
  storage?: StorageAdapter;
}) {
  const router = Router();
  const authRepo = options?.authRepo ?? prismaAuthRepository;
  const itemRepo = options?.itemRepo ?? prismaItemRepository;
  const matchRepo =
    options?.matchRepo ?? (options?.itemRepo ? undefined : prismaMatchRepository);
  const storage = options?.storage ?? storageService;

  const authenticate = createAuthenticateMiddleware(authRepo);
  const optionalAuthenticate = createOptionalAuthenticateMiddleware(authRepo);
  const controller = createItemController(itemRepo, storage, matchRepo);

  router.get('/metadata', controller.getMetadata);

  router.get(
    '/',
    optionalAuthenticate,
    validateQuery(listItemsQuerySchema),
    controller.listItems,
  );

  router.get(
    '/:id',
    optionalAuthenticate,
    validateParams(itemIdParamSchema),
    controller.getItemById,
  );

  router.post(
    '/',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.STUDENT),
    uploadItemPhotos.array('images', MAX_ITEM_IMAGES_PER_REPORT),
    validateBody(createItemSchema),
    controller.createItem,
  );

  router.patch(
    '/:id',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.STUDENT),
    validateParams(itemIdParamSchema),
    uploadItemPhotos.array('images', MAX_ITEM_IMAGES_PER_REPORT),
    validateBody(updateItemSchema),
    controller.updateItem,
  );

  router.delete(
    '/:id',
    csrfProtection,
    authenticate,
    authorizeRoles(UserRole.STUDENT),
    validateParams(itemIdParamSchema),
    controller.withdrawItem,
  );

  return router;
}

export const itemRouter = createItemRouter();
