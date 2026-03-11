import { ImageResponse } from "@vercel/og";
import { renderOgImage } from "@/lib/og/render";
import { loadDefaultFont } from "@/lib/og/font";
import type { OgImage, Theme } from "@/lib/og/types";

export const runtime = "edge";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("image" in body) ||
    !("theme" in body)
  ) {
    return new Response('Request body must contain "image" and "theme"', {
      status: 400,
    });
  }

  const { image, theme } = body as { image: OgImage; theme: Theme };

  if (
    typeof image !== "object" ||
    image === null ||
    typeof image.width !== "number" ||
    typeof image.height !== "number"
  ) {
    return new Response('"image" must be a valid OgImage object with width and height', {
      status: 400,
    });
  }

  if (typeof theme !== "object" || theme === null) {
    return new Response('"theme" must be a valid Theme object', { status: 400 });
  }

  const jsx = renderOgImage(image, theme);

  // Load font explicitly to avoid broken fallback fetch on Cloudflare Workers.
  const url = new URL(request.url);
  const fontData = await loadDefaultFont(url.origin);

  return new ImageResponse(jsx, {
    width: image.width,
    height: image.height,
    fonts: [
      { name: "sans-serif", data: fontData, weight: 400, style: "normal" },
    ],
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      "Content-Type": "image/png",
    },
  });
}
