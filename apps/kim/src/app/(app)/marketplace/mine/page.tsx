import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MyMarketplaceItems } from "@/components/marketplace/MyMarketplaceItems";

export const metadata: Metadata = {
  title: "My Marketplace Items - 1tt.dev",
  description: "Manage your published marketplace templates.",
};

export default function MyMarketplacePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3 w-3" />
          Marketplace
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">My Published Items</h1>
        <p className="text-sm text-muted-foreground">
          Manage templates you&apos;ve published to the marketplace.
        </p>
      </div>
      <MyMarketplaceItems />
    </div>
  );
}
