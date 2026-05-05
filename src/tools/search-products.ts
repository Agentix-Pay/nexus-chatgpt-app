import { z } from 'zod';
import { nexus } from '../client.js';

const inputSchema = z.object({
  merchantId: z.string().min(1).describe('The merchant to search within. Get this from list_merchants.'),
  q: z.string().optional().describe('Free-text search query. Empty = browse all.'),
  minPriceCents: z.number().int().nonnegative().optional(),
  maxPriceCents: z.number().int().nonnegative().optional(),
  category: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  images: string[];
  inventoryQuantity: number;
}

export const searchProductsTool = {
  name: 'search_products',
  description: 'Search products in a specific store. Always pass a merchantId from list_merchants.',
  inputSchema,
  outputUI: 'ProductGrid',
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const params = new URLSearchParams({
      merchantId: input.merchantId,
      page: String(input.page),
      limit: String(input.limit),
      ...(input.q && { q: input.q }),
      ...(input.minPriceCents !== undefined && { minPrice: String(input.minPriceCents) }),
      ...(input.maxPriceCents !== undefined && { maxPrice: String(input.maxPriceCents) }),
      ...(input.category && { category: input.category }),
    });
    const result = await nexus.get<{ data: Product[]; pagination: unknown }>(
      `/acp/v1/products?${params.toString()}`,
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { products: result.data.data };
  },
};
