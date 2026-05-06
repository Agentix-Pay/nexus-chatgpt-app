/**
 * ChatGPT Apps SDK widget HTML — iframe-hosted inline UI components.
 *
 * Per OpenAI Apps SDK spec (https://developers.openai.com/apps-sdk/build/mcp-server):
 *   - Each widget is registered as an MCP resource at `ui://widget/<name>.html`
 *   - ChatGPT loads the resource into an iframe inside the chat
 *   - When a tool returns, ChatGPT posts `ui/notifications/tool-result` to the
 *     iframe via postMessage; the widget's JS renders the structured data
 *   - The resource's `_meta.ui` declares the public domain + CSP allowlist
 *
 * Each widget here is one self-contained HTML page (inline CSS + inline JS,
 * no external assets) so OpenAI's review process can verify the contents.
 *
 * The render logic mirrors what we built in `src/components/render.ts` —
 * same data shapes, same brand language. Server-side render.ts is kept as
 * a fallback for non-iframe MCP hosts (Claude Desktop today, etc.).
 */

const WIDGET_DOMAIN = 'https://agentix-nexus-app.fly.dev';

export const WIDGET_NAMES = [
  'merchant-list',
  'product-grid',
  'product-detail',
  'order-summary',
  'payment-sheet',
  'checkout-link',
  'order-confirmation',
  'order-status',
] as const;

export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Map a tool's outputUI value to its widget URI. */
export function widgetUri(outputUI: string): string {
  const map: Record<string, WidgetName> = {
    MerchantList: 'merchant-list',
    ProductGrid: 'product-grid',
    ProductDetailCard: 'product-detail',
    OrderSummary: 'order-summary',
    PaymentSheet: 'payment-sheet',
    CheckoutLinkCard: 'checkout-link',
    OrderConfirmation: 'order-confirmation',
    OrderStatusCard: 'order-status',
  };
  const name = map[outputUI] ?? 'merchant-list';
  return `ui://widget/${name}.html`;
}

/** Per-widget _meta.ui block for resource registration (CSP, domain, etc.). */
export function widgetMeta(): Record<string, unknown> {
  return {
    ui: {
      domain: WIDGET_DOMAIN,
      csp: {
        connectDomains: ['https://agentix-nexus.fly.dev'],
        resourceDomains: ['https://*.oaistatic.com'],
      },
    },
  };
}

const SHARED_CSS = `
:root{color-scheme:light;}
*{box-sizing:border-box;}
body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;background:transparent;color:#0F172A;font-size:14px;line-height:1.5;font-feature-settings:"ss01","cv11";font-variant-numeric:tabular-nums;}
.nx-card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.04);max-width:560px;margin:0 auto;}
.nx-eyebrow{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#475569;margin:0 0 6px;}
.nx-title{font-size:18px;font-weight:600;margin:0 0 10px;}
.nx-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #E2E8F0;}
.nx-row:last-child{border-bottom:none;}
.nx-meta{font-size:12px;color:#64748B;margin-top:2px;}
.nx-amount{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;}
.nx-totals{margin-top:8px;padding-top:14px;border-top:2px solid #0F172A;}
.nx-totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#475569;}
.nx-grand{margin-top:6px;padding-top:10px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:baseline;}
.nx-grand-label{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:#0F172A;}
.nx-grand-amount{font-size:26px;font-weight:700;background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);-webkit-background-clip:text;background-clip:text;color:transparent;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
.nx-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;border-radius:10px;background:#0F172A;color:#fff;font-size:15px;font-weight:600;text-decoration:none;margin-top:14px;border:0;cursor:pointer;font-family:inherit;}
.nx-button-gradient{background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);}
.nx-button:hover{filter:brightness(1.05);}
.nx-pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:11px;font-weight:500;}
.nx-pill-success{background:#D1FAE5;color:#065F46;}
.nx-pill-warn{background:#FEF3C7;color:#713F12;}
.nx-banner{margin-top:12px;padding:10px 12px;border-radius:8px;background:#FEF3C7;border:1px solid #FDE68A;color:#713F12;font-size:12px;}
.nx-tile{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:10px;border:1px solid #E2E8F0;background:#fff;margin-bottom:8px;}
.nx-tile-img{width:56px;height:56px;border-radius:8px;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);flex-shrink:0;background-size:cover;background-position:center;}
.nx-tile-body{flex:1;min-width:0;}
.nx-tile-title{font-weight:600;color:#0F172A;font-size:14px;margin:0;}
.nx-tile-meta{font-size:12px;color:#64748B;margin:2px 0 0;}
.nx-tile-price{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:14px;color:#0F172A;flex-shrink:0;}
.nx-empty{padding:24px;text-align:center;color:#64748B;font-size:13px;}
.nx-check{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#34D399,#10B981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;margin:0 auto 12px;font-weight:700;}
.nx-error{padding:12px;border-radius:8px;background:#FEE2E2;border:1px solid #FECACA;color:#991B1B;font-size:13px;}
.nx-payment-options{margin:8px 0 14px;display:flex;flex-direction:column;gap:6px;}
.nx-payment-option{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;}
`;

