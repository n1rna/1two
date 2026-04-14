import type { Metadata } from "next";
import { MarketplaceBrowser } from "@/components/marketplace/MarketplaceBrowser";

export const dynamic = "force-dynamic";

const SITE_URL = "https://kim1.ai";

export const metadata: Metadata = {
  title: "Marketplace · kim",
  description:
    "Browse and fork community-built routines, gym sessions, and meal plans from the kim life agent. Free, public, no sign-up to read.",
  alternates: { canonical: `${SITE_URL}/marketplace` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/marketplace`,
    title: "kim marketplace",
    description:
      "Community templates for routines, meals, and gym sessions — fork one to get started.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kim marketplace",
    description:
      "Community templates for routines, meals, and gym sessions — fork one to get started.",
  },
};

export default function MarketplacePage() {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 space-y-10">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          community library
        </div>
        <h1
          className="text-4xl md:text-5xl italic leading-[1.05] tracking-tight"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          borrow a life,
          <br />
          <span className="text-muted-foreground">then make it your own.</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Routines, gym sessions, and meal plans built by other kim users.
          Read anything without signing in. Fork a template to drop it into
          your own life — kim takes it from there.
        </p>
      </section>

      <MarketplaceBrowser />
    </div>
  );
}
