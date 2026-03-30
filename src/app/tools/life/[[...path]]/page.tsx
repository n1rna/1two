import { LifeTool } from "@/components/tools/life-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "life",
  title: "Life Tool - AI Life Planner - 1tt.dev",
  description:
    "AI-powered life planning - manage routines, actionables, habits, and daily schedules with an intelligent assistant.",
  keywords: [
    "life planner",
    "ai assistant",
    "routines",
    "habits",
    "daily planner",
    "productivity",
    "schedule",
    "reminders",
  ],
});

export default function LifePage() {
  const jsonLd = toolJsonLd("life");
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; } main { overflow: hidden !important; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <LifeTool />
    </>
  );
}
