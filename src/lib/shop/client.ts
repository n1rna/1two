import Medusa from "@medusajs/js-sdk";

export const medusa = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9000",
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
});

// ── Types matching Medusa v2 Store API ───────────────────────────────────────

export interface ProductPrice {
  id: string;
  currency_code: string;
  amount: number;
  raw_amount: { value: string; precision: number };
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  prices: ProductPrice[];
  options?: { id: string; value: string; option_id: string }[];
  inventory_quantity?: number;
  manage_inventory?: boolean;
}

export interface ProductOption {
  id: string;
  title: string;
  product_id: string;
  values: { id: string; value: string; option_id: string }[];
}

export interface ProductImage {
  id: string;
  url: string;
  rank: number;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  subtitle: string | null;
  description: string | null;
  thumbnail: string | null;
  status: string;
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  tags: { id: string; value: string }[];
  collection: { id: string; title: string; handle: string } | null;
  type: { id: string; value: string } | null;
  created_at: string;
  updated_at: string;
}

export interface CartLineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  total: number;
  variant_id: string;
  variant: {
    id: string;
    title: string;
    product: {
      title: string;
      thumbnail: string | null;
    };
  };
}

export interface Cart {
  id: string;
  items: CartLineItem[];
  total: number;
  subtotal: number;
  currency_code: string;
  region_id: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getLowestPrice(variant: ProductVariant, currency = "eur"): { amount: number; currency_code: string } | null {
  const price = variant.prices?.find((p) => p.currency_code === currency) ?? variant.prices?.[0];
  if (!price) return null;
  return { amount: Number(price.raw_amount?.value ?? price.amount) * 100, currency_code: price.currency_code };
}

export function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}
