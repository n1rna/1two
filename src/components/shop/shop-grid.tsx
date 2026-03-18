"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { medusa } from "@/lib/shop/client";
import { ShoppingBag } from "lucide-react";

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  variants: {
    id: string;
    calculated_price?: {
      calculated_amount: number;
      currency_code: string;
    };
  }[];
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function ShopGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { products: data } = await medusa.store.product.list({
          fields: "id,title,handle,description,thumbnail,variants.id,variants.calculated_price",
        });
        if (!cancelled) setProducts(data as unknown as Product[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card animate-pulse">
            <div className="aspect-square bg-muted rounded-t-xl" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">
          Shop is not available right now.
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">No products yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => {
        const firstVariant = product.variants?.[0];
        const price = firstVariant?.calculated_price;

        return (
          <Link
            key={product.id}
            href={`/shop/${product.handle}`}
            className="group rounded-xl border bg-card hover:border-primary/30 transition-colors overflow-hidden"
          >
            {/* Thumbnail */}
            <div className="aspect-square bg-muted relative overflow-hidden">
              {product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground/20" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                {product.title}
              </h3>
              {product.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {product.description}
                </p>
              )}
              {price && (
                <p className="text-sm font-medium mt-2">
                  {formatPrice(price.calculated_amount, price.currency_code)}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
