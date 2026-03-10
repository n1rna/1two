import { CsvViewer } from "@/components/tools/csv-viewer";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "csv",
  title: "CSV Viewer & Editor",
  description:
    "Open, view, edit, search, and export CSV files in the browser with data science split presets",
  keywords: [
    "csv",
    "csv viewer",
    "csv editor",
    "tsv",
    "data",
    "export",
    "train test split",
    "sample",
  ],
});

export default function CsvPage() {
  const jsonLd = toolJsonLd("csv");
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
      <CsvViewer />
    </>
  );
}
