import { SqliteBrowser } from "@/components/tools/sqlite-browser";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "sqlite",
  title: "SQLite Database Browser",
  description:
    "Open and explore SQLite databases directly in your browser. Browse tables, view schemas, run SQL queries with syntax highlighting, sort and filter data, and export results. Powered by sql.js WebAssembly.",
  keywords: [
    "sqlite browser",
    "sqlite viewer",
    "sqlite online",
    "sql query",
    "database browser",
    "sqlite editor",
    "db viewer",
    "sqlite explorer",
    "sql.js",
    "wasm sqlite",
  ],
});

export default function SqlitePage() {
  const jsonLd = toolJsonLd("sqlite");
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
      <SqliteBrowser />
    </>
  );
}
