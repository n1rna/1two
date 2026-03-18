import type { Metadata } from "next";
import { ShopGrid } from "@/components/shop/shop-grid";

export const metadata: Metadata = {
  title: "Shop — 1tt.dev Merch",
  description:
    "Official 1tt.dev merchandise. T-shirts, hoodies, stickers, mugs, and more. High-quality developer merch.",
};

export default function ShopPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shop</h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-base">
          Official 1tt.dev merch — wear the tools you love.
        </p>
      </div>
      <ShopGrid />
    </div>
  );
}
