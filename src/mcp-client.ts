/**
 * Core-MCP client used by the App's tool handlers.
 *
 * AGX-158 (slim the ChatGPT app): the commerce tools no longer re-implement
 * catalog/checkout logic against the REST API — they delegate to the **core
 * Nexus MCP server** (`<NEXUS_BASE_URL>/mcp`, Streamable HTTP). One tool
 * implementation, every host; this app keeps only the presentation layer.
 *
 * Each call is made on behalf of either an authenticated shopper (their OAuth
 * JWT) or an unauthenticated browse session (the App's fallback ISV key) — the
 * same credential the core `/mcp` `agentAuthMiddleware` accepts (key OR JWT).
 *
 * Core tools return `{ content: [{ type:'text', text: JSON.stringify(domain) }] }`
 * (and `isError` + an `{error}` envelope on failure); we parse `content[0].text`
 * back into the domain object the presentation layer expects.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE_URL = process.env['NEXUS_BASE_URL'] ?? 'https://nexus-api.agentixpay.ai';
const MCP_ENDPOINT = new URL('/mcp', BASE_URL);

// Agent attribution for the dashboard "Source" column. Passed to the core
// write tools (which honor a caller-supplied agentId — see nexus AGX-158).
export const AGENT_ID = process.env['NEXUS_AGENT_ID'] ?? 'chatgpt';

const CLIENT_INFO = { name: 'nexus-chatgpt-app', version: '0.1.0' } as const;

export interface CoreCallOptions {
  jwt?: string;
  fallbackApiKey?: string;
}

export type CoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

/** A bound tool-caller scoped to one open core-MCP connection. */
export type CoreCaller = <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<CoreResult<T>>;

interface CallToolResultShape {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function parseToolResult<T>(raw: CallToolResultShape): CoreResult<T> {
  // Prefer structuredContent when a host/server provides it; else parse the
  // text content the core server emits.
  let payload: unknown = raw.structuredContent;
  if (payload === undefined) {
    const text = raw.content?.find((c) => c.type === 'text')?.text;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: { code: 'NEXUS_BAD_RESPONSE', message: text.slice(0, 200) } };
      }
    }
  }
  const err = (payload as { error?: { code?: string; message?: string } } | undefined)?.error;
  if (raw.isError || err) {
    return {
      ok: false,
      code: err?.code ?? 'NEXUS_ERROR',
      message: err?.message ?? 'Core MCP call failed',
    };
  }
  return { ok: true, data: (payload ?? {}) as T };
}

/**
 * Open one core-MCP connection, run `fn` with a bound caller, and tear it down.
 * Tools that need several core calls (e.g. products + merchant directory)
 * should make them all inside a single `withCore` so they share the connection.
 */
export async function withCore<T>(
  opts: CoreCallOptions,
  fn: (call: CoreCaller) => Promise<T>,
): Promise<T> {
  const auth = opts.jwt ?? opts.fallbackApiKey;
  if (!auth) {
    // Surface as a CoreResult-style failure to every call made in this scope.
    const deny: CoreCaller = async () => ({ ok: false, code: 'NO_AUTH', message: 'No JWT or fallback API key supplied' });
    return fn(deny);
  }

  const transport = new StreamableHTTPClientTransport(MCP_ENDPOINT, {
    requestInit: { headers: { Authorization: `Bearer ${auth}` } },
  });
  const client = new Client(CLIENT_INFO, { capabilities: {} });

  const call: CoreCaller = async (name, args = {}) => {
    try {
      const raw = (await client.callTool({ name, arguments: args })) as CallToolResultShape;
      return parseToolResult(raw);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      return {
        ok: false,
        code: e.name === 'McpError' ? 'NEXUS_MCP_ERROR' : 'NEXUS_NETWORK_ERROR',
        message: e.message ?? 'Core MCP transport error',
      };
    }
  };

  try {
    await client.connect(transport);
    return await fn(call);
  } finally {
    await client.close().catch(() => {});
  }
}

/** Convenience for a single core tool call (opens/closes one connection). */
export async function callCore<T = unknown>(
  name: string,
  args: Record<string, unknown>,
  opts: CoreCallOptions,
): Promise<CoreResult<T>> {
  return withCore(opts, (call) => call<T>(name, args));
}
