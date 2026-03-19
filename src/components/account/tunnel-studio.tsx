"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Database, Wifi, WifiOff, Loader2 } from "lucide-react";
import { AuthGate } from "@/components/layout/auth-gate";
import { StudioShell } from "@/components/account/database-studio/studio-shell";
import { useBillingStatus } from "@/lib/billing";
import { queryTunnel, getTunnelSchema } from "@/lib/tunnel";
import type { TableSchema } from "@/components/account/database-studio/types";

function TunnelStudioInner({ token }: { token: string }) {
  const [schema, setSchema] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [dialect, setDialect] = useState<"postgres" | "redis">("postgres");
  const [error, setError] = useState<string | null>(null);

  const { data: billing } = useBillingStatus();
  const aiEnabled = billing != null && billing.plan !== "free";

  // Load schema (also checks if tunnel is connected)
  // Track whether this is the initial load (show full-page spinner) vs a refresh (keep StudioShell mounted)
  const [initialLoad, setInitialLoad] = useState(true);

  const loadSchema = useCallback(async () => {
    setSchemaLoading(true);
    setError(null);
    try {
      // First try the CLI schema endpoint
      let tables: TableSchema[] = [];
      try {
        const result = await getTunnelSchema(token);
        if (result.tables && result.tables.length > 0) {
          tables = result.tables.map((t) => ({
            schema: t.schema ?? "public",
            name: t.name,
            type: "table",
            columns: (t.columns ?? []).map((c) => ({
              name: c.name,
              type: c.type,
              nullable: c.nullable ?? true,
              default: c.default_value ?? null,
              isPrimary: c.is_primary ?? false,
              isUnique: false,
              foreignKey: undefined,
            })),
            indexes: [],
            rowEstimate: 0,
          })) as unknown as TableSchema[];
        }
      } catch {
        // CLI schema endpoint failed — fall through to SQL introspection
      }

      // Fallback: introspect via SQL queries through the tunnel
      if (tables.length === 0) {
        try {
          const tablesResult = await queryTunnel(token, {
            sql: `SELECT table_schema, table_name
                  FROM information_schema.tables
                  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                    AND table_type = 'BASE TABLE'
                  ORDER BY table_schema, table_name`,
          });

          const tableRows = (tablesResult.rows ?? []) as string[][];
          if (tableRows.length > 0) {
            const colsResult = await queryTunnel(token, {
              sql: `SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
                           c.is_nullable, c.column_default,
                           CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_primary
                    FROM information_schema.columns c
                    LEFT JOIN information_schema.key_column_usage kcu
                      ON c.table_schema = kcu.table_schema
                     AND c.table_name = kcu.table_name
                     AND c.column_name = kcu.column_name
                    LEFT JOIN information_schema.table_constraints tc
                      ON kcu.constraint_schema = tc.constraint_schema
                     AND kcu.constraint_name = tc.constraint_name
                     AND tc.constraint_type = 'PRIMARY KEY'
                    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
            });

            const colRows = (colsResult.rows ?? []) as string[][];

            // Group columns by table
            const tableMap = new Map<string, TableSchema>();
            for (const row of tableRows) {
              const key = `${row[0]}.${row[1]}`;
              tableMap.set(key, {
                schema: row[0],
                name: row[1],
                type: "table",
                columns: [],
                indexes: [],
                rowEstimate: 0,
              });
            }

            for (const row of colRows) {
              const key = `${row[0]}.${row[1]}`;
              const table = tableMap.get(key);
              if (table) {
                table.columns.push({
                  name: row[2],
                  type: row[3],
                  nullable: row[4] === "YES",
                  default: row[5] ?? null,
                  isPrimary: row[6] === "true" || row[6] === "t",
                  isUnique: false,
                });
              }
            }

            tables = Array.from(tableMap.values());
          }
        } catch {
          // SQL introspection also failed
        }
      }

      setSchema(tables);
      setConnected(true);
    } catch (err) {
      if (initialLoad) {
        setError(err instanceof Error ? err.message : "Failed to load schema");
      }
      setConnected(false);
    } finally {
      setSchemaLoading(false);
      setInitialLoad(false);
    }
  }, [token, initialLoad]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const queryExecutor = useCallback(
    async (sql: string) => {
      const result = await queryTunnel(token, { sql });
      return {
        columns: result.columns ?? [],
        rows: (result.rows ?? []) as string[][],
        rowCount: result.rows_affected ?? result.rows?.length ?? 0,
      };
    },
    [token]
  );

  const sidebarHeader = (
    <div className="px-3 py-2.5 border-b space-y-1.5">
      <Link
        href="/account/databases"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3 w-3" />
        All databases
      </Link>
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold truncate flex-1 min-w-0">
          External Database
        </span>
        {connected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 truncate font-mono">
        tunnel:{token.slice(0, 12)}…
      </p>
    </div>
  );

  if (initialLoad && !schemaLoading && error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">Tunnel not connected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Make sure the CLI is running with this tunnel token. The tunnel may have expired or the CLI disconnected.
          </p>
        </div>
        <p className="text-xs text-destructive">{error}</p>
        <Link
          href="/account/databases"
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Back to databases
        </Link>
      </div>
    );
  }

  if (initialLoad && schemaLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting to tunnel…
      </div>
    );
  }

  return (
    <StudioShell
      queryExecutor={queryExecutor}
      dialect={dialect}
      schema={schema}
      schemaLoading={schemaLoading}
      sidebarHeader={sidebarHeader}
      aiEnabled={aiEnabled}
      onRefreshSchema={loadSchema}
      className="flex-1 min-h-0"
    />
  );
}

export function TunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <TunnelStudioInner token={token} />
    </AuthGate>
  );
}
