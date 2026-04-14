"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { medusa, getLowestPrice, formatPrice, type Product } from "@/lib/shop/client";
import { ShoppingBag, Tag } from "lucide-react";

export function ShopGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await medusa.store.product.list({
          fields: "+variants.prices.*",
        });
        if (!cancelled) setProducts((res as unknown as { products: Product[] }).products ?? []);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card animate-pulse">
            <div className="aspect-[4/3] bg-muted rounded-t-xl" />
            <div className="p-5 space-y-2.5">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/3 mt-3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Shop is not available right now.</p>
        <p className="text-muted-foreground/50 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">No products yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {products.map((product) => {
        const firstVariant = product.variants?.[0];
        const price = firstVariant ? getLowestPrice(firstVariant) : null;

        return (
          <Link
            key={product.id}
            href={`/shop/${product.handle}`}
            className="group block"
          >
            <div className="relative h-full rounded-xl border bg-card transition-all duration-200 hover:border-foreground/25 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 overflow-hidden">
              {/* Thumbnail */}
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-10 w-10 text-muted-foreground/15" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-lg blur-md bg-primary/20 scale-125" aria-hidden />
                    <div className="relative p-2 rounded-lg bg-primary/10 ring-1 ring-primary/15">
                      <Tag className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    {product.collection && (
                      <Badge variant="outline" className="text-xs font-medium mt-1">
                        {product.collection.title}
                      </Badge>
                    )}
                  </div>
                </div>

                {product.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                    {product.description}
                  </p>
                )}

                {price && (
                  <p className="text-sm font-semibold mt-3 text-primary">
                    {formatPrice(price.amount, price.currency_code)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
