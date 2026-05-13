/**
 * In-memory cart store (process-wide singleton for demo simplicity).
 *
 * Original design keyed carts by MCP SSE sessionId. Turned out ChatGPT can
 * open a new SSE connection per tool call in some configurations, breaking
 * cart continuity — successive add_to_cart calls landed on different
 * sessionIds and each created a fresh cart. For a demo with one shopper at
 * a time, the simplest reliable fix is a single shared cart.
 *
 * Trade-offs accepted:
 * - One cart per App process. Concurrent shoppers share state. Fine for the
 *   demo (one user) and fine in practice until we wire real user identity
 *   from OAuth — then we'd swap this for a Nexus-backed per-user cart.
 * - Cart persists until the App container restarts (rare with
 *   min_machines_running=1 + auto_stop_machines=false) or someone calls
 *   clearCart (checkout_cart does this on success).
 *
 * Carts are pinned to a single merchant. Calling add_to_cart for a different
 * merchant returns an error rather than silently mixing items — Nexus's
 * /acp/v1/handoff is a per-merchant operation and mixing would fail downstream.
 *
 * Future migration: when Nexus grows a real Cart model with persistence and
 * user identity is wired through OAuth, swap this implementation for a
 * per-user Nexus-backed one — the tool surface (add/view/checkout) stays
 * identical.
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

// Process-wide single cart. sessionId arg kept on the public API for future
// per-user scoping, but currently ignored — all calls land here.
let sharedCart: Cart | null = null;

function totalCents(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);
}

function totalCount(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function getCart(_sessionId: string): Cart | null {
  return sharedCart;
}

export function clearCart(_sessionId: string): void {
  sharedCart = null;
}

export type AddResult =
  | { ok: true; cart: Cart; itemCount: number; subtotalCents: number }
  | { ok: false; error: { code: string; message: string } };

export function addToCart(
  _sessionId: string,
  item: CartItem,
  merchantId: string,
  merchantName?: string,
): AddResult {
  if (!merchantId) {
    return { ok: false, error: { code: 'NO_MERCHANT', message: 'Cannot add item without merchantId' } };
  }

  if (sharedCart && sharedCart.merchantId !== merchantId) {
    return {
      ok: false,
      error: {
        code: 'MERCHANT_MISMATCH',
        message: `Cart already has items from ${sharedCart.merchantName ?? sharedCart.merchantId}. Clear cart before adding from a different store.`,
      },
    };
  }

  if (!sharedCart) {
    sharedCart = { merchantId, merchantName, items: [], updatedAt: Date.now() };
  }
  if (merchantName && !sharedCart.merchantName) sharedCart.merchantName = merchantName;

  // Merge same-product additions by incrementing quantity.
  const existingItem = sharedCart.items.find((it) => it.productId === item.productId);
  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    sharedCart.items.push({ ...item });
  }
  sharedCart.updatedAt = Date.now();
  return { ok: true, cart: sharedCart, itemCount: totalCount(sharedCart), subtotalCents: totalCents(sharedCart) };
}

export function cartSummary(_sessionId: string) {
  if (!sharedCart) {
    return { merchantId: null, merchantName: null, items: [], itemCount: 0, subtotalCents: 0 };
  }
  return {
    merchantId: sharedCart.merchantId,
    merchantName: sharedCart.merchantName ?? null,
    items: sharedCart.items,
    itemCount: totalCount(sharedCart),
    subtotalCents: totalCents(sharedCart),
  };
}
