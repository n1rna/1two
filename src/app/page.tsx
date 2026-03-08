import { ToolGrid } from "@/components/layout/tool-grid";
import { tools } from "@/lib/tools/registry";

function JsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "1two.dev",
    url: "https://1two.dev",
    description:
      "Free online developer tools: JWT parser, JSON formatter, Base64 encoder, diff viewer, cron builder, timestamp converter, color palette builder, UUID generator, and more.",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: tools.map((t) => t.name),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function Home() {
  return (
    <>
      <JsonLd />
      <div className="p-6 max-w-6xl mx-auto">
        <ToolGrid />
      </div>
    </>
  );
}
