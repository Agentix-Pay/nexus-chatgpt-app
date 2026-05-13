import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({
  merchantId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().optional(),
        sku: z.string().optional(),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .min(1),
  email: z.string().email().optional(),
});

export const createCheckoutTool = {
  name: 'create_checkout',
  description:
    'DISABLED FOR DEMO — DO NOT CALL. In-chat checkout (Walmart-style — Flow A) is gated off for the current demo build. For any purchase intent ("buy this", "checkout", "complete my order", "I want to pay"), call `create_handoff` instead — it returns a secure browser checkout link, which is the only working payment path right now. If the shopper insists on in-chat payment, tell them it is coming soon and point them at the "↗ Open secure link" action on the product card.',
  inputSchema,
  outputUI: 'OrderSummary',
  annotations: { title: 'Start in-chat checkout', readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await nexus.post<unknown>(
      '/acp/v1/checkouts',
      input,
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { checkout: result.data };
  },
};
