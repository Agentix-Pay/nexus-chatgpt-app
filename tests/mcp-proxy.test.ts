/**
 * AGX-158 — the App's tools now proxy to the core Nexus MCP server instead of
 * the REST API. These tests mock the MCP SDK Client (no network) and assert:
 *   - each tool calls the right core tool with the right args
 *   - presentation transforms still apply (field-stripping, merchantName)
 *   - write tools carry agentId for dashboard attribution
 *   - missing auth short-circuits (no core call)
 *   - a core error envelope maps to a tool { error }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { callToolMock, connectMock, closeMock } = vi.hoisted(() => ({
  callToolMock: vi.fn(),
  connectMock: vi.fn().mockResolvedValue(undefined),
  closeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: connectMock,
    callTool: callToolMock,
    close: closeMock,
  })),
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn(),
}));
// inline-image hits the network for data URLs; stub it to a passthrough.
vi.mock('../src/lib/inline-image.js', () => ({
  inlineImages: vi.fn(async (urls: string[]) => urls),
}));

import { listMerchantsTool } from '../src/tools/list-merchants.js';
import { searchProductsTool } from '../src/tools/search-products.js';
import { createHandoffTool } from '../src/tools/create-handoff.js';
import { getOrderStatusTool } from '../src/tools/get-order-status.js';

/** Build a core CallToolResult with a JSON text payload. */
function text(obj: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
}

const KEY = { fallbackApiKey: 'nexus_test' };

beforeEach(() => {
  vi.clearAllMocks();
  connectMock.mockResolvedValue(undefined);
  closeMock.mockResolvedValue(undefined);
});

describe('list_merchants proxy @regression', () => {
  it('calls core list_merchants and strips technical fields', async () => {
    callToolMock.mockResolvedValue(
      text({ data: [{ id: 'm1', displayName: 'Mall of Toys', platform: 'MOCK', checkoutMode: 'SIGNED_URL', domain: 'x.com' }] }),
    );
    const out = (await listMerchantsTool.handler({}, KEY)) as { merchants: unknown[] };
    expect(callToolMock).toHaveBeenCalledWith({ name: 'list_merchants', arguments: {} });
    expect(out.merchants).toEqual([{ id: 'm1', displayName: 'Mall of Toys', checkoutMode: 'SIGNED_URL' }]);
  });

  it('short-circuits with NO_AUTH when no credential is supplied', async () => {
    const out = (await listMerchantsTool.handler({}, {})) as { error?: { code: string } };
    expect(out.error?.code).toBe('NO_AUTH');
    expect(callToolMock).not.toHaveBeenCalled();
  });

  it('maps a core error envelope to a tool error', async () => {
    callToolMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ error: { code: 'FORBIDDEN', message: 'nope' } }) }],
      isError: true,
    });
    const out = (await listMerchantsTool.handler({}, KEY)) as { error?: { code: string } };
    expect(out.error?.code).toBe('FORBIDDEN');
  });
});

describe('search_products proxy @regression', () => {
  it('forwards price/category args to core and enriches merchantName', async () => {
    callToolMock.mockImplementation(async ({ name }: { name: string }) =>
      name === 'search_products'
        ? text({ data: [{ id: 'p1', title: 'Blocks', images: ['http://img/1'] }], pagination: {} })
        : text({ data: [{ id: 'm1', displayName: 'Mall of Toys' }] }),
    );
    const out = (await searchProductsTool.handler(
      { merchantId: 'm1', q: 'blocks', minPriceCents: 100, page: 1, limit: 10 },
      KEY,
    )) as { merchantName?: string; products: unknown[] };
    expect(callToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'search_products',
        arguments: expect.objectContaining({ merchantId: 'm1', q: 'blocks', minPriceCents: 100 }),
      }),
    );
    expect(out.merchantName).toBe('Mall of Toys');
    expect(out.products).toHaveLength(1);
  });
});

describe('create_handoff proxy @regression', () => {
  it('passes agentId=chatgpt and merges merchantName', async () => {
    callToolMock.mockImplementation(async ({ name }: { name: string }) =>
      name === 'create_handoff'
        ? text({ pendingOrderId: 'po_1', checkoutUrl: 'https://x/pay/po_1', checkoutHost: 'nexus' })
        : text({ data: [{ id: 'm1', displayName: 'Mall of Toys' }] }),
    );
    const out = (await createHandoffTool.handler(
      { merchantId: 'm1', items: [{ sku: 'S1', quantity: 1 }] },
      KEY,
    )) as { merchantName?: string; checkoutUrl?: string };
    expect(callToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'create_handoff',
        arguments: expect.objectContaining({ merchantId: 'm1', agentId: 'chatgpt' }),
      }),
    );
    expect(out.merchantName).toBe('Mall of Toys');
    expect(out.checkoutUrl).toBe('https://x/pay/po_1');
  });
});

describe('get_order_status proxy @regression', () => {
  it('calls core get_order and enriches merchantName', async () => {
    callToolMock.mockImplementation(async ({ name }: { name: string }) =>
      name === 'get_order'
        ? text({ id: 'ord_1', orderNumber: 'ORD-ABC', status: 'CONFIRMED', merchantId: 'm1' })
        : text({ data: [{ id: 'm1', displayName: 'Mall of Toys' }] }),
    );
    const out = (await getOrderStatusTool.handler({ orderId: 'ORD-ABC' }, KEY)) as {
      order: { orderNumber: string; merchantName?: string };
    };
    expect(callToolMock).toHaveBeenCalledWith({ name: 'get_order', arguments: { orderId: 'ORD-ABC' } });
    expect(out.order.orderNumber).toBe('ORD-ABC');
    expect(out.order.merchantName).toBe('Mall of Toys');
  });
});
