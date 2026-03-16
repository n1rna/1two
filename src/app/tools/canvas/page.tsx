import CanvasEditor from "@/components/tools/canvas-editor";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "canvas",
  title: "Canvas Editor — Free Online Image Design Tool",
  description:
    "Create and edit images with text, shapes, and layers. Lightweight browser-based design tool — no sign-up, no watermarks. Export to PNG or JPG.",
  keywords: ["canvas editor", "image editor", "design tool", "online photoshop", "canva alternative", "free design", "png editor", "shapes", "text on image"],
});

export default function CanvasPage() {
  const jsonLd = toolJsonLd("canvas");
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <CanvasEditor />
    </>
  );
}
