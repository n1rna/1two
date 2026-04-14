"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListShell } from "@/components/list-shell";
import { ActionableCard } from "@/components/actionables/actionable-card";
import {
  bulkDismissActionables,
  listLifeActionables,
  respondToActionable,
  type LifeActionable,
} from "@/lib/life";

export default function ActionablesPage() {
  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setActionables(await listLifeActionables());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRespond = useCallback(
    async (id: string, action: string, data?: unknown) => {
      await respondToActionable(id, action, data);
      setActionables((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: action === "dismiss" ? "dismissed" : "confirmed",
                resolvedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      setSelected((s) => {
        if (!s.has(id)) return s;
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      const updated = await listLifeActionables();
      setActionables(updated);
    },
    [],
  );

  const pending = useMemo(
    () => actionables.filter((a) => a.status === "pending"),
    [actionables],
  );
  const resolved = actionables.filter((a) => a.status !== "pending");

  const sortedPending = useMemo(
    () =>
      [...pending].sort((a, b) => {
        if (a.dueAt && b.dueAt)
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    [pending],
  );

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPendingSelected =
    sortedPending.length > 0 && selected.size === sortedPending.length;

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedPending.map((a) => a.id)));
    }
  };

  const skipSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setBulkBusy(true);
    try {
      await bulkDismissActionables({ ids });
      setActionables((prev) =>
        prev.map((a) =>
          ids.includes(a.id)
            ? {
                ...a,
                status: "dismissed",
                resolvedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  const skipAllPending = async () => {
    if (pending.length === 0) return;
    if (!confirm(`Dismiss all ${pending.length} pending actionable(s)?`)) return;
    setBulkBusy(true);
    try {
      await bulkDismissActionables({ allPending: true });
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <ListShell
      title="Actionables"
      subtitle={
        pending.length > 0
          ? `${pending.length} pending${resolved.length ? ` · ${resolved.length} resolved` : ""}`
          : "Things Kim wants you to confirm, decide, or acknowledge"
      }
      toolbar={
        <>
          <button
            onClick={load}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>

          {sortedPending.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              title={allPendingSelected ? "Clear selection" : "Select all pending"}
            >
              {allPendingSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {allPendingSelected ? "Clear" : "Select all"}
            </button>
          )}

          <div className="flex-1" />

          {pending.length > 0 && selected.size === 0 && (
            <button
              onClick={skipAllPending}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
              title="Dismiss every pending actionable"
            >
              <X className="h-3.5 w-3.5" />
              Skip all
            </button>
          )}
        </>
      }
    >
      <div>
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 border-b bg-accent/40 backdrop-blur">
            <span className="text-xs font-medium text-foreground">
              {selected.size} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              onClick={skipSelected}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive/90 text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              Skip {selected.size}
            </button>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button
              onClick={() => {
                setError(null);
                load();
              }}
              className="ml-auto text-xs underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="px-4 py-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && pending.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
            <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                All caught up
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                No items need your attention right now. Kim will surface new
                actionables here as suggestions come up.
              </p>
            </div>
          </div>
        )}

        {!loading && sortedPending.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            {sortedPending.map((a) => {
              const isSel = selected.has(a.id);
              return (
                <div key={a.id} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleSelect(a.id)}
                    className={cn(
                      "mt-4 h-[18px] w-[18px] shrink-0 rounded-[4px] border flex items-center justify-center transition-colors",
                      isSel
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border hover:border-primary/60",
                    )}
                    aria-pressed={isSel}
                    title={isSel ? "Deselect" : "Select"}
                  >
                    {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <ActionableCard actionable={a} onRespond={handleRespond} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && resolved.length > 0 && (
          <div className="border-t mt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showResolved ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Resolved ({resolved.length})</span>
            </button>
            {showResolved && (
              <div>
                {resolved.slice(0, 20).map((a) => (
                  <ActionableCard
                    key={a.id}
                    actionable={a}
                    onRespond={handleRespond}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ListShell>
  );
}
