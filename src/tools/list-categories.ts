import { z } from 'zod';
import { callCore } from '../mcp-client.js';

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
    // Category tiles are now text-only on a gradient (no images), so we no
    // longer inline c.sampleImage. Saves the per-call inline overhead and
    // shrinks the tool payload to a few hundred bytes — categories render
    // noticeably faster on cold and warm.
    return { merchantId: input.merchantId, categories: result.data.data };
  },
};
