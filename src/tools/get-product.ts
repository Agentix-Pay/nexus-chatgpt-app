import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({
  merchantId: z.string().min(1),
  productId: z.string().min(1),
});

export const getProductTool = {
  name: 'get_product',
  description: 'Fetch full details for a single product (use after search_products to render a product detail card).',
  inputSchema,
  outputUI: 'ProductDetailCard',
  annotations: { title: 'Get product details', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    // Fetch product + merchant in parallel so the widget can decide which
    // checkout buttons to render based on merchant.checkoutMode.
    const [productRes, merchantsRes] = await Promise.all([
      nexus.get<unknown>(
        `/acp/v1/products/${encodeURIComponent(input.productId)}?merchantId=${encodeURIComponent(input.merchantId)}`,
        { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
      ),
      nexus.get<{ data: Array<{ id: string; displayName: string; platform: string; checkoutMode?: string; domain?: string }> }>(
        '/acp/v1/merchants',
        { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
      ),
    ]);
    if (!productRes.ok) {
      return { error: { code: productRes.code, message: productRes.message } };
    }
    const merchant = merchantsRes.ok
      ? merchantsRes.data.data.find((m) => m.id === input.merchantId)
      : undefined;
    const platform = merchant?.platform ?? 'UNKNOWN';
    const isMock = platform === 'MOCK';
    const mode = merchant?.checkoutMode ?? 'AUTO';
    // Mock merchants show all 3 options for demo. Real merchants show what
    // their checkoutMode is configured for. AUTO falls back to in-chat + link.
    const availableModes = isMock
      ? ['IN_APP', 'MERCHANT_PAGE', 'SIGNED_URL']
      : mode === 'IN_APP'
        ? ['IN_APP']
        : mode === 'MERCHANT_PAGE'
          ? ['MERCHANT_PAGE']
          : mode === 'SIGNED_URL'
            ? ['SIGNED_URL']
            : ['IN_APP', 'SIGNED_URL'];
    return {
      product: productRes.data,
      merchant: {
        id: input.merchantId,
        displayName: merchant?.displayName ?? '',
        platform,
        checkoutMode: mode,
        isMock,
        availableModes,
      },
    };
  },
};
