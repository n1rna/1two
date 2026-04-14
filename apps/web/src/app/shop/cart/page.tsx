import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";

export const metadata: Metadata = {
  title: "Cart - 1tt.dev Shop",
  description: "Your shopping cart.",
};

export default function CartPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Cart</h1>
      <CartView />
    </div>
  );
}
