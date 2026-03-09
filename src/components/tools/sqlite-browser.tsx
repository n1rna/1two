"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Database,
  Table,
  Play,
  Upload,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Columns,
  Code,
  Loader2,
  Search,
  FileDown,
} from "lucide-react";
import type { Database as SqlJsDatabase } from "sql.js";

// ─── Types ─────────────────────────────────────────────────────────

interface TableInfo {
  name: string;
  rowCount: number;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: string | null;
  pk: boolean;
}

interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string[];
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  time: number;
  error?: string;
}

type SortDir = "asc" | "desc" | null;

// ─── Constants ─────────────────────────────────────────────────────

const PAGE_SIZE = 100;

// ─── CodeMirror SQL Editor ─────────────────────────────────────────

function SqlEditor({
  value,
  onChange,
  onRun,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<import("@codemirror/view").EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    let destroyed = false;

    (async () => {
      const { EditorView, keymap, placeholder } = await import("@codemirror/view");
      const { EditorState } = await import("@codemirror/state");
      const { sql, SQLite } = await import("@codemirror/lang-sql");
      const { defaultKeymap, history, historyKeymap } = await import("@codemirror/commands");
      const { oneDark } = await import("@codemirror/theme-one-dark");
      const { autocompletion, completionKeymap } = await import("@codemirror/autocomplete");
      const { syntaxHighlighting, defaultHighlightStyle } = await import("@codemirror/language");

      if (destroyed || !editorRef.current) return;

      const runKeymap = keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onRun();
            return true;
          },
        },
      ]);

      const theme = EditorView.theme({
        "&": {
          fontSize: "13px",
          height: "100%",
        },
        ".cm-content": {
          fontFamily: "var(--font-geist-mono), monospace",
          padding: "8px 0",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--border)",
        },
        ".cm-activeLine": {
          backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
        },
        ".cm-selectionBackground": {
          backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent) !important",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--foreground)",
        },
        "&.cm-focused": {
          outline: "none",
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          runKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
          history(),
          sql({ dialect: SQLite }),
          autocompletion(),
          syntaxHighlighting(defaultHighlightStyle),
          oneDark,
          theme,
          placeholder("Write SQL here... (Ctrl+Enter to run)"),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;
    })();

    return () => {
      destroyed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={editorRef} className="h-full overflow-hidden" />;
}

// ─── Main Component ────────────────────────────────────────────────

