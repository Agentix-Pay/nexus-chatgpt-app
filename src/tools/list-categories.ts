import { z } from 'zod';
import { callCore } from '../mcp-client.js';
import { inlineImage } from '../lib/inline-image.js';

const inputSchema = z.object({
  merchantId: z.string().min(1).describe('The merchant whose categories to list. Get this from list_merchants.'),
});

export interface Category {
  name: string;
  productCount: number;
  sampleImage: string;
}

export const listCategoriesTool = {
  name: 'list_categories',
  description:
    'List the product categories available at a specific merchant. ALWAYS use this (not list_merchants) when the shopper has already chosen a store and wants to browse it — for prompts like "show me categories at <store>", "show categories", "browse <store name>", "what does this store sell", or after they tap a Browse button on a merchant card. Returns category names with product counts and sample images for visual category tiles.',
  inputSchema,
  outputUI: 'CategoryGrid',
  annotations: { title: 'Browse categories', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    input: z.infer<typeof inputSchema>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await callCore<{ data: Category[] }>(
      'list_categories',
      { merchantId: input.merchantId },
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    // sampleImage inlined as a data URL — same rationale as list_merchants'
    // logo and search_products' product images: sidesteps the iframe
    // rejecting plain HTTP image loads regardless of CSP/proxy.
    const categories = await Promise.all(
      result.data.data.map(async (c) => ({
        ...c,
        sampleImage: c.sampleImage ? await inlineImage(c.sampleImage) : c.sampleImage,
      })),
    );
    return { merchantId: input.merchantId, categories };
  },
};
