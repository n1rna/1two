"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  FileSpreadsheet,
  Upload,
  ArrowUp,
  ArrowDown,
  X,
  Check,
  Columns,
  Search,
  FileDown,
  Plus,
  Pencil,
  Save,
  ChevronDown,
  Shuffle,
  Scissors,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────

type SortDir = "asc" | "desc" | null;

interface RowDrawerState {
  open: boolean;
  mode: "create" | "edit";
  values: Record<string, string>;
  rowIndex: number | null;
}

interface ExportPreset {
  label: string;
  id: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const SPLIT_PRESETS: ExportPreset[] = [
  { label: "80 / 20 split", id: "split-80-20" },
  { label: "70 / 30 split", id: "split-70-30" },
  { label: "90 / 10 split", id: "split-90-10" },
  { label: "60 / 40 split", id: "split-60-40" },
];

// ─── CSV Parser ─────────────────────────────────────────────────────

function detectDelimiter(sample: string): string {
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    // Count occurrences in the first line only
    const firstLine = sample.split("\n")[0] ?? "";
    let count = 0;
    let inQuote = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuote = !inQuote;
      if (!inQuote && ch === d) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
          continue;
        } else {
          inQuote = false;
          i++;
          continue;
        }
      } else {
        field += ch;
        i++;
        continue;
      }
    }

    if (ch === '"') {
      inQuote = true;
      i++;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Last field/row
  row.push(field);
  if (row.some((f) => f !== "")) {
    rows.push(row);
  }

  return rows;
}

function escapeCSVField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCSV(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCSVField).join(","),
    ...rows.map((r) => r.map(escapeCSVField).join(",")),
  ];
  return lines.join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Row Drawer ────────────────────────────────────────────────────

