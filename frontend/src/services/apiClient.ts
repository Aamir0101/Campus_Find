import type { PreviewStateMode } from '../types/domain';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: ApiErrorDetail[];
  };
}

function readCsrfCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const entry of cookies) {
    const trimmed = entry.trim();
    if (trimmed.startsWith('csrf_token=')) {
      return decodeURIComponent(trimmed.slice('csrf_token='.length));
    }
  }
  return undefined;
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptSilentTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const csrfToken = readCsrfCookie();
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAutoRefresh?: boolean } = {},
): Promise<T> {
  const { skipAutoRefresh, headers: customHeaders, body, method = 'GET', ...rest } = options;

  const upperMethod = method.toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(upperMethod);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers = new Headers(customHeaders);
  if (!isFormData && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (isMutation) {
    const csrfToken = readCsrfCookie();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      method: upperMethod,
      body,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiClientError(
      'Unable to reach the CampusFind server. Ensure the backend service is running on port 4000.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (
    response.status === 401 &&
    !skipAutoRefresh &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/register') &&
    !path.includes('/auth/refresh')
  ) {
    const refreshed = await attemptSilentTokenRefresh();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipAutoRefresh: true });
    }
  }

  const contentType = response.headers.get('content-type') ?? '';
  let parsed: ApiEnvelope<T> | null = null;
  if (contentType.includes('application/json')) {
    parsed = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  }

  if (!response.ok || !parsed?.ok) {
    const message =
      parsed?.error?.message ??
      (response.status === 401
        ? 'Please sign in with your university account to continue.'
        : `Request failed with status ${response.status}.`);
    const code = parsed?.error?.code ?? 'HTTP_ERROR';
    const details = parsed?.error?.details ?? [];
    throw new ApiClientError(message, response.status, code, details);
  }

  return parsed.data as T;
}

/**
 * Preview-mode helpers retained strictly for Phase 5/6/7 workflows
 * (Matching, Claims, Audit) that do not have backend endpoints yet.
 */
let activePreviewStateMode: PreviewStateMode = 'populated';

export function setPreviewStateMode(mode: PreviewStateMode): void {
  activePreviewStateMode = mode;
}

export function getPreviewStateMode(): PreviewStateMode {
  return activePreviewStateMode;
}

export async function simulatePreviewRequest<T>(
  resolver: () => T,
  emptyFallback: T,
  delayMs = 220,
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (activePreviewStateMode === 'loading') {
    await new Promise((resolve) => setTimeout(resolve, 1600));
    return resolver();
  }

  if (activePreviewStateMode === 'error') {
    throw new Error(
      'Preview Network Notice: Unable to load records in simulated error state. Switch back to Populated mode or retry.',
    );
  }

  if (activePreviewStateMode === 'empty') {
    return emptyFallback;
  }

  return resolver();
}
