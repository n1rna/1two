"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { listMarketplaceItems, type MarketplaceItem, type MarketplaceKind } from "@/lib/marketplace";
import { MarketplaceCard } from "./MarketplaceCard";

const KIND_TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "routine", label: "Routines" },
  { value: "gym_session", label: "Gym Sessions" },
  { value: "meal_plan", label: "Meal Plans" },
];

export function MarketplaceBrowser() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, k: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMarketplaceItems({
        q: q || undefined,
        kind: k || undefined,
        limit: 48,
      });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load marketplace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query, kind), query ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, kind, load]);

  return (
    <div className="flex flex-col gap-5">
      {/* Search + kind tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setKind(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                kind === tab.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">No results</p>
          {query && (
            <p className="text-xs text-muted-foreground/60">
              Try a different search term or clear the filter.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <MarketplaceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