/** Common boilerplate that listens for postMessage and dispatches to render(). */
const POSTMSG_LISTENER = `
const root = document.getElementById('root');
function fmt(c){if(c==null)return '$—';return '$'+(Number(c)/100).toFixed(2);}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.addEventListener('message',(e)=>{
  if(e.source!==window.parent)return;
  const m=e.data;if(!m||m.jsonrpc!=='2.0')return;
  if(m.method!=='ui/notifications/tool-result')return;
  const data=(m.params&&(m.params.structuredContent||m.params.data||m.params))||{};
  try{render(data);}catch(err){root.innerHTML='<div class="nx-card"><div class="nx-error">Render error: '+escapeHtml(err.message)+'</div></div>';}
},{passive:true});
window.parent.postMessage({jsonrpc:'2.0',method:'ui/ready'},'*');
`;

interface WidgetSpec {
  emptyHtml: string;
  renderJs: string; // body of render(data) — has access to root, fmt(), escapeHtml()
}

const WIDGETS: Record<WidgetName, WidgetSpec> = {
  // ── MerchantList ──────────────────────────────────────────────────────
  'merchant-list': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Loading stores…</div></div>`,
    renderJs: `
      const merchants = data.merchants || [];
      if (!merchants.length) {
        root.innerHTML = '<div class="nx-card"><div class="nx-empty">No stores available right now.</div></div>';
        return;
      }
      const tiles = merchants.map(m => \`
        <div class="nx-tile">
          <div class="nx-tile-img"></div>
          <div class="nx-tile-body">
            <p class="nx-tile-title">\${escapeHtml(m.displayName)}</p>
            <p class="nx-tile-meta">\${escapeHtml(m.domain || '')}\${m.platform ? ' · <span class="nx-pill">' + escapeHtml(m.platform) + '</span>' : ''}</p>
          </div>
        </div>\`).join('');
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Available stores</p><h3 class="nx-title">' + merchants.length + ' ' + (merchants.length===1?'store':'stores') + '</h3>' + tiles + '</div>';
    `,
  },

  // ── ProductGrid ───────────────────────────────────────────────────────
  'product-grid': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Searching…</div></div>`,
    renderJs: `
      const products = data.products || [];
      if (!products.length) {
        root.innerHTML = '<div class="nx-card"><div class="nx-empty">No products matched. Try broader terms.</div></div>';
        return;
      }
      const tiles = products.map(p => {
        const img = p.images && p.images[0] ? 'background-image:url(\\'' + escapeHtml(p.images[0]) + '\\');background-size:cover;background-position:center;' : '';
        const stock = (p.inventoryQuantity != null && p.inventoryQuantity > 0)
          ? '<span class="nx-pill nx-pill-success">In stock</span>'
          : '<span class="nx-pill nx-pill-warn">Out of stock</span>';
        const desc = p.description ? '<p class="nx-tile-meta">' + escapeHtml(p.description.slice(0, 90)) + (p.description.length > 90 ? '…' : '') + '</p>' : '';
        return \`
          <div class="nx-tile">
            <div class="nx-tile-img" style="\${img}"></div>
            <div class="nx-tile-body">
              <p class="nx-tile-title">\${escapeHtml(p.title)}</p>
              \${desc}
              <div style="margin-top:6px;">\${stock}</div>
            </div>
            <div class="nx-tile-price">\${fmt(p.priceCents)}</div>
          </div>\`;
      }).join('');
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Search results</p><h3 class="nx-title">' + products.length + ' ' + (products.length===1?'item':'items') + '</h3>' + tiles + '</div>';
    `,
  },

  // ── ProductDetail ─────────────────────────────────────────────────────
  'product-detail': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Loading product…</div></div>`,
    renderJs: `
      const p = data.product;
      if (!p) { root.innerHTML = '<div class="nx-card"><div class="nx-empty">Product not found.</div></div>'; return; }
      const imgStyle = p.images && p.images[0]
        ? 'background-image:url(\\'' + escapeHtml(p.images[0]) + '\\');background-size:cover;background-position:center;'
        : 'background:linear-gradient(135deg,#E0F2FE,#EDE9FE);';
      root.innerHTML = '<div class="nx-card">' +
        '<div style="width:100%;aspect-ratio:16/9;border-radius:10px;margin-bottom:14px;' + imgStyle + '"></div>' +
        '<h3 class="nx-title">' + escapeHtml(p.title) + '</h3>' +
        '<p class="nx-tile-meta" style="margin-bottom:10px;">SKU ' + escapeHtml(p.sku) + '</p>' +
        (p.description ? '<p style="font-size:13px;color:#475569;margin:0 0 14px;">' + escapeHtml(p.description) + '</p>' : '') +
        '<div class="nx-grand"><span class="nx-grand-label">Price</span><span class="nx-grand-amount">' + fmt(p.priceCents) + '</span></div>' +
      '</div>';
    `,
  },

  // ── OrderSummary ──────────────────────────────────────────────────────
  'order-summary': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Building order summary…</div></div>`,
    renderJs: `
      const c = data.checkout || data;
      const items = (c.metadata && c.metadata.items) || [];
      const itemHtml = items.map(it => \`
        <div class="nx-row">
          <div>
            <div style="font-weight:500;">\${escapeHtml(it.title)}</div>
            <div class="nx-meta">SKU \${escapeHtml(it.sku)} · Qty \${it.quantity}</div>
          </div>
          <div class="nx-amount">\${fmt(it.lineTotalCents)}</div>
        </div>\`).join('');
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Order summary</p>' +
        '<h3 class="nx-title">' + escapeHtml(c.merchantName || 'Order') + '</h3>' +
        '<div>' + itemHtml + '</div>' +
        '<div class="nx-totals">' +
          '<div class="nx-totals-row"><span>Subtotal</span><span class="nx-amount">' + fmt(c.subtotalCents) + '</span></div>' +
          '<div class="nx-totals-row"><span>Shipping</span><span class="nx-amount">' + fmt(c.shippingCostCents) + '</span></div>' +
          '<div class="nx-totals-row"><span>Tax</span><span class="nx-amount">' + fmt(c.taxCents) + '</span></div>' +
          '<div class="nx-grand"><span class="nx-grand-label">Total</span><span class="nx-grand-amount">' + fmt(c.totalCents) + '</span></div>' +
        '</div></div>';
    `,
  },

  // ── PaymentSheet ──────────────────────────────────────────────────────
  'payment-sheet': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Preparing payment…</div></div>`,
    renderJs: `
      const total = data.totalCents || (data.checkout && data.checkout.totalCents) || 0;
      const merchant = data.merchantName || (data.checkout && data.checkout.merchantName) || 'Merchant';
      const pm = data.paymentMethod || { brand: 'visa', last4: '4242' };
      const brand = pm.brand[0].toUpperCase() + pm.brand.slice(1);
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Confirm payment</p>' +
        '<h3 class="nx-title">Pay ' + fmt(total) + ' to ' + escapeHtml(merchant) + '</h3>' +
        '<div class="nx-payment-options">' +
          (data.showApplePay !== false ? '<div class="nx-payment-option"><span>🍎 <strong>Apple Pay</strong></span><span class="nx-pill">Face ID</span></div>' : '') +
          '<div class="nx-payment-option"><span>💳 <strong>' + escapeHtml(brand) + '</strong> ending ' + escapeHtml(pm.last4) + '</span><span class="nx-pill nx-pill-success">Default</span></div>' +
          (data.showShopPay ? '<div class="nx-payment-option"><span>💚 <strong>Shop Pay</strong></span><span class="nx-pill">Saved</span></div>' : '') +
        '</div>' +
        '<button class="nx-button nx-button-gradient" onclick="window.parent.postMessage({jsonrpc:\\'2.0\\',method:\\'ui/notifications/user-action\\',params:{action:\\'confirm-payment\\'}},\\'*\\')">🔒 Confirm payment</button>' +
      '</div>';
    `,
  },

  // ── CheckoutLink ──────────────────────────────────────────────────────
  'checkout-link': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Generating link…</div></div>`,
    renderJs: `
      const total = data.totalCents || 0;
      const merchant = data.merchantName || 'Merchant';
      const url = data.checkoutUrl || '#';
      const isPlatform = data.checkoutHost === 'platform';
      const where = isPlatform
        ? "You'll be sent to <strong>" + escapeHtml(merchant) + "</strong> to complete payment."
        : 'Secure checkout hosted by Agentix.';
      const expires = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 60*60_000);
      const minutes = Math.max(0, Math.round((expires.getTime() - Date.now())/60_000));
      const orderId = (data.pendingOrderId || data.orderId || '').slice(0,8).toUpperCase();
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Checkout link ready</p>' +
        '<h3 class="nx-title">' + escapeHtml(merchant) + ' · ' + fmt(total) + '</h3>' +
        '<p class="nx-meta" style="margin-bottom:12px;">Order ' + escapeHtml(orderId) + ' · Expires in ' + minutes + ' min</p>' +
        '<a href="' + escapeHtml(url) + '" target="_top" class="nx-button nx-button-gradient" style="text-decoration:none;">🔒 Open secure checkout →</a>' +
        '<p style="margin-top:10px;font-size:12px;color:#64748B;">' + where + '</p>' +
      '</div>';
    `,
  },

  // ── OrderConfirmation ─────────────────────────────────────────────────
  'order-confirmation': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Confirming…</div></div>`,
    renderJs: `
      const order = data.order || {};
      const payment = data.payment || {};
      const total = payment.amountCents || order.totalCents || 0;
      const merchant = order.merchantName || '';
      const summary = payment.summary || '';
      const mode = payment.mode || 'demo';
      const number = order.orderNumber || '—';
      const banner = mode === 'demo'
        ? '<div class="nx-banner">Demo mode — no real charge was processed.</div>'
        : '';
      root.innerHTML = '<div class="nx-card"><div style="text-align:center;">' +
        '<div class="nx-check">✓</div>' +
        '<h3 class="nx-title">Order confirmed</h3>' +
        (merchant ? '<p class="nx-meta" style="margin-bottom:14px;">' + escapeHtml(merchant) + '</p>' : '') +
        '<div class="nx-grand-amount" style="font-size:28px;">' + fmt(total) + '</div>' +
        (summary ? '<p style="margin:8px 0 14px;color:#475569;font-size:13px;">' + escapeHtml(summary) + '</p>' : '') +
        '<div style="display:inline-block;padding:6px 12px;border-radius:6px;background:#F1F5F9;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#0F172A;">' + escapeHtml(number) + '</div>' +
        banner +
      '</div></div>';
    `,
  },

  // ── OrderStatus ───────────────────────────────────────────────────────
  'order-status': {
    emptyHtml: `<div class="nx-card"><div class="nx-empty">Looking up order…</div></div>`,
    renderJs: `
      const o = data.order || {};
      const status = (o.status || 'PENDING').toUpperCase();
      const positive = ['CONFIRMED','SHIPPED','DELIVERED'].indexOf(status) >= 0;
      const negative = ['CANCELLED','FAILED'].indexOf(status) >= 0;
      const pillClass = positive ? 'nx-pill nx-pill-success' : negative ? 'nx-pill nx-pill-warn' : 'nx-pill';
      const tracking = o.trackingNumber
        ? '<div class="nx-row"><span>Tracking</span><span class="nx-amount">' +
            (o.trackingUrl ? '<a href="' + escapeHtml(o.trackingUrl) + '" target="_top" style="color:#1D4ED8;">' + escapeHtml(o.trackingNumber) + '</a>' : escapeHtml(o.trackingNumber)) +
          '</span></div>'
        : '';
      root.innerHTML = '<div class="nx-card"><p class="nx-eyebrow">Order status</p>' +
        '<h3 class="nx-title">' + escapeHtml(o.orderNumber || '—') + '</h3>' +
        '<div class="nx-row"><span>Status</span><span><span class="' + pillClass + '">' + escapeHtml(status) + '</span></span></div>' +
        (o.fulfillmentStatus ? '<div class="nx-row"><span>Fulfillment</span><span>' + escapeHtml(o.fulfillmentStatus) + '</span></div>' : '') +
        '<div class="nx-row"><span>Total</span><span class="nx-amount">' + fmt(o.totalCents) + '</span></div>' +
        tracking +
      '</div>';
    `,
  },
};

/** Generate the full iframe HTML page for a widget. */
export function widgetHtml(name: WidgetName): string {
  const spec = WIDGETS[name];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agentix · ${name}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div id="root">${spec.emptyHtml}</div>
<script>
${POSTMSG_LISTENER}
function render(data) {
${spec.renderJs}
}
</script>
</body>
</html>`;
}