function RowDrawer({
  state,
  headers,
  onClose,
  onSave,
}: {
  state: RowDrawerState;
  headers: string[];
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
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
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
          {headers.map((col, idx) => (
            <div key={idx}>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                <span>{col || `Column ${idx + 1}`}</span>
                <span className="font-mono text-[10px] opacity-60">col {idx + 1}</span>
              </label>
              <input
                type="text"
                value={values[col] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [col]: e.target.value }))
                }
                placeholder="empty"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
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

// ─── Export Panel ──────────────────────────────────────────────────

function ExportPanel({
  headers,
  allRows,
  filteredRows,
  fileName,
  onClose,
}: {
  headers: string[];
  allRows: string[][];
  filteredRows: string[][];
  fileName: string;
  onClose: () => void;
}) {
  const baseName = fileName.replace(/\.(csv|tsv)$/i, "") || "data";

  // Column selection
  const [selectedCols, setSelectedCols] = useState<boolean[]>(
    headers.map(() => true)
  );

  // Export mode
  type ExportMode =
    | "all"
    | "filtered"
    | "first-n"
    | "last-n"
    | "sample"
    | "range"
    | "split-80-20"
    | "split-70-30"
    | "split-90-10"
    | "split-60-40";

  const [mode, setMode] = useState<ExportMode>("all");
  const [nRows, setNRows] = useState(100);
  const [samplePct, setSamplePct] = useState(10);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(Math.min(100, allRows.length));

  const activeCols = headers.filter((_, i) => selectedCols[i]);
  const activeColIdxs = headers
    .map((_, i) => i)
    .filter((i) => selectedCols[i]);

  function filterCols(rows: string[][]): string[][] {
    return rows.map((r) => activeColIdxs.map((i) => r[i] ?? ""));
  }

  function shuffled(rows: string[][]): string[][] {
    const arr = [...rows];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function doExport() {
    const source = mode === "filtered" ? filteredRows : allRows;

    if (mode === "all" || mode === "filtered") {
      downloadCSV(rowsToCSV(activeCols, filterCols(source)), `${baseName}.csv`);
    } else if (mode === "first-n") {
      const rows = filterCols(source.slice(0, nRows));
      downloadCSV(rowsToCSV(activeCols, rows), `${baseName}_first${nRows}.csv`);
    } else if (mode === "last-n") {
      const rows = filterCols(source.slice(-nRows));
      downloadCSV(rowsToCSV(activeCols, rows), `${baseName}_last${nRows}.csv`);
    } else if (mode === "sample") {
      const count = Math.max(1, Math.round(source.length * samplePct / 100));
      const rows = filterCols(shuffled(source).slice(0, count));
      downloadCSV(rowsToCSV(activeCols, rows), `${baseName}_sample${samplePct}pct.csv`);
    } else if (mode === "range") {
      const from = Math.max(1, rangeFrom) - 1;
      const to = Math.min(source.length, rangeTo);
      const rows = filterCols(source.slice(from, to));
      downloadCSV(rowsToCSV(activeCols, rows), `${baseName}_rows${rangeFrom}-${rangeTo}.csv`);
    } else {
      // Split presets
      const ratios: Record<string, [number, number]> = {
        "split-80-20": [80, 20],
        "split-70-30": [70, 30],
        "split-90-10": [90, 10],
        "split-60-40": [60, 40],
      };
      const [trainPct, testPct] = ratios[mode] ?? [80, 20];
      const sh = shuffled(source);
      const cutoff = Math.round(sh.length * trainPct / 100);
      const trainRows = filterCols(sh.slice(0, cutoff));
      const testRows = filterCols(sh.slice(cutoff));
      downloadCSV(rowsToCSV(activeCols, trainRows), `${baseName}_train${trainPct}.csv`);
      setTimeout(() => {
        downloadCSV(rowsToCSV(activeCols, testRows), `${baseName}_test${testPct}.csv`);
      }, 200);
    }
  }

  const isSplit = mode.startsWith("split-");

  return (
    <div className="absolute right-0 top-8 z-50 w-80 bg-background border rounded-lg shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">Export</span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-accent text-muted-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[70vh] overflow-auto">
        {/* Mode selection */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Export mode
          </div>
          <div className="space-y-0.5">
            {(
              [
                { id: "all", label: `All rows (${allRows.length.toLocaleString()})` },
                { id: "filtered", label: `Current view (${filteredRows.length.toLocaleString()})` },
                { id: "first-n", label: "First N rows" },
                { id: "last-n", label: "Last N rows" },
                { id: "sample", label: "Random sample %" },
                { id: "range", label: "Row range" },
              ] as { id: ExportMode; label: string }[]
            ).map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
              >
                <input
                  type="radio"
                  name="export-mode"
                  value={opt.id}
                  checked={mode === opt.id}
                  onChange={() => setMode(opt.id)}
                  className="accent-primary"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* N rows input */}
        {(mode === "first-n" || mode === "last-n") && (
          <div className="flex items-center gap-2 px-2">
            <label className="text-xs text-muted-foreground shrink-0">N =</label>
            <input
              type="number"
              min={1}
              max={allRows.length}
              value={nRows}
              onChange={(e) => setNRows(Number(e.target.value))}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Sample % */}
        {mode === "sample" && (
          <div className="flex items-center gap-2 px-2">
            <label className="text-xs text-muted-foreground shrink-0">%</label>
            <input
              type="number"
              min={1}
              max={100}
              value={samplePct}
              onChange={(e) => setSamplePct(Number(e.target.value))}
              className="w-20 rounded border border-input bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ~{Math.round(allRows.length * samplePct / 100)} rows
            </span>
          </div>
        )}

        {/* Range */}
        {mode === "range" && (
          <div className="flex items-center gap-2 px-2 text-xs">
            <span className="text-muted-foreground shrink-0">Rows</span>
            <input
              type="number"
              min={1}
              max={allRows.length}
              value={rangeFrom}
              onChange={(e) => setRangeFrom(Number(e.target.value))}
              className="w-20 rounded border border-input bg-background px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-muted-foreground shrink-0">to</span>
            <input
              type="number"
              min={1}
              max={allRows.length}
              value={rangeTo}
              onChange={(e) => setRangeTo(Number(e.target.value))}
              className="w-20 rounded border border-input bg-background px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Train / Test splits */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Scissors className="h-2.5 w-2.5" />
            Train / Test splits
          </div>
          <div className="space-y-0.5">
            {SPLIT_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
              >
                <input
                  type="radio"
                  name="export-mode"
                  value={preset.id}
                  checked={mode === preset.id}
                  onChange={() => setMode(preset.id as ExportMode)}
                  className="accent-primary"
                />
                <Shuffle className="h-3 w-3 text-muted-foreground" />
                {preset.label}
                {mode === preset.id && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    2 files
                  </span>
                )}
              </label>
            ))}
          </div>
          {isSplit && (
            <p className="px-2 mt-1 text-[10px] text-muted-foreground">
              Rows are shuffled randomly before splitting.
            </p>
          )}
        </div>

        {/* Column selection */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Columns className="h-2.5 w-2.5" />
            Columns ({activeCols.length} / {headers.length})
          </div>
          <div className="max-h-32 overflow-auto space-y-0.5 border rounded-md p-1">
            {headers.map((col, i) => (
              <label
                key={i}
                className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCols[i]}
                  onChange={(e) => {
                    const next = [...selectedCols];
                    next[i] = e.target.checked;
                    setSelectedCols(next);
                  }}
                  className="accent-primary"
                />
                <span className="truncate font-mono">{col || `col_${i + 1}`}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-1 px-1">
            <button
              onClick={() => setSelectedCols(headers.map(() => true))}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Select all
            </button>
            <span className="text-[10px] text-muted-foreground">·</span>
            <button
              onClick={() => setSelectedCols(headers.map(() => false))}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t flex items-center gap-2">
        <button
          onClick={doExport}
          disabled={activeCols.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <FileDown className="h-3 w-3" />
          {isSplit ? "Download 2 files" : "Download CSV"}
        </button>
      </div>
    </div>
  );
}

// ─── Columns Panel ─────────────────────────────────────────────────

function ColumnsPanel({
  headers,
  visible,
  onChange,
  onClose,
}: {
  headers: string[];
  visible: boolean[];
  onChange: (next: boolean[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-8 z-50 w-60 bg-background border rounded-lg shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Columns className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold">
          Columns ({visible.filter(Boolean).length} / {headers.length})
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-accent text-muted-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2 max-h-72 overflow-auto space-y-0.5">
        {headers.map((col, i) => (
          <label
            key={i}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 cursor-pointer text-xs transition-colors"
          >
            <input
              type="checkbox"
              checked={visible[i]}
              onChange={(e) => {
                const next = [...visible];
                next[i] = e.target.checked;
                onChange(next);
              }}
              className="accent-primary"
            />
            <span className="truncate font-mono">{col || `col_${i + 1}`}</span>
          </label>
        ))}
      </div>
      <div className="px-3 py-2 border-t flex gap-2">
        <button
          onClick={() => onChange(headers.map(() => true))}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Show all
        </button>
        <span className="text-[10px] text-muted-foreground">·</span>
        <button
          onClick={() => onChange(headers.map(() => false))}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Hide all
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export function CsvViewer() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [delimiter, setDelimiter] = useState(",");

  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<number, string>>({});
  const [filterOpenCol, setFilterOpenCol] = useState<number | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");

  const [colVisible, setColVisible] = useState<boolean[]>([]);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);

  const [drawer, setDrawer] = useState<RowDrawerState>({
    open: false,
    mode: "create",
    values: {},
    rowIndex: null,
  });

  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportBtnRef = useRef<HTMLDivElement>(null);
  const colsBtnRef = useRef<HTMLDivElement>(null);

  // ─── Load CSV ───────────────────────────────────────────────────

  const loadCSV = useCallback((text: string, name: string, size: number) => {
    const detectedDelim = detectDelimiter(text);
    const parsed = parseCSV(text, detectedDelim);
    if (parsed.length === 0) return;

    const hdrs = parsed[0].map((h) => h.trim());
    const rows = parsed.slice(1).filter((r) => r.length > 0 && r.some((c) => c !== ""));

    // Normalize row widths
    const width = hdrs.length;
    const normalized = rows.map((r) => {
      const out = [...r];
      while (out.length < width) out.push("");
      return out.slice(0, width);
    });

    setHeaders(hdrs);
    setAllRows(normalized);
    setFileName(name);
    setFileSize(size);
    setDelimiter(detectedDelim);
    setPage(0);
    setSortCol(null);
    setSortDir(null);
    setFilters({});
    setGlobalSearch("");
    setColVisible(hdrs.map(() => true));
    setFilterOpenCol(null);
    setShowExportPanel(false);
    setShowColumnsPanel(false);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        loadCSV(text, file.name, file.size);
      };
      reader.readAsText(file, "utf-8");
    },
    [loadCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ─── Derived / computed data ────────────────────────────────────

  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Per-column filters
    const filterEntries = Object.entries(filters).filter(([, v]) => v.trim());
    if (filterEntries.length > 0) {
      rows = rows.filter((row) =>
        filterEntries.every(([colIdxStr, val]) => {
          const ci = Number(colIdxStr);
          return (row[ci] ?? "").toLowerCase().includes(val.toLowerCase());
        })
      );
    }

    // Global search
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      rows = rows.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortCol !== null && sortDir !== null) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol] ?? "";
        const bv = b[sortCol] ?? "";
        // Try numeric sort
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
        return av.localeCompare(bv) * dir;
      });
    }

    return rows;
  }, [allRows, filters, globalSearch, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const activeFilters = useMemo(
    () => Object.values(filters).filter((v) => v.trim()).length,
    [filters]
  );

  const visibleColIdxs = useMemo(
    () => headers.map((_, i) => i).filter((i) => colVisible[i] !== false),
    [headers, colVisible]
  );

  // Highlight search matches
  function highlight(cell: string): React.ReactNode {
    if (!globalSearch.trim()) return cell;
    const q = globalSearch.toLowerCase();
    const idx = cell.toLowerCase().indexOf(q);
    if (idx === -1) return cell;
    return (
      <>
        {cell.slice(0, idx)}
        <mark className="bg-yellow-300/70 dark:bg-yellow-500/40 rounded-sm px-0">{cell.slice(idx, idx + q.length)}</mark>
        {cell.slice(idx + q.length)}
      </>
    );
  }

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSort = useCallback(
    (colIdx: number) => {
      let newDir: SortDir;
      if (sortCol === colIdx) {
        newDir = sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc";
      } else {
        newDir = "asc";
      }
      setSortCol(newDir ? colIdx : null);
      setSortDir(newDir);
      setPage(0);
    },
    [sortCol, sortDir]
  );

  const handleFilterChange = useCallback((colIdx: number, value: string) => {
    setFilters((prev) => ({ ...prev, [colIdx]: value }));
    setPage(0);
  }, []);

  const copyCell = useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, []);

  // ─── Row drawer ─────────────────────────────────────────────────

  const openCreateDrawer = useCallback(() => {
    const values: Record<string, string> = {};
    for (const h of headers) values[h] = "";
    setDrawer({ open: true, mode: "create", values, rowIndex: null });
  }, [headers]);

  const openEditDrawer = useCallback(
    (pageRowIdx: number) => {
      // pageRowIdx is within the current page
      const absIdx = page * PAGE_SIZE + pageRowIdx;
      const row = pageRows[pageRowIdx];
      if (!row) return;
      const values: Record<string, string> = {};
      headers.forEach((h, i) => {
        values[h] = row[i] ?? "";
      });
      // We need to find the actual index in allRows
      const filteredRowObj = filteredRows[absIdx];
      const realIdx = allRows.indexOf(filteredRowObj);
      setDrawer({ open: true, mode: "edit", values, rowIndex: realIdx });
    },
    [headers, page, pageRows, filteredRows, allRows]
  );

  const handleDrawerSave = useCallback(
    (values: Record<string, string>) => {
      const newRow = headers.map((h) => values[h] ?? "");
      if (drawer.mode === "create") {
        setAllRows((prev) => [...prev, newRow]);
      } else if (drawer.rowIndex !== null) {
        setAllRows((prev) => {
          const next = [...prev];
          next[drawer.rowIndex!] = newRow;
          return next;
        });
      }
      setDrawer((prev) => ({ ...prev, open: false }));
    },
    [drawer.mode, drawer.rowIndex, headers]
  );

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        showExportPanel &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target as Node)
      ) {
        setShowExportPanel(false);
      }
      if (
        showColumnsPanel &&
        colsBtnRef.current &&
        !colsBtnRef.current.contains(e.target as Node)
      ) {
        setShowColumnsPanel(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportPanel, showColumnsPanel]);

  // ─── Delimiter label ────────────────────────────────────────────

  const delimLabel =
    delimiter === "\t"
      ? "TSV (tab)"
      : delimiter === ";"
        ? "semicolon"
        : delimiter === "|"
          ? "pipe"
          : "CSV (comma)";

  // ─── No file loaded ─────────────────────────────────────────────

  if (headers.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-6 px-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
            <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Open a CSV or TSV file</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drop a{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-xs">.csv</code>{" "}
              or{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-xs">.tsv</code>{" "}
              file here, or click to browse. Delimiter is auto-detected.
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
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }

  // ─── File loaded ────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5 shrink-0 text-sm flex-wrap">
        <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate max-w-48">{fileName}</span>
        <span className="text-muted-foreground text-xs tabular-nums shrink-0">
          {allRows.length.toLocaleString()} rows · {headers.length} cols · {formatBytes(fileSize)} · {delimLabel}
        </span>

        {/* Global search */}
        <div className="relative ml-2 flex-1 min-w-32 max-w-56">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-6 pr-2 py-0.5 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {globalSearch && (
            <button
              onClick={() => { setGlobalSearch(""); setPage(0); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={openCreateDrawer}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-accent text-muted-foreground transition-colors"
            title="Add new row"
          >
            <Plus className="h-3 w-3" />
            Row
          </button>

          {/* Columns panel */}
          <div ref={colsBtnRef} className="relative">
            <button
              onClick={() => { setShowColumnsPanel(!showColumnsPanel); setShowExportPanel(false); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                showColumnsPanel
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <Columns className="h-3 w-3" />
              Columns
            </button>
            {showColumnsPanel && (
              <ColumnsPanel
                headers={headers}
                visible={colVisible}
                onChange={setColVisible}
                onClose={() => setShowColumnsPanel(false)}
              />
            )}
          </div>

          {/* Export panel */}
          <div ref={exportBtnRef} className="relative">
            <button
              onClick={() => { setShowExportPanel(!showExportPanel); setShowColumnsPanel(false); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                showExportPanel
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <FileDown className="h-3 w-3" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportPanel && (
              <ExportPanel
                headers={headers}
                allRows={allRows}
                filteredRows={filteredRows}
                fileName={fileName}
                onClose={() => setShowExportPanel(false)}
              />
            )}
          </div>

          <button
            onClick={() => {
              setHeaders([]);
              setAllRows([]);
              setFileName("");
              setFileSize(0);
            }}
            className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent text-muted-foreground transition-colors"
            title="Close file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Data grid */}
      <div className="flex-1 overflow-auto min-h-0">
        {visibleColIdxs.length > 0 ? (
          <table className="text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/80 backdrop-blur-sm">
                <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-muted-foreground border-b border-r tabular-nums sticky left-0 z-20 bg-muted backdrop-blur-sm shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                  #
                </th>
                {visibleColIdxs.map((ci) => {
                  const hasFilter = (filters[ci] ?? "").trim().length > 0;
                  const isFilterOpen = filterOpenCol === ci;
                  return (
                    <th
                      key={ci}
                      className="px-2 py-1.5 text-left text-xs font-semibold border-b border-r select-none whitespace-nowrap relative"
                    >
                      <span className="inline-flex items-center gap-1 w-full">
                        <span
                          className="cursor-pointer hover:text-primary transition-colors flex-1"
                          onClick={() => handleSort(ci)}
                        >
                          {headers[ci] || `col_${ci + 1}`}
                        </span>
                        {sortCol === ci && sortDir === "asc" && (
                          <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                        )}
                        {sortCol === ci && sortDir === "desc" && (
                          <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterOpenCol(isFilterOpen ? null : ci);
                          }}
                          className={`shrink-0 rounded p-0.5 transition-colors cursor-pointer ${
                            hasFilter || isFilterOpen
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground/40 hover:text-muted-foreground"
                          }`}
                          title={`Filter ${headers[ci] || `col_${ci + 1}`}`}
                        >
                          <Search className="h-3 w-3" />
                        </button>
                      </span>
                      {isFilterOpen && (
                        <div className="absolute left-0 right-0 top-full z-20 px-1 py-1 bg-background border border-t-0 border-input rounded-b shadow-md">
                          <input
                            type="text"
                            autoFocus
                            placeholder={`Filter ${headers[ci] || `col_${ci + 1}`}...`}
                            value={filters[ci] ?? ""}
                            onChange={(e) => handleFilterChange(ci, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") setFilterOpenCol(null); }}
                            className="w-full bg-background border border-input rounded px-1.5 py-0.5 text-xs font-normal focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      )}
                    </th>
                  );
                })}
                {/* Edit column header - sticky right */}
                <th className="px-2 py-1.5 border-b w-8 sticky right-0 z-20 bg-muted backdrop-blur-sm shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                  <Pencil className="h-3 w-3 text-muted-foreground mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const absRowNum = page * PAGE_SIZE + i + 1;
                return (
                  <tr key={i} className="hover:bg-accent/30 transition-colors group">
                    <td className="px-2 py-1 text-[10px] text-muted-foreground border-b border-r tabular-nums sticky left-0 z-[1] bg-background group-hover:bg-accent/30 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                      {absRowNum}
                    </td>
                    {visibleColIdxs.map((ci) => {
                      const cell = row[ci] ?? "";
                      return (
                        <td
                          key={ci}
                          className="px-2 py-1 border-b border-r max-w-64 truncate font-mono text-xs cursor-pointer hover:bg-accent/50"
                          onClick={() => copyCell(cell)}
                          title={cell}
                        >
                          {highlight(cell)}
                        </td>
                      );
                    })}
                    {/* Edit button - sticky right */}
                    <td className="px-1 py-1 border-b sticky right-0 z-[1] bg-muted group-hover:bg-accent shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                      <button
                        onClick={() => openEditDrawer(i)}
                        className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                        title="Edit row"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleColIdxs.length + 2}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            All columns are hidden. Use the Columns button to show them.
          </div>
        )}
      </div>

      {/* Status bar: filter toggle + pagination */}
      <div className="flex items-center gap-2 border-t px-3 py-1 shrink-0 text-xs text-muted-foreground">
        {activeFilters > 0 && (
          <button
            onClick={() => { setFilters({}); setFilterOpenCol(null); setPage(0); }}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
            Clear {activeFilters} filter{activeFilters !== 1 ? "s" : ""}
          </button>
        )}

        <div className="flex-1" />

        {filteredRows.length !== allRows.length && (
          <span className="tabular-nums text-primary">
            {filteredRows.length.toLocaleString()} of {allRows.length.toLocaleString()} rows
          </span>
        )}
        {filteredRows.length === allRows.length && (
          <span className="tabular-nums">
            {allRows.length.toLocaleString()} row{allRows.length !== 1 ? "s" : ""}
          </span>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-30 transition-colors"
            >
              Prev
            </button>
            <span className="tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="rounded px-1.5 py-0.5 hover:bg-accent disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Row editor drawer */}
      <RowDrawer
        state={drawer}
        headers={headers}
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
