"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Archive,
  Bell,
  Brain,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  History,
  ListTodo,
  Repeat,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Utensils,
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
  type LifeActionable,
  type LifeAgentRun,
} from "@/lib/life";
import {
  BUCKET_ORDER,
  DOMAIN_ORDER,
  type ActionableDomain,
  type TimeBucket,
  bucketOf,
  domainOf,
  groupByBucket,
  matchesSearch,
} from "@/lib/actionables-group";
import { useTranslation } from "react-i18next";

const DOMAIN_ICON: Record<ActionableDomain, React.ElementType> = {
  calendar: CalendarIcon,
  task: ListTodo,
  routine: Repeat,
  meal: Utensils,
  memory: Brain,
  suggestion: Sparkles,
  other: Bell,
};

const BUCKET_ICON: Record<TimeBucket, React.ElementType> = {
  tomorrow: CalendarIcon,
  today: Clock,
  yesterday: History,
  older: Archive,
};

function bucketAccent(b: TimeBucket): string {
  if (b === "today") return "text-teal-500";
  if (b === "tomorrow") return "text-primary";
  return "text-muted-foreground";
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleInArray<T extends string>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function ActionablesPage() {
  const { t } = useTranslation("actionables");
  const router = useRouter();
  const searchParams = useSearchParams();

  const runId = searchParams.get("run");
  const [runFilter, setRunFilter] = useState<LifeAgentRun | null>(null);
  const [runFilterLoading, setRunFilterLoading] = useState(false);

  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [bucketFilter, setBucketFilter] = useState<TimeBucket[]>(
    () => parseCsv(searchParams.get("b")) as TimeBucket[],
  );
  const [domainFilter, setDomainFilter] = useState<ActionableDomain[]>(
    () => parseCsv(searchParams.get("d")) as ActionableDomain[],
  );

  // Mirror filter state into the URL so deep-links preserve what the user sees.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("q", search);
    else params.delete("q");
    if (bucketFilter.length) params.set("b", bucketFilter.join(","));
    else params.delete("b");
    if (domainFilter.length) params.set("d", domainFilter.join(","));
    else params.delete("d");
    const qs = params.toString();
    router.replace(qs ? `/actionables?${qs}` : "/actionables", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, bucketFilter, domainFilter]);

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
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    const qs = params.toString();
    router.replace(qs ? `/actionables?${qs}` : "/actionables", { scroll: false });
  }, [router, searchParams]);

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

  const filteredActionables = useMemo(() => {
    if (!runFilter) return actionables;
    const allowed = new Set(runFilter.producedActionableIds);
    return actionables.filter((a) => allowed.has(a.id));
  }, [actionables, runFilter]);

  const pending = useMemo(
    () => filteredActionables.filter((a) => a.status === "pending"),
    [filteredActionables],
  );
  const resolved = useMemo(
    () => filteredActionables.filter((a) => a.status !== "pending"),
    [filteredActionables],
  );

  // Sort once (earliest dueAt first, dueless at the end newest-first).
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

  // Apply search + domain + bucket in sequence. We also compute pool-level
  // counts for filter chip badges (counts reflect what the chip would show
  // if toggled, i.e. ignore its own axis).
  const afterSearch = useMemo(
    () => sortedPending.filter((a) => matchesSearch(a, search)),
    [sortedPending, search],
  );

  const bucketCounts = useMemo(() => {
    const pool =
      domainFilter.length === 0
        ? afterSearch
        : afterSearch.filter((a) => domainFilter.includes(domainOf(a)));
    const map: Record<TimeBucket, number> = {
      tomorrow: 0,
      today: 0,
      yesterday: 0,
      older: 0,
    };
    for (const a of pool) map[bucketOf(a)]++;
    return map;
  }, [afterSearch, domainFilter]);

  const domainCounts = useMemo(() => {
    const pool =
      bucketFilter.length === 0
        ? afterSearch
        : afterSearch.filter((a) => bucketFilter.includes(bucketOf(a)));
    const map: Record<ActionableDomain, number> = {
      calendar: 0,
      task: 0,
      routine: 0,
      meal: 0,
      memory: 0,
      suggestion: 0,
      other: 0,
    };
    for (const a of pool) map[domainOf(a)]++;
    return map;
  }, [afterSearch, bucketFilter]);

  const visiblePending = useMemo(() => {
    let out = afterSearch;
    if (domainFilter.length)
      out = out.filter((a) => domainFilter.includes(domainOf(a)));
    if (bucketFilter.length)
      out = out.filter((a) => bucketFilter.includes(bucketOf(a)));
    return out;
  }, [afterSearch, domainFilter, bucketFilter]);

  const grouped = useMemo(() => groupByBucket(visiblePending), [visiblePending]);

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected =
    visiblePending.length > 0 && selected.size === visiblePending.length;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visiblePending.map((a) => a.id)));
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

  const hasActiveFilters =
    !!search || bucketFilter.length > 0 || domainFilter.length > 0;
  const clearFilters = () => {
    setSearch("");
    setBucketFilter([]);
    setDomainFilter([]);
  };

  return (
    <ListShell
      title={t("page_title")}
      subtitle={
        pending.length > 0
          ? resolved.length
            ? t("subtitle_with_counts", {
                pendingCount: pending.length,
                resolvedCount: resolved.length,
              })
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

          {visiblePending.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              title={
                allVisibleSelected
                  ? t("clear_selection_title")
                  : t("select_all_pending_title")
              }
            >
              {allVisibleSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {allVisibleSelected
                ? t("clear_selection", { ns: "common" })
                : t("select_all", { ns: "common" })}
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
        {runId && (
          <div className="mx-4 sm:mx-8 mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2 text-xs">
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

        {/* Filters panel: search + bucket chips + domain chips. */}
        {pending.length > 0 && (
          <div className="mx-4 sm:mx-8 mt-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full h-8 pl-8 pr-8 rounded-md border border-border bg-background text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {BUCKET_ORDER.map((b) => {
                const count = bucketCounts[b];
                const active = bucketFilter.includes(b);
                const Icon = BUCKET_ICON[b];
                const accent = bucketAccent(b);
                if (count === 0 && !active) return null;
                return (
                  <button
                    key={b}
                    onClick={() =>
                      setBucketFilter((cur) => toggleInArray(cur, b))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                    )}
                  >
                    <Icon
                      className={cn("h-3 w-3", !active && accent)}
                    />
                    <span>{t(`bucket_${b}`)}</span>
                    <span
                      className={cn(
                        "text-[10px]",
                        active
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              <span className="mx-1 h-4 w-px bg-border" />
              {DOMAIN_ORDER.map((d) => {
                const count = domainCounts[d];
                const active = domainFilter.includes(d);
                const Icon = DOMAIN_ICON[d];
                if (count === 0 && !active) return null;
                return (
                  <button
                    key={d}
                    onClick={() =>
                      setDomainFilter((cur) => toggleInArray(cur, d))
                    }
                    className={cn(
                      "inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[11px] transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{t(`domain_${d}`)}</span>
                    <span
                      className={cn(
                        "text-[10px]",
                        active
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  {t("filter_clear_all")}
                </button>
              )}
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-8 py-2.5 border-b bg-accent/40 backdrop-blur mt-4">
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
          <div className="mx-4 sm:mx-8 mt-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
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
          <div className="px-4 sm:px-8 py-6 space-y-2">
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

        {!loading &&
          pending.length > 0 &&
          visiblePending.length === 0 &&
          !error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Filter className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("empty_filtered_title")}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {t("empty_filtered_body")}
                </p>
              </div>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <X className="h-3 w-3" />
                {t("filter_clear_all")}
              </button>
            </div>
          )}

        {!loading && grouped.length > 0 && (
          <div className="px-4 sm:px-8 py-6 space-y-6">
            {grouped.map((group) => {
              const Icon = BUCKET_ICON[group.bucket];
              const accent = bucketAccent(group.bucket);
              return (
                <section key={group.bucket}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", accent)} />
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                      {t(`bucket_${group.bucket}`)}
                    </h2>
                    <span className="text-[10px] text-muted-foreground/60">
                      · {group.items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((a) => {
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
                            title={
                              isSel ? t("deselect_title") : t("select_title")
                            }
                          >
                            {isSel && (
                              <Check className="h-3 w-3" strokeWidth={3} />
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
                </section>
              );
            })}
          </div>
        )}

        {!loading && resolved.length > 0 && (
          <div className="border-t mt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full flex items-center gap-2 px-4 sm:px-8 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