export function SqliteBrowser() {
  const [db, setDb] = useState<SqlJsDatabase | null>(null);
  const [fileName, setFileName] = useState("");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [colNames, setColNames] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  // Query editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [sql, setSql] = useState("SELECT * FROM ");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [editorHeight, setEditorHeight] = useState(200);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef(false);
  const editorResizingRef = useRef(false);

  // ─── Load database ──────────────────────────────────────────────

  const loadDatabase = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setLoading(true);
    try {
      const initSqlJs = (await import("sql.js")).default;
      const SQL = await initSqlJs({
        locateFile: (file: string) =>
          `https://sql.js.org/dist/${file}`,
      });
      const newDb = new SQL.Database(new Uint8Array(buffer));
      setDb((prev) => {
        prev?.close();
        return newDb;
      });
      setFileName(name);

      // Get tables
      const result = newDb.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      const tableNames = (result[0]?.values ?? []).map((r) => String(r[0]));
      const tableInfos: TableInfo[] = tableNames.map((t) => {
        const countResult = newDb.exec(`SELECT COUNT(*) FROM "${t}"`);
        return {
          name: t,
          rowCount: Number(countResult[0]?.values[0]?.[0] ?? 0),
        };
      });
      setTables(tableInfos);

      // Reset state
      setSelectedTable(null);
      setColumns([]);
      setIndexes([]);
      setRows([]);
      setColNames([]);
      setPage(0);
      setSortCol(null);
      setSortDir(null);
      setFilters({});
      setQueryResult(null);
      setQueryError(null);

      // Auto-select first table
      if (tableNames.length > 0) {
        selectTable(newDb, tableNames[0]);
      }
    } catch (e) {
      setQueryError(`Failed to open database: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Select table ───────────────────────────────────────────────

  const selectTable = useCallback(
    (database: SqlJsDatabase, tableName: string) => {
      setSelectedTable(tableName);
      setPage(0);
      setSortCol(null);
      setSortDir(null);
      setFilters({});
      setShowFilters(false);

      // Get schema
      try {
        const pragmaResult = database.exec(`PRAGMA table_info("${tableName}")`);
        const cols: ColumnInfo[] = (pragmaResult[0]?.values ?? []).map((r) => ({
          cid: Number(r[0]),
          name: String(r[1]),
          type: String(r[2]) || "ANY",
          notnull: Boolean(r[3]),
          dflt_value: r[4] != null ? String(r[4]) : null,
          pk: Boolean(r[5]),
        }));
        setColumns(cols);

        // Get indexes
        const idxResult = database.exec(`PRAGMA index_list("${tableName}")`);
        const idxs: IndexInfo[] = (idxResult[0]?.values ?? []).map((r) => {
          const idxName = String(r[1]);
          const idxInfoResult = database.exec(`PRAGMA index_info("${idxName}")`);
          return {
            name: idxName,
            unique: Boolean(r[2]),
            columns: (idxInfoResult[0]?.values ?? []).map((c) => String(c[2])),
          };
        });
        setIndexes(idxs);

        // Get data
        fetchData(database, tableName, 0, null, null, {});
      } catch (e) {
        setQueryError(`Error loading table: ${e instanceof Error ? e.message : e}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ─── Fetch table data ──────────────────────────────────────────

  const fetchData = useCallback(
    (
      database: SqlJsDatabase,
      tableName: string,
      pageNum: number,
      sortColumn: string | null,
      sortDirection: SortDir,
      filterMap: Record<string, string>
    ) => {
      try {
        // Build WHERE
        const whereClauses: string[] = [];
        for (const [col, val] of Object.entries(filterMap)) {
          if (val.trim()) {
            whereClauses.push(`"${col}" LIKE '%${val.replace(/'/g, "''")}%'`);
          }
        }
        const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

        // Total count
        const countResult = database.exec(
          `SELECT COUNT(*) FROM "${tableName}"${whereStr}`
        );
        const total = Number(countResult[0]?.values[0]?.[0] ?? 0);
        setTotalRows(total);

        // Build ORDER BY
        const orderStr = sortColumn && sortDirection
          ? ` ORDER BY "${sortColumn}" ${sortDirection.toUpperCase()}`
          : "";

        const dataResult = database.exec(
          `SELECT * FROM "${tableName}"${whereStr}${orderStr} LIMIT ${PAGE_SIZE} OFFSET ${pageNum * PAGE_SIZE}`
        );

        setColNames(dataResult[0]?.columns ?? []);
        setRows(dataResult[0]?.values ?? []);
      } catch (e) {
        setQueryError(`Query error: ${e instanceof Error ? e.message : e}`);
      }
    },
    []
  );

  // ─── Handlers ───────────────────────────────────────────────────

  const handleFileInput = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      await loadDatabase(buffer, file.name);
    },
    [loadDatabase]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileInput(file);
    },
    [handleFileInput]
  );

  const handleTableClick = useCallback(
    (tableName: string) => {
      if (db) selectTable(db, tableName);
    },
    [db, selectTable]
  );

  const handleSort = useCallback(
    (col: string) => {
      if (!db || !selectedTable) return;
      let newDir: SortDir;
      if (sortCol === col) {
        newDir = sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc";
      } else {
        newDir = "asc";
      }
      const newCol = newDir ? col : null;
      setSortCol(newCol);
      setSortDir(newDir);
      setPage(0);
      fetchData(db, selectedTable, 0, newCol, newDir, filters);
    },
    [db, selectedTable, sortCol, sortDir, filters, fetchData]
  );

  const handleFilterChange = useCallback(
    (col: string, value: string) => {
      const newFilters = { ...filters, [col]: value };
      setFilters(newFilters);
      setPage(0);
      if (db && selectedTable) {
        fetchData(db, selectedTable, 0, sortCol, sortDir, newFilters);
      }
    },
    [db, selectedTable, sortCol, sortDir, filters, fetchData]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      if (db && selectedTable) {
        fetchData(db, selectedTable, newPage, sortCol, sortDir, filters);
      }
    },
    [db, selectedTable, sortCol, sortDir, filters, fetchData]
  );

  const runQuery = useCallback(() => {
    if (!db || !sql.trim()) return;
    setQueryError(null);
    const start = performance.now();
    try {
      const results = db.exec(sql);
      const elapsed = performance.now() - start;
      if (results.length > 0) {
        const r = results[0];
        setQueryResult({
          columns: r.columns,
          rows: r.values,
          rowCount: r.values.length,
          time: elapsed,
        });
      } else {
        setQueryResult({
          columns: [],
          rows: [],
          rowCount: 0,
          time: elapsed,
        });
      }
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : String(e));
      setQueryResult(null);
    }
  }, [db, sql]);

  const exportCsv = useCallback(() => {
    const data = queryResult ?? { columns: colNames, rows };
    if (!data.columns.length) return;

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [
      data.columns.map(escape).join(","),
      ...data.rows.map((r) => r.map(escape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable ?? "query"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [queryResult, colNames, rows, selectedTable]);

  const copyCell = useCallback(async (value: unknown) => {
    await navigator.clipboard.writeText(value == null ? "" : String(value));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, []);

  // ─── Sidebar resize ────────────────────────────────────────────

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const w = Math.max(160, Math.min(400, startWidth + ev.clientX - startX));
      setSidebarWidth(w);
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarWidth]);

  // ─── Editor resize ─────────────────────────────────────────────

  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    editorResizingRef.current = true;
    const startY = e.clientY;
    const startH = editorHeight;

    const onMove = (ev: MouseEvent) => {
      if (!editorResizingRef.current) return;
      const h = Math.max(100, Math.min(500, startH - (ev.clientY - startY)));
      setEditorHeight(h);
    };
    const onUp = () => {
      editorResizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHeight]);

  // ─── Pagination ─────────────────────────────────────────────────

  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  const activeFilters = useMemo(
    () => Object.values(filters).filter((v) => v.trim()).length,
    [filters]
  );

  // ─── No database loaded ─────────────────────────────────────────

  if (!db) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-6 px-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            ) : (
              <Database className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">Open a SQLite Database</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drop a <code className="px-1 py-0.5 rounded bg-muted text-xs">.sqlite</code> or{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-xs">.db</code> file here, or click
              to browse.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Upload className="h-4 w-4" />
            Choose file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sqlite,.db,.sqlite3,.db3"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileInput(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }

  // ─── Database loaded ────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0 text-sm">
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium truncate max-w-48">{fileName}</span>
        <span className="text-muted-foreground">
          {tables.length} table{tables.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setEditorOpen(!editorOpen)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              editorOpen
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            <Code className="h-3 w-3" />
            SQL
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="Export as CSV"
          >
            <FileDown className="h-3 w-3" />
            CSV
          </button>
          <button
            onClick={() => {
              db.close();
              setDb(null);
              setFileName("");
              setTables([]);
            }}
            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent text-muted-foreground transition-colors"
            title="Close database"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sqlite,.db,.sqlite3,.db3"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileInput(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div
          className="flex flex-col border-r shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Tables list */}
          <div className="flex-1 overflow-auto">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tables
            </div>
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleTableClick(t.name)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedTable === t.name
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                }`}
              >
                <Table className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{t.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {t.rowCount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          {/* Schema panel */}
          {selectedTable && columns.length > 0 && (
            <div className="border-t shrink-0">
              <button
                onClick={() => setSchemaOpen(!schemaOpen)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {schemaOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <Columns className="h-3 w-3" />
                Schema
              </button>
              {schemaOpen && (
                <div className="overflow-auto max-h-48 px-1 pb-1.5">
                  {columns.map((col) => (
                    <div
                      key={col.cid}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-xs"
                    >
                      <span
                        className={`truncate flex-1 ${col.pk ? "font-semibold" : ""}`}
                      >
                        {col.pk ? "\u{1F511}" : ""} {col.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {col.type}
                      </span>
                    </div>
                  ))}
                  {indexes.length > 0 && (
                    <div className="mt-1.5 border-t pt-1.5">
                      <div className="px-1.5 text-[10px] font-semibold text-muted-foreground mb-0.5">
                        Indexes
                      </div>
                      {indexes.map((idx) => (
                        <div
                          key={idx.name}
                          className="px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {idx.unique ? "UNIQUE " : ""}
                          {idx.name} ({idx.columns.join(", ")})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar resize handle */}
        <div
          className="w-px bg-border hover:bg-primary/50 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleSidebarResize}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Data grid */}
          <div className="flex-1 overflow-auto min-h-0">
            {selectedTable && colNames.length > 0 ? (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur-sm">
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-muted-foreground border-b border-r w-10 tabular-nums">
                      #
                    </th>
                    {colNames.map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1.5 text-left text-xs font-semibold border-b border-r cursor-pointer hover:bg-accent/50 transition-colors select-none whitespace-nowrap"
                        onClick={() => handleSort(col)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col}
                          {sortCol === col && sortDir === "asc" && (
                            <ArrowUp className="h-3 w-3 text-primary" />
                          )}
                          {sortCol === col && sortDir === "desc" && (
                            <ArrowDown className="h-3 w-3 text-primary" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                  {showFilters && (
                    <tr className="bg-muted/50">
                      <td className="px-2 py-1 border-b border-r" />
                      {colNames.map((col) => (
                        <td key={col} className="px-1 py-1 border-b border-r">
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={filters[col] ?? ""}
                            onChange={(e) => handleFilterChange(col, e.target.value)}
                            className="w-full bg-background border border-input rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </td>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-2 py-1 text-[10px] text-muted-foreground border-b border-r tabular-nums">
                        {page * PAGE_SIZE + i + 1}
                      </td>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-2 py-1 border-b border-r max-w-64 truncate font-mono text-xs cursor-pointer hover:bg-accent/50"
                          onClick={() => copyCell(cell)}
                          title={cell == null ? "NULL" : String(cell)}
                        >
                          {cell == null ? (
                            <span className="text-muted-foreground/50 italic">NULL</span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={colNames.length + 1}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        No rows found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select a table to browse data
              </div>
            )}
          </div>

          {/* Pagination + filter toggle */}
          {selectedTable && colNames.length > 0 && (
            <div className="flex items-center gap-2 border-t px-3 py-1 shrink-0 text-xs text-muted-foreground">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition-colors ${
                  showFilters || activeFilters > 0
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                <Search className="h-3 w-3" />
                Filter
                {activeFilters > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">
                    {activeFilters}
                  </span>
                )}
              </button>
              <div className="flex-1" />
              <span className="tabular-nums">
                {totalRows.toLocaleString()} row{totalRows !== 1 ? "s" : ""}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => handlePageChange(page - 1)}
                    className="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-30 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="tabular-nums">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => handlePageChange(page + 1)}
                    className="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-30 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SQL Editor panel */}
          {editorOpen && (
            <>
              {/* Editor resize handle */}
              <div
                className="h-px bg-border hover:bg-primary/50 cursor-row-resize transition-colors shrink-0"
                onMouseDown={handleEditorResize}
              />
              <div
                className="flex flex-col shrink-0 border-t"
                style={{ height: editorHeight }}
              >
                <div className="flex items-center gap-1 px-2 py-1 border-b shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    SQL Query
                  </span>
                  <div className="flex-1" />
                  {queryResult && !queryError && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""} in{" "}
                      {queryResult.time.toFixed(1)}ms
                    </span>
                  )}
                  <button
                    onClick={runQuery}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    Run
                  </button>
                </div>
                <div className="flex flex-1 min-h-0">
                  {/* Editor */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <SqlEditor value={sql} onChange={setSql} onRun={runQuery} />
                  </div>
                  {/* Query results */}
                  {(queryResult || queryError) && (
                    <div className="w-1/2 border-l overflow-auto min-w-0">
                      {queryError ? (
                        <div className="p-3 text-xs text-destructive font-mono whitespace-pre-wrap">
                          {queryError}
                        </div>
                      ) : queryResult && queryResult.columns.length > 0 ? (
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0">
                            <tr className="bg-muted/80">
                              {queryResult.columns.map((c) => (
                                <th
                                  key={c}
                                  className="px-2 py-1 text-left font-semibold border-b border-r whitespace-nowrap"
                                >
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.rows.map((row, i) => (
                              <tr key={i} className="hover:bg-accent/30">
                                {row.map((cell, j) => (
                                  <td
                                    key={j}
                                    className="px-2 py-0.5 border-b border-r font-mono max-w-48 truncate"
                                    title={cell == null ? "NULL" : String(cell)}
                                  >
                                    {cell == null ? (
                                      <span className="text-muted-foreground/50 italic">
                                        NULL
                                      </span>
                                    ) : (
                                      String(cell)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          Query executed. No rows returned.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Copied toast */}
      {copied && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <Check className="h-3 w-3" />
          Copied
        </div>
      )}
    </div>
  );
}
