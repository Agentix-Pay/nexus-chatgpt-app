/**
 * MCP server entry — wires the Nexus tool registry into a Model Context Protocol
 * server that ChatGPT (and any MCP-compatible host) can connect to.
 *
 * Runs over stdio for local dev and SSE for production hosting. The OpenAI
 * Apps platform handles the OAuth dance externally and forwards the resulting
 * JWT in the MCP session metadata; we extract it per-request and pass to tool
 * handlers.
 *
 * Status: scaffold. The `@modelcontextprotocol/sdk` API surface is stable, but
 * OpenAI's specific Apps host integration is still evolving — verify against
 * their current docs before publishing.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools/index.js';

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
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      _meta: { uiComponent: tool.outputUI, structured: result },
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Tool error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

/** Minimal Zod → JSON Schema converter (we don't need full coverage — just what
 *  our tools use). For richer use later, swap in `zod-to-json-schema`. */
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

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[agentix-nexus] MCP server running on stdio (${tools.length} tools)\n`);
