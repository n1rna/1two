import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "sqlite-browser";

export const metadata = guideMetadata({
  slug,
  title: "SQLite in the Browser with Turso & libSQL",
  description:
    "Open SQLite databases entirely client-side with WebAssembly — plus how Turso and libSQL are extending SQLite for edge and multi-tenant workloads.",
  keywords: [
    "sqlite",
    "turso",
    "libsql",
    "sqlite wasm",
    "sql.js",
    "embedded database",
    "edge database",
    "sqlite browser",
    "ai sql",
    "natural language sql",
  ],
});

export default function SqliteBrowserGuide() {
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
        <Guide.H2>SQLite everywhere</Guide.H2>
        <Guide.P>
          SQLite is the most deployed database engine in the world. It powers
          every iPhone, every Android device, every browser, and countless
          desktop and embedded applications. A single file holds an entire
          relational database — no server process, no configuration, no network
          round-trips.
        </Guide.P>
        <Guide.P>
          The 1tt.dev SQLite Browser lets you open and query these files
          directly in the browser. Drag and drop a{" "}
          <Guide.Code>.sqlite</Guide.Code>, <Guide.Code>.db</Guide.Code>, or{" "}
          <Guide.Code>.sqlite3</Guide.Code> file and start exploring — nothing
          is uploaded to a server.
        </Guide.P>
        <Guide.Callout>
          The SQLite Browser is available on{" "}
          <Guide.Strong>Pro</Guide.Strong> and <Guide.Strong>Max</Guide.Strong>{" "}
          plans.
        </Guide.Callout>

        <Guide.H2>How it works</Guide.H2>
        <Guide.P>
          Under the hood, the browser uses{" "}
          <Guide.Code>sql.js</Guide.Code> — a WebAssembly compilation of the
          full SQLite C library. When you drop a file, it is read into memory
          and passed to the WASM engine. Every query runs locally in your
          browser tab with the same behavior as native SQLite.
        </Guide.P>
        <Guide.UL>
          <li>Browse tables and views with column types, primary keys, and indexes</li>
          <li>Run arbitrary SQL with syntax highlighting</li>
          <li>Sort, filter, and paginate results in a data grid</li>
          <li>Export query results as CSV</li>
        </Guide.UL>

        <Guide.H2>AI-assisted SQL</Guide.H2>
        <Guide.P>
          The SQLite Browser includes an AI assistant that generates SQL from
          natural language. Describe what you need — &quot;find duplicate
          entries by email&quot; — and the assistant writes a query using the
          actual tables and columns in your database.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Schema-aware</Guide.Strong> — the AI reads your
            database schema and generates queries that reference real table
            and column names
          </li>
          <li>
            <Guide.Strong>Suggestion chips</Guide.Strong> — one-click query
            suggestions based on the tables in your file, so you can start
            exploring immediately
          </li>
          <li>
            <Guide.Strong>Edit and refine</Guide.Strong> — generated SQL
            lands in the editor where you can tweak it before running
          </li>
        </Guide.UL>

        <Guide.H2>Turso and libSQL: SQLite for the edge</Guide.H2>
        <Guide.P>
          SQLite was designed as an embedded, single-writer database. That model
          works brilliantly for local apps, but it has limitations for modern
          server workloads: no built-in replication, no network access protocol,
          and no multi-tenant isolation.
        </Guide.P>
        <Guide.P>
          <Guide.Strong>libSQL</Guide.Strong> is an open-source fork of SQLite
          created to address these gaps while staying fully compatible with the
          SQLite file format and SQL dialect. It adds:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Server mode</Guide.Strong> — libSQL can run as a
            standalone server that accepts connections over HTTP or WebSockets,
            turning SQLite into a networked database
          </li>
          <li>
            <Guide.Strong>Replication</Guide.Strong> — built-in support for
            streaming replication from a primary to read replicas, enabling
            edge-distributed SQLite
          </li>
          <li>
            <Guide.Strong>Embedded replicas</Guide.Strong> — an application can
            embed a local SQLite replica that syncs from a remote primary,
            giving you local-read performance with cloud durability
          </li>
          <li>
            <Guide.Strong>Multi-tenancy</Guide.Strong> — namespaced databases
            on a single server, each isolated with its own schema and data
          </li>
          <li>
            <Guide.Strong>Extensions</Guide.Strong> — native support for
            user-defined functions, virtual tables, and other extensions that
            upstream SQLite restricts in certain environments
          </li>
        </Guide.UL>

        <Guide.H2>What is Turso?</Guide.H2>
        <Guide.P>
          <Guide.Strong>Turso</Guide.Strong> is a managed platform built on
          libSQL. It provides hosted SQLite databases that replicate to edge
          locations around the world. You get the simplicity of SQLite — a
          single-file mental model, standard SQL, zero operational overhead —
          with the reach and durability of a distributed database.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Global replication</Guide.Strong> — databases
            replicate to data centers close to your users for sub-millisecond
            reads
          </li>
          <li>
            <Guide.Strong>Embedded replicas</Guide.Strong> — Turso&apos;s SDK
            lets your app embed a local SQLite file that syncs from the cloud,
            so reads never hit the network
          </li>
          <li>
            <Guide.Strong>Per-tenant databases</Guide.Strong> — create
            thousands of isolated databases on a single Turso group, ideal for
            SaaS applications where each customer gets their own database
          </li>
          <li>
            <Guide.Strong>SQLite compatibility</Guide.Strong> — Turso databases
            are real SQLite files. You can export them and open them in any
            SQLite tool — including the 1tt.dev SQLite Browser
          </li>
        </Guide.UL>

        <Guide.H2>Using Turso databases with 1tt.dev</Guide.H2>
        <Guide.P>
          If you use Turso or libSQL, you can export your database as a{" "}
          <Guide.Code>.sqlite</Guide.Code> file and open it in the 1tt.dev
          SQLite Browser for inspection. This is useful for:
        </Guide.P>
        <Guide.UL>
          <li>Debugging production data without connecting directly to the live database</li>
          <li>Inspecting schema changes before and after migrations</li>
          <li>Sharing a snapshot of a database with a teammate</li>
          <li>Running ad-hoc queries on an exported backup</li>
        </Guide.UL>

        <Guide.H2>Common use cases</Guide.H2>
        <Guide.UL>
          <li>
            <Guide.Strong>Mobile app databases</Guide.Strong> — pull the SQLite
            file from an iOS or Android device and browse it instantly
          </li>
          <li>
            <Guide.Strong>Browser storage</Guide.Strong> — inspect{" "}
            <Guide.Code>cookies.sqlite</Guide.Code>,{" "}
            <Guide.Code>places.sqlite</Guide.Code>, and other browser
            databases
          </li>
          <li>
            <Guide.Strong>Dataset exploration</Guide.Strong> — many open
            datasets ship as SQLite files. Drop one in and start querying
          </li>
          <li>
            <Guide.Strong>Quick SQL prototyping</Guide.Strong> — test schema
            designs and queries without installing any database software
          </li>
        </Guide.UL>
      </GuideLayout>
    </>
  );
}
