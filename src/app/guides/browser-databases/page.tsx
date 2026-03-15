import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "browser-databases";

export const metadata = guideMetadata({
  slug,
  title: "Explore Databases in the Browser",
  description:
    "Open SQLite files, connect to Postgres databases, and browse Elasticsearch clusters — all from a single browser tab.",
  keywords: [
    "sqlite browser",
    "database explorer",
    "sql editor",
    "elasticsearch client",
    "postgres gui",
    "browser database",
  ],
});

export default function BrowserDatabasesGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>No install required</Guide.H2>
        <Guide.P>
          Most database GUIs require downloading an app, managing connections, and keeping
          software up to date. 1two.dev runs entirely in the browser — open a tab and
          start exploring.
        </Guide.P>

        <Guide.H2>SQLite Browser</Guide.H2>
        <Guide.P>
          Drag and drop any <Guide.Code>.sqlite</Guide.Code> or{" "}
          <Guide.Code>.db</Guide.Code> file onto the page. The file is read locally using
          WebAssembly — nothing is uploaded to a server.
        </Guide.P>
        <Guide.UL>
          <li>Browse tables and view schemas with column types, primary keys, and indexes</li>
          <li>Run arbitrary SQL queries with syntax highlighting and auto-complete</li>
          <li>Sort, filter, and paginate results in a spreadsheet-style data grid</li>
          <li>Export query results as CSV or JSON</li>
        </Guide.UL>
        <Guide.P>
          The interface follows a sidebar + tab bar pattern similar to desktop database
          tools. Each table or query gets its own tab so you can switch between them
          without losing state.
        </Guide.P>
        <Guide.ToolCard slug="sqlite" />

        <Guide.H2>Elasticsearch Explorer</Guide.H2>
        <Guide.P>
          Connect to any Elasticsearch or OpenSearch cluster that is reachable from your
          browser. The explorer supports <Guide.Strong>Basic auth</Guide.Strong>,{" "}
          <Guide.Strong>API key</Guide.Strong>, and{" "}
          <Guide.Strong>Bearer token</Guide.Strong> authentication.
        </Guide.P>
        <Guide.UL>
          <li>Browse indices with health status, doc counts, and storage sizes</li>
          <li>View cluster overview, node stats, and alias configuration</li>
          <li>Run queries with the full Elasticsearch Query DSL</li>
          <li>Create and update documents with auto-generated sample bodies based on index mappings</li>
          <li>Multiple saved connections with one-click switching</li>
        </Guide.UL>

        <Guide.H3>CORS considerations</Guide.H3>
        <Guide.P>
          Because the browser makes requests directly to your cluster, the cluster needs
          to allow cross-origin requests from{" "}
          <Guide.Code>https://1two.dev</Guide.Code>. If you&apos;re running Elasticsearch
          locally, add these settings to <Guide.Code>elasticsearch.yml</Guide.Code>:
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`http.cors.enabled: true
http.cors.allow-origin: "https://1two.dev"
http.cors.allow-headers: "Authorization,Content-Type"
http.cors.allow-methods: "GET,POST,PUT,DELETE,HEAD,OPTIONS"`}
          </pre>
        </Guide.Callout>
        <Guide.ToolCard slug="elasticsearch" />

        <Guide.H2>Postgres (Database Studio)</Guide.H2>
        <Guide.P>
          For authenticated users, 1two.dev also provides a{" "}
          <Guide.Strong>Database Studio</Guide.Strong> for Postgres databases. Connect
          using a standard connection string and get the same sidebar + tab bar experience
          with schema browsing, SQL editing, and data grids.
        </Guide.P>

        <Guide.H2>State persistence</Guide.H2>
        <Guide.P>
          Saved connections, open tabs, and query history are persisted to{" "}
          <Guide.Code>localStorage</Guide.Code> and can optionally be synced to the cloud
          so they follow you across devices. See the{" "}
          <Guide.Strong>Cloud Sync</Guide.Strong> guide for details.
        </Guide.P>
      </GuideLayout>
    </>
  );
}
