"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { medusa, formatPrice } from "@/lib/shop/client";
import { getCartId, clearCartId } from "@/lib/shop/cart";
import { Button } from "@/components/ui/button";
import { Trash2, Minus, Plus, ShoppingBag, Loader2, ArrowLeft, ArrowRight } from "lucide-react";

interface CartLineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail: string | null;
  product_title: string | null;
  variant_title: string | null;
}

interface Cart {
  id: string;
  items: CartLineItem[];
  total: number;
  subtotal: number;
  currency_code: string;
}

export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    const cartId = getCartId();
    if (!cartId) {
      setLoading(false);
      return;
    }
    try {
      const data = await medusa.store.cart.retrieve(cartId);
      setCart((data as unknown as { cart: Cart }).cart);
    } catch {
      clearCartId();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    const cartId = getCartId();
    if (!cartId) return;
    setUpdating(itemId);
    try {
      if (quantity <= 0) {
        await medusa.store.cart.deleteLineItem(cartId, itemId);
      } else {
        await medusa.store.cart.updateLineItem(cartId, itemId, { quantity });
      }
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      // ignore
    } finally {
      setUpdating(null);
    }
  }, [fetchCart]);

  const removeItem = useCallback(async (itemId: string) => {
    const cartId = getCartId();
    if (!cartId) return;
    setUpdating(itemId);
    try {
      await medusa.store.cart.deleteLineItem(cartId, itemId);
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
    } catch {
      // ignore
    } finally {
      setUpdating(null);
    }
  }, [fetchCart]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse border rounded-xl p-4">
            <div className="w-20 h-20 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Your cart is empty.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 text-primary text-sm hover:underline mt-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Items */}
      <div className="space-y-3">
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-4 border rounded-xl p-4 bg-card transition-colors hover:border-foreground/10">
            {/* Thumbnail */}
            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden shrink-0 border">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/15" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm tracking-tight truncate">
                {item.product_title ?? item.title}
              </h3>
              {item.variant_title && item.variant_title !== "Default" && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.variant_title}</p>
              )}

              {/* Quantity controls */}
              <div className="flex items-center gap-1.5 mt-2.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  disabled={updating === item.id}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium tabular-nums w-6 text-center">
                  {updating === item.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                  ) : (
                    item.quantity
                  )}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={updating === item.id}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Price + remove */}
            <div className="flex flex-col items-end justify-between shrink-0">
              <p className="text-sm font-semibold">
                {formatPrice(item.unit_price * item.quantity, cart.currency_code)}
              </p>
              {item.quantity > 1 && (
                <p className="text-[11px] text-muted-foreground/60">
                  {formatPrice(item.unit_price, cart.currency_code)} each
                </p>
              )}
              <button
                onClick={() => removeItem(item.id)}
                disabled={updating === item.id}
                className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5 mt-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 rounded-xl border bg-card p-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatPrice(cart.subtotal, cart.currency_code)}</span>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(cart.total, cart.currency_code)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <Link href="/shop" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Continue shopping
          </Button>
        </Link>
        <Link href="/shop/checkout" className="flex-1">
          <Button className="w-full gap-2">
            Checkout
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
