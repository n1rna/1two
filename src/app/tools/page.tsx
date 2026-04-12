import type { Metadata } from "next";
import { ToolGrid } from "@/components/layout/tool-grid";
import { homepageJsonLd } from "@/lib/tools/seo";

const SITE_URL = "https://1tt.dev";

export const metadata: Metadata = {
  title: "All Tools - 1tt.dev",
  description:
    "Browse every tool on 1tt.dev — JWT parser, JSON formatter, Base64 encoder, diff viewer, cron builder, timestamp converter, color picker, UUID generator, Database Studio, Redis Studio, Life Planner, and more.",
  keywords: [
    "developer tools",
    "online tools",
    "web tools",
    "devtools",
    "tool directory",
    "all tools",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/tools`,
    siteName: "1tt.dev",
    title: "All Tools - 1tt.dev",
    description:
      "Browse every tool on 1tt.dev — formatters, parsers, encoders, generators, converters, and AI-powered planners.",
  },
  twitter: {
    card: "summary_large_image",
    title: "All Tools - 1tt.dev",
    description:
      "Browse every tool on 1tt.dev — free, fast, no sign-up.",
  },
  alternates: {
    canonical: `${SITE_URL}/tools`,
  },
};

export default function ToolsPage() {
  const jsonLdItems = homepageJsonLd();
  return (
    <>
      {jsonLdItems.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <div className="p-6 max-w-6xl mx-auto">
        <ToolGrid />
      </div>
    </>
  );
}
