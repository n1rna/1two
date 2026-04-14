"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CellValue } from "./types";

interface EditableCellProps {
  value: CellValue;
  columnType: string;
  onConfirm: (newValue: CellValue) => void;
  onCancel: () => void;
}

function isBoolType(type: string) {
  const t = type.toLowerCase();
  return t === "bool" || t === "boolean";
}

function isNumericType(type: string) {
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

export function EditableCell({
  value,
  columnType,
  onConfirm,
  onCancel,
}: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState<CellValue>(value);

  useEffect(() => {
    // focus on mount
    const el = inputRef.current;
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const len = String(el.value).length;
        el.setSelectionRange(len, len);
      }
    }
  }, []);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onConfirm(draft);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  if (isBoolType(columnType)) {
    return (
      <div className="flex items-center justify-center gap-2 px-2 py-1.5 bg-background border rounded shadow-sm">
        <input
          type="checkbox"
          checked={Boolean(draft)}
          onChange={(e) => setDraft(e.target.checked)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(draft);
            if (e.key === "Escape") onCancel();
          }}
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="h-4 w-4 accent-primary"
        />
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => onConfirm(draft)}
        >
          OK
        </button>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          Esc
        </button>
      </div>
    );
  }

  const isMultiline =
    typeof draft === "string" && (draft.includes("\n") || draft.length > 80);

  const inputClass = cn(
    "font-mono text-xs bg-background border rounded shadow-md px-2 py-1",
    "focus:outline-none focus:ring-1 focus:ring-primary w-full min-w-[120px]"
  );

  return (
    <div className="relative min-w-[120px]">
      {isMultiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft === null ? "" : String(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className={cn(inputClass, "resize-none")}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={isNumericType(columnType) ? "number" : "text"}
          value={draft === null ? "" : String(draft)}
          onChange={(e) => {
            const v = e.target.value;
            if (isNumericType(columnType)) {
              setDraft(v === "" ? null : Number(v));
            } else {
              setDraft(v);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => onConfirm(draft)}
          className={inputClass}
        />
      )}
      <div className="flex gap-1 mt-0.5">
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            onConfirm(draft);
          }}
        >
          Enter ↵
        </button>
        <span className="text-[10px] text-muted-foreground/40">·</span>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            setDraft(null);
          }}
        >
          Set NULL
        </button>
        <span className="text-[10px] text-muted-foreground/40">·</span>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            onCancel();
          }}
        >
          Esc
        </button>
      </div>
    </div>
  );
}
