import { z } from 'zod';
import { cartSummary } from '../lib/cart.js';

const inputSchema = z.object({});

export const viewCartTool = {
  name: 'view_cart',
  description:
    'Show the shopper their current cart for this conversation. Use when they say "view cart", "show my cart", "what\'s in my cart", "show me my cart", or tap a View cart button. Returns the merchant, items with quantities, subtotal, and item count. If empty, returns an empty cart state — the widget shows a friendly empty message and a CTA to keep browsing.',
  inputSchema,
  outputUI: 'CartView',
  annotations: { title: 'View cart', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    _input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string; sessionId?: string },
  ) => {
    const summary = cartSummary(ctx.sessionId ?? '');
    return {
      cart: {
        merchantId: summary.merchantId,
        merchantName: summary.merchantName,
        items: summary.items,
      },
      itemCount: summary.itemCount,
      subtotalCents: summary.subtotalCents,
      currency: summary.items[0]?.currency ?? 'USD',
    };
  },
};
