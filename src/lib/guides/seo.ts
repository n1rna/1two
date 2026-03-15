import type { Metadata } from "next";
import { getGuideBySlug } from "./registry";

const SITE_URL = "https://1two.dev";
const OG_COLLECTION_SLUG = "c9d65497fec3";
const OG_BASE = `${SITE_URL}/og/s/${OG_COLLECTION_SLUG}`;

interface GuideSeoOptions {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

export function guideMetadata({ slug, title, description, keywords }: GuideSeoOptions): Metadata {
  const url = `${SITE_URL}/guides/${slug}`;
  const subtitle = encodeURIComponent(title);
  const ogImage = `${OG_BASE}/open-graph.png?subtitle=${subtitle}`;
  const twImage = `${OG_BASE}/twitter-card.png?subtitle=${subtitle}`;
  return {
    title: `${title} — 1two.dev`,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — 1two.dev`,
      description,
      url,
      type: "article",
      siteName: "1two.dev",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — 1two.dev`,
      description,
      images: [twImage],
    },
  };
}

export function guideJsonLd(slug: string) {
  const guide = getGuideBySlug(slug);
  if (!guide) return null;

  const url = `${SITE_URL}/guides/${slug}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      url,
      author: {
        "@type": "Organization",
        name: "1two.dev",
        url: SITE_URL,
      },
      publisher: {
        "@type": "Organization",
        name: "1two.dev",
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
      },
      keywords: guide.keywords.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ],
    },
  ];
}
