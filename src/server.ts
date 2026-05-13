/**
 * Nexus ChatGPT App — MCP server entry.
 *
 * Two transports run side by side:
 *   - stdio: for local MCP hosts (Claude Desktop, MCP Inspector, etc.)
 *   - SSE/HTTP: for ChatGPT Apps and any remote MCP host
 *
 * Mode is controlled via `--transport=stdio|http` flag (defaults to stdio).
 * Tool responses include `_meta.uiHtml` (rendered HTML chunk for the inline
 * card) and `_meta.uiData` (structured payload) so MCP hosts that support
 * rich rendering get the polished UX, and hosts that don't fall back to the
 * `content[].text` JSON.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { WIDGET_NAMES, widgetUri, widgetHtml, widgetMeta, type WidgetName } from './widgets/index.js';
import express from 'express';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tools } from './tools/index.js';
import {
  renderError,
  renderMerchantList,
  renderProductGrid,
  renderProductDetail,
  renderOrderSummary,
  renderPaymentSheet,        // available for future complete_checkout UI variant
  renderCheckoutLinkCard,
  renderOrderConfirmation,
  renderOrderStatus,
} from './components/render.js';
// keep renderPaymentSheet referenced so it's not stripped — wired in a later pass
void renderPaymentSheet;

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SessionContext {
  jwt?: string;
  fallbackApiKey?: string;
}

function getSessionContext(req: CallToolRequest): SessionContext {
  // OpenAI Apps platform passes the user's JWT via _meta.bearer_token (subject
  // to change). The fallback ISV API key is read from env so unauthenticated
  // browse/search calls still work.
  const meta = (req.params._meta ?? {}) as Record<string, unknown>;
  const jwt = typeof meta['bearer_token'] === 'string' ? (meta['bearer_token'] as string) : undefined;
  return {
    jwt,
    fallbackApiKey: process.env['NEXUS_FALLBACK_API_KEY'] ?? undefined,
  };
}

/**
 * Render the inline UI HTML for a tool result based on the tool's outputUI
 * declaration. Returns null when the tool errored or there's no renderer
 * for the data shape — MCP hosts fall back to the JSON text content.
 */
function renderUI(outputUI: string, result: unknown): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  if (r?.error) return renderError(r.error.message ?? 'Something went wrong');
  try {
    switch (outputUI) {
      case 'MerchantList':
        return renderMerchantList(r.merchants ?? []);
      case 'ProductGrid':
        return renderProductGrid(r.products ?? []);
      case 'ProductDetailCard':
        return renderProductDetail(r.product);
      case 'OrderSummary':
        return renderOrderSummary({
          merchantName: r.checkout?.merchantName ?? 'Order',
          orderId: r.checkout?.id ?? '',
          items: r.checkout?.metadata?.items ?? [],
          subtotalCents: Number(r.checkout?.subtotalCents ?? 0),
          shippingCostCents: Number(r.checkout?.shippingCostCents ?? 0),
          taxCents: Number(r.checkout?.taxCents ?? 0),
          totalCents: Number(r.checkout?.totalCents ?? 0),
        });
      case 'OrderConfirmation':
        return renderOrderConfirmation({
          orderNumber: r.order?.orderNumber ?? '—',
          totalCents: Number(r.payment?.amountCents ?? r.order?.totalCents ?? 0),
          paymentSummary: r.payment?.summary ?? '',
          mode: r.payment?.mode === 'real' ? 'real' : 'demo',
          merchantName: r.order?.merchantName ?? '',
        });
      case 'CheckoutLinkCard':
        return renderCheckoutLinkCard({
          merchantName: r.merchantName ?? 'Merchant',
          totalCents: Number(r.totalCents ?? 0),
          checkoutUrl: r.checkoutUrl ?? '#',
          checkoutHost: r.checkoutHost ?? 'nexus',
          expiresAt: r.expiresAt ?? new Date(Date.now() + 60 * 60_000).toISOString(),
          orderId: r.pendingOrderId ?? '',
        });
      case 'OrderStatusCard':
        return renderOrderStatus({
          orderNumber: r.order?.orderNumber ?? '—',
          status: r.order?.status ?? 'PENDING',
          fulfillmentStatus: r.order?.fulfillmentStatus,
          totalCents: Number(r.order?.totalCents ?? 0),
          trackingNumber: r.order?.trackingNumber,
          trackingUrl: r.order?.trackingUrl,
        });
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Build the MCP server with tool handlers. Same instance can drive any transport. */
function buildServer(): Server {
  const server = new Server(
    { name: 'agentix-nexus', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      annotations: (t as any).annotations,
      _meta: { ui: { resourceUri: widgetUri(t.outputUI) } },
    })),
  }));

  // ── Resources: serve the iframe widget HTML pages ─────────────────────
  // Per OpenAI Apps SDK: each tool's `_meta.ui.resourceUri` points at one of
  // these. ChatGPT loads the resource into an iframe inline in chat, then
  // posts the tool's structuredContent to the iframe via postMessage.
  const RESOURCE_MIME = 'text/html;profile=mcp-app';

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: WIDGET_NAMES.map((name) => ({
      uri: `ui://widget/${name}.html`,
      name: `nexus-widget-${name}`,
      mimeType: RESOURCE_MIME,
      _meta: widgetMeta(),
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    // Accept optional ?v=N query suffix so cache-bust URIs still match. The
    // version is encoded in widgetUri() — see WIDGET_VERSION in widgets/index.ts.
    const m = uri.match(/^ui:\/\/widget\/([a-z-]+)\.html(?:\?.*)?$/);
    const name = m?.[1];
    if (!name || !(WIDGET_NAMES as readonly string[]).includes(name)) {
      throw new Error(`Unknown widget URI: ${uri}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME,
          text: widgetHtml(name as WidgetName),
          _meta: widgetMeta(),
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }
    const ctx = getSessionContext(req);
    try {
      const parsed = tool.inputSchema.parse(req.params.arguments ?? {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (tool.handler as (i: any, c: SessionContext) => Promise<unknown>)(parsed, ctx);
      // structuredContent is the spec field ChatGPT posts to the iframe widget
      // via ui/notifications/tool-result. uiHtml stays as a fallback for
      // non-iframe MCP hosts (e.g. Claude Desktop with rich messages).
      const uiHtml = renderUI(tool.outputUI, result);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
        _meta: {
          ui: { resourceUri: widgetUri(tool.outputUI) },
          uiHtml: uiHtml ?? undefined,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Tool error: ${(err as Error).message}` }],
        _meta: { uiHtml: renderError((err as Error).message) },
        isError: true,
      };
    }
  });

  return server;
}

