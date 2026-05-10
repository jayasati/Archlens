import { API_BASE_URL, SERVER_API_BASE_URL } from '../constants';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
    public readonly body: unknown
  ) {
    super(`API ${status} ${statusText} on ${url}`);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  token?: string | null;
}

function buildUrl(path: string, query: ApiRequestOptions['query'], base: string): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (res.status === 204) return null;
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function doFetch<T>(path: string, options: ApiRequestOptions, base: string): Promise<T> {
  const { query, body, token, headers, ...rest } = options;
  const url = buildUrl(path, query, base);

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has('content-type')) {
    finalHeaders.set('content-type', 'application/json');
  }
  if (token) finalHeaders.set('authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: rest.cache ?? 'no-store',
  });

  if (!res.ok) {
    const errorBody = await parseBody(res).catch(() => null);
    throw new ApiError(res.status, res.statusText, url, errorBody);
  }

  return (await parseBody(res)) as T;
}

/** Browser-side API client. Reads NEXT_PUBLIC_API_URL. */
export function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return doFetch<T>(path, options, API_BASE_URL);
}

/** Server-side API client (route handlers, RSCs). Reads ARCHLENS_API_URL. */
export function serverApiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return doFetch<T>(path, options, SERVER_API_BASE_URL);
}
