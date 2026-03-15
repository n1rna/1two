"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnResizeMode,
  flexRender,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2, AlertTriangle, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Debounce helper for filter inputs
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
import { DataGridCell } from "./data-grid-cell";
import { DataGridToolbar } from "./data-grid-toolbar";
import { EditableCell } from "./editable-cell";
import { TableStructure } from "./table-structure";
import {
  buildUpdateSQL,
  buildInsertSQL,
  buildDeleteSQL,
  buildTransaction,
  quoteTableRef,
} from "./sql-builder";
import type { TableSchema, CellValue, PendingEdit, QueryExecutor, SqlDialect } from "./types";

// Key for a pending edit: "rowIndex:columnName"
function editKey(rowIndex: number, column: string) {
  return `${rowIndex}:${column}`;
}

interface DataGridProps {
  queryExecutor: QueryExecutor;
  dialect?: SqlDialect;
  tableSchema: TableSchema;
  view: "data" | "structure";
  onViewChange: (v: "data" | "structure") => void;
}

const PAGE_SIZES = [25, 50, 100];

export function DataGrid({
  queryExecutor,
  dialect = "postgres",
  tableSchema,
  view,
  onViewChange,
}: DataGridProps) {
  const [rows, setRows] = useState<Record<string, CellValue>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Editing state
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(
    new Map()
  );
  const [newRows, setNewRows] = useState<Record<string, CellValue>[]>([]);
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    column: string;
  } | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const debouncedFilters = useDebounce(columnFilters, 400);

  const primaryKeys = useMemo(
    () => tableSchema.columns.filter((c) => c.isPrimary).map((c) => c.name),
    [tableSchema]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = page * pageSize;

      // Build WHERE clause from column filters
      const activeFilters = Object.entries(debouncedFilters).filter(
        ([, v]) => v.trim() !== ""
      );
      let whereClause = "";
      if (activeFilters.length > 0) {
        const conditions = activeFilters.map(([colName, value]) => {
          const col = tableSchema.columns.find((c) => c.name === colName);
          const colType = col?.type.toLowerCase() ?? "";
          // For numeric types use prefix match, for text use case-insensitive contains
          const isNumeric =
            colType.includes("int") ||
            colType.includes("numeric") ||
            colType.includes("decimal") ||
            colType.includes("float") ||
            colType.includes("double") ||
            colType === "real" ||
            colType === "serial" ||
            colType === "bigserial" ||
            colType === "smallserial";
          const escaped = value.replace(/'/g, "''");
          if (dialect === "sqlite") {
            // SQLite: no ::text cast, use LIKE (case-insensitive for ASCII by default)
            if (isNumeric) {
              return `"${colName}" LIKE '${escaped}%'`;
            }
            return `"${colName}" LIKE '%${escaped}%'`;
          }
          // Postgres: cast to text + ILIKE
          if (isNumeric) {
            return `"${colName}"::text ILIKE '${escaped}%'`;
          }
          return `"${colName}"::text ILIKE '%${escaped}%'`;
        });
        whereClause = `WHERE ${conditions.join(" AND ")}`;
      }

      const orderClause =
        sorting.length > 0
          ? `ORDER BY "${sorting[0].id}" ${sorting[0].desc ? "DESC" : "ASC"}`
          : primaryKeys.length > 0
          ? `ORDER BY "${primaryKeys[0]}"`
          : "";
      const tableRef = quoteTableRef(tableSchema.schema, tableSchema.name, dialect);
      const sql = `SELECT * FROM ${tableRef} ${whereClause} ${orderClause} LIMIT ${pageSize} OFFSET ${offset};`;
      const result = await queryExecutor(sql);
      if (result.error) throw new Error(result.error);
      const cols = result.columns ?? [];
      const rawRows = result.rows ?? [];
      const mapped = rawRows.map((r) =>
        Object.fromEntries(cols.map((c, i) => [c, r[i] as CellValue]))
      );
      setRows(mapped);
      setTotalRows(result.rowCount ?? rawRows.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [queryExecutor, dialect, tableSchema, page, pageSize, sorting, primaryKeys, debouncedFilters]);

  useEffect(() => {
    if (view === "data") fetchData();
  }, [fetchData, view]);

  // Reset pagination when table changes
  useEffect(() => {
    setPage(0);
    setPendingEdits(new Map());
    setNewRows([]);
    setDeletedIndices(new Set());
    setRowSelection({});
    setColumnFilters({});
  }, [tableSchema.schema, tableSchema.name]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedFilters]);

  const handleCellEdit = useCallback(
    (rowIndex: number, column: string, newValue: CellValue) => {
      const originalValue = rows[rowIndex]?.[column] ?? null;
      const key = editKey(rowIndex, column);
      setPendingEdits((prev) => {
        const next = new Map(prev);
        if (newValue === originalValue) {
          next.delete(key);
        } else {
          next.set(key, { rowIndex, column, originalValue, newValue });
        }
        return next;
      });
      setEditingCell(null);
    },
    [rows]
  );

  const handleAddRow = useCallback(() => {
    const empty: Record<string, CellValue> = {};
    tableSchema.columns.forEach((c) => {
      empty[c.name] = null;
    });
    setNewRows((prev) => [...prev, empty]);
  }, [tableSchema]);

  const handleDeleteSelected = useCallback(() => {
    const indices = Object.keys(rowSelection)
      .filter((k) => rowSelection[k])
      .map(Number);
    setDeletedIndices((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.add(i));
      return next;
    });
    setRowSelection({});
  }, [rowSelection]);

  const hasChanges =
    pendingEdits.size > 0 || newRows.length > 0 || deletedIndices.size > 0;
  const changeCount =
    pendingEdits.size + newRows.length + deletedIndices.size;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const statements: string[] = [];

      // Updates
      for (const edit of pendingEdits.values()) {
        const rowData = rows[edit.rowIndex];
        if (!rowData) continue;
        statements.push(
          buildUpdateSQL(
            tableSchema.schema,
            tableSchema.name,
            primaryKeys,
            edit,
            rowData,
            dialect
          )
        );
      }

      // Inserts
      for (const row of newRows) {
        statements.push(
          buildInsertSQL(
            tableSchema.schema,
            tableSchema.name,
            tableSchema.columns.map((c) => c.name),
            row,
            dialect
          )
        );
      }

      // Deletes
      if (deletedIndices.size > 0) {
        const deletedRows = Array.from(deletedIndices).map((i) => rows[i]).filter(Boolean);
        if (deletedRows.length > 0 && primaryKeys.length > 0) {
          statements.push(
            buildDeleteSQL(
              tableSchema.schema,
              tableSchema.name,
              primaryKeys,
              deletedRows as Record<string, CellValue>[],
              dialect
            )
          );
        }
      }

      if (statements.length > 0) {
        const sql = buildTransaction(statements);
        const result = await queryExecutor(sql);
        if (result.error) throw new Error(result.error);
      }

      setPendingEdits(new Map());
      setNewRows([]);
      setDeletedIndices(new Set());
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    pendingEdits,
    newRows,
    deletedIndices,
    rows,
    tableSchema,
    primaryKeys,
    dialect,
    queryExecutor,
    fetchData,
  ]);

  const handleDiscard = useCallback(() => {
    setPendingEdits(new Map());
    setNewRows([]);
    setDeletedIndices(new Set());
    setRowSelection({});
  }, []);

  // Build TanStack Table columns
  const columns = useMemo<ColumnDef<Record<string, CellValue>>[]>(() => {
    const checkboxCol: ColumnDef<Record<string, CellValue>> = {
      id: "__select",
      size: 36,
      enableResizing: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-3.5 w-3.5 accent-primary"
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center h-full">
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 accent-primary"
            aria-label="Select row"
          />
        </div>
      ),
    };

    const dataCols: ColumnDef<Record<string, CellValue>>[] =
      tableSchema.columns.map((col) => ({
        id: col.name,
        accessorKey: col.name,
        size: 160,
        minSize: 60,
        maxSize: 600,
        header: () => (
          <div className="flex items-center gap-1 select-none">
            <span className="truncate">{col.name}</span>
            <span className="text-[10px] text-muted-foreground/50 uppercase font-normal shrink-0">
              {col.type}
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const rowIndex = row.index;
          const key = editKey(rowIndex, col.name);
          const edit = pendingEdits.get(key);
          const isEditing =
            editingCell?.rowIndex === rowIndex &&
            editingCell?.column === col.name;
          const isDeleted = deletedIndices.has(rowIndex);
          const displayValue =
            edit !== undefined ? edit.newValue : row.getValue<CellValue>(col.name);

          if (isEditing) {
            return (
              <div className="relative z-20">
                <EditableCell
                  value={displayValue}
                  columnType={col.type}
                  onConfirm={(v) => handleCellEdit(rowIndex, col.name, v)}
                  onCancel={() => setEditingCell(null)}
                />
              </div>
            );
          }

          return (
            <DataGridCell
              value={displayValue}
              type={col.type}
              isModified={edit !== undefined}
              isDeleted={isDeleted}
              onDoubleClick={() =>
                !isDeleted && setEditingCell({ rowIndex, column: col.name })
              }
            />
          );
        },
      }));

    return [checkboxCol, ...dataCols];
  }, [tableSchema.columns, pendingEdits, editingCell, deletedIndices, handleCellEdit]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
    manualSorting: true,
    manualPagination: true,
  });

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const showingFrom = page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalRows);

  if (view === "structure") {
    return (
      <div className="flex flex-col h-full">
        <ViewToggle view={view} onViewChange={onViewChange} />
        <div className="flex-1 overflow-auto">
          <TableStructure tableSchema={tableSchema} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewToggle view={view} onViewChange={onViewChange} />
      <DataGridToolbar
        hasChanges={hasChanges}
        changeCount={changeCount}
        selectedCount={selectedCount}
        saving={saving}
        onAddRow={handleAddRow}
        onDeleteSelected={handleDeleteSelected}
        onSave={handleSave}
        onDiscard={handleDiscard}
      >
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-6 px-2 text-xs gap-1",
            showFilters && "bg-primary/10 text-primary",
            Object.values(columnFilters).some((v) => v.trim() !== "") &&
              !showFilters &&
              "text-primary"
          )}
          onClick={() => {
            setShowFilters((v) => !v);
            if (showFilters) setColumnFilters({});
          }}
        >
          <Filter className="h-3 w-3" />
          Filter
          {Object.values(columnFilters).filter((v) => v.trim() !== "").length >
            0 && (
            <span className="ml-0.5 bg-primary/20 text-primary text-[10px] px-1 rounded-full tabular-nums">
              {Object.values(columnFilters).filter((v) => v.trim() !== "").length}
            </span>
          )}
        </Button>
      </DataGridToolbar>

      {error && (
        <div className="px-3 py-2 text-xs text-destructive flex items-center gap-2 bg-destructive/5 border-b border-destructive/20">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-30">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <table
          className="w-full border-collapse text-xs font-mono"
          style={{ tableLayout: "fixed", minWidth: table.getTotalSize() }}
        >
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/40">
                {hg.headers.map((header) => {
                  const col = tableSchema.columns.find(
                    (c) => c.name === header.id
                  );
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={cn(
                        "px-2 py-2 text-left text-xs font-medium text-foreground/80",
                        "border-r border-border/30 relative select-none whitespace-nowrap overflow-hidden",
                        canSort && "cursor-pointer hover:bg-muted/60"
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {col?.isPrimary && (
                          <span className="shrink-0 h-2 w-2 rounded-full bg-yellow-400" />
                        )}
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {canSort && (
                          <span className="ml-auto shrink-0">
                            {sorted === "asc" ? (
                              <ChevronUp className="h-3 w-3 text-primary" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="h-3 w-3 text-primary" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />
                            )}
                          </span>
                        )}
                      </div>
                      {/* Resize handle */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
                            header.column.getIsResizing() && "bg-primary"
                          )}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
            {/* Inline filter row */}
            {showFilters && (
              <tr className="border-b bg-muted/20">
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const isSelectCol = header.id === "__select";
                  const colName = header.id;
                  return (
                    <th
                      key={`filter-${header.id}`}
                      style={{ width: header.getSize() }}
                      className="px-1 py-1 border-r border-border/30"
                    >
                      {isSelectCol ? null : (
                        <input
                          type="text"
                          value={columnFilters[colName] ?? ""}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({
                              ...prev,
                              [colName]: e.target.value,
                            }))
                          }
                          placeholder="Filter..."
                          className={cn(
                            "w-full bg-transparent border border-border/40 rounded px-1.5 py-0.5",
                            "text-xs font-mono font-normal placeholder:text-muted-foreground/40",
                            "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50",
                            columnFilters[colName]?.trim() && "border-primary/40 bg-primary/5"
                          )}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isDeleted = deletedIndices.has(row.index);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                    row.index % 2 === 1 && "bg-muted/10",
                    row.getIsSelected() && "bg-primary/5",
                    isDeleted && "opacity-40"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="border-r border-border/20 overflow-hidden p-0 h-8"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* New rows */}
            {newRows.map((newRow, ni) => (
              <tr
                key={`new-${ni}`}
                className="border-b border-border/30 bg-green-500/5"
              >
                {/* Checkbox placeholder */}
                <td className="border-r border-border/20 w-9 h-8 p-0">
                  <div className="flex items-center justify-center h-full">
                    <span className="text-[10px] text-green-600 font-medium">
                      +
                    </span>
                  </div>
                </td>
                {tableSchema.columns.map((col) => (
                  <td
                    key={col.name}
                    className="border-r border-border/20 overflow-hidden p-0 h-8"
                    style={{ width: 160 }}
                  >
                    <DataGridCell
                      value={newRow[col.name] ?? null}
                      type={col.type}
                      onDoubleClick={() => {
                        // inline edit new row
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No rows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-4 px-3 py-2 border-t bg-muted/10 text-xs text-muted-foreground shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={fetchData}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </Button>
        <span>
          {totalRows > 0
            ? `Showing ${showingFrom}–${showingTo} of ~${totalRows.toLocaleString()}`
            : "0 rows"}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="bg-transparent border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// View toggle tabs (Data / Structure)
function ViewToggle({
  view,
  onViewChange,
}: {
  view: "data" | "structure";
  onViewChange: (v: "data" | "structure") => void;
}) {
  return (
    <div className="flex border-b bg-muted/10 shrink-0">
      {(["data", "structure"] as const).map((v) => (
        <button
          key={v}
          className={cn(
            "px-4 py-2 text-xs font-medium transition-colors",
            view === v
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onViewChange(v)}
        >
          {v === "data" ? "Data" : "Structure"}
        </button>
      ))}
    </div>
  );
}
