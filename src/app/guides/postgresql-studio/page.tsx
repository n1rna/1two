import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "postgresql-studio";

export const metadata = guideMetadata({
  slug,
  title: "PostgreSQL Database Studio",
  description:
    "Connect to any PostgreSQL database from the browser — browse schemas, run SQL queries, and inspect tables without installing a desktop client.",
  keywords: [
    "postgresql",
    "postgres",
    "database studio",
    "sql editor",
    "pg admin",
    "database gui",
    "schema browser",
    "postgres client",
  ],
});

export default function PostgresqlStudioGuide() {
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
        <Guide.H2>A database GUI that lives in your browser</Guide.H2>
        <Guide.P>
          Most PostgreSQL clients — pgAdmin, DBeaver, DataGrip — are desktop
          apps that need to be installed, updated, and configured. The 1two.dev
          Database Studio runs entirely in the browser. Open a tab, paste a
          connection string, and start querying.
        </Guide.P>
        <Guide.Callout>
          The PostgreSQL Database Studio is available on{" "}
          <Guide.Strong>Pro</Guide.Strong> and <Guide.Strong>Max</Guide.Strong>{" "}
          plans.
        </Guide.Callout>

        <Guide.H2>Connecting</Guide.H2>
        <Guide.P>
          Connections use a standard PostgreSQL connection string:
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`postgresql://user:password@host:5432/dbname`}
          </pre>
        </Guide.Callout>
        <Guide.P>
          The connection is proxied through the 1two.dev backend so your database
          does not need to allow browser-origin CORS requests. As long as the
          host is reachable from the internet (or from your network if you are
          connecting to a local instance), it will work.
        </Guide.P>

        <Guide.H2>Schema browsing</Guide.H2>
        <Guide.P>
          Once connected, the sidebar lists all schemas and their tables. Click
          any table to open it in a new tab with:
        </Guide.P>
        <Guide.UL>
          <li>Column names, types, nullability, and default values</li>
          <li>Primary keys, foreign keys, and unique constraints</li>
          <li>Indexes with their type and columns</li>
          <li>Row counts and a paginated data preview</li>
        </Guide.UL>
        <Guide.P>
          The tab bar keeps multiple tables open at once so you can cross-reference
          schemas without losing your place.
        </Guide.P>

        <Guide.H2>SQL editor</Guide.H2>
        <Guide.P>
          The built-in SQL editor gives you a full query workspace with syntax
          highlighting and keyboard shortcuts. Results render in a sortable,
          scrollable data grid. You can run <Guide.Code>SELECT</Guide.Code>,{" "}
          <Guide.Code>INSERT</Guide.Code>, <Guide.Code>UPDATE</Guide.Code>,{" "}
          <Guide.Code>DELETE</Guide.Code>, and DDL statements — anything your
          database user has permission to execute.
        </Guide.P>

        <Guide.H2>Hosted Postgres databases</Guide.H2>
        <Guide.P>
          Don&apos;t have a database yet? 1two.dev can provision a hosted
          PostgreSQL instance for you. Each hosted database runs on dedicated
          infrastructure managed by 1two — no AWS console, no Terraform, no
          connection pooler to configure. You get a connection string and
          start building.
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Instant provisioning</Guide.Strong> — create a new
            database in seconds from the Database Studio interface
          </li>
          <li>
            <Guide.Strong>Managed backups</Guide.Strong> — automated daily
            backups with point-in-time restore
          </li>
          <li>
            <Guide.Strong>Built-in studio access</Guide.Strong> — your hosted
            database appears directly in the Database Studio sidebar, ready to
            browse and query
          </li>
          <li>
            <Guide.Strong>Standard Postgres</Guide.Strong> — full PostgreSQL
            compatibility. Use it from any client, ORM, or migration tool that
            speaks Postgres
          </li>
        </Guide.UL>
        <Guide.P>
          Hosted databases are included with <Guide.Strong>Pro</Guide.Strong>{" "}
          and <Guide.Strong>Max</Guide.Strong> plans. You can also connect
          your own external databases alongside hosted ones — the studio
          treats them the same way.
        </Guide.P>

        <Guide.H2>When to use it</Guide.H2>
        <Guide.UL>
          <li>
            <Guide.Strong>Quick checks</Guide.Strong> — verify data after a
            migration, inspect a staging database, or confirm a deploy without
            opening a full desktop client
          </li>
          <li>
            <Guide.Strong>Remote debugging</Guide.Strong> — connect from any
            machine with a browser, no SSH tunnel or local tooling required
          </li>
          <li>
            <Guide.Strong>Pair programming</Guide.Strong> — share your screen
            and walk through schemas and queries without requiring your
            teammate to install anything
          </li>
          <li>
            <Guide.Strong>Cloud databases</Guide.Strong> — works with any
            Postgres-compatible service: Supabase, Neon, Railway, Amazon RDS,
            Google Cloud SQL, Azure Database for PostgreSQL
          </li>
        </Guide.UL>

      </GuideLayout>
    </>
  );
}
