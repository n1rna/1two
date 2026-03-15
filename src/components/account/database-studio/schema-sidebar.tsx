"use client";

import { useState, useMemo } from "react";
import {
  Table2,
  ChevronRight,
  ChevronDown,
  Terminal,
  Key,
  Link,
  Sparkles,
  Search,
  Database,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TableSchema, ColumnSchema } from "./types";

function formatRowEstimate(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `~${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ColumnRow({ col }: { col: ColumnSchema }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs group">
      <span className="font-mono truncate flex-1 text-foreground/80">
        {col.name}
      </span>
      <span className="text-muted-foreground/60 shrink-0 text-[10px] font-mono uppercase">
        {col.type}
      </span>
      {col.isPrimary && (
        <Key className="h-2.5 w-2.5 shrink-0 text-yellow-500" aria-label="Primary key" />
      )}
      {col.foreignKey && !col.isPrimary && (
        <Link className="h-2.5 w-2.5 shrink-0 text-blue-500" aria-label="Foreign key" />
      )}
      {col.isUnique && !col.isPrimary && (
        <Sparkles className="h-2.5 w-2.5 shrink-0 text-purple-500" aria-label="Unique" />
      )}
    </div>
  );
}

function TableRow({
  table,
  onSelect,
}: {
  table: TableSchema;
  onSelect: (schema: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors group">
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <button
          className="flex-1 text-left truncate text-sm font-medium min-w-0"
          onClick={() => onSelect(table.schema, table.name)}
          title={`Open ${table.schema}.${table.name}`}
        >
          {table.name}
        </button>
        {table.rowEstimate > 0 && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">
            {formatRowEstimate(table.rowEstimate)}
          </span>
        )}
      </div>
      {expanded && (
        <div className="ml-6 mt-0.5 mb-1 space-y-0">
          {table.columns.map((col) => (
            <ColumnRow key={col.name} col={col} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SchemaSidebarProps {
  tables: TableSchema[];
  loading?: boolean;
  onSelectTable: (schema: string, name: string) => void;
  onNewQuery: () => void;
  onRefresh?: () => void;
}

export function SchemaSidebar({
  tables,
  loading,
  onSelectTable,
  onNewQuery,
  onRefresh,
}: SchemaSidebarProps) {
  const [search, setSearch] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  // Collect unique schemas
  const schemas = useMemo(() => {
    const set = new Set(tables.map((t) => t.schema));
    return Array.from(set).sort();
  }, [tables]);

  // Auto-select first schema when schemas load
  const activeSchema = selectedSchema ?? schemas[0] ?? null;

  // Filter by selected schema, then by search
  const filtered = useMemo(() => {
    let result = activeSchema
      ? tables.filter((t) => t.schema === activeSchema)
      : tables;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    return result;
  }, [tables, activeSchema, search]);

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Schema selector */}
      {schemas.length > 0 && (
        <div className="px-2 pt-2 pb-1 border-b">
          <div className="relative">
            <Database className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <select
              value={activeSchema ?? ""}
              onChange={(e) => setSelectedSchema(e.target.value || null)}
              className={cn(
                "w-full bg-transparent border border-border/50 rounded-md pl-7 pr-2 h-7 text-xs",
                "appearance-none cursor-pointer",
                "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50",
                "text-foreground"
              )}
            >
              {schemas.length > 1 && (
                <option value="">All schemas ({tables.length})</option>
              )}
              {schemas.map((s) => {
                const count = tables.filter((t) => t.schema === s).length;
                return (
                  <option key={s} value={s}>
                    {s} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Search + Refresh */}
      <div className="p-2 border-b flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tables…"
            className="pl-7 h-7 text-xs"
          />
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh schema"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {loading && (
          <div className="space-y-1.5 px-1 pt-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-7 rounded-md bg-muted animate-pulse"
              />
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">
            {search ? "No matching tables" : "No tables found"}
          </p>
        )}
        {!loading &&
          filtered.map((t) => (
            <TableRow
              key={`${t.schema}.${t.name}`}
              table={t}
              onSelect={onSelectTable}
            />
          ))}
      </div>

      {/* New SQL Query button */}
      <div className="p-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className={cn("w-full gap-2 text-xs h-8")}
          onClick={onNewQuery}
        >
          <Terminal className="h-3.5 w-3.5" />
          New SQL Query
        </Button>
      </div>
    </div>
  );
}
