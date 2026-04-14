import Link from "next/link";
import {
  Database,
  ChevronLeft,
  Table2,
  Terminal,
  Search,
  RefreshCw,
  Plus,
  X,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "database-studio",
  title: "Database Studio - PostgreSQL Browser & SQL Client",
  description:
    "Connect to any PostgreSQL database from the browser - run queries, browse schemas, inspect tables, and manage data. Works with managed databases or your own via a secure tunnel.",
  keywords: [
    "database studio",
    "postgresql client",
    "postgres gui",
    "sql editor",
    "schema browser",
    "pgadmin alternative",
    "database browser",
    "sql query tool",
    "postgres web client",
    "database management",
  ],
});

export default function DatabaseStudioPage() {
  const jsonLd = toolJsonLd("database-studio");
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      {/* Full-screen layout — no ToolLayout wrapper */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Database Studio</span>
            <div className="flex items-center gap-1 ml-auto">
              <Link
                href="/guides/postgresql-studio"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Docs</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Body: mockup left + info panel right */}
        <div className="flex flex-1 min-h-0">
          {/* ── Left: Static Studio Mockup ── */}
          <div
            className="hidden lg:flex lg:w-[55%] flex-col border-r overflow-hidden pointer-events-none select-none opacity-90 shrink-0"
            aria-hidden="true"
          >
            {/* Studio shell */}
            <div className="flex h-full overflow-hidden">
              {/* Sidebar */}
              <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden">
                {/* Sidebar header */}
                <div className="px-3 py-2.5 border-b space-y-1.5 shrink-0">
                  {/* Back link */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChevronLeft className="h-3 w-3" />
                    All databases
                  </div>
                  {/* DB name */}
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold truncate flex-1 min-w-0">
                      production-db
                    </span>
                  </div>
                  {/* Badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      Postgres
                    </span>
                  </div>
                </div>

                {/* Schema sidebar replica */}
                <div className="flex flex-col h-full bg-muted/20">
                  {/* Schema selector */}
                  <div className="px-2 pt-2 pb-1 border-b">
                    <div className="relative">
                      <Database className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <div className="w-full bg-transparent border border-border/50 rounded-md pl-7 pr-2 h-7 text-xs flex items-center text-foreground">
                        public (5)
                      </div>
                    </div>
                  </div>

                  {/* Search + Refresh */}
                  <div className="p-2 border-b flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <div className="w-full border border-border/50 rounded-md pl-7 pr-2 h-7 text-xs flex items-center text-muted-foreground bg-background">
                        Filter tables&hellip;
                      </div>
                    </div>
                    <div className="h-7 w-7 shrink-0 flex items-center justify-center rounded border border-border/50 text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Table list */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                    {[
                      { name: "users", rows: "~1.2k", active: true },
                      { name: "orders", rows: "~8.9k" },
                      { name: "products", rows: "342" },
                      { name: "payments", rows: "~5.1k" },
                      { name: "sessions", rows: "892" },
                    ].map(({ name, rows, active }) => (
                      <div
                        key={name}
                        className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors group"
                      >
                        <span className="shrink-0 text-muted-foreground">
                          <ChevronRight className="h-3 w-3" />
                        </span>
                        <Table2
                          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`flex-1 text-left truncate text-sm font-medium min-w-0 ${active ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">
                          {rows}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* New SQL Query button */}
                  <div className="p-2 border-t">
                    <div className="w-full flex items-center justify-center gap-2 text-xs h-8 border border-border/50 rounded-md text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5" />
                      New SQL Query
                    </div>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
                  <div className="flex items-end min-w-0">
                    {/* Active tab: users */}
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none border-r border-border/50 shrink-0 max-w-[160px] bg-background border-b-2 border-b-primary text-foreground">
                      <Table2 className="h-3 w-3 shrink-0" />
                      <span className="truncate font-medium">users</span>
                      <span className="shrink-0 rounded hover:bg-muted p-0.5 -mr-0.5 opacity-60">
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </div>
                    {/* Inactive tab: SQL Query */}
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none border-r border-border/50 shrink-0 max-w-[160px] text-muted-foreground">
                      <Terminal className="h-3 w-3 shrink-0" />
                      <span className="truncate font-medium">SQL Query</span>
                      <span className="shrink-0 rounded hover:bg-muted p-0.5 -mr-0.5 opacity-0">
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-8 w-8 shrink-0 ml-0.5 text-muted-foreground rounded-sm">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1" />
                </div>

                {/* Data grid */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b sticky top-0">
                        {["id", "email", "name", "role", "created_at"].map(
                          (col) => (
                            <th
                              key={col}
                              className="px-3 py-2 text-left font-medium text-muted-foreground font-mono whitespace-nowrap border-r last:border-r-0"
                            >
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "1",
                          "alice@startup.io",
                          "Alice Chen",
                          "admin",
                          "2024-03-15 09:23",
                        ],
                        [
                          "2",
                          "bob@corp.com",
                          "Bob Martinez",
                          "user",
                          "2024-03-14 14:01",
                        ],
                        [
                          "3",
                          "carol@dev.net",
                          "Carol Williams",
                          "user",
                          "2024-03-13 11:45",
                        ],
                        [
                          "4",
                          "dave@agency.co",
                          "Dave Kim",
                          "admin",
                          "2024-03-12 16:30",
                        ],
                        [
                          "5",
                          "eve@lab.org",
                          "Eve Johnson",
                          "user",
                          "2024-03-11 08:15",
                        ],
                        [
                          "6",
                          "frank@studio.io",
                          "Frank Lee",
                          "user",
                          "2024-03-10 19:22",
                        ],
                        [
                          "7",
                          "grace@eng.dev",
                          "Grace Taylor",
                          "admin",
                          "2024-03-09 12:08",
                        ],
                      ].map(([id, email, name, role, ts]) => (
                        <tr
                          key={id}
                          className="border-b hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-3 py-1.5 font-mono text-muted-foreground border-r whitespace-nowrap">
                            {id}
                          </td>
                          <td className="px-3 py-1.5 text-foreground border-r whitespace-nowrap">
                            {email}
                          </td>
                          <td className="px-3 py-1.5 text-foreground border-r whitespace-nowrap">
                            {name}
                          </td>
                          <td className="px-3 py-1.5 border-r whitespace-nowrap">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                role === "admin"
                                  ? "bg-purple-500/15 text-purple-500"
                                  : "bg-muted/60 text-muted-foreground"
                              }`}
                            >
                              {role}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                            {ts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/20 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    7 rows
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    4 ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Info panel ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 space-y-6 max-w-lg">
              {/* Heading */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Database Studio
                </h1>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  A browser-based SQL client for PostgreSQL. Browse schemas, run
                  queries, and inspect data — no desktop app required.
                </p>
              </div>

              {/* Action cards */}
              <div className="space-y-3">
                {/* Create Database */}
                <div className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Managed Database
                    </span>
                  </div>
                  <h2 className="text-base font-semibold mb-1">
                    Hosted PostgreSQL on Neon
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Create a hosted PostgreSQL database on Neon — ready in
                    seconds. Includes the full studio, AI assistant, and cloud
                    sync.
                  </p>
                  <Link
                    href="/account/managed"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background text-xs font-medium px-4 py-2 hover:bg-foreground/90 transition-colors"
                  >
                    Create Database
                  </Link>
                </div>

                {/* Use a Tunnel */}
                <div className="rounded-xl border bg-card p-5 hover:border-foreground/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Connect Your Own
                    </span>
                  </div>
                  <h2 className="text-base font-semibold mb-1">
                    Use a Tunnel
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    Connect any PostgreSQL database to the studio via a secure
                    tunnel from your local environment. Your data stays on your
                    machine.
                  </p>
                  <Link
                    href="/guides/database-tunnel"
                    className="inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium px-4 py-2 hover:bg-muted/50 transition-colors"
                  >
                    Learn How
                  </Link>
                </div>
              </div>

              {/* ToolInfo sections */}
              <ToolInfo>
                <ToolInfo.H2>What is the Database Studio?</ToolInfo.H2>
                <ToolInfo.P>
                  The Database Studio is a browser-based SQL client for
                  PostgreSQL. It lets you connect to any Postgres database,
                  explore schemas, run queries, and inspect data — without
                  installing a desktop application like pgAdmin, TablePlus, or
                  DBeaver.
                </ToolInfo.P>
                <ToolInfo.P>
                  It works with any PostgreSQL database: a local development
                  instance, a cloud-hosted database on Neon, RDS, Supabase,
                  PlanetScale, or a private staging environment reached via a
                  secure tunnel.
                </ToolInfo.P>

                <ToolInfo.H2>How it works</ToolInfo.H2>
                <ToolInfo.P>
                  There are two connection modes. With a{" "}
                  <ToolInfo.Strong>managed database</ToolInfo.Strong>, you
                  create a Neon PostgreSQL instance directly from your account —
                  credentials are configured automatically and the studio
                  connects immediately. With a{" "}
                  <ToolInfo.Strong>tunnel connection</ToolInfo.Strong>, you run
                  the <ToolInfo.Code>1tt</ToolInfo.Code> CLI on your machine,
                  which opens a WebSocket proxy to the studio. Queries are
                  relayed through the tunnel and executed locally — no data
                  leaves your environment.
                </ToolInfo.P>

                <ToolInfo.H2>How to use this tool</ToolInfo.H2>
                <ToolInfo.UL>
                  <li>
                    <ToolInfo.Strong>Create a managed database</ToolInfo.Strong>{" "}
                    — go to your account, create a Neon database, and open the
                    studio in one click
                  </li>
                  <li>
                    <ToolInfo.Strong>Connect via tunnel</ToolInfo.Strong> —
                    generate a tunnel token, install the{" "}
                    <ToolInfo.Code>1tt</ToolInfo.Code> CLI, and run{" "}
                    <ToolInfo.Code>
                      1tt tunnel --token ... --db postgres://...
                    </ToolInfo.Code>
                  </li>
                  <li>
                    <ToolInfo.Strong>Browse the schema</ToolInfo.Strong> —
                    explore tables, columns, indexes, and foreign keys in the
                    sidebar
                  </li>
                  <li>
                    <ToolInfo.Strong>Run SQL queries</ToolInfo.Strong> — write
                    and execute queries with syntax highlighting and result
                    pagination
                  </li>
                  <li>
                    <ToolInfo.Strong>Inspect and edit rows</ToolInfo.Strong> —
                    view, insert, update, and delete records directly from the
                    table view
                  </li>
                </ToolInfo.UL>

                <ToolInfo.H2>Common use cases</ToolInfo.H2>
                <ToolInfo.UL>
                  <li>
                    Querying a local development database without installing a
                    GUI client
                  </li>
                  <li>
                    Exploring a staging or production database schema while
                    onboarding to a new codebase
                  </li>
                  <li>
                    Running <ToolInfo.Code>SELECT</ToolInfo.Code> queries to
                    debug data issues or verify migrations
                  </li>
                  <li>
                    Browsing a Neon or Supabase database from any device without
                    extra tooling
                  </li>
                  <li>
                    Teaching SQL interactively — spin up a fresh database and
                    explore it in real time
                  </li>
                </ToolInfo.UL>
              </ToolInfo>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
