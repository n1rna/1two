"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketplaceKind = "routine" | "gym_session" | "meal_plan";

export interface MarketplaceAuthor {
  id: string;
  name: string;
}

export interface MarketplaceVersion {
  id: string;
  version: number;
  changelog: string;
  created_at: string;
}

export interface MarketplaceItem {
  id: string;
  slug: string;
  kind: MarketplaceKind;
  title: string;
  description: string;
  tags: string[];
  author: MarketplaceAuthor;
  current_version: number;
  fork_count: number;
  view_count: number;
  published_at: string;
  updated_at: string;
  content: unknown;
  versions?: MarketplaceVersion[];
  forked_from_mp_id?: string | null;
}

export interface MarketplaceListResponse {
  items: MarketplaceItem[];
}

export interface PublishPayload {
  kind: MarketplaceKind;
  source_id: string;
  title: string;
  description: string;
  tags: string[];
  changelog?: string;
}

export interface ForkResponse {
  source_id: string;
  kind: MarketplaceKind;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mpApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/life/marketplace${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || "";
    } catch {
      message = text;
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error("Service is temporarily unavailable.");
    }
    if (res.status === 401) {
      throw new Error("Please sign in to continue.");
    }
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function publishToMarketplace(
  payload: PublishPayload
): Promise<MarketplaceItem> {
  return mpApiFetch<MarketplaceItem>("/publish", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishNewVersion(
  id: string,
  changelog?: string
): Promise<MarketplaceVersion> {
  return mpApiFetch<MarketplaceVersion>(`/items/${id}/versions`, {
    method: "POST",
    body: JSON.stringify({ changelog }),
  });
}

export async function unpublishMarketplaceItem(id: string): Promise<void> {
  return mpApiFetch<void>(`/items/${id}`, { method: "DELETE" });
}

export async function listMarketplaceItems(params?: {
  q?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  return mpApiFetch<MarketplaceListResponse>(`${query}`);
}

export async function listMyMarketplaceItems(): Promise<MarketplaceListResponse> {
  return mpApiFetch<MarketplaceListResponse>("/mine");
}

export async function getMarketplaceItem(id: string): Promise<MarketplaceItem> {
  return mpApiFetch<MarketplaceItem>(`/items/${id}`);
}

export async function forkMarketplaceItem(
  id: string,
  version?: number
): Promise<ForkResponse> {
  return mpApiFetch<ForkResponse>(`/items/${id}/fork`, {
    method: "POST",
    body: JSON.stringify(version != null ? { version } : {}),
  });
}

// ─── Public (no auth) ─────────────────────────────────────────────────────────

export async function getPublicMarketplaceItem(
  slug: string
): Promise<MarketplaceItem> {
  const res = await fetch(`/api/proxy/public/marketplace/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Not found (${res.status})`);
  return res.json() as Promise<MarketplaceItem>;
}

export async function listPublicMarketplaceItems(params?: {
  q?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketplaceListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  const res = await fetch(`/api/proxy/public/marketplace${query}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to load marketplace (${res.status})`);
  }
  return res.json() as Promise<MarketplaceListResponse>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const KIND_LABELS: Record<MarketplaceKind, string> = {
  routine: "Routine",
  gym_session: "Gym Session",
  meal_plan: "Meal Plan",
};

export const KIND_COLORS: Record<MarketplaceKind, string> = {
  routine: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  gym_session: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  meal_plan: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
};

export const KIND_ACCENT_HEX: Record<MarketplaceKind, string> = {
  routine: "#7c3aed",
  gym_session: "#ea580c",
  meal_plan: "#0d9488",
};

export function kindRoute(
  kind: MarketplaceKind,
  sourceId: string
): string {
  if (kind === "routine") return `/routines/${sourceId}`;
  if (kind === "gym_session") return `/health/sessions/${sourceId}`;
  return `/health/meals/${sourceId}`;
}
