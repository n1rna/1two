"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { medusa } from "@/lib/shop/client";
import { getCartId, setCartId } from "@/lib/shop/cart";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Minus, Plus, ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: string;
  title: string;
  values: { id: string; value: string }[];
}

interface ProductVariant {
  id: string;
  title: string;
  sku: string | null;
  options: Record<string, string>;
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
  inventory_quantity?: number;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  images: { id: string; url: string }[];
  options: ProductOption[];
  variants: ProductVariant[];
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function ProductDetail({ handle }: { handle: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { products } = await medusa.store.product.list({
          handle,
          fields: "*variants,*variants.calculated_price,*variants.options,*options,*options.values,*images",
        });
        const p = (products as unknown as Product[])?.[0];
        if (!cancelled && p) {
          setProduct(p);
          // Default to first value for each option
          const defaults: Record<string, string> = {};
          for (const opt of p.options ?? []) {
            if (opt.values?.[0]) defaults[opt.title] = opt.values[0].value;
          }
          setSelectedOptions(defaults);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  // Find the matching variant based on selected options
  const selectedVariant = product?.variants?.find((v) => {
    if (!v.options) return false;
    return Object.entries(selectedOptions).every(
      ([key, val]) => v.options[key] === val
    );
  }) ?? product?.variants?.[0];

  const price = selectedVariant?.calculated_price;

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant) return;
    setAdding(true);
    try {
      let cartId = getCartId();
      if (!cartId) {
        const cart = await medusa.store.cart.create({});
        cartId = (cart as unknown as { cart: { id: string } }).cart.id;
        setCartId(cartId);
      }
      await medusa.store.cart.createLineItem(cartId, {
        variant_id: selectedVariant.id,
        quantity,
      });
      router.push("/shop/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }, [selectedVariant, quantity, router]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="animate-pulse flex flex-col md:flex-row gap-8">
          <div className="aspect-square w-full md:w-1/2 bg-muted rounded-xl" />
          <div className="flex-1 space-y-4">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Product not found.</p>
        <Link href="/shop" className="text-primary text-sm hover:underline mt-2 inline-block">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back link */}
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        {/* Image */}
        <div className="w-full md:w-1/2">
          <div className="aspect-square bg-muted rounded-xl overflow-hidden">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.title}</h1>

          {price && (
            <p className="text-xl font-semibold mt-2">
              {formatPrice(price.calculated_amount, price.currency_code)}
            </p>
          )}

          {product.description && (
            <p className="text-muted-foreground mt-4 leading-relaxed text-sm">
              {product.description}
            </p>
          )}

          {/* Options (size, color, etc.) */}
          {product.options?.map((option) => (
            <div key={option.id} className="mt-6">
              <label className="text-sm font-medium mb-2 block">{option.title}</label>
              <div className="flex flex-wrap gap-2">
                {option.values.map((val) => (
                  <button
                    key={val.id}
                    onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.title]: val.value }))}
                    className={cn(
                      "px-3 py-1.5 rounded-md border text-sm transition-colors",
                      selectedOptions[option.title] === val.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    {val.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity */}
          <div className="mt-6">
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Add to cart */}
          <Button
            className="mt-6 w-full sm:w-auto gap-2"
            size="lg"
            onClick={handleAddToCart}
            disabled={adding || !selectedVariant}
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Add to cart
          </Button>

          {error && (
            <p className="text-destructive text-sm mt-3">{error}</p>
          )}

          {selectedVariant?.sku && (
            <p className="text-xs text-muted-foreground/60 mt-4">
              SKU: {selectedVariant.sku}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
