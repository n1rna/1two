import { SqliteBrowser } from "@/components/tools/sqlite-browser";
import { PromoBanner } from "@/components/layout/promo-banner";
import { ToolInfo } from "@/components/layout/tool-info";
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
      <PromoBanner currentSlug="sqlite" />
      <SqliteBrowser>
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <ToolInfo>
            <ToolInfo.H2>What is SQLite?</ToolInfo.H2>
            <ToolInfo.P>
              SQLite is a self-contained, serverless SQL database engine stored in a single file. It&apos;s the most widely deployed database in the world - embedded in browsers, mobile apps, IoT devices, and desktop software. Files typically use <ToolInfo.Code>.sqlite</ToolInfo.Code>, <ToolInfo.Code>.db</ToolInfo.Code>, or <ToolInfo.Code>.sqlite3</ToolInfo.Code> extensions.
            </ToolInfo.P>

            <ToolInfo.H2>How it works</ToolInfo.H2>
            <ToolInfo.P>
              This browser opens SQLite databases entirely client-side using <ToolInfo.Code>sql.js</ToolInfo.Code>, a WebAssembly port of SQLite. Your database file never leaves your machine - it&apos;s loaded into memory and queried directly in the browser tab.
            </ToolInfo.P>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li><ToolInfo.Strong>Drag & drop</ToolInfo.Strong> a <ToolInfo.Code>.sqlite</ToolInfo.Code> or <ToolInfo.Code>.db</ToolInfo.Code> file, or click to browse</li>
              <li>Browse <ToolInfo.Strong>tables</ToolInfo.Strong>, view schemas, and inspect data with sorting and filtering</li>
              <li>Run custom <ToolInfo.Strong>SQL queries</ToolInfo.Strong> with syntax highlighting</li>
              <li>Export query results as CSV</li>
            </ToolInfo.UL>

            <ToolInfo.H2>Common use cases</ToolInfo.H2>
            <ToolInfo.UL>
              <li>Inspecting SQLite databases from mobile apps (iOS Core Data, Android Room)</li>
              <li>Browsing browser storage databases (<ToolInfo.Code>cookies.sqlite</ToolInfo.Code>, <ToolInfo.Code>places.sqlite</ToolInfo.Code>)</li>
              <li>Quick SQL queries on local data without installing DB tools</li>
              <li>Exploring dataset files distributed as SQLite databases</li>
            </ToolInfo.UL>
          </ToolInfo>
        </div>
      </SqliteBrowser>
    </>
  );
}
