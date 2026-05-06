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
    const result = await nexus.get<unknown>(
      `/acp/v1/products/${encodeURIComponent(input.productId)}?merchantId=${encodeURIComponent(input.merchantId)}`,
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { product: result.data };
  },
};