// ── Transports ───────────────────────────────────────────────────────────

async function startStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[agentix-nexus] MCP server running on stdio (${tools.length} tools)\n`);
}

async function startHttp(port: number) {
  const app = express();

  // ── Root landing page (so visitors don't 404) ──
  app.get('/', (_req, res) => {
    res
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>Nexus — ChatGPT App</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F8FAFC;color:#0F172A;margin:0;padding:48px 16px;min-height:100vh;box-sizing:border-box}
.card{max-width:640px;margin:0 auto;background:#fff;border-radius:16px;padding:36px;box-shadow:0 1px 3px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.04)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:20px;font-weight:600;font-size:14px;color:#0F172A}
.brand-dot{width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC)}
h1{font-size:24px;margin:0 0 8px}
.muted{color:#64748B;font-size:14px;line-height:1.6}
.endpoints{margin:24px 0 0;padding:0;list-style:none}
.endpoints li{padding:10px 14px;background:#F1F5F9;border-radius:8px;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.endpoints code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#0F172A}
.tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:#D1FAE5;color:#065F46}
a{color:#1D4ED8;text-decoration:none}
a:hover{text-decoration:underline}
</style></head><body>
<div class="card">
  <div class="brand"><span class="brand-dot"></span>Agentix · Nexus ChatGPT App</div>
  <h1>MCP Server is running</h1>
  <p class="muted">This is the backend for the Nexus ChatGPT App — an MCP server that powers an inline shopping experience inside ChatGPT (and any MCP-compatible host: Claude Desktop, future agents). It's not meant to be visited directly.</p>
  <ul class="endpoints">
    <li><code>GET /healthz</code> <span class="tag">200 OK</span></li>
    <li><code>GET /manifest.json</code> <span class="tag">App manifest</span></li>
    <li><code>GET /mcp/sse</code> <span class="tag">MCP SSE</span></li>
    <li><code>POST /mcp/messages?sessionId=…</code> <span class="tag">MCP messages</span></li>
  </ul>
  <p class="muted" style="margin-top:24px;font-size:13px">Source: <a href="https://github.com/Agentix-Pay/nexus-chatgpt-app">github.com/Agentix-Pay/nexus-chatgpt-app</a></p>
</div></body></html>`);
  });

  // ── Public manifest + health (no MCP auth needed) ──
  app.get('/manifest.json', (_req, res) => {
    try {
      const manifest = readFileSync(resolve(__dirname, '../manifest.json'), 'utf-8');
      res
        .setHeader('Content-Type', 'application/json')
        .setHeader('Cache-Control', 'public, max-age=300')
        .send(manifest);
    } catch {
      res.status(500).json({ error: 'manifest.json not found' });
    }
  });

  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      version: '0.1.0',
      tools: tools.length,
      nexusBaseUrl: process.env['NEXUS_BASE_URL'] ?? 'https://agentix-nexus.fly.dev',
    });
  });

  // ── Image proxy ──────────────────────────────────────────────────────────
  // Product/category image URLs from MockAdapter (loremflickr.com), Shopify
  // CDN, etc. were failing to load inside the ChatGPT iframe sandbox even
  // with the host in resourceDomains — most likely a combination of CSP
  // strictness, 302-redirect-with-cookies handling (loremflickr's flow),
  // and sandbox restrictions. Proxying images through the App's own origin
  // sidesteps all of that: the iframe is served from this same host, so
  // image requests are effectively same-origin and the CSP allowlist is
  // moot. Server-side fetch handles redirects + drops session cookies the
  // browser couldn't carry through.
  const IMG_PROXY_ALLOWLIST = [
    /^https:\/\/loremflickr\.com\//,
    /^https:\/\/[^/]+\.flickr\.com\//,
    /^https:\/\/cdn\.shopify\.com\//,
    /^https:\/\/[^/]+\.shopifycdn\.com\//,
    /^https:\/\/i[0-9]\.wp\.com\//,
    /^https:\/\/[^/]+\.bigcommerce\.com\//,
    /^https:\/\/res\.cloudinary\.com\//,
    /^https:\/\/ik\.imagekit\.io\//,
    /^https:\/\/imagedelivery\.net\//,
    /^https:\/\/images\.squarespace-cdn\.com\//,
    /^https:\/\/[^/]+\.cloudfront\.net\//,
    /^https:\/\/[^/]+\.s3\.amazonaws\.com\//,
    /^https:\/\/s3\.amazonaws\.com\//,
    /^https:\/\/images\.unsplash\.com\//,
  ];
  app.get('/img-proxy', async (req, res) => {
    const url = typeof req.query['url'] === 'string' ? req.query['url'] : '';
    if (!url) {
      res.status(400).json({ error: 'missing url query param' });
      return;
    }
    if (!IMG_PROXY_ALLOWLIST.some((re) => re.test(url))) {
      res.status(403).json({ error: 'host not in allowlist' });
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const upstream = await fetch(url, { redirect: 'follow', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'upstream returned ' + upstream.status });
        return;
      }
      const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res
        .setHeader('Content-Type', contentType)
        .setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
        .setHeader('Access-Control-Allow-Origin', '*')
        .send(buf);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      res.status(502).json({ error: e.name === 'AbortError' ? 'upstream timeout' : (e.message ?? 'proxy error') });
    }
  });

  // ── OAuth discovery: DISABLED for anonymous-by-default mode ───────────
  // The App used to advertise OAuth via these well-known endpoints, prompting
  // ChatGPT to show a sign-in screen at install time. We now serve 404 here
  // so ChatGPT treats the App as no-auth-required. Shoppers can browse,
  // search, and use signed-link checkout without any account.
  //
  // Per-tool auth (e.g. for IN_APP card-on-file checkout) will be wired
  // selectively at the tool level if/when needed — not via App-wide OAuth.
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.status(404).json({ error: 'OAuth not required for this App' });
  });
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.status(404).json({ error: 'OAuth not required for this App' });
  });

  // ── MCP over SSE ──────────────────────────────────────────
  // Map of session-id → transport so multiple concurrent MCP clients work.
  const transports = new Map<string, SSEServerTransport>();

  app.get('/mcp/sse', async (_req, res) => {
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));

    const server = buildServer();
    await server.connect(transport);
    process.stderr.write(`[agentix-nexus] SSE session opened: ${transport.sessionId}\n`);
  });

  app.post('/mcp/messages', async (req, res) => {
    const sessionId = (req.query['sessionId'] as string | undefined) ?? '';
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Unknown sessionId' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.listen(port, () => {
    process.stderr.write(
      `[agentix-nexus] MCP HTTP server on :${port}\n` +
        `  Manifest:  http://localhost:${port}/manifest.json\n` +
        `  Health:    http://localhost:${port}/healthz\n` +
        `  MCP SSE:   http://localhost:${port}/mcp/sse\n` +
        `  Tools:     ${tools.length}\n`,
    );
  });
}

