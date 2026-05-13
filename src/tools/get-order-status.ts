import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({ orderId: z.string().min(1) });

export const getOrderStatusTool = {
  name: 'get_order_status',
  description: 'Look up the status of a previously placed order. Use when the shopper asks "where\'s my order?", "did my order ship?", "paid?", "is my order confirmed?", or taps a Check-order-status button on a checkout link card. Accepts any of: Order.id (UUID), Order.orderNumber (e.g. "ORD-A1B2C3D4"), or the PendingOrder ID returned from create_handoff (Nexus auto-bridges to the resulting Order once payment completes). The OrderStatusCard widget shows the full confirmation; keep your text reply brief.',
  inputSchema,
  outputUI: 'OrderStatusCard',
  annotations: { title: 'Order status', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    // Order + merchant directory in parallel — we surface merchantName in the
    // confirmation card so the shopper sees which store they paid (matters
    // most for the moment after secure-link checkout completes).
    const [result, merchantsRes] = await Promise.all([
      nexus.get<Record<string, unknown>>(
        `/acp/v1/orders/${encodeURIComponent(input.orderId)}`,
        { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
      ),
      nexus.get<{ data: Array<{ id: string; displayName: string }> }>(
        '/acp/v1/merchants',
        { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
      ),
    ]);
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    const order = result.data as Record<string, unknown>;
    const merchantIdRaw = order['merchantId'];
    const merchantName = merchantsRes.ok && typeof merchantIdRaw === 'string'
      ? merchantsRes.data.data.find((m) => m.id === merchantIdRaw)?.displayName
      : undefined;
    return {
      order: {
        ...order,
        ...(merchantName ? { merchantName } : {}),
      },
    };
  },
};
