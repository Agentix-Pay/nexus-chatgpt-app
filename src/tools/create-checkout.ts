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
    'Start an in-chat checkout (Walmart-style — Flow A). Use ONLY when the merchant.checkoutMode is IN_APP, or when the shopper explicitly asks to complete the purchase in chat with their card on file. Do NOT use when the shopper clicks an "Open secure link" button or asks for a browser checkout link, "secure link", "checkout link", or "checkout URL" — use create_handoff for those. Pair with complete_checkout to finalize the in-chat charge.',
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
