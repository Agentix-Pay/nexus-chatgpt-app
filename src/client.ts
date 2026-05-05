/**
 * Thin Nexus API client used by the App's tool handlers.
 *
 * Each tool call is made on behalf of either:
 *   - an authenticated end shopper (using their per-session JWT from the
 *     ChatGPT OAuth flow), OR
 *   - an unauthenticated browse session (using the App's fallback ISV API key
 *     for read-only operations like list/search/getProduct).
 *
 * For chargeable operations (createCheckout completion, handoff to in-app
 * payment), the JWT is required.
 */

const BASE_URL = process.env['NEXUS_BASE_URL'] ?? 'https://agentix-nexus.fly.dev';

export interface ApiCallOptions {
  /** User JWT from the OAuth session — preferred when present. */
  jwt?: string;
  /** Fallback ISV API key for read-only public operations. */
  fallbackApiKey?: string;
  /** Additional headers (rare). */
  headers?: Record<string, string>;
  /** Timeout in ms (default 15s). */
  timeoutMs?: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body: unknown | undefined,
  opts: ApiCallOptions,
): Promise<ApiResult<T>> {
  const auth = opts.jwt ?? opts.fallbackApiKey;
  if (!auth) {
    return { ok: false, status: 401, code: 'NO_AUTH', message: 'No JWT or fallback API key supplied' };
  }

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: { code?: string; message?: string } };
    if (!res.ok || json.success === false) {
      return {
        ok: false,
        status: res.status,
        code: json.error?.code ?? 'NEXUS_ERROR',
        message: json.error?.message ?? `Nexus returned ${res.status}`,
      };
    }
    return { ok: true, data: json.data as T };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    return {
      ok: false,
      status: 502,
      code: e.name === 'AbortError' ? 'NEXUS_TIMEOUT' : 'NEXUS_NETWORK_ERROR',
      message: e.message ?? 'Network error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const nexus = {
  get: <T>(path: string, opts: ApiCallOptions): Promise<ApiResult<T>> => call<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts: ApiCallOptions): Promise<ApiResult<T>> => call<T>('POST', path, body, opts),
  patch: <T>(path: string, body: unknown, opts: ApiCallOptions): Promise<ApiResult<T>> => call<T>('PATCH', path, body, opts),
};
