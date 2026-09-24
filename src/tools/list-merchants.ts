import { z } from 'zod';
import { callCore } from '../mcp-client.js';
import { inlineImage } from '../lib/inline-image.js';

export interface Merchant {
  id: string;
  displayName: string;
  domain: string;
  platform: string;
  checkoutMode?: string;
  logo?: string | null;
}

export const listMerchantsTool = {
  name: 'list_merchants',
  description: 'List all stores available to the shopper. Use at the start of a session or when the shopper asks "what stores are available?". CUSTOMER-FACING UI NOTE: when summarizing the results in your text reply, mention only the store DISPLAY NAMES — do NOT recite domain, platform, merchantId, or other internal fields. The shopper sees them rendered as visual tiles via the MerchantList widget; the technical fields are admin metadata.',
  inputSchema: z.object({}),
  outputUI: 'MerchantList',
  annotations: { title: 'List stores', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    _input: Record<string, never>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await callCore<{ data: Merchant[]; pagination?: unknown }>(
      'list_merchants',
      {},
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    // Strip technical fields before returning to the GPT — keeps them out of
    // text responses even if the GPT ignores the description's UI note.
    // Logo is inlined as a data URL (same as product/category images) — the
    // iframe can reject plain HTTP image loads regardless of CSP/proxy, so
    // embedding the bytes directly sidesteps that instead of relying on it.
    const merchants = await Promise.all(
      result.data.data.map(async (m) => ({
        id: m.id,
        displayName: m.displayName,
        checkoutMode: m.checkoutMode,
        logo: m.logo ? await inlineImage(m.logo) : undefined,
      })),
    );
    return { merchants };
  },
};
