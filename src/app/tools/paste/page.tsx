import { ToolLayout } from "@/components/layout/tool-layout";
import { PasteTool } from "@/components/tools/paste-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "paste",
  title: "Paste Bin",
  description:
    "Create and share text snippets with short, shareable links.",
  keywords: [
    "pastebin",
    "paste",
    "snippet",
    "share text",
    "share code",
    "gist",
    "text sharing",
  ],
});

export default function PastePage() {
  const jsonLd = toolJsonLd("paste");
  return (
    <ToolLayout slug="paste">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <PasteTool />
    </ToolLayout>
  );
}
