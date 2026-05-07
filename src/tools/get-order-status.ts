import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({ orderId: z.string().min(1) });

export const getOrderStatusTool = {
  name: 'get_order_status',
  description: 'Look up the status of a previously placed order. Use when the shopper asks "where\'s my order?", "did my order ship?", or just "paid?" / "is my order confirmed?". Accepts any of: Order.id (UUID), Order.orderNumber (e.g. "ORD-A1B2C3D4"), or the PendingOrder ID returned from create_handoff (Nexus auto-bridges to the resulting Order once payment completes).',
  inputSchema,
  outputUI: 'OrderStatusCard',
  annotations: { title: 'Order status', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await nexus.get<unknown>(
      `/acp/v1/orders/${encodeURIComponent(input.orderId)}`,
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { order: result.data };
  },
};
