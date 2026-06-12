import { z } from 'zod';
import { callCore, AGENT_ID } from '../mcp-client.js';
import { cartSummary, clearCart } from '../lib/cart.js';

const inputSchema = z.object({
  email: z.string().email().optional(),
});

export const checkoutCartTool = {
  name: 'checkout_cart',
  description:
    'Convert the shopper\'s entire cart into a secure browser checkout link (Flow B / SIGNED_URL). Use when they say "checkout my cart", "buy everything in my cart", "I\'m ready to pay", or tap a Checkout button on the cart view. Generates a single handoff covering all cart items at once, then clears the cart. Returns the CheckoutLinkCard so they can open the link in the browser to complete payment.',
  inputSchema,
  outputUI: 'CheckoutLinkCard',
  annotations: { title: 'Checkout cart', readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string; sessionId?: string },
  ) => {
    const sessionId = ctx.sessionId ?? '';
    const summary = cartSummary(sessionId);
    if (summary.items.length === 0 || !summary.merchantId) {
      return {
        error: {
          code: 'CART_EMPTY',
          message: 'Your cart is empty. Add some items first, then come back to check out.',
        },
      };
    }
    const result = await callCore<Record<string, unknown>>(
      'create_handoff',
      {
        merchantId: summary.merchantId,
        items: summary.items.map((it) => ({ productId: it.productId, sku: it.sku, quantity: it.quantity })),
        ...(input.email ? { email: input.email } : {}),
        agentId: AGENT_ID,
      },
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    // Clear the cart on a successful handoff — payment happens in the browser
    // from here, so a fresh cart on the next add-to-cart call is correct.
    clearCart(sessionId);
    // Carry merchantName from the cart into the response so the CheckoutLinkCard
    // widget renders "<store name> · $X" instead of the generic "Merchant" fallback.
    return {
      ...result.data,
      ...(summary.merchantName ? { merchantName: summary.merchantName } : {}),
    };
  },
};
