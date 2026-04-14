"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserDatabase {
  id: string;
  name: string;
  region: string;
  status: string;
  neonProjectId: string;
  createdAt: string;
}

export interface DatabaseDetail extends UserDatabase {
  connectionUri: string;
}

export function useDatabases() {
  const [data, setData] = useState<UserDatabase[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/databases", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch databases: ${res.status}`);
      }
      const json = (await res.json()) as { databases: UserDatabase[] };
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

export async function createDatabase(
  name: string,
  region: string
): Promise<UserDatabase> {
  const res = await fetch("/api/proxy/databases", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, region }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create database: ${res.status}`);
  }
  return (await res.json()) as UserDatabase;
}

export async function deleteDatabase(id: string): Promise<void> {
  const res = await fetch(`/api/proxy/databases/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete database: ${res.status}`);
  }
}

// ── Explorer types ──────────────────────────────────

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimary: boolean;
  isUnique: boolean;
  foreignKey?: { table: string; column: string };
}

export interface IndexSchema {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  definition: string;
}

export interface TableSchema {
  schema: string;
  name: string;
  type: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  rowEstimate: number;
}

export interface QueryResult {
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  rowsAffected?: number;
  error?: string;
}

// ── Explorer API helpers ────────────────────────────

export async function getDatabaseSchema(id: string): Promise<TableSchema[]> {
  const res = await fetch(`/api/proxy/databases/${id}/schema`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.status}`);
  }
  const json = (await res.json()) as { tables: TableSchema[] };
  return json.tables ?? [];
}

export async function queryDatabase(
  id: string,
  query: string
): Promise<QueryResult> {
  const res = await fetch(`/api/proxy/databases/${id}/query`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`Query failed: ${res.status}`);
  }
  return (await res.json()) as QueryResult;
}
