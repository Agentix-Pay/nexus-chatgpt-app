/**
 * Fetch an image URL server-side and return a data URL that can be embedded
 * directly in the widget HTML — bypasses every iframe-level image-load
 * restriction (CSP, sandbox, referrer, redirect-with-cookies) because the
 * iframe makes zero network calls for these images.
 *
 * Used by the tool handlers (search_products, get_product, list_categories)
 * so the structuredContent ChatGPT posts to the widget already has data URLs
 * in place of HTTP URLs. The widget renders them unchanged.
 *
 * Each result is cached in-process by URL — the same upstream image won't be
 * re-fetched while the App stays warm.
 */

const cache = new Map<string, { data: string; expires: number }>();
const TTL_MS = 60 * 60_000; // 1h in-memory cache

const ALLOW = [
  /^https:\/\/loremflickr\.com\//,
  /^https:\/\/[^/]+\.flickr\.com\//,
  /^https:\/\/cdn\.shopify\.com\//,
  /^https:\/\/[^/]+\.shopifycdn\.com\//,
  /^https:\/\/i[0-9]\.wp\.com\//,
  /^https:\/\/[^/]+\.bigcommerce\.com\//,
  /^https:\/\/res\.cloudinary\.com\//,
  /^https:\/\/ik\.imagekit\.io\//,
  /^https:\/\/imagedelivery\.net\//,
  /^https:\/\/images\.squarespace-cdn\.com\//,
  /^https:\/\/[^/]+\.cloudfront\.net\//,
  /^https:\/\/[^/]+\.s3\.amazonaws\.com\//,
  /^https:\/\/s3\.amazonaws\.com\//,
  /^https:\/\/images\.unsplash\.com\//,
];

/**
 * Some upstream image sources serve images much larger than the widget needs.
 * Tiles render ~280×280px; serving 800×600 wastes both fetch time and payload
 * size to ChatGPT. Rewrite known sources to smaller dimensions before fetch.
 */
function rewriteForSize(url: string): string {
  // loremflickr: https://loremflickr.com/<w>/<h>/<tags>?lock=N → 300×300
  const lf = url.match(/^(https:\/\/loremflickr\.com\/)\d+\/\d+(\/.+)$/);
  if (lf) return `${lf[1]}300/300${lf[2]}`;
  // Shopify CDN supports size suffixes — most product image URLs are like
  // https://cdn.shopify.com/.../image.jpg → image_400x400.jpg
  // We don't blanket-rewrite Shopify because their URLs encode size differently
  // per shop; leave the upstream URL alone until we have a specific merchant
  // to tune for.
  return url;
}

async function inlineOne(url: string): Promise<string> {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:')) return url;
  if (!ALLOW.some((re) => re.test(url))) return url; // pass through unrecognised

  // Cache key is the original URL so repeat calls hit even if rewriting changes.
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;

  const fetchUrl = rewriteForSize(url);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const r = await fetch(fetchUrl, { redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return url;
    const contentType = r.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    const data = `data:${contentType};base64,${buf.toString('base64')}`;
    cache.set(url, { data, expires: Date.now() + TTL_MS });
    return data;
  } catch {
    return url; // fall back to original — widget's placeholder will handle it
  }
}

/** Inline a single image URL → data URL (or pass through on failure). */
export async function inlineImage(url: string | null | undefined): Promise<string> {
  return inlineOne(url ?? '');
}

/** Inline an array of image URLs in parallel. */
export async function inlineImages(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((u) => inlineOne(u)));
}
