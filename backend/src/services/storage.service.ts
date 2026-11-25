import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSupabaseStorageConfigured } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ITEM_IMAGES_PER_REPORT = 4;
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_EVIDENCE_FILES_PER_CLAIM = 3;
export const SIGNED_EVIDENCE_URL_TTL_SECONDS = 120;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export interface UploadImageFileInput {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface StoredItemImageMetadata {
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface StoredClaimEvidenceMetadata {
  storageKey: string;
  mimeType: string;
  fileSize: number;
  extension: string;
}

export interface StorageAdapter {
  uploadItemImages(
    itemId: string,
    files: UploadImageFileInput[],
    startingOrder?: number,
  ): Promise<StoredItemImageMetadata[]>;
  deleteItemImages(storageKeys: string[]): Promise<void>;
}

export interface EvidenceStorageAdapter {
  uploadClaimEvidenceFiles(
    claimId: string,
    files: UploadImageFileInput[],
  ): Promise<StoredClaimEvidenceMetadata[]>;
  deleteClaimEvidenceFiles(storageKeys: string[]): Promise<void>;
  createSignedEvidenceUrl(
    storageKey: string,
    expiresInSeconds?: number,
  ): Promise<string | null>;
}

/**
 * Inspects file magic bytes to verify genuine image format independent of filename/extension.
 */
export function detectValidatedImageFormat(
  buffer: Buffer,
  declaredMime: string,
): { mimeType: string; extension: string } | null {
  if (buffer.length < 12) return null;

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg && declaredMime === 'image/jpeg') {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (isPng && declaredMime === 'image/png') {
    return { mimeType: 'image/png', extension: 'png' };
  }

  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (isWebp && declaredMime === 'image/webp') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  return null;
}

export function detectValidatedEvidenceFormat(
  buffer: Buffer,
  declaredMime: string,
): { mimeType: string; extension: string } | null {
  const imageFormat = detectValidatedImageFormat(buffer, declaredMime);
  if (imageFormat) return imageFormat;

  if (
    declaredMime === 'application/pdf' &&
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }

  return null;
}

export function validateUploadedImageFile(file: UploadImageFileInput): {
  mimeType: string;
  extension: string;
} {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      'Only JPEG, PNG, and WebP photographs are permitted.',
      400,
      'INVALID_IMAGE_MIME_TYPE',
    );
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new AppError(
      'Each item photograph must be between 1 byte and 5 MB.',
      400,
      'INVALID_IMAGE_SIZE',
    );
  }

  const detected = detectValidatedImageFormat(file.buffer, file.mimetype);
  if (!detected) {
    throw new AppError(
      'Uploaded file signature does not match a valid JPEG, PNG, or WebP image.',
      400,
      'INVALID_IMAGE_SIGNATURE',
    );
  }

  return detected;
}

export function validateUploadedEvidenceFile(file: UploadImageFileInput): {
  mimeType: string;
  extension: string;
} {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      'Supporting evidence files must be JPEG, PNG, WebP, or PDF documents.',
      400,
      'INVALID_EVIDENCE_MIME_TYPE',
    );
  }

  if (file.size <= 0 || file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    throw new AppError(
      'Each supporting evidence file must be between 1 byte and 5 MB.',
      400,
      'INVALID_EVIDENCE_SIZE',
    );
  }

  const detected = detectValidatedEvidenceFormat(file.buffer, file.mimetype);
  if (!detected) {
    throw new AppError(
      'Uploaded evidence file signature does not match a valid image or PDF document.',
      400,
      'INVALID_EVIDENCE_SIGNATURE',
    );
  }

  return detected;
}

function getSupabaseServerClient(): {
  client: SupabaseClient;
  itemBucket: string;
  evidenceBucket: string;
} {
  let config;
  try {
    config = assertSupabaseStorageConfigured();
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Supabase Storage is not configured.',
      503,
      'STORAGE_NOT_CONFIGURED',
    );
  }

  // Service-role client is instantiated strictly on the server and never leaked
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    client,
    itemBucket: config.itemBucket,
    evidenceBucket: config.evidenceBucket,
  };
}

