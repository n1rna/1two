// Cache the font ArrayBuffer so we only fetch once per worker instance.
let fontCache: ArrayBuffer | null = null;

/**
 * Loads the default font for Satori/ImageResponse.
 *
 * On Cloudflare Workers the built-in fallback font fetch in @vercel/og fails
 * because `fetch(new URL("./file.ttf", import.meta.url))` doesn't resolve.
 * We work around this by fetching the font from /fonts/ (static asset) and
 * passing it explicitly to ImageResponse.
 */
export async function loadDefaultFont(origin: string): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(`${origin}/fonts/noto-sans-regular.ttf`);
  fontCache = await res.arrayBuffer();
  return fontCache;
}