// ── Minimal Zod → JSON Schema (covers what our tool inputs use) ─────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: any): Record<string, unknown> {
  if (!schema?._def) return { type: 'object' };
  const shape = schema._def?.shape?.() ?? {};
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(shape)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = val as any;
    const isOptional = v._def?.typeName === 'ZodOptional' || v._def?.typeName === 'ZodDefault';
    const inner = isOptional ? v._def.innerType : v;
    properties[key] = jsonTypeFor(inner);
    if (!isOptional) required.push(key);
  }
  return { type: 'object', properties, required };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonTypeFor(z: any): Record<string, unknown> {
  const t = z._def?.typeName;
  if (t === 'ZodString') return { type: 'string' };
  if (t === 'ZodNumber') return { type: 'number' };
  if (t === 'ZodBoolean') return { type: 'boolean' };
  if (t === 'ZodArray') return { type: 'array', items: jsonTypeFor(z._def.type) };
  if (t === 'ZodObject') return zodToJsonSchema(z);
  return { type: 'string' };
}

// ── Entry ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const transportFlag = args.find((a) => a.startsWith('--transport='))?.split('=')[1] ?? 'stdio';
const portFlag = parseInt(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? '4400', 10);

if (transportFlag === 'http' || transportFlag === 'sse') {
  await startHttp(portFlag);
} else {
  await startStdio();
}
