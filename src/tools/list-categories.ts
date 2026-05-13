import { z } from 'zod';
import { nexus } from '../client.js';
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
    const result = await nexus.get<{ data: Category[] }>(
      `/acp/v1/categories?merchantId=${encodeURIComponent(input.merchantId)}`,
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    // Inline each category's sample image as a data URL — same rationale as
    // search_products / get_product.
    const categories = await Promise.all(
      result.data.data.map(async (c) => ({
        ...c,
        sampleImage: await inlineImage(c.sampleImage),
      })),
    );
    return { merchantId: input.merchantId, categories };
  },
};
