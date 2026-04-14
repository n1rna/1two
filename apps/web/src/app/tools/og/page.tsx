import { OgImageBuilder } from "@/components/tools/og-image-builder";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "og",
  title: "OG Image Builder",
  description:
    "Create Open Graph images for social media with multiple layouts, sizes, and export options",
  keywords: [
    "og image",
    "open graph",
    "social media",
    "meta image",
    "twitter card",
    "facebook",
    "linkedin",
    "og builder",
  ],
});

export default function OgPage() {
  const jsonLd = toolJsonLd("og");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <style>{`body { overflow: hidden; }`}</style>
      <OgImageBuilder />
    </>
  );
}