export function createStorageService(
  clientFactory: () => {
    client: SupabaseClient;
    itemBucket: string;
    evidenceBucket: string;
  } = getSupabaseServerClient,
): StorageAdapter & EvidenceStorageAdapter {
  return {
    async uploadItemImages(
      itemId: string,
      files: UploadImageFileInput[],
      startingOrder = 0,
    ): Promise<StoredItemImageMetadata[]> {
      if (files.length === 0) return [];
      if (files.length > MAX_ITEM_IMAGES_PER_REPORT) {
        throw new AppError(
          `Maximum ${MAX_ITEM_IMAGES_PER_REPORT} photographs allowed per report.`,
          400,
          'TOO_MANY_IMAGES',
        );
      }

      // Validate all files before uploading any to storage
      const validatedFiles = files.map((file) => ({
        file,
        format: validateUploadedImageFile(file),
      }));

      const { client, itemBucket } = clientFactory();
      const uploaded: StoredItemImageMetadata[] = [];

      try {
        for (let idx = 0; idx < validatedFiles.length; idx += 1) {
          const { file, format } = validatedFiles[idx];
          // Strictly randomized storage key — never trust original filename
          const storageKey = `items/${itemId}/${randomUUID()}.${format.extension}`;

          const { error } = await client.storage
            .from(itemBucket)
            .upload(storageKey, file.buffer, {
              contentType: format.mimeType,
              upsert: false,
            });

          if (error) {
            throw new AppError(
              'Failed to upload item photograph to Supabase Storage.',
              502,
              'STORAGE_UPLOAD_FAILED',
            );
          }

          const { data: urlData } = client.storage
            .from(itemBucket)
            .getPublicUrl(storageKey);

          uploaded.push({
            storageKey,
            publicUrl: urlData.publicUrl,
            mimeType: format.mimeType,
            displayOrder: startingOrder + idx,
            isPrimary: startingOrder + idx === 0,
          });
        }

        return uploaded;
      } catch (err) {
        if (uploaded.length > 0) {
          await client.storage
            .from(itemBucket)
            .remove(uploaded.map((u) => u.storageKey))
            .catch(() => undefined);
        }
        throw err;
      }
    },

    async deleteItemImages(storageKeys: string[]): Promise<void> {
      if (storageKeys.length === 0) return;
      const { client, itemBucket } = clientFactory();
      await client.storage.from(itemBucket).remove(storageKeys);
    },

    async uploadClaimEvidenceFiles(
      claimId: string,
      files: UploadImageFileInput[],
    ): Promise<StoredClaimEvidenceMetadata[]> {
      if (files.length === 0) return [];
      if (files.length > MAX_EVIDENCE_FILES_PER_CLAIM) {
        throw new AppError(
          `Maximum ${MAX_EVIDENCE_FILES_PER_CLAIM} supporting evidence files allowed per claim.`,
          400,
          'TOO_MANY_EVIDENCE_FILES',
        );
      }

      const validatedFiles = files.map((file) => ({
        file,
        format: validateUploadedEvidenceFile(file),
      }));

      const { client, evidenceBucket } = clientFactory();
      const uploaded: StoredClaimEvidenceMetadata[] = [];

      try {
        for (const { file, format } of validatedFiles) {
          // Private evidence bucket only — strictly randomized key, never public URL
          const storageKey = `claims/${claimId}/${randomUUID()}.${format.extension}`;

          const { error } = await client.storage
            .from(evidenceBucket)
            .upload(storageKey, file.buffer, {
              contentType: format.mimeType,
              upsert: false,
            });

          if (error) {
            throw new AppError(
              'Failed to store private claim evidence file.',
              502,
              'EVIDENCE_UPLOAD_FAILED',
            );
          }

          uploaded.push({
            storageKey,
            mimeType: format.mimeType,
            fileSize: file.size,
            extension: format.extension,
          });
        }

        return uploaded;
      } catch (err) {
        if (uploaded.length > 0) {
          await client.storage
            .from(evidenceBucket)
            .remove(uploaded.map((u) => u.storageKey))
            .catch(() => undefined);
        }
        throw err;
      }
    },

    async deleteClaimEvidenceFiles(storageKeys: string[]): Promise<void> {
      if (storageKeys.length === 0) return;
      const { client, evidenceBucket } = clientFactory();
      await client.storage.from(evidenceBucket).remove(storageKeys);
    },

    async createSignedEvidenceUrl(
      storageKey: string,
      expiresInSeconds = SIGNED_EVIDENCE_URL_TTL_SECONDS,
    ): Promise<string | null> {
      if (!storageKey) return null;
      const { client, evidenceBucket } = clientFactory();
      const { data, error } = await client.storage
        .from(evidenceBucket)
        .createSignedUrl(storageKey, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    },
  };
}

export const storageService = createStorageService();
