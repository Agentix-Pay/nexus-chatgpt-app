import { z } from 'zod';
import { nexus } from '../client.js';

export interface Merchant {
  id: string;
  displayName: string;
  domain: string;
  platform: string;
  checkoutMode?: string;
}

export const listMerchantsTool = {
  name: 'list_merchants',
  description: 'List all stores available to the shopper. Use at the start of a session or when the shopper asks "what stores are available?".',
  inputSchema: z.object({}),
  outputUI: 'MerchantList',
  annotations: { title: 'List stores', readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  handler: async (
    _input: Record<string, never>,
    ctx: { jwt?: string; fallbackApiKey?: string },
  ) => {
    const result = await nexus.get<{ data: Merchant[]; pagination?: unknown }>(
      '/acp/v1/merchants',
      { jwt: ctx.jwt, fallbackApiKey: ctx.fallbackApiKey },
    );
    if (!result.ok) {
      return { error: { code: result.code, message: result.message } };
    }
    return { merchants: result.data.data };
  },
};
