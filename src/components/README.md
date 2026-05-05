# UI Component Specs

These are skeletons / specs for the inline UI components the App renders in ChatGPT. The OpenAI Apps SDK for UI components is still being finalized — once their schema solidifies, these specs become real React-ish components.

## ProductCard

Inline product tile with image, title, price, "Add to cart" / "Buy in chat" / "Get link" actions.

```
┌─────────────────────────────────┐
│  [image]                        │
│                                 │
│  LEGO Technic Bugatti Bolide    │
│  $49.99 · 905 pieces            │
│                                 │
│  [ Buy in chat ] [ Get link ]   │
└─────────────────────────────────┘
```

Renders for `search_products` results and `get_product` detail.

## OrderSummary

Pre-checkout breakdown — line items, subtotal, shipping, tax, total. Renders after `create_checkout`.

```
Order Summary
─────────────────────────
LEGO Technic Bugatti Bolide   $49.99
  SKU LEGO-BUGATTI-42151 · Qty 1
─────────────────────────
Subtotal                      $49.99
Shipping                       $5.99
Tax (8%)                       $4.00
─────────────────────────
Total                         $59.98

[ Confirm purchase ]
```

The "Confirm purchase" button triggers `complete_checkout` if the user agrees.

## PaymentSheet

Inline payment confirmation when checkoutMode === IN_APP. Shows the stored payment method, supports Apple Pay / Shop Pay one-tap, plus cancel.

```
Pay $59.98 to Mall of Toys
─────────────────────────
🍎 Pay  [face ID]              ◉
💳 Visa ending 4242             ○
💚 Shop Pay (saved)             ○

[ Confirm payment ]   [ Cancel ]
```

After successful charge, replaced with `OrderConfirmation`.

## CheckoutLinkCard

For Flow B — shows the secure link plus a clear "Open checkout" CTA with merchant attribution.

```
Your checkout is ready
─────────────────────────
Mall of Toys · $59.98
Order #ORD-XXX · Expires in 1h

[ 🔒 Open secure checkout → ]

You'll be sent to Mall of Toys to
complete payment.
```

Renders the shell URL or merchant URL from `create_handoff`'s `checkoutUrl` + `checkoutHost`.

## OrderConfirmation

After Flow A success or Flow B finalization webhook.

```
✓ Order confirmed
─────────────────────────
LEGO Technic Bugatti Bolide
$59.98 · Visa ending 4242

Order #ORD-EEFD0480

You'll get an email when it ships.
```

## OrderStatusCard

For `get_order_status`. Shows status, fulfillment, tracking if available.

## MerchantList

For `list_merchants` — pickable merchant tiles with logo + status.

---

## Implementation notes when the Apps UI SDK lands

- Each component is server-rendered HTML returned in the tool response's `_meta.uiComponent` payload, OR
- Rendered client-side from a structured JSON payload + a component identifier — the OpenAI host loads the component code from the App's manifest

Either way, the component data structure is: `{ component: 'ProductCard', props: { ... } }`. We have the data — only the renderer is pending platform finalization.
