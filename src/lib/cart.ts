/**
 * In-memory per-session cart store.
 *
 * Each ChatGPT conversation establishes an MCP SSE connection with a stable
 * sessionId for the duration. We key the cart on that sessionId — every tool
 * call from the same conversation lands on the same cart. Cart is lost when
 * the connection closes (e.g. user starts a new chat), which is the correct
 * UX semantic — a new conversation is a new shopping session.
 *
 * Carts are pinned to a single merchant. Calling add_to_cart for a different
 * merchant returns an error rather than silently mixing items — Nexus's
 * /acp/v1/handoff is a per-merchant operation and mixing would fail downstream.
 *
 * Future migration: when Nexus grows a real Cart model with persistence, swap
 * this implementation for a Nexus-backed one — the tool surface (add/view/
 * checkout) stays identical.
 */

export interface CartItem {
  productId: string;
  sku: string;
  title: string;
  priceCents: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
}

export interface Cart {
  merchantId: string;
  merchantName?: string;
  items: CartItem[];
  updatedAt: number;
}

const carts = new Map<string, Cart>();

function totalCents(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);
}

function totalCount(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function getCart(sessionId: string): Cart | null {
  return carts.get(sessionId) ?? null;
}

export function clearCart(sessionId: string): void {
  carts.delete(sessionId);
}

export type AddResult =
  | { ok: true; cart: Cart; itemCount: number; subtotalCents: number }
  | { ok: false; error: { code: string; message: string } };

export function addToCart(
  sessionId: string,
  item: CartItem,
  merchantId: string,
  merchantName?: string,
): AddResult {
  if (!sessionId) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'No session context — cannot track cart' } };
  }
  if (!merchantId) {
    return { ok: false, error: { code: 'NO_MERCHANT', message: 'Cannot add item without merchantId' } };
  }

  const existing = carts.get(sessionId);
  if (existing && existing.merchantId !== merchantId) {
    return {
      ok: false,
      error: {
        code: 'MERCHANT_MISMATCH',
        message: `Cart already has items from ${existing.merchantName ?? existing.merchantId}. Clear cart before adding from a different store.`,
      },
    };
  }

  const cart: Cart = existing ?? { merchantId, merchantName, items: [], updatedAt: Date.now() };
  if (merchantName && !cart.merchantName) cart.merchantName = merchantName;

  // Merge same-product additions by incrementing quantity.
  const existingItem = cart.items.find((it) => it.productId === item.productId);
  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    cart.items.push({ ...item });
  }
  cart.updatedAt = Date.now();
  carts.set(sessionId, cart);
  return { ok: true, cart, itemCount: totalCount(cart), subtotalCents: totalCents(cart) };
}

export function cartSummary(sessionId: string) {
  const cart = carts.get(sessionId);
  if (!cart) {
    return { merchantId: null, merchantName: null, items: [], itemCount: 0, subtotalCents: 0 };
  }
  return {
    merchantId: cart.merchantId,
    merchantName: cart.merchantName ?? null,
    items: cart.items,
    itemCount: totalCount(cart),
    subtotalCents: totalCents(cart),
  };
}
