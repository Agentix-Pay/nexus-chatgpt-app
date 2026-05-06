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

export const createHandoffTool = {
  name: 'create_handoff',
  description:
    "Generate a secure checkout link the shopper opens in their browser (Flow B). Use this when the merchant.checkoutMode is SIGNED_URL or MERCHANT_PAGE, or when the shopper asks for a link. The response.checkoutHost field tells you whether the link points to our hosted shell or the merchant's own checkout (Shopify, etc.) — surface that in the UI so the shopper knows what they're clicking.",
  inputSchema,
  outputUI: 'CheckoutLinkCard',
  annotations: { title: 'Get checkout link', readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await nexus.post<{
      checkoutUrl: string;
      checkoutHost: 'platform' | 'nexus';
      externalOrderId?: string;
      expiresAt: string;
      totalCents: number;
      currency: string;
      items: Array<{ sku: string; title: string; quantity: number; lineTotalCents: number }>;
    }>('/acp/v1/handoff', input, {
      jwt: ctx.jwt,
      fallbackApiKey: ctx.fallbackApiKey,
    });
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return result.data;
  },
};
