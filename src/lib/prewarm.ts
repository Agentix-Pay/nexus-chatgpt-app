/**
 * Pre-warm the image cache at container boot so the first shopper of the
 * session doesn't pay the cold-fetch tax. Walks every merchant → categories
 * → products and feeds each image URL through inlineImage().
 *
 * Runs fire-and-forget after the HTTP listener comes up — never blocks
 * startup and never throws into the request path. Logs progress to stderr
 * so Fly's log stream shows when the cache is hot.
 */

import { withCore, type CoreCaller } from '../mcp-client.js';
import { inlineImages } from './inline-image.js';

interface MerchantLite {
  id: string;
  displayName?: string;
}

interface CategoryLite {
  name?: string;
  sampleImage?: string;
}

interface ProductLite {
  id?: string;
  images?: string[];
}

async function listMerchants(call: CoreCaller): Promise<MerchantLite[]> {
  const r = await call<{ data: MerchantLite[] }>('list_merchants', {});
  return r.ok ? r.data.data : [];
}

async function listCategories(call: CoreCaller, merchantId: string): Promise<CategoryLite[]> {
  const r = await call<{ data: CategoryLite[] }>('list_categories', { merchantId });
  return r.ok ? r.data.data : [];
}

async function listProducts(call: CoreCaller, merchantId: string): Promise<ProductLite[]> {
  const r = await call<{ data: ProductLite[] }>('search_products', { merchantId, limit: 50 });
  return r.ok ? r.data.data : [];
}

export async function prewarmImageCache(): Promise<void> {
  const apiKey = process.env['NEXUS_FALLBACK_API_KEY'];
  if (!apiKey) {
    process.stderr.write('[agentix-nexus] prewarm: skipping (no NEXUS_FALLBACK_API_KEY set)\n');
    return;
  }
  const t0 = Date.now();
  try {
    // One core-MCP connection for the whole walk (merchants → categories + products).
    await withCore({ fallbackApiKey: apiKey }, async (call) => {
      const merchants = await listMerchants(call);
      if (merchants.length === 0) {
        process.stderr.write('[agentix-nexus] prewarm: no merchants returned, nothing to warm\n');
        return;
      }
      process.stderr.write(`[agentix-nexus] prewarm: starting for ${merchants.length} merchant(s)\n`);

      const urls: string[] = [];
      for (const m of merchants) {
        const [cats, prods] = await Promise.all([
          listCategories(call, m.id),
          listProducts(call, m.id),
        ]);
        for (const c of cats) if (c.sampleImage) urls.push(c.sampleImage);
        for (const p of prods) if (p.images?.[0]) urls.push(p.images[0]);
      }

      // Dedupe — the mock often reuses image URLs across products
      const unique = Array.from(new Set(urls));
      process.stderr.write(`[agentix-nexus] prewarm: fetching ${unique.length} unique image(s)\n`);

      await inlineImages(unique);
      process.stderr.write(`[agentix-nexus] prewarm: done in ${Date.now() - t0}ms\n`);
    });
  } catch (err) {
    const e = err as { message?: string };
    process.stderr.write(`[agentix-nexus] prewarm: failed after ${Date.now() - t0}ms: ${e.message ?? String(err)}\n`);
  }
}
