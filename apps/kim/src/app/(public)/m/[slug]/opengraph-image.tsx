import { ImageResponse } from "next/og";
import { apiFetch } from "@/lib/api-fetch";
import type { MarketplaceItem, MarketplaceKind } from "@/lib/marketplace";

// Note: do NOT set `runtime = "edge"` — OpenNext/Cloudflare requires edge
// runtime functions to be bundled separately, which breaks the monolithic
// build. ImageResponse works fine under the default runtime.
export const alt = "Life Marketplace item";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT: Record<MarketplaceKind, string> = {
  routine: "#5F9598",
  gym_session: "#C84B42",
  meal_plan: "#7EA879",
};

const KIND_LABELS: Record<MarketplaceKind, string> = {
  routine: "Routine",
  gym_session: "Gym Session",
  meal_plan: "Meal Plan",
};

async function fetchItem(slug: string): Promise<MarketplaceItem | null> {
  try {
    const res = await apiFetch(`/api/v1/public/marketplace/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await fetchItem(slug);

  const title = item?.title ?? "Life Marketplace";
  const description = item?.description ?? "Browse community templates on 1tt.dev";
  const kind = item?.kind ?? "routine";
  const authorName = item?.author?.name ?? "";
  const accent = ACCENT[kind] ?? "#7c3aed";
  const kindLabel = KIND_LABELS[kind] ?? "Template";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#09090b",
          display: "flex",
          flexDirection: "column",
          padding: "64px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 6,
            background: accent,
          }}
        />

        {/* Kind badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: `${accent}25`,
              color: accent,
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {kindLabel}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.15,
            maxWidth: 900,
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          {title}
        </div>

        {/* Description */}
        {description && (
          <div
            style={{
              fontSize: 22,
              color: "#a1a1aa",
              lineHeight: 1.5,
              maxWidth: 850,
              marginBottom: 40,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {authorName && (
              <span style={{ color: "#71717a", fontSize: 18 }}>
                by {authorName}
              </span>
            )}
          </div>
          <div
            style={{
              color: "#3f3f46",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            1tt.dev
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      },
    }
  );
}
