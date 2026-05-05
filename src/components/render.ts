/**
 * Inline UI components for the Nexus ChatGPT App.
 *
 * Each function returns an HTML string. The MCP server wires these into tool
 * responses via `_meta.uiHtml` so MCP hosts (ChatGPT Apps, Claude Desktop with
 * rich messages, custom hosts) can render them inline.
 *
 * Brand: dark navy (#0F172A) + cyan→violet gradient accent (#67E8F9 → #818CF8 → #C084FC).
 * Matches the dashboard /pay/<id> checkout page so the experience feels unified
 * whether the shopper completes in chat or via Flow B link.
 *
 * Static HTML for now (no JS, no event handlers) — interactive primitives
 * (buttons, payment sheet) get layered on when OpenAI's Apps SDK formalizes
 * its component schema. The data contracts here are ready.
 */

function escape(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function fmtCents(c: number | null | undefined): string {
  if (c == null) return '$—';
  return `$${(Number(c) / 100).toFixed(2)}`;
}

const STYLES = `
  .nx-card{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.04);max-width:560px;color:#0F172A;font-size:14px;line-height:1.5;font-feature-settings:"ss01","cv11";font-variant-numeric:tabular-nums;}
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
  .nx-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;border-radius:10px;background:#0F172A;color:#fff;font-size:15px;font-weight:600;text-decoration:none;margin-top:14px;box-shadow:0 1px 2px rgba(15,23,42,.10),0 4px 12px rgba(15,23,42,.08);box-sizing:border-box;}
  .nx-button-gradient{background:linear-gradient(135deg,#67E8F9,#818CF8 50%,#C084FC);}
  .nx-button-secondary{background:#F1F5F9;color:#0F172A;}
  .nx-pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:11px;font-weight:500;}
  .nx-pill-success{background:#D1FAE5;color:#065F46;}
  .nx-pill-warn{background:#FEF3C7;color:#713F12;}
  .nx-banner{margin-top:12px;padding:10px 12px;border-radius:8px;background:#FEF3C7;border:1px solid #FDE68A;color:#713F12;font-size:12px;}
  .nx-tile{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:10px;border:1px solid #E2E8F0;background:#fff;margin-bottom:8px;}
  .nx-tile-img{width:56px;height:56px;border-radius:8px;background:#F1F5F9;flex-shrink:0;background-size:cover;background-position:center;}
  .nx-tile-body{flex:1;min-width:0;}
  .nx-tile-title{font-weight:600;color:#0F172A;font-size:14px;margin:0;}
  .nx-tile-meta{font-size:12px;color:#64748B;margin:2px 0 0;}
  .nx-tile-price{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:500;font-size:14px;color:#0F172A;flex-shrink:0;}
  .nx-empty{padding:24px;text-align:center;color:#64748B;font-size:13px;}
  .nx-check{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#34D399,#10B981);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;margin:0 auto 12px;font-weight:700;}
  .nx-error{padding:12px;border-radius:8px;background:#FEE2E2;border:1px solid #FECACA;color:#991B1B;font-size:13px;}
  .nx-payment-options{margin:8px 0 14px;display:flex;flex-direction:column;gap:6px;}
  .nx-payment-option{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;}
  .nx-payment-option strong{font-weight:500;}
  .nx-store{font-size:12px;color:#64748B;margin-left:8px;}
  a.nx-button{text-decoration:none;}
`;

function shell(inner: string): string {
  return `<style>${STYLES}</style><div class="nx-card">${inner}</div>`;
}

// ── ERROR ─────────────────────────────────────────────────────────────────

export function renderError(message: string): string {
  return shell(`<div class="nx-error">⚠️ ${escape(message)}</div>`);
}

// ── MERCHANT LIST ─────────────────────────────────────────────────────────

interface Merchant {
  id: string;
  displayName: string;
  domain?: string;
  platform?: string;
}

export function renderMerchantList(merchants: Merchant[]): string {
  if (!merchants.length) {
    return shell(`<div class="nx-empty">No stores available right now.</div>`);
  }
  const rows = merchants
    .map(
      (m) => `<div class="nx-tile">
        <div class="nx-tile-img" style="background:linear-gradient(135deg,#E0F2FE,#EDE9FE);"></div>
        <div class="nx-tile-body">
          <p class="nx-tile-title">${escape(m.displayName)}</p>
          <p class="nx-tile-meta">${escape(m.domain ?? '')}${m.platform ? ` · <span class="nx-pill">${escape(m.platform)}</span>` : ''}</p>
        </div>
      </div>`,
    )
    .join('');
  return shell(
    `<p class="nx-eyebrow">Available stores</p>
     <h3 class="nx-title">${merchants.length} ${merchants.length === 1 ? 'store' : 'stores'}</h3>
     ${rows}`,
  );
}

// ── PRODUCT GRID ──────────────────────────────────────────────────────────

interface Product {
  id: string;
  sku: string;
  title: string;
  description?: string;
  priceCents: number;
  currency?: string;
  images?: string[];
  inventoryQuantity?: number;
  merchantName?: string;
}

export function renderProductGrid(products: Product[]): string {
  if (!products.length) {
    return shell(
      `<div class="nx-empty">No products matched. Try broader terms or a different store.</div>`,
    );
  }
  const rows = products
    .map((p) => {
      const img = p.images?.[0]
        ? `style="background-image:url('${escape(p.images[0])}');"`
        : `style="background:linear-gradient(135deg,#E0F2FE,#EDE9FE);"`;
      const stockBadge =
        p.inventoryQuantity != null && p.inventoryQuantity > 0
          ? `<span class="nx-pill nx-pill-success">In stock</span>`
          : `<span class="nx-pill nx-pill-warn">Out of stock</span>`;
      const desc = p.description
        ? `<p class="nx-tile-meta">${escape(p.description.slice(0, 90))}${p.description.length > 90 ? '…' : ''}</p>`
        : '';
      return `<div class="nx-tile">
        <div class="nx-tile-img" ${img}></div>
        <div class="nx-tile-body">
          <p class="nx-tile-title">${escape(p.title)}</p>
          ${desc}
          <div style="margin-top:6px;">${stockBadge}${p.merchantName ? `<span class="nx-store">${escape(p.merchantName)}</span>` : ''}</div>
        </div>
        <div class="nx-tile-price">${fmtCents(p.priceCents)}</div>
      </div>`;
    })
    .join('');
  return shell(
    `<p class="nx-eyebrow">Search results</p>
     <h3 class="nx-title">${products.length} ${products.length === 1 ? 'item' : 'items'} found</h3>
     ${rows}`,
  );
}

// ── PRODUCT DETAIL ────────────────────────────────────────────────────────

export function renderProductDetail(p: Product): string {
  const img = p.images?.[0]
    ? `style="width:100%;aspect-ratio:16/9;background-image:url('${escape(p.images[0])}');background-size:cover;background-position:center;border-radius:10px;margin-bottom:14px;"`
    : `style="width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,#E0F2FE,#EDE9FE);border-radius:10px;margin-bottom:14px;"`;
  return shell(
    `<div ${img}></div>
     <h3 class="nx-title">${escape(p.title)}</h3>
     <p class="nx-tile-meta" style="margin-bottom:10px;">SKU ${escape(p.sku)}${p.merchantName ? ` · ${escape(p.merchantName)}` : ''}</p>
     ${p.description ? `<p style="font-size:13px;color:#475569;margin:0 0 14px;">${escape(p.description)}</p>` : ''}
     <div class="nx-grand">
       <span class="nx-grand-label">Price</span>
       <span class="nx-grand-amount">${fmtCents(p.priceCents)}</span>
     </div>`,
  );
}

// ── ORDER SUMMARY (pre-payment, Flow A IN_APP) ───────────────────────────

interface LineItem {
  sku: string;
  title: string;
  quantity: number;
  lineTotalCents: number;
  priceCents?: number;
}

interface OrderTotals {
  merchantName: string;
  orderId: string;
  items: LineItem[];
  subtotalCents: number;
  shippingCostCents: number;
  taxCents: number;
  totalCents: number;
}

export function renderOrderSummary(o: OrderTotals): string {
  const items = o.items
    .map(
      (it) => `<div class="nx-row">
        <div>
          <div style="font-weight:500;">${escape(it.title)}</div>
          <div class="nx-meta">SKU ${escape(it.sku)} · Qty ${it.quantity}${it.priceCents ? ` · ${fmtCents(it.priceCents)} ea` : ''}</div>
        </div>
        <div class="nx-amount">${fmtCents(it.lineTotalCents)}</div>
      </div>`,
    )
    .join('');
  return shell(
    `<p class="nx-eyebrow">Order summary</p>
     <h3 class="nx-title">${escape(o.merchantName)}</h3>
     <div>${items}</div>
     <div class="nx-totals">
       <div class="nx-totals-row"><span>Subtotal</span><span class="nx-amount">${fmtCents(o.subtotalCents)}</span></div>
       <div class="nx-totals-row"><span>Shipping</span><span class="nx-amount">${fmtCents(o.shippingCostCents)}</span></div>
       <div class="nx-totals-row"><span>Tax</span><span class="nx-amount">${fmtCents(o.taxCents)}</span></div>
       <div class="nx-grand">
         <span class="nx-grand-label">Total</span>
         <span class="nx-grand-amount">${fmtCents(o.totalCents)}</span>
       </div>
     </div>`,
  );
}

// ── PAYMENT SHEET (IN_APP — Walmart-style picker) ────────────────────────

interface PaymentMethodOnFile {
  brand: string; // 'visa' | 'mastercard' | …
  last4: string;
}

export function renderPaymentSheet(opts: {
  totalCents: number;
  merchantName: string;
  paymentMethod: PaymentMethodOnFile;
  showApplePay?: boolean;
  showShopPay?: boolean;
}): string {
  const brand = opts.paymentMethod.brand[0]?.toUpperCase() + opts.paymentMethod.brand.slice(1);
  const options = [
    opts.showApplePay
      ? `<div class="nx-payment-option"><span>🍎 <strong>Apple Pay</strong></span><span class="nx-pill">Face ID</span></div>`
      : '',
    `<div class="nx-payment-option"><span>💳 <strong>${escape(brand)}</strong> ending ${escape(opts.paymentMethod.last4)}</span><span class="nx-pill nx-pill-success">Default</span></div>`,
    opts.showShopPay
      ? `<div class="nx-payment-option"><span>💚 <strong>Shop Pay</strong></span><span class="nx-pill">Saved</span></div>`
      : '',
  ]
    .filter(Boolean)
    .join('');
  return shell(
    `<p class="nx-eyebrow">Confirm payment</p>
     <h3 class="nx-title">Pay ${fmtCents(opts.totalCents)} to ${escape(opts.merchantName)}</h3>
     <div class="nx-payment-options">${options}</div>
     <div class="nx-button nx-button-gradient" role="button">🔒 Confirm payment</div>
     <div style="margin-top:8px;text-align:center;font-size:12px;color:#64748B;">Reply &ldquo;confirm&rdquo; to charge or &ldquo;cancel&rdquo; to abort.</div>`,
  );
}

// ── CHECKOUT LINK CARD (Flow B — handoff) ────────────────────────────────

export function renderCheckoutLinkCard(opts: {
  merchantName: string;
  totalCents: number;
  checkoutUrl: string;
  checkoutHost: 'platform' | 'nexus';
  expiresAt: string;
  orderId: string;
}): string {
  const where =
    opts.checkoutHost === 'platform'
      ? `You'll be sent to <strong>${escape(opts.merchantName)}</strong> to complete payment.`
      : `Secure checkout hosted by Agentix.`;
  const expires = new Date(opts.expiresAt);
  const minutes = Math.max(0, Math.round((expires.getTime() - Date.now()) / 60_000));
  return shell(
    `<p class="nx-eyebrow">Checkout link ready</p>
     <h3 class="nx-title">${escape(opts.merchantName)} · ${fmtCents(opts.totalCents)}</h3>
     <p class="nx-meta" style="margin-bottom:12px;">Order ${escape(opts.orderId.slice(0, 8).toUpperCase())} · Expires in ${minutes} min</p>
     <a href="${escape(opts.checkoutUrl)}" class="nx-button nx-button-gradient">🔒 Open secure checkout →</a>
     <p style="margin-top:10px;font-size:12px;color:#64748B;">${where}</p>`,
  );
}

// ── ORDER CONFIRMATION (post-payment, Flow A success) ────────────────────

export function renderOrderConfirmation(opts: {
  orderNumber: string;
  totalCents: number;
  paymentSummary: string; // "Charged $59.98 to Visa ending in 4242"
  mode: 'demo' | 'real';
  merchantName: string;
}): string {
  const modeBanner =
    opts.mode === 'demo'
      ? `<div class="nx-banner">Demo mode — no real charge was processed.</div>`
      : '';
  return shell(
    `<div style="text-align:center;">
       <div class="nx-check">✓</div>
       <h3 class="nx-title">Order confirmed</h3>
       <p class="nx-meta" style="margin-bottom:14px;">${escape(opts.merchantName)}</p>
       <div class="nx-grand-amount" style="font-size:28px;">${fmtCents(opts.totalCents)}</div>
       <p style="margin:8px 0 14px;color:#475569;font-size:13px;">${escape(opts.paymentSummary)}</p>
       <div style="display:inline-block;padding:6px 12px;border-radius:6px;background:#F1F5F9;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#0F172A;">${escape(opts.orderNumber)}</div>
       ${modeBanner}
     </div>`,
  );
}

// ── ORDER STATUS ─────────────────────────────────────────────────────────

interface OrderRow {
  orderNumber: string;
  status: string; // CONFIRMED | SHIPPED | DELIVERED | CANCELLED | …
  fulfillmentStatus?: string;
  totalCents: number;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  merchantName?: string;
}

export function renderOrderStatus(o: OrderRow): string {
  const statusPill = (() => {
    const s = o.status.toUpperCase();
    if (s === 'CONFIRMED' || s === 'SHIPPED' || s === 'DELIVERED')
      return `<span class="nx-pill nx-pill-success">${escape(s)}</span>`;
    if (s === 'CANCELLED' || s === 'FAILED')
      return `<span class="nx-pill nx-pill-warn">${escape(s)}</span>`;
    return `<span class="nx-pill">${escape(s)}</span>`;
  })();
  const tracking = o.trackingNumber
    ? `<div class="nx-row"><span>Tracking</span><span class="nx-amount">${
        o.trackingUrl
          ? `<a href="${escape(o.trackingUrl)}" style="color:#1D4ED8;">${escape(o.trackingNumber)}</a>`
          : escape(o.trackingNumber)
      }</span></div>`
    : '';
  return shell(
    `<p class="nx-eyebrow">Order status</p>
     <h3 class="nx-title">${escape(o.orderNumber)}</h3>
     <div class="nx-row"><span>Status</span><span>${statusPill}</span></div>
     ${o.fulfillmentStatus ? `<div class="nx-row"><span>Fulfillment</span><span>${escape(o.fulfillmentStatus)}</span></div>` : ''}
     <div class="nx-row"><span>Total</span><span class="nx-amount">${fmtCents(o.totalCents)}</span></div>
     ${tracking}
     ${o.merchantName ? `<p class="nx-meta" style="margin-top:10px;">From ${escape(o.merchantName)}</p>` : ''}`,
  );
}
