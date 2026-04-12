import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import type { MarketplaceItem } from "@/lib/marketplace";
import { PublicMarketplacePage } from "@/components/life/marketplace/PublicMarketplacePage";

const SITE_URL = "https://1tt.dev";

async function fetchPublicItem(slug: string): Promise<MarketplaceItem | null> {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchPublicItem(slug);
  if (!item) return { title: "Not found - 1tt.dev" };

  const imageUrl = `${SITE_URL}/m/${slug}/opengraph-image`;

  return {
    title: `${item.title} - 1tt.dev`,
    description: item.description,
    openGraph: {
      title: item.title,
      description: item.description,
      url: `${SITE_URL}/m/${slug}`,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description: item.description,
      images: [imageUrl],
    },
  };
}

export default async function PublicItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await fetchPublicItem(slug);
  if (!item) notFound();

  return <PublicMarketplacePage item={item} />;
}
