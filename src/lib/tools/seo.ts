import type { Metadata } from "next";
import { getToolBySlug } from "./registry";

const SITE_URL = "https://1two.dev";

interface ToolSeoOptions {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

export function toolMetadata({ slug, title, description, keywords }: ToolSeoOptions): Metadata {
  const url = `${SITE_URL}/tools/${slug}`;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — 1two.dev`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — 1two.dev`,
      description,
    },
  };
}

export function toolJsonLd(slug: string) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: `${SITE_URL}/tools/${slug}`,
    description: tool.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}
