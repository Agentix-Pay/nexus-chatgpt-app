import { z } from 'zod';
import { addToCart, type CartItem } from '../lib/cart.js';

const inputSchema = z.object({
  merchantId: z.string().min(1),
  productId: z.string().min(1),
  sku: z.string().min(1),
  title: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('USD'),
  quantity: z.number().int().positive().default(1),
  merchantName: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const addToCartTool = {
  name: 'add_to_cart',
  description:
    'Add a product to the shopper\'s cart for this conversation. Use this (NOT create_checkout, NOT create_handoff) whenever the shopper says "add to cart", "save this", "I want to buy this later", or taps an Add-to-cart button on a product tile. Cart is per-conversation and per-merchant; mixing items from different stores returns an error. Pair with view_cart to show the cart and checkout_cart to convert it into a secure checkout link.',
  inputSchema,
  outputUI: 'CartView',
  annotations: { title: 'Add to cart', readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string; sessionId?: string },
  ) => {
    const item: CartItem = {
      productId: input.productId,
      sku: input.sku,
      title: input.title,
      priceCents: input.priceCents,
      currency: input.currency,
      quantity: input.quantity,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    };
    const result = addToCart(ctx.sessionId ?? '', item, input.merchantId, input.merchantName);
    if (!result.ok) {
      return { error: result.error };
    }
    return {
      cart: {
        merchantId: result.cart.merchantId,
        merchantName: result.cart.merchantName,
        items: result.cart.items,
      },
      itemCount: result.itemCount,
      subtotalCents: result.subtotalCents,
      currency: input.currency,
      justAdded: { productId: input.productId, sku: input.sku, title: input.title, quantity: input.quantity },
    };
  },
};
