import { describe, it, expect } from 'vitest';
import {
  renderError,
  renderMerchantList,
  renderProductGrid,
  renderProductDetail,
  renderOrderSummary,
  renderPaymentSheet,
  renderCheckoutLinkCard,
  renderOrderConfirmation,
  renderOrderStatus,
} from '../src/components/render.js';

describe('renderError', () => {
  it('escapes HTML in messages', () => {
    const html = renderError('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderMerchantList', () => {
  it('shows empty state when no merchants', () => {
    expect(renderMerchantList([])).toContain('No stores available');
  });
  it('renders merchant tiles', () => {
    const html = renderMerchantList([
      { id: 'm1', displayName: 'Mall of Toys', domain: 'mall-of-toys.com', platform: 'MOCK' },
    ]);
    expect(html).toContain('Mall of Toys');
    expect(html).toContain('mall-of-toys.com');
    expect(html).toContain('MOCK');
  });
});

describe('renderProductGrid', () => {
  it('shows empty state when no products', () => {
    expect(renderProductGrid([])).toContain('No products matched');
  });
  it('formats prices in dollars', () => {
    const html = renderProductGrid([
      { id: 'p1', sku: 'SKU1', title: 'Widget', priceCents: 4999, inventoryQuantity: 5 },
    ]);
    expect(html).toContain('$49.99');
    expect(html).toContain('Widget');
    expect(html).toContain('In stock');
  });
  it('marks out-of-stock', () => {
    const html = renderProductGrid([
      { id: 'p1', sku: 'SKU1', title: 'Sold out', priceCents: 1000, inventoryQuantity: 0 },
    ]);
    expect(html).toContain('Out of stock');
  });
});

describe('renderProductDetail', () => {
  it('renders title + price + sku', () => {
    const html = renderProductDetail({
      id: 'p1', sku: 'TEST-SKU', title: 'Test Item', priceCents: 12345,
    });
    expect(html).toContain('Test Item');
    expect(html).toContain('$123.45');
    expect(html).toContain('TEST-SKU');
  });
});

describe('renderOrderSummary', () => {
  it('renders line items + totals', () => {
    const html = renderOrderSummary({
      merchantName: 'Mall of Toys',
      orderId: 'order-1',
      items: [
        { sku: 'LEGO-1', title: 'LEGO Bugatti', quantity: 1, lineTotalCents: 4999, priceCents: 4999 },
      ],
      subtotalCents: 4999,
      shippingCostCents: 599,
      taxCents: 400,
      totalCents: 5998,
    });
    expect(html).toContain('LEGO Bugatti');
    expect(html).toContain('$49.99');
    expect(html).toContain('$5.99');
    expect(html).toContain('$4.00');
    expect(html).toContain('$59.98');
  });
});

describe('renderPaymentSheet', () => {
  it('renders all three payment options when enabled', () => {
    const html = renderPaymentSheet({
      totalCents: 5998,
      merchantName: 'Mall of Toys',
      paymentMethod: { brand: 'visa', last4: '4242' },
      showApplePay: true,
      showShopPay: true,
    });
    expect(html).toContain('Apple Pay');
    expect(html).toContain('Shop Pay');
    expect(html).toContain('Visa');
    expect(html).toContain('4242');
    expect(html).toContain('$59.98');
  });
});

describe('renderCheckoutLinkCard', () => {
  it('shows merchant attribution for platform host', () => {
    const html = renderCheckoutLinkCard({
      merchantName: 'Mall of Toys',
      totalCents: 5998,
      checkoutUrl: 'https://mall-of-toys.myshopify.com/checkout/abc',
      checkoutHost: 'platform',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      orderId: 'order-1',
    });
    expect(html).toContain("You'll be sent to <strong>Mall of Toys</strong>");
  });
  it('shows Agentix attribution for nexus host', () => {
    const html = renderCheckoutLinkCard({
      merchantName: 'Mall of Toys',
      totalCents: 5998,
      checkoutUrl: 'https://agentixpay.ai/pay/abc',
      checkoutHost: 'nexus',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      orderId: 'order-1',
    });
    expect(html).toContain('hosted by Agentix');
  });
});

describe('renderOrderConfirmation', () => {
  it('shows demo banner in demo mode', () => {
    const html = renderOrderConfirmation({
      orderNumber: 'ORD-123',
      totalCents: 5998,
      paymentSummary: 'Charged $59.98 to Visa ending in 4242',
      mode: 'demo',
      merchantName: 'Mall of Toys',
    });
    expect(html).toContain('Demo mode');
    expect(html).toContain('Charged $59.98');
    expect(html).toContain('ORD-123');
  });
  it('omits demo banner in real mode', () => {
    const html = renderOrderConfirmation({
      orderNumber: 'ORD-456',
      totalCents: 1000,
      paymentSummary: 'Charged $10.00 to Visa ending in 1111',
      mode: 'real',
      merchantName: 'Real Store',
    });
    expect(html).not.toContain('Demo mode');
  });
});

describe('renderOrderStatus', () => {
  it('shows pill colors by status', () => {
    expect(
      renderOrderStatus({ orderNumber: 'O1', status: 'CONFIRMED', totalCents: 1000 }),
    ).toContain('nx-pill-success');
    expect(
      renderOrderStatus({ orderNumber: 'O2', status: 'CANCELLED', totalCents: 1000 }),
    ).toContain('nx-pill-warn');
  });
  it('renders tracking link when present', () => {
    const html = renderOrderStatus({
      orderNumber: 'O1',
      status: 'SHIPPED',
      totalCents: 5998,
      trackingNumber: '1Z999',
      trackingUrl: 'https://carrier.com/track/1Z999',
    });
    expect(html).toContain('1Z999');
    expect(html).toContain('carrier.com');
  });
});
