import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({ orderId: z.string().min(1) });

export const getOrderStatusTool = {
  name: 'get_order_status',
  description: 'Look up the status of a previously placed order. Use when the shopper asks "where\'s my order?" or "did my order ship?".',
  inputSchema,
  outputUI: 'OrderStatusCard',
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
