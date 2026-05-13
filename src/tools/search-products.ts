import { z } from 'zod';
import { nexus } from '../client.js';
import { inlineImages } from '../lib/inline-image.js';

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
  description: 'Search or list products in a specific store. ALWAYS use this (not list_merchants) when the shopper wants to see products — for prompts like "show me products", "find toys", "browse Building Sets", "what\'s under $50". Pass merchantId from list_merchants. Optional: q (free-text search), category (exact category name), minPriceCents, maxPriceCents.',
  inputSchema,
  outputUI: 'ProductGrid',
  annotations: { title: 'Search products', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
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
    // Inline the first image of each product as a data URL. The iframe was
    // rejecting all HTTP image loads regardless of CSP/proxy; data URLs need
    // no network call and render in any sandbox.
    const products = await Promise.all(
      result.data.data.map(async (p) => {
        const first = p.images?.[0];
        if (!first) return p;
        const inlined = await inlineImages([first]);
        return { ...p, images: [inlined[0] ?? first, ...p.images.slice(1)] };
      }),
    );
    return {
      merchantId: input.merchantId,
      products,
      ...(input.category ? { category: input.category } : {}),
      ...(input.q ? { q: input.q } : {}),
    };
  },
};
