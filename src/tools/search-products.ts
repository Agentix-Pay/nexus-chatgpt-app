import { z } from 'zod';
import { withCore } from '../mcp-client.js';
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
    // Fetch products + the merchant's display name over one core-MCP
    // connection — the cart widget needs merchantName for friendly display
    // when an add_to_cart fires from a product tile in this grid.
    const { productsRes, merchantName } = await withCore(ctx, async (call) => {
      const [products, merchants] = await Promise.all([
        call<{ data: Product[]; pagination: unknown }>('search_products', {
          merchantId: input.merchantId,
          page: input.page,
          limit: input.limit,
          ...(input.q ? { q: input.q } : {}),
          ...(input.minPriceCents !== undefined ? { minPriceCents: input.minPriceCents } : {}),
          ...(input.maxPriceCents !== undefined ? { maxPriceCents: input.maxPriceCents } : {}),
          ...(input.category ? { category: input.category } : {}),
        }),
        call<{ data: Array<{ id: string; displayName: string }> }>('list_merchants', {}),
      ]);
      return {
        productsRes: products,
        merchantName: merchants.ok
          ? merchants.data.data.find((m) => m.id === input.merchantId)?.displayName
          : undefined,
      };
    });
    if (!productsRes.ok) {
      return { error: { code: productsRes.code, message: productsRes.message } };
    }
    // Inline the first image of each product as a data URL. The iframe was
    // rejecting all HTTP image loads regardless of CSP/proxy; data URLs need
    // no network call and render in any sandbox.
    const products = await Promise.all(
      productsRes.data.data.map(async (p) => {
        const first = p.images?.[0];
        if (!first) return p;
        const inlined = await inlineImages([first]);
        return { ...p, images: [inlined[0] ?? first, ...p.images.slice(1)] };
      }),
    );
    return {
      merchantId: input.merchantId,
      ...(merchantName ? { merchantName } : {}),
      products,
      ...(input.category ? { category: input.category } : {}),
      ...(input.q ? { q: input.q } : {}),
    };
  },
};
