"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  QueryExecutor,
  TableSchema,
  ColumnSchema,
  IndexSchema,
} from "@/components/account/database-studio/types";

export interface HostedSqliteDB {
  id: string;
  name: string;
  apiKey?: string; // Turso JWT token (only on creation/get)
  tursoHostname?: string;
  tursoDbName?: string;
  fileSize: number; // kept for backward compat; may be 0 for Turso databases
  status: string;
  readOnly: boolean;
  createdAt: string;
  endpoint: string; // now "libsql://hostname"
}

export function useHostedSqliteDbs() {
  const [data, setData] = useState<HostedSqliteDB[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/sqlite", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch databases: ${res.status}`);
      }
      const json = (await res.json()) as { databases: HostedSqliteDB[] };
      setData(json.databases ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

export async function uploadSqliteDb(
  file: File,
  name: string
): Promise<HostedSqliteDB> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);
  const res = await fetch("/api/proxy/sqlite", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json() as Promise<HostedSqliteDB>;
}

export async function getHostedSqliteDb(id: string): Promise<HostedSqliteDB> {
  const res = await fetch(`/api/proxy/sqlite/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch database: ${res.status}`);
  return res.json() as Promise<HostedSqliteDB>;
}

export async function deleteHostedSqliteDb(id: string): Promise<void> {
  const res = await fetch(`/api/proxy/sqlite/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to delete database: ${res.status}`);
}

// ── Turso / libSQL direct connection ───────────────────────────────────────

// Typed cell value as returned by Turso's pipeline HTTP API
type TursoCell =
  | { type: "text"; value: string }
  | { type: "integer"; value: string }
  | { type: "float"; value: string }
  | { type: "blob"; base64: string }
  | { type: "null" };

function decodeTursoCell(cell: TursoCell): string {
  if (cell.type === "null") return "";
  if (cell.type === "blob") return `<blob:${cell.base64}>`;
  return cell.value;
}

/**
 * QueryExecutor that talks directly to Turso's HTTP pipeline API.
 * Translates Turso's typed-value response into the generic QueryResult format.
 */
export function createTursoExecutor(hostname: string, token: string): QueryExecutor {
  return async (sql: string) => {
    let res: Response;
    try {
      res = await fetch(`https://${hostname}/v2/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            { type: "execute", stmt: { sql } },
            { type: "close" },
          ],
        }),
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Network error" };
    }

    if (!res.ok) {
      return { error: `Turso HTTP ${res.status}: ${res.statusText}` };
    }

    let data: {
      results?: Array<{
        type: "ok" | "error";
        response?: {
          type: string;
          result?: {
            cols?: Array<{ name: string; decltype: string | null }>;
            rows?: TursoCell[][];
            affected_row_count?: number;
            last_insert_rowid?: string | null;
          };
        };
        error?: { message?: string };
      }>;
    };

    try {
      data = (await res.json()) as typeof data;
    } catch {
      return { error: "Failed to parse Turso response" };
    }

    const firstResult = data.results?.[0];
    if (!firstResult) {
      return { error: "Empty response from Turso" };
    }
    if (firstResult.type === "error") {
      return { error: firstResult.error?.message ?? "Query failed" };
    }

    const execResult = firstResult.response?.result;
    if (!execResult) {
      return { error: "No result returned" };
    }

    const columns = execResult.cols?.map((c) => c.name) ?? [];
    if (columns.length > 0 && execResult.rows) {
      const rows = execResult.rows.map((row) =>
        row.map((cell) => decodeTursoCell(cell))
      );
      return { columns, rows, rowCount: rows.length };
    }

    return { rowsAffected: execResult.affected_row_count ?? 0 };
  };
}

/**
 * Fetches the full schema from a Turso database by running SQLite introspection
 * queries (sqlite_master, PRAGMA table_info, PRAGMA index_list, PRAGMA index_info).
 */
export async function getTursoSchema(
  hostname: string,
  token: string
): Promise<TableSchema[]> {
  const exec = createTursoExecutor(hostname, token);

  // Get all user tables
  const tablesResult = await exec(
    "SELECT name, sql FROM sqlite_master " +
    "WHERE type='table' " +
    "AND name NOT LIKE 'sqlite_%' " +
    "AND name NOT LIKE '_litestream_%' " +
    "AND name NOT LIKE 'libsql_%' " +
    "ORDER BY name"
  );

  if (tablesResult.error ?? !tablesResult.rows) return [];

  const tables: TableSchema[] = [];

  for (const row of tablesResult.rows) {
    const tableName = row[0];
    if (!tableName) continue;

    // PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
    const colsResult = await exec(`PRAGMA table_info(${JSON.stringify(tableName)})`);
    const columns: ColumnSchema[] = [];
    const pkColumns = new Set<string>();

    if (!colsResult.error && colsResult.rows) {
      for (const c of colsResult.rows) {
        // c: [cid, name, type, notnull, dflt_value, pk]
        const isPk = c[5] !== null && c[5] !== "0";
        if (isPk) pkColumns.add(c[1] ?? "");
        columns.push({
          name: c[1] ?? "",
          type: c[2] ?? "",
          nullable: c[3] === "0",
          default: c[4] ?? null,
          isPrimary: isPk,
          isUnique: isPk, // refined below by indexes
        });
      }
    }

    // PRAGMA index_list: seq, name, unique, origin, partial
    const idxListResult = await exec(`PRAGMA index_list(${JSON.stringify(tableName)})`);
    const indexes: IndexSchema[] = [];

    if (!idxListResult.error && idxListResult.rows) {
      for (const idx of idxListResult.rows) {
        const idxName = idx[1];
        const isUnique = idx[2] === "1";
        if (!idxName) continue;

        // PRAGMA index_info: seqno, cid, name
        const infoResult = await exec(`PRAGMA index_info(${JSON.stringify(idxName)})`);
        const idxCols: string[] = [];
        if (!infoResult.error && infoResult.rows) {
          for (const ic of infoResult.rows) {
            if (ic[2]) idxCols.push(ic[2]);
          }
        }

        // Mark columns as unique if covered by a unique single-col index
        if (isUnique && idxCols.length === 1) {
          const col = columns.find((c) => c.name === idxCols[0]);
          if (col) col.isUnique = true;
        }

        indexes.push({
          name: idxName,
          columns: idxCols,
          isUnique,
          isPrimary: idxName.startsWith("sqlite_autoindex_"),
          definition: `CREATE ${isUnique ? "UNIQUE " : ""}INDEX ${idxName} ON ${tableName} (${idxCols.join(", ")})`,
        });
      }
    }

    tables.push({
      schema: "main",
      name: tableName,
      type: "table",
      columns,
      indexes,
      rowEstimate: 0,
    });
  }

  return tables;
}
