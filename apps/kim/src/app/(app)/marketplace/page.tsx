import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { MarketplaceBrowser } from "@/components/marketplace/MarketplaceBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Life Marketplace - 1tt.dev",
  description:
    "Browse and fork community-created routines, gym sessions, and meal plans.",
};

export default function MarketplacePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Marketplace</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Community templates — fork one to get started instantly.
          </p>
        </div>
        <Link
          href="/marketplace/mine"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          My published items
        </Link>
      </div>

      <MarketplaceBrowser />
    </div>
  );
}
