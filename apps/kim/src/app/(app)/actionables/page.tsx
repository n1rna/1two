"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListShell } from "@/components/list-shell";
import { ActionableCard } from "@/components/actionables/actionable-card";
import {
  bulkDismissActionables,
  getLifeAgentRun,
  listLifeActionables,
  respondToActionable,
  type JourneyTrigger,
  type LifeActionable,
  type LifeAgentRun,
} from "@/lib/life";
import { useTranslation } from "react-i18next";

// Triggers we explicitly know how to label. Unknown triggers fall back to the
// raw string so the group still renders rather than silently disappearing.
const KNOWN_JOURNEY_TRIGGERS: JourneyTrigger[] = [
  "gym_session_updated",
  "meal_plan_updated",
  "routine_updated",
];

function isJourneyActionable(a: LifeActionable): boolean {
  return a.source?.kind === "journey" && typeof a.source.trigger === "string";
}

function groupPendingByJourney(pending: LifeActionable[]): {
  journeyGroups: { trigger: string; items: LifeActionable[] }[];
  other: LifeActionable[];
} {
  const byTrigger = new Map<string, LifeActionable[]>();
  const other: LifeActionable[] = [];
  for (const a of pending) {
    if (isJourneyActionable(a)) {
      const trig = a.source!.trigger as string;
      const bucket = byTrigger.get(trig);
      if (bucket) bucket.push(a);
      else byTrigger.set(trig, [a]);
    } else {
      other.push(a);
    }
  }
  // Order known triggers first (stable ordering), unknown triggers last.
  const ordered: { trigger: string; items: LifeActionable[] }[] = [];
  for (const t of KNOWN_JOURNEY_TRIGGERS) {
    const items = byTrigger.get(t);
    if (items) {
      ordered.push({ trigger: t, items });
      byTrigger.delete(t);
    }
  }
  for (const [t, items] of byTrigger) {
    ordered.push({ trigger: t, items });
  }
  return { journeyGroups: ordered, other };
}

