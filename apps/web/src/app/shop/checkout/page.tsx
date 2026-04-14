import type { Metadata } from "next";
import { CheckoutView } from "@/components/shop/checkout-view";

export const metadata: Metadata = {
  title: "Checkout - 1tt.dev Shop",
  description: "Complete your purchase.",
};

export default function CheckoutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Checkout</h1>
      <CheckoutView />
    </div>
  );
}
