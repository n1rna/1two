"use client";

import { Key, Check, X, Link, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableSchema } from "./types";

interface TableStructureProps {
  tableSchema: TableSchema;
}

export function TableStructure({ tableSchema }: TableStructureProps) {
  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* Columns */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Columns</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  Type
                </th>
                <th className="px-3 py-2 text-center font-medium text-foreground">
                  Nullable
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  Default
                </th>
                <th className="px-3 py-2 text-center font-medium text-foreground">
                  PK
                </th>
                <th className="px-3 py-2 text-center font-medium text-foreground">
                  Unique
                </th>
                <th className="px-3 py-2 text-left font-medium text-foreground">
                  References
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tableSchema.columns.map((col) => (
                <tr
                  key={col.name}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {col.name}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground uppercase text-[10px]">
                    {col.type}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {col.nullable ? (
                      <Check className="h-3 w-3 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-3 w-3 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {col.default ?? (
                      <span className="italic text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {col.isPrimary && (
                      <Key className="h-3 w-3 text-yellow-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {col.isUnique && !col.isPrimary && (
                      <Sparkles className="h-3 w-3 text-purple-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {col.foreignKey ? (
                      <span className="flex items-center gap-1">
                        <Link className="h-3 w-3 text-blue-500 shrink-0" />
                        {col.foreignKey.table}.{col.foreignKey.column}
                      </span>
                    ) : (
                      <span className="italic text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Indexes */}
      {tableSchema.indexes && tableSchema.indexes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Indexes</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    Columns
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-foreground">
                    Unique
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-foreground">
                    PK
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-foreground">
                    Definition
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableSchema.indexes.map((idx) => (
                  <tr
                    key={idx.name}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {idx.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {idx.columns.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {idx.isUnique ? (
                        <Check className="h-3 w-3 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {idx.isPrimary ? (
                        <Key className="h-3 w-3 text-yellow-500 mx-auto" />
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-muted-foreground/70 max-w-xs truncate",
                        "text-[10px]"
                      )}
                      title={idx.definition}
                    >
                      {idx.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
