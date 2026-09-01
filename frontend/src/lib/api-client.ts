export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

/** API origin for iframes/media — follows LAN hostname when env still points at localhost. */
export function resolveApiOrigin(): string {
  const configured = API_URL.replace(/\/api\/v1\/?$/, '');
  if (!isBrowser()) {
    return configured.startsWith('http') ? configured : '';
  }
  if (!configured || configured.startsWith('/')) {
    return window.location.origin;
  }
  try {
    const base = configured.startsWith('http') ? configured : `http://${configured}`;
    const url = new URL(base);
    if (url.hostname === 'localhost' && window.location.hostname !== 'localhost') {
      const port = url.port || '4000';
      return `${window.location.protocol}//${window.location.hostname}:${port}`;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return window.location.origin;
  }
}

/** Resolve API paths and rewrite hardcoded localhost URLs for LAN access. */
export function resolveApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (isBrowser() && /https?:\/\/localhost(?::4000)?/.test(path)) {
      return path.replace(/^https?:\/\/localhost(?::4000)?/, resolveApiOrigin());
    }
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/api/v1')) {
    return isBrowser() && !API_URL.startsWith('http') ? normalized : `${resolveApiOrigin()}${normalized}`;
  }
  const origin = resolveApiOrigin();
  return origin ? `${origin}${normalized}` : normalized;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

/** Soft flag for Next middleware; refresh JWT stays httpOnly. Keep in sync with middleware.ts */
export const AUTH_FLAG_COOKIE = "cor_logged_in";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function setAuthFlagCookie(loggedIn: boolean): void {
  if (!isBrowser()) return;
  if (loggedIn) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    // Align roughly with refresh TTL (7d); middleware only needs a presence flag.
    document.cookie = `${AUTH_FLAG_COOKIE}=1; Path=/; Max-Age=604800; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${AUTH_FLAG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function withCredentials(init: RequestInit = {}): RequestInit {
  return { ...init, credentials: "include" };
}

export function setTokens(access: string, _refresh?: string): void {
  accessToken = access;
  setAuthFlagCookie(true);
}

export function clearTokens(): void {
  accessToken = null;
  setAuthFlagCookie(false);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function hydrateRefreshToken(): void {
  // Refresh lives in an httpOnly cookie; nothing to hydrate from storage.
}

/** Restore access token from refresh cookie before the first authenticated request. */
export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken) return accessToken;
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, withCredentials({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }));
        if (!res.ok) {
          clearTokens();
          return null;
        }
        const json = await res.json();
        const payload =
          json && typeof json === 'object' && 'success' in json && json.success
            ? json.data
            : json;
        const access =
          payload?.accessToken ?? payload?.tokens?.accessToken;
        if (!access) {
          clearTokens();
          return null;
        }
        setTokens(access as string);
        return access as string;
      } catch {
        clearTokens();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
  idempotent?: boolean;
}

export function idempotencyHeaders(): Record<string, string> {
  return { 'Idempotency-Key': crypto.randomUUID() };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, skipRefresh = false, idempotent, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (idempotent) {
    headers['Idempotency-Key'] = headers['Idempotency-Key'] ?? crypto.randomUUID();
  }

  if (auth) {
    const token = await ensureAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  let response = await fetch(url, withCredentials({
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));

  if (response.status === 401 && auth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, withCredentials({
        ...rest,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }));
    }
  }

  return parseApiJson<T>(response);
}

async function parseApiJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const json = await response.json();

  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      throw new ApiClientError(
        json.error?.message ?? 'Request failed',
        json.error?.code ?? 'UNKNOWN',
        response.status,
        json.error?.details,
      );
    }
    return json.data as T;
  }

  if (!response.ok) {
    throw new ApiClientError(
      json.error?.message ?? 'Request failed',
      json.error?.code ?? 'UNKNOWN',
      response.status,
      json.error?.details,
    );
  }

  return json as T;
}

export async function apiGetBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const {
    auth = true,
    skipRefresh = false,
    headers: customHeaders,
    body: _body,
    idempotent: _idempotent,
    ...rest
  } = options;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (auth) {
    const token = await ensureAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const init = withCredentials({ ...rest, method: 'GET' as const, headers });
  let response = await fetch(url, init);

  if (response.status === 401 && auth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, withCredentials({ ...init, headers }));
    }
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const json = await response.json();
      message = json.error?.message ?? json.message ?? message;
    } catch {
      // ignore parse errors for blob responses
    }
    throw new ApiClientError(message, 'UNKNOWN', response.status);
  }

  return response.blob();
}

export async function apiUploadForm<T>(
  path: string,
  file: File,
  fieldName = 'file',
): Promise<T> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  let response = await fetch(url, withCredentials({ method: 'POST', headers, body: formData }));

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, withCredentials({ method: 'POST', headers, body: formData }));
    }
  }

  return parseApiJson<T>(response);
}

export async function apiUploadBinary<T>(
  path: string,
  body: Blob,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    ...extraHeaders,
  };
  const token = await ensureAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  let response = await fetch(url, withCredentials({ method: 'POST', headers, body }));

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, withCredentials({ method: 'POST', headers, body }));
    }
  }

  return parseApiJson<T>(response);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  getBlob: apiGetBlob,
  uploadForm: apiUploadForm,
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'DELETE' }),
  uploadBinary: apiUploadBinary,
};
