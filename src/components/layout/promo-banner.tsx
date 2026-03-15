"use client";

import { useState, useEffect } from "react";
import { X, Megaphone } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { SignInDialog } from "./sign-in-dialog";

interface Promotion {
  text: string;
  slug: string;
  href: string;
}

const PROMOTIONS: Promotion[] = [
  {
    text: "New: Serverless Postgres databases — create and manage databases instantly",
    slug: "databases",
    href: "/account/databases",
  },
  {
    text: "Try our OG Image Builder — generate social preview images for any URL",
    slug: "og-checker",
    href: "/tools/og-checker",
  },
  {
    text: "Check out the DNS Lookup tool — query any domain's DNS records",
    slug: "dns",
    href: "/tools/dns",
  },
  {
    text: "Explore SSL Certificate Checker — inspect any site's SSL certificate chain",
    slug: "ssl-checker",
    href: "/tools/ssl-checker",
  },
  {
    text: "Try the JSON Beautifier — format, minify, and validate JSON instantly",
    slug: "json-beautifier",
    href: "/tools/json-beautifier",
  },
  {
    text: "New: Invoice Creator — generate professional invoices in seconds",
    slug: "invoice",
    href: "/tools/invoice",
  },
  {
    text: "Try the LLMs.txt Generator — create AI-ready documentation for any website",
    slug: "llms-txt",
    href: "/tools/llms-txt",
  },
];

function pickPromotion(currentSlug: string): Promotion | null {
  const available = PROMOTIONS.filter((p) => p.slug !== currentSlug);
  if (available.length === 0) return null;
  // Deterministic pick based on slug hash so it doesn't change on re-render,
  // but differs per tool page.
  let hash = 0;
  for (let i = 0; i < currentSlug.length; i++) {
    hash = (hash * 31 + currentSlug.charCodeAt(i)) >>> 0;
  }
  return available[hash % available.length];
}

function storageKey(toolSlug: string) {
  return `promo-dismissed:${toolSlug}`;
}

interface PromoBannerProps {
  currentSlug: string;
}

export function PromoBanner({ currentSlug }: PromoBannerProps) {
  const { data: session, isPending } = useSession();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  // Read dismissed state from localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    const key = storageKey(currentSlug);
    setDismissed(localStorage.getItem(key) === "1");
  }, [currentSlug]);

  const promotion = pickPromotion(currentSlug);

  // Don't render anything while session or dismissed state is loading.
  if (isPending || dismissed === null) return null;
  // Logged-in users don't see the banner.
  if (session) return null;
  // Already dismissed for this tool.
  if (dismissed) return null;
  // No suitable promotion available.
  if (!promotion) return null;

  function handleDismiss() {
    localStorage.setItem(storageKey(currentSlug), "1");
    setDismissed(true);
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (promotion!.href.startsWith("/account/")) {
      e.preventDefault();
      setSignInOpen(true);
    }
  }

  return (
    <>
      <div className="border-b bg-primary/5 animate-in slide-in-from-top-1 duration-200">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 h-9">
          <Megaphone className="h-3.5 w-3.5 text-primary shrink-0" />
          <a
            href={promotion.href}
            onClick={handleClick}
            className="flex-1 text-xs text-foreground/80 hover:text-foreground transition-colors truncate cursor-pointer"
          >
            {promotion.text}
          </a>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="shrink-0 ml-2 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}
