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
  Plus,
  Pencil,
  Save,
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
}

type SortDir = "asc" | "desc" | null;

interface RowDrawerState {
  open: boolean;
  mode: "create" | "edit";
  values: Record<string, string>;
  /** For edit mode: original PK values to identify the row */
  originalPk: Record<string, unknown>;
}

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
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    if (!editorRef.current) return;
    let destroyed = false;

    (async () => {
      const { EditorView, keymap, placeholder, lineNumbers } = await import("@codemirror/view");
      const { EditorState } = await import("@codemirror/state");
      const { sql, SQLite } = await import("@codemirror/lang-sql");
      const { defaultKeymap, history, historyKeymap } = await import("@codemirror/commands");
      const { autocompletion, completionKeymap } = await import("@codemirror/autocomplete");
      const { syntaxHighlighting, HighlightStyle } = await import("@codemirror/language");
      const { tags } = await import("@lezer/highlight");

      if (destroyed || !editorRef.current) return;

      const runKeymap = keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onRunRef.current();
            return true;
          },
        },
      ]);

      // Custom highlight style matching app theme
      const highlight = HighlightStyle.define([
        { tag: tags.keyword, color: "#c792ea" },
        { tag: tags.operatorKeyword, color: "#c792ea" },
        { tag: tags.string, color: "#c3e88d" },
        { tag: tags.number, color: "#f78c6c" },
        { tag: tags.bool, color: "#ff5370" },
        { tag: tags.null, color: "#ff5370", fontStyle: "italic" },
        { tag: tags.comment, color: "#697098", fontStyle: "italic" },
        { tag: tags.typeName, color: "#ffcb6b" },
        { tag: tags.function(tags.variableName), color: "#82aaff" },
        { tag: tags.propertyName, color: "#f07178" },
        { tag: tags.punctuation, color: "#89ddff" },
        { tag: tags.paren, color: "#89ddff" },
        { tag: tags.squareBracket, color: "#89ddff" },
        { tag: tags.separator, color: "#89ddff" },
        { tag: tags.special(tags.string), color: "#f07178" },
      ]);

      const theme = EditorView.theme({
        "&": {
          fontSize: "13px",
          height: "100%",
          backgroundColor: "color-mix(in srgb, var(--background) 95%, var(--foreground) 5%)",
          color: "var(--foreground)",
        },
        ".cm-content": {
          fontFamily: "var(--font-geist-mono), monospace",
          padding: "8px 0",
          caretColor: "var(--foreground)",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          color: "var(--muted-foreground)",
          borderRight: "1px solid var(--border)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "transparent",
          color: "var(--foreground)",
        },
        ".cm-activeLine": {
          backgroundColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
        },
        ".cm-selectionBackground": {
          backgroundColor: "color-mix(in srgb, var(--primary) 25%, transparent) !important",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--foreground)",
        },
        "&.cm-focused": {
          outline: "none",
        },
        ".cm-tooltip": {
          backgroundColor: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "var(--accent)",
          color: "var(--accent-foreground)",
        },
        ".cm-completionIcon": {
          display: "none",
        },
        ".cm-placeholder": {
          color: "var(--muted-foreground)",
        },
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          runKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
          history(),
          lineNumbers(),
          sql({ dialect: SQLite }),
          autocompletion(),
          syntaxHighlighting(highlight),
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

// ─── Row Drawer ────────────────────────────────────────────────────

function RowDrawer({
  state,
  columns,
  onClose,
  onSave,
}: {
  state: RowDrawerState;
  columns: ColumnInfo[];
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(state.values);

  useEffect(() => {
    setValues(state.values);
  }, [state.values]);

  if (!state.open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          {state.mode === "create" ? (
            <Plus className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Pencil className="h-4 w-4 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-sm">
            {state.mode === "create" ? "New Row" : "Edit Row"}
          </h3>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {columns.map((col) => {
            const isPk = col.pk && state.mode === "edit";
            return (
              <div key={col.cid}>
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                  <span>{col.name}</span>
                  <span className="font-mono text-[10px] opacity-60">{col.type}</span>
                  {col.pk && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded">PK</span>
                  )}
                  {col.notnull && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 rounded">NOT NULL</span>
                  )}
                </label>
                <input
                  type="text"
                  value={values[col.name] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                  }
                  disabled={isPk}
                  placeholder={
                    col.dflt_value != null
                      ? `Default: ${col.dflt_value}`
                      : col.notnull
                        ? "Required"
                        : "NULL"
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(values)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {state.mode === "create" ? "Insert" : "Update"}
          </button>
        </div>
      </div>
    </>
  );
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
  const [filterOpenCol, setFilterOpenCol] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

  // Query editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [sqlText, setSqlText] = useState("SELECT * FROM ");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Row drawer
  const [drawer, setDrawer] = useState<RowDrawerState>({
    open: false,
    mode: "create",
    values: {},
    originalPk: {},
  });

  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [editorHeight, setEditorHeight] = useState(220);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef(false);
  const editorResizingRef = useRef(false);

  // ─── Load database ──────────────────────────────────────────────

  const loadDatabase = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setLoading(true);
    try {
      const initSqlJs = (await import("sql.js")).default;
      const SQL = await initSqlJs({
        locateFile: () => "/sql-wasm.wasm",
      });
      const newDb = new SQL.Database(new Uint8Array(buffer));
      setDb((prev) => {
        prev?.close();
        return newDb;
      });
      setFileName(name);

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
      setSelectedTable(null);
      setColumns([]);
      setIndexes([]);
      setRows([]);
      setColNames([]);
      setPage(0);
      setSortCol(null);
      setSortDir(null);
      setFilters({});
      setFilterError(null);
      setQueryResult(null);
      setQueryError(null);

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
      setFilterError(null);
      setFilterOpenCol(null);

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
        const whereClauses: string[] = [];
        for (const [col, val] of Object.entries(filterMap)) {
          if (val.trim()) {
            whereClauses.push(`"${col}" LIKE '%${val.replace(/'/g, "''")}%'`);
          }
        }
        const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

        const countResult = database.exec(
          `SELECT COUNT(*) FROM "${tableName}"${whereStr}`
        );
        const total = Number(countResult[0]?.values[0]?.[0] ?? 0);
        setTotalRows(total);

        const orderStr = sortColumn && sortDirection
          ? ` ORDER BY "${sortColumn}" ${sortDirection.toUpperCase()}`
          : "";

        const dataResult = database.exec(
          `SELECT * FROM "${tableName}"${whereStr}${orderStr} LIMIT ${PAGE_SIZE} OFFSET ${pageNum * PAGE_SIZE}`
        );

        if (dataResult[0]?.columns) {
          setColNames(dataResult[0].columns);
        }
        setRows(dataResult[0]?.values ?? []);
        setFilterError(null);
      } catch {
        setFilterError("Filter error - check that your filter values match the column types");
      }
    },
    []
  );

  // ─── Refresh current view ──────────────────────────────────────

  const refreshTable = useCallback(() => {
    if (!db || !selectedTable) return;
    fetchData(db, selectedTable, page, sortCol, sortDir, filters);
    // Refresh row counts
    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = (result[0]?.values ?? []).map((r) => String(r[0]));
    setTables(
      tableNames.map((t) => {
        const countResult = db.exec(`SELECT COUNT(*) FROM "${t}"`);
        return { name: t, rowCount: Number(countResult[0]?.values[0]?.[0] ?? 0) };
      })
    );
  }, [db, selectedTable, page, sortCol, sortDir, filters, fetchData]);

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
    if (!db || !sqlText.trim()) return;
    setQueryError(null);
    const start = performance.now();
    try {
      const results = db.exec(sqlText);
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
      // Refresh table data if it was a write query
      const trimmed = sqlText.trim().toUpperCase();
      if (trimmed.startsWith("INSERT") || trimmed.startsWith("UPDATE") || trimmed.startsWith("DELETE") || trimmed.startsWith("DROP") || trimmed.startsWith("ALTER")) {
        refreshTable();
      }
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : String(e));
      setQueryResult(null);
    }
  }, [db, sqlText, refreshTable]);

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

  // ─── Row drawer handlers ───────────────────────────────────────

  const openCreateDrawer = useCallback(() => {
    const defaultValues: Record<string, string> = {};
    for (const col of columns) {
      defaultValues[col.name] = col.dflt_value ?? "";
    }
    setDrawer({
      open: true,
      mode: "create",
      values: defaultValues,
      originalPk: {},
    });
  }, [columns]);

  const openEditDrawer = useCallback(
    (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row) return;
      const values: Record<string, string> = {};
      const originalPk: Record<string, unknown> = {};
      colNames.forEach((col, i) => {
        values[col] = row[i] == null ? "" : String(row[i]);
      });
      for (const col of columns) {
        if (col.pk) {
          const idx = colNames.indexOf(col.name);
          if (idx >= 0) originalPk[col.name] = row[idx];
        }
      }
      setDrawer({ open: true, mode: "edit", values, originalPk });
    },
    [rows, colNames, columns]
  );

  const handleDrawerSave = useCallback(
    (values: Record<string, string>) => {
      if (!db || !selectedTable) return;

      try {
        if (drawer.mode === "create") {
          const cols = Object.keys(values).filter((k) => values[k] !== "");
          if (cols.length === 0) return;
          const placeholders = cols.map(() => "?").join(", ");
          const vals = cols.map((k) => values[k] === "" ? null : values[k]);
          const stmt = db.prepare(
            `INSERT INTO "${selectedTable}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`
          );
          stmt.run(vals);
          stmt.free();
        } else {
          // Edit mode - update by PK
          const pkCols = columns.filter((c) => c.pk);
          if (pkCols.length === 0) {
            setQueryError("Cannot edit: table has no primary key");
            return;
          }
          const setClauses = columns
            .filter((c) => !c.pk)
            .map((c) => `"${c.name}" = ?`);
          const setValues = columns
            .filter((c) => !c.pk)
            .map((c) => values[c.name] === "" ? null : values[c.name]);
          const whereClauses = pkCols.map((c) => `"${c.name}" = ?`);
          const whereValues = pkCols.map((c) => {
            const v = drawer.originalPk[c.name];
            return v == null ? null : String(v);
          });

          const stmt = db.prepare(
            `UPDATE "${selectedTable}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")}`
          );
          stmt.run([...setValues, ...whereValues] as (string | null)[]);
          stmt.free();
        }

        setDrawer((prev) => ({ ...prev, open: false }));
        refreshTable();
      } catch (e) {
        setQueryError(`${drawer.mode === "create" ? "Insert" : "Update"} failed: ${e instanceof Error ? e.message : e}`);
      }
    },
    [db, selectedTable, columns, drawer.mode, drawer.originalPk, refreshTable]
  );

  // ─── Sidebar resize ────────────────────────────────────────────

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setSidebarWidth(Math.max(160, Math.min(400, startWidth + ev.clientX - startX)));
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
      setEditorHeight(Math.max(120, Math.min(600, startH - (ev.clientY - startY))));
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

  // ─── Derived ────────────────────────────────────────────────────

  const totalPages = Math.ceil(totalRows / PAGE_SIZE);
  const activeFilters = useMemo(
    () => Object.values(filters).filter((v) => v.trim()).length,
    [filters]
  );
  const hasPk = useMemo(() => columns.some((c) => c.pk), [columns]);

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
          {selectedTable && (
            <button
              onClick={openCreateDrawer}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
              title="Insert new row"
            >
              <Plus className="h-3 w-3" />
              Row
            </button>
          )}
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
                    <div key={col.cid} className="flex items-center gap-1 px-1.5 py-0.5 text-xs">
                      <span className={`truncate flex-1 ${col.pk ? "font-semibold" : ""}`}>
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
                        <div key={idx.name} className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {idx.unique ? "UNIQUE " : ""}{idx.name} ({idx.columns.join(", ")})
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
              <table className="text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur-sm">
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-muted-foreground border-b border-r tabular-nums sticky left-0 z-20 bg-muted backdrop-blur-sm shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                      #
                    </th>
                    {colNames.map((col) => {
                      const hasFilter = (filters[col] ?? "").trim().length > 0;
                      const isFilterOpen = filterOpenCol === col;
                      return (
                        <th
                          key={col}
                          className="px-2 py-1.5 text-left text-xs font-semibold border-b border-r select-none whitespace-nowrap relative"
                        >
                          <span className="inline-flex items-center gap-1 w-full">
                            <span
                              className="cursor-pointer hover:text-primary transition-colors flex-1"
                              onClick={() => handleSort(col)}
                            >
                              {col}
                            </span>
                            {sortCol === col && sortDir === "asc" && (
                              <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                            )}
                            {sortCol === col && sortDir === "desc" && (
                              <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterOpenCol(isFilterOpen ? null : col);
                              }}
                              className={`shrink-0 rounded p-0.5 transition-colors cursor-pointer ${
                                hasFilter || isFilterOpen
                                  ? "text-primary bg-primary/10"
                                  : "text-muted-foreground/40 hover:text-muted-foreground"
                              }`}
                              title={`Filter ${col}`}
                            >
                              <Search className="h-3 w-3" />
                            </button>
                          </span>
                          {isFilterOpen && (
                            <div className="absolute left-0 right-0 top-full z-20 px-1 py-1 bg-background border border-t-0 border-input rounded-b shadow-md">
                              <input
                                type="text"
                                autoFocus
                                placeholder={`Filter ${col}...`}
                                value={filters[col] ?? ""}
                                onChange={(e) => handleFilterChange(col, e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Escape") setFilterOpenCol(null); }}
                                className="w-full bg-background border border-input rounded px-1.5 py-0.5 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          )}
                        </th>
                      );
                    })}
                    {/* Edit column header - sticky right */}
                    {hasPk && (
                      <th className="px-2 py-1.5 border-b w-8 sticky right-0 z-20 bg-muted backdrop-blur-sm shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                        <Pencil className="h-3 w-3 text-muted-foreground mx-auto" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-accent/30 transition-colors group">
                      <td className="px-2 py-1 text-[10px] text-muted-foreground border-b border-r tabular-nums sticky left-0 z-[1] bg-background group-hover:bg-accent/30 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
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
                      {/* Edit button - sticky right */}
                      {hasPk && (
                        <td className="px-1 py-1 border-b sticky right-0 z-[1] bg-muted group-hover:bg-accent shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                          <button
                            onClick={() => openEditDrawer(i)}
                            className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                            title="Edit row"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={colNames.length + 1 + (hasPk ? 1 : 0)}
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
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setFilters({});
                    setFilterOpenCol(null);
                    setPage(0);
                    if (db && selectedTable) {
                      fetchData(db, selectedTable, 0, sortCol, sortDir, {});
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                  Clear {activeFilters} filter{activeFilters !== 1 ? "s" : ""}
                </button>
              )}
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
              {/* Editor resize handle - thicker grab area */}
              <div
                className="h-1.5 bg-border hover:bg-primary/50 cursor-row-resize transition-colors shrink-0 flex items-center justify-center"
                onMouseDown={handleEditorResize}
              >
                <div className="w-8 h-0.5 rounded-full bg-muted-foreground/30" />
              </div>
              <div
                className="flex flex-col shrink-0"
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
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <SqlEditor value={sqlText} onChange={setSqlText} onRun={runQuery} />
                  </div>
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
                                <th key={c} className="px-2 py-1 text-left font-semibold border-b border-r whitespace-nowrap">
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
                                      <span className="text-muted-foreground/50 italic">NULL</span>
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

      {/* Row editor drawer */}
      <RowDrawer
        state={drawer}
        columns={columns}
        onClose={() => setDrawer((prev) => ({ ...prev, open: false }))}
        onSave={handleDrawerSave}
      />

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