export default function ActionablesPage() {
  const { t } = useTranslation("actionables");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-link filter: when ?run=<id> is present the page only shows
  // actionables this run produced. Populated from agent-runs detail.
  const runId = searchParams.get("run");
  const [runFilter, setRunFilter] = useState<LifeAgentRun | null>(null);
  const [runFilterLoading, setRunFilterLoading] = useState(false);
  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Journey super-group collapsible state. Collapsed by default when > 5 items.
  const [journeyCollapsed, setJourneyCollapsed] = useState(false);

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

  // Hydrate the run filter whenever the ?run query param changes. The
  // endpoint returns the full run payload, and we only need its produced
  // actionable ids to filter client-side.
  useEffect(() => {
    let cancelled = false;
    if (!runId) {
      setRunFilter(null);
      return;
    }
    setRunFilterLoading(true);
    getLifeAgentRun(runId)
      .then((r) => {
        if (!cancelled) setRunFilter(r);
      })
      .catch(() => {
        if (!cancelled) setRunFilter(null);
      })
      .finally(() => {
        if (!cancelled) setRunFilterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const clearRunFilter = useCallback(() => {
    router.replace("/actionables");
  }, [router]);

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

  // When a run filter is active, restrict the dataset to actionables the
  // run produced. Works across pending + resolved so revisiting a completed
  // run still shows the items the user has already actioned.
  const filteredActionables = useMemo(() => {
    if (!runFilter) return actionables;
    const allowed = new Set(runFilter.producedActionableIds);
    return actionables.filter((a) => allowed.has(a.id));
  }, [actionables, runFilter]);

  const pending = useMemo(
    () => filteredActionables.filter((a) => a.status === "pending"),
    [filteredActionables],
  );
  const resolved = filteredActionables.filter((a) => a.status !== "pending");

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

  // Split the sorted list into a Journey super-group (by trigger) and a flat
  // fallback list. Sort order within each group is preserved from sortedPending.
  const { journeyGroups, other: otherPending } = useMemo(
    () => groupPendingByJourney(sortedPending),
    [sortedPending],
  );

  const journeyCount = useMemo(
    () => journeyGroups.reduce((n, g) => n + g.items.length, 0),
    [journeyGroups],
  );

  // Auto-collapse when the journey section is large so the flat list stays
  // visible. User can toggle freely after that.
  useEffect(() => {
    setJourneyCollapsed(journeyCount > 5);
  }, [journeyCount]);

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
    if (!confirm(t("confirm_skip_all", { count: pending.length }))) return;
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
      title={t("page_title")}
      subtitle={
        pending.length > 0
          ? resolved.length
            ? t("subtitle_with_counts", { pendingCount: pending.length, resolvedCount: resolved.length })
            : t("subtitle_with_pending", { pendingCount: pending.length })
          : t("subtitle_empty")
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
              title={allPendingSelected ? t("clear_selection_title") : t("select_all_pending_title")}
            >
              {allPendingSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {allPendingSelected ? t("clear_selection", { ns: "common" }) : t("select_all", { ns: "common" })}
            </button>
          )}

          <div className="flex-1" />

          {pending.length > 0 && selected.size === 0 && (
            <button
              onClick={skipAllPending}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
              title={t("skip_all_title")}
            >
              <X className="h-3.5 w-3.5" />
              {t("skip_all")}
            </button>
          )}
        </>
      }
    >
      <div>
        {/* Run filter banner — surfaced when the page was opened from the
            Kim drawer's "View N actionables" deep link. */}
        {runId && (
          <div className="mx-8 mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {runFilterLoading ? (
                <span className="text-muted-foreground">
                  {t("run_filter_loading")}
                </span>
              ) : runFilter ? (
                <span className="text-foreground">
                  {t("run_filter_banner", {
                    count: runFilter.producedActionableIds.length,
                    source:
                      runFilter.subtitle || runFilter.title || runFilter.kind,
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("run_filter_missing")}
                </span>
              )}
            </div>
            <button
              onClick={clearRunFilter}
              className="shrink-0 inline-flex items-center gap-1 text-primary hover:underline"
            >
              <X className="h-3 w-3" />
              {t("run_filter_clear")}
            </button>
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 px-8 py-2.5 border-b bg-accent/40 backdrop-blur">
            <span className="text-xs font-medium text-foreground">
              {t("selected_count", { count: selected.size, ns: "common" })}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("clear", { ns: "common" })}
            </button>
            <button
              onClick={skipSelected}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive/90 text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              {t("skip_count", { count: selected.size, ns: "common" })}
            </button>
          </div>
        )}

        {error && (
          <div className="mx-8 mt-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button
              onClick={() => {
                setError(null);
                load();
              }}
              className="ml-auto text-xs underline"
            >
              {t("retry", { ns: "common" })}
            </button>
          </div>
        )}

        {loading && (
          <div className="px-8 py-6 space-y-2">
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
                {t("all_caught_up_title")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {t("all_caught_up_body")}
              </p>
            </div>
          </div>
        )}

        {!loading && sortedPending.length > 0 && (
          <div className="px-8 py-6 space-y-6">
            {/* Journey super-group: cascading changes from recent updates. */}
            {journeyGroups.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.03]">
                <button
                  onClick={() => setJourneyCollapsed((c) => !c)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-primary/5 rounded-t-lg transition-colors"
                >
                  {journeyCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {t("journey_group_title")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {journeyCount}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[11px] text-muted-foreground/70 truncate">
                    {t("journey_group_subtitle")}
                  </span>
                </button>
                {!journeyCollapsed && (
                  <div className="px-3 pb-3 pt-1 space-y-4">
                    {journeyGroups.map((group) => {
                      const label =
                        KNOWN_JOURNEY_TRIGGERS.includes(
                          group.trigger as JourneyTrigger,
                        )
                          ? t(`journey_trigger_${group.trigger}`)
                          : group.trigger;
                      return (
                        <div key={group.trigger}>
                          <div className="flex items-center gap-2 px-1 mb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {label}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              · {group.items.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((a) => {
                              const isSel = selected.has(a.id);
                              return (
                                <div
                                  key={a.id}
                                  className="flex items-start gap-2"
                                >
                                  <button
                                    onClick={() => toggleSelect(a.id)}
                                    className={cn(
                                      "mt-4 h-[18px] w-[18px] shrink-0 rounded-[4px] border flex items-center justify-center transition-colors",
                                      isSel
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "bg-background border-border hover:border-primary/60",
                                    )}
                                    aria-pressed={isSel}
                                    title={
                                      isSel
                                        ? t("deselect_title")
                                        : t("select_title")
                                    }
                                  >
                                    {isSel && (
                                      <Check
                                        className="h-3 w-3"
                                        strokeWidth={3}
                                      />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <ActionableCard
                                      actionable={a}
                                      onRespond={handleRespond}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Flat list of non-journey pending actionables. */}
            {otherPending.length > 0 && (
              <div className="space-y-2">
                {otherPending.map((a) => {
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
                        title={isSel ? t("deselect_title") : t("select_title")}
                      >
                        {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <ActionableCard
                          actionable={a}
                          onRespond={handleRespond}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && resolved.length > 0 && (
          <div className="border-t mt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full flex items-center gap-2 px-8 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showResolved ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>{t("resolved_section", { count: resolved.length })}</span>
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
