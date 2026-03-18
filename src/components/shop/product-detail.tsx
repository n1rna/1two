"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { medusa, getLowestPrice, formatPrice, type Product, type ProductVariant } from "@/lib/shop/client";
import { getCartId, setCartId } from "@/lib/shop/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, ArrowLeft, Loader2, ShoppingBag, Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ProductDetail({ handle }: { handle: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await medusa.store.product.list({
          handle,
          fields: "+variants.prices.*,+variants.options.*,+options.values.*,+images",
        });
        const p = ((res as unknown as { products: Product[] }).products)?.[0];
        if (!cancelled && p) {
          setProduct(p);
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

  // Match variant to selected options
  const selectedVariant: ProductVariant | undefined = product?.variants?.find((v) => {
    if (!v.options || v.options.length === 0) return true;
    return v.options.every((opt) => {
      const parentOption = product?.options?.find((o) => o.id === opt.option_id);
      if (!parentOption) return true;
      return selectedOptions[parentOption.title] === opt.value;
    });
  }) ?? product?.variants?.[0];

  const price = selectedVariant ? getLowestPrice(selectedVariant) : null;

  const handleAddToCart = useCallback(async () => {
    if (!selectedVariant) return;
    setAdding(true);
    setError(null);
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
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  }, [selectedVariant, quantity]);

  const images = product?.images?.length ? product.images : product?.thumbnail ? [{ id: "thumb", url: product.thumbnail, rank: 0 }] : [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="h-4 w-24 bg-muted rounded mb-6 animate-pulse" />
        <div className="animate-pulse flex flex-col md:flex-row gap-8 lg:gap-12">
          <div className="aspect-square w-full md:w-1/2 bg-muted rounded-xl" />
          <div className="flex-1 space-y-4">
            <div className="h-7 bg-muted rounded w-3/4" />
            <div className="h-5 bg-muted rounded w-1/4" />
            <div className="h-px bg-border my-4" />
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Product not found.</p>
        <Link href="/shop" className="text-primary text-sm hover:underline mt-3 inline-block">
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
        {/* Images */}
        <div className="w-full md:w-1/2">
          <div className="aspect-square bg-muted rounded-xl overflow-hidden border">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage].url}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="h-16 w-16 text-muted-foreground/15" />
              </div>
            )}
          </div>
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-colors",
                    i === selectedImage ? "border-primary" : "border-transparent hover:border-border"
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.title}</h1>

          {product.collection && (
            <Badge variant="outline" className="text-xs font-medium mt-2">
              {product.collection.title}
            </Badge>
          )}

          {price && (
            <p className="text-2xl font-bold mt-3 text-primary">
              {formatPrice(price.amount, price.currency_code)}
            </p>
          )}

          <div className="h-px bg-border my-5" />

          {product.description && (
            <p className="text-muted-foreground leading-relaxed text-sm">
              {product.description}
            </p>
          )}

          {/* Options (size, color, etc.) */}
          {product.options?.map((option) => (
            <div key={option.id} className="mt-5">
              <label className="text-sm font-medium mb-2 block">
                {option.title}
                {selectedOptions[option.title] && (
                  <span className="text-muted-foreground font-normal ml-2">
                    {selectedOptions[option.title]}
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {option.values.map((val) => (
                  <button
                    key={val.id}
                    onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.title]: val.value }))}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg border text-sm transition-all duration-150",
                      selectedOptions[option.title] === val.value
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/25 hover:bg-muted/50"
                    )}
                  >
                    {val.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity */}
          <div className="mt-5">
            <label className="text-sm font-medium mb-2 block">Quantity</label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Add to cart */}
          <div className="flex items-center gap-3 mt-6">
            <Button
              className="gap-2 px-6"
              size="lg"
              onClick={handleAddToCart}
              disabled={adding || !selectedVariant}
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : added ? (
                <Check className="h-4 w-4" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              {added ? "Added!" : "Add to cart"}
            </Button>
            <Link href="/shop/cart">
              <Button variant="outline" size="lg">View cart</Button>
            </Link>
          </div>

          {error && (
            <p className="text-destructive text-sm mt-3">{error}</p>
          )}

          {/* Meta */}
          <div className="mt-6 pt-5 border-t space-y-1">
            {selectedVariant?.sku && (
              <p className="text-xs text-muted-foreground/50">SKU: {selectedVariant.sku}</p>
            )}
            {product.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-[10px]">
                    {tag.value}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
