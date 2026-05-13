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
    "Generate a secure browser checkout link (Flow B) — returns a clickable URL the shopper opens to complete payment outside the chat. ALWAYS USE THIS when the shopper says any of: \"secure link\", \"checkout link\", \"checkout URL\", \"open secure checkout\", \"browser checkout\", or clicks an 'Open secure link' button. Also use when merchant.checkoutMode is SIGNED_URL or MERCHANT_PAGE. Do NOT use create_checkout for these requests — that one starts an in-chat charge flow, which is wrong. The response.checkoutHost field tells you whether the link points to our hosted shell or the merchant's own checkout (Shopify, etc.) — surface that in the UI so the shopper knows what they're clicking.",
  inputSchema,
  outputUI: 'CheckoutLinkCard',
  annotations: { title: 'Get checkout link', readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    // Fetch handoff + merchant directory in parallel — handoff response doesn't
    // include merchantName, so we look it up so the CheckoutLinkCard widget can
    // render "<store name> · $X" instead of the generic "Merchant" fallback.
    const [result, merchantsRes] = await Promise.all([
      nexus.post<Record<string, unknown>>('/acp/v1/handoff', input, {
        jwt: ctx.jwt,
        fallbackApiKey: ctx.fallbackApiKey,
      }),
      nexus.get<{ data: Array<{ id: string; displayName: string }> }>(
        '/acp/v1/merchants',
        { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
      ),
    ]);
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    const merchantName = merchantsRes.ok
      ? merchantsRes.data.data.find((m) => m.id === input.merchantId)?.displayName
      : undefined;
    return {
      ...result.data,
      ...(merchantName ? { merchantName } : {}),
    };
  },
};
