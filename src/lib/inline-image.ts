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

async function inlineOne(url: string): Promise<string> {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:')) return url;
  if (!ALLOW.some((re) => re.test(url))) return url; // pass through unrecognised

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const r = await fetch(url, { redirect: 'follow', signal: controller.signal });
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
