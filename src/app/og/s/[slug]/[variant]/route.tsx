import { ImageResponse } from "@vercel/og";
import { apiFetch } from "@/lib/api-fetch";
import { renderOgImage } from "@/lib/og/render";
import { loadDefaultFont } from "@/lib/og/font";
import type { OgCollection, OgImage } from "@/lib/og/types";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; variant: string }> },
) {
  const { slug, variant } = await params;

  // Strip extension (.png, .jpg, .webp)
  const variantName = variant.replace(/\.(png|jpe?g|webp)$/, "");

  // Fetch collection config from Go API
  const res = await apiFetch(`/api/v1/og/s/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    return new Response(res.status === 404 ? "Collection not found" : "Server error", {
      status: res.status,
    });
  }

  const collection = (await res.json()) as OgCollection;

  // Find the matching image variant by label slug
  const img = collection.config.images.find((i: OgImage) => {
    const labelSlug = i.label.toLowerCase().replace(/\s+/g, "-");
    return i.enabled && labelSlug === variantName;
  });

  if (!img) {
    return new Response(
      `Variant "${variantName}" not found. Available: ${collection.config.images
        .filter((i: OgImage) => i.enabled)
        .map((i: OgImage) => i.label.toLowerCase().replace(/\s+/g, "-"))
        .join(", ")}`,
      { status: 404 },
    );
  }

  // Apply dynamic query params
  const url = new URL(request.url);
  const dynamicTitle = url.searchParams.get("title");
  const dynamicSubtitle = url.searchParams.get("subtitle");

  const renderImg: OgImage = {
    ...img,
    title: dynamicTitle ?? img.title,
    subtitle: dynamicSubtitle ?? img.subtitle,
  };

  const theme = collection.config.theme;
  const jsx = renderOgImage(renderImg, theme);

  // Load font explicitly to avoid broken fallback fetch on Cloudflare Workers.
  const fontData = await loadDefaultFont(url.origin);

  return new ImageResponse(jsx, {
    width: img.width,
    height: img.height,
    fonts: [
      { name: "sans-serif", data: fontData, weight: 400, style: "normal" },
    ],
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
