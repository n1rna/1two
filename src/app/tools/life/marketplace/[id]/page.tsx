import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { MarketplaceItemDetail } from "@/components/life/marketplace/MarketplaceItemDetail";
import type { MarketplaceItem } from "@/lib/marketplace";

async function fetchItem(id: string): Promise<MarketplaceItem | null> {
  try {
    const hdrs = await headers();
    const session = await auth.api.getSession({ headers: hdrs }).catch(() => null);
    const reqHeaders: Record<string, string> = {};
    if (session?.session) {
      reqHeaders["x-session-token"] = session.session.token;
      reqHeaders["x-user-id"] = session.user.id;
    }
    const res = await apiFetch(`/api/v1/life/marketplace/items/${id}`, {
      headers: reqHeaders,
      next: { revalidate: 0 },
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchItem(id);
  if (!item) return { title: "Not found - 1tt.dev" };
  return {
    title: `${item.title} - Life Marketplace - 1tt.dev`,
    description: item.description,
  };
}

export default async function MarketplaceItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await fetchItem(id);
  if (!item) notFound();

  return <MarketplaceItemDetail item={item} />;
}
