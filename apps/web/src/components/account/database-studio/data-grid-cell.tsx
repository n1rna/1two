"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CellValue } from "./types";

interface DataGridCellProps {
  value: CellValue;
  type: string;
  isModified?: boolean;
  isDeleted?: boolean;
  onDoubleClick?: () => void;
}

function isJsonType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "json" || t === "jsonb";
}

function isTimestampType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes("timestamp") ||
    t.includes("datetime") ||
    t === "date" ||
    t === "time"
  );
}

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes("int") ||
    t.includes("float") ||
    t.includes("double") ||
    t.includes("decimal") ||
    t.includes("numeric") ||
    t.includes("real") ||
    t === "bigserial" ||
    t === "serial"
  );
}

function isBoolType(type: string): boolean {
  const t = type.toLowerCase();
  return t === "bool" || t === "boolean";
}

function JsonPreview({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);

  let preview = value;
  try {
    preview = JSON.stringify(JSON.parse(value));
  } catch {
    // use raw
  }

  if (!expanded) {
    const truncated = preview.length > 60 ? preview.slice(0, 60) + "…" : preview;
    return (
      <button
        className="text-left w-full"
        onClick={() => setExpanded(true)}
        title="Click to expand"
      >
        <span className="font-mono text-xs text-muted-foreground/80 truncate block">
          {truncated}
        </span>
      </button>
    );
  }

  return (
    <button
      className="text-left w-full"
      onClick={() => setExpanded(false)}
      title="Click to collapse"
    >
      <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all max-w-xs max-h-48 overflow-auto">
        {(() => {
          try {
            return JSON.stringify(JSON.parse(value), null, 2);
          } catch {
            return value;
          }
        })()}
      </pre>
    </button>
  );
}

export function DataGridCell({
  value,
  type,
  isModified,
  isDeleted,
  onDoubleClick,
}: DataGridCellProps) {
  const cellClass = cn(
    "font-mono text-xs px-2 py-1.5 h-full flex items-center w-full",
    isModified && "bg-amber-500/10 outline outline-1 outline-amber-500/30",
    isDeleted && "opacity-40 line-through"
  );

  if (value === null || value === undefined) {
    return (
      <div className={cellClass} onDoubleClick={onDoubleClick}>
        <span className="bg-muted/50 text-muted-foreground text-xs italic px-1.5 rounded">
          NULL
        </span>
      </div>
    );
  }

  if (isBoolType(type)) {
    return (
      <div className={cn(cellClass, "justify-center")} onDoubleClick={onDoubleClick}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          readOnly
          className="h-3.5 w-3.5 cursor-default accent-primary"
        />
      </div>
    );
  }

  if (isJsonType(type) && typeof value === "string") {
    return (
      <div className={cellClass} onDoubleClick={onDoubleClick}>
        <JsonPreview value={value} />
      </div>
    );
  }

  if (isTimestampType(type) && typeof value === "string") {
    let formatted = value;
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        formatted = d.toLocaleString();
      }
    } catch {
      // use raw
    }
    return (
      <div className={cellClass} onDoubleClick={onDoubleClick}>
        <span className="truncate text-foreground/80">{formatted}</span>
      </div>
    );
  }

  if (isNumericType(type)) {
    return (
      <div className={cn(cellClass, "justify-end")} onDoubleClick={onDoubleClick}>
        <span className="text-right tabular-nums">{String(value)}</span>
      </div>
    );
  }

  // Default: text
  const strVal = String(value);
  return (
    <div className={cellClass} onDoubleClick={onDoubleClick}>
      <span className="truncate" title={strVal.length > 80 ? strVal : undefined}>
        {strVal}
      </span>
    </div>
  );
}
