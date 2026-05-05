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
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
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
    { capabilities: { tools: {}, prompts: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

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
      const uiHtml = renderUI(tool.outputUI, result);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        _meta: {
          uiComponent: tool.outputUI,
          uiHtml: uiHtml ?? undefined,
          uiData: result,
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
