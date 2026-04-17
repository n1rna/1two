"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ShoppingCart,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  GroceryCategory,
  GroceryItem,
  HealthMealPlan,
  MealItem,
  SupplementItem,
} from "@/lib/health";
import {
  aggregateGrocery,
  CATEGORY_LABEL,
  formatAsMarkdown,
  guessCategory,
} from "./grocery-helpers";

interface Props {
  plan: HealthMealPlan;
  meals: MealItem[];
  supplements: SupplementItem[];
  planDays: number;
  /** Persist the updated grocery list to the backend. */
  onSave: (items: GroceryItem[], generatedAt?: string) => Promise<void>;
}

export function GroceryListCard({
  plan,
  meals,
  supplements,
  planDays,
  onSave,
}: Props) {
  const initial = plan.content?.grocery?.items ?? [];
  const generatedAt = plan.content?.grocery?.generatedAt;
  const [items, setItems] = useState<GroceryItem[]>(initial);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingName, setAddingName] = useState("");

  // Group by category for display.
  const grouped = useMemo(() => {
    const m = new Map<GroceryCategory, GroceryItem[]>();
    for (const it of items) {
      const list = m.get(it.category) ?? [];
      list.push(it);
      m.set(it.category, list);
    }
    return m;
  }, [items]);

  const persist = useCallback(
    async (next: GroceryItem[], newGeneratedAt?: string) => {
      setItems(next);
      try {
        await onSave(next, newGeneratedAt ?? generatedAt);
      } catch (e) {
        console.error("grocery: save failed", e);
      }
    },
    [onSave, generatedAt],
  );

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const next = aggregateGrocery(meals, supplements, planDays, items);
      await persist(next, new Date().toISOString());
    } finally {
      setRegenerating(false);
    }
  }, [meals, supplements, planDays, items, persist]);

  const toggleChecked = useCallback(
    (name: string, unit: string) => {
      const next = items.map((it) =>
        it.name === name && it.unit === unit ? { ...it, checked: !it.checked } : it,
      );
      void persist(next);
    },
    [items, persist],
  );

  const removeItem = useCallback(
    (name: string, unit: string) => {
      const next = items.filter(
        (it) => !(it.name === name && it.unit === unit),
      );
      void persist(next);
    },
    [items, persist],
  );

  const addManualItem = useCallback(() => {
    const raw = addingName.trim();
    if (!raw) return;
    const name = raw.toLowerCase();
    if (items.some((it) => it.name === name && it.unit === "")) {
      setAddingName("");
      return;
    }
    const next: GroceryItem[] = [
      ...items,
      {
        name,
        quantity: 0,
        unit: "",
        category: guessCategory(name),
        checked: false,
        source: "manual",
      },
    ];
    void persist(next);
    setAddingName("");
  }, [addingName, items, persist]);

  const copyAsMarkdown = useCallback(async () => {
    try {
      const md = formatAsMarkdown(items, `${plan.title} — grocery list`);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [items, plan.title]);

  const checkedCount = items.filter((it) => it.checked).length;
  const hasIngredients = meals.some(
    (m) => (m.ingredients ?? []).length > 0,
  );

  // Render
  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-semibold">Grocery list</h2>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {checkedCount}/{items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={regenerate}
            disabled={regenerating}
            title={
              hasIngredients
                ? "Regenerate from current meals + supplements (preserves manual items & check-off)"
                : "Add ingredients to meals first (via Kim) — then regenerate."
            }
          >
            <RefreshCw
              className={"h-3 w-3 " + (regenerating ? "animate-spin" : "")}
            />
            {items.length === 0 ? "Generate" : "Regenerate"}
          </Button>
          {items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={copyAsMarkdown}
              title="Copy list as markdown"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {hasIngredients ? (
            <>
              Click <span className="font-medium text-foreground">Generate</span>{" "}
              to build a grocery list from the meal plan.
            </>
          ) : (
            <>
              Meals don't have ingredient lists yet. Ask Kim to fill in
              ingredients for your meals, then come back here to generate the
              list.
            </>
          )}
        </div>
      ) : (
        <div className="divide-y">
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <div key={cat} className="py-2">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABEL[cat]} · {list.length}
              </div>
              <ul>
                {list.map((it) => (
                  <GroceryRow
                    key={`${it.name}\u0000${it.unit}`}
                    item={it}
                    onToggle={() => toggleChecked(it.name, it.unit)}
                    onRemove={() => removeItem(it.name, it.unit)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Manual add */}
      <div className="px-4 py-3 border-t bg-muted/10">
        <div className="flex gap-2">
          <input
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManualItem();
              }
            }}
            placeholder="Add item (e.g. coffee, paper towels)"
            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
          />
          <Button size="sm" onClick={addManualItem} disabled={!addingName.trim()}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
        {generatedAt && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Auto items last generated{" "}
            {new Date(generatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
    </section>
  );
}

function GroceryRow({
  item,
  onToggle,
  onRemove,
}: {
  item: GroceryItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 px-4 py-2 hover:bg-accent/30 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={item.checked}
        className={
          "shrink-0 h-4 w-4 rounded-sm border flex items-center justify-center transition-colors " +
          (item.checked
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border hover:border-foreground/40")
        }
      >
        {item.checked && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={
            "text-sm flex items-center gap-2 flex-wrap " +
            (item.checked
              ? "text-muted-foreground line-through"
              : "text-foreground")
          }
        >
          <span className="capitalize">{item.name}</span>
          {item.source === "manual" && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 bg-muted/50 px-1 py-0.5 rounded">
              manual
            </span>
          )}
        </div>
        {item.note && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.note}
          </div>
        )}
      </div>
      {item.quantity > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatQty(item.quantity)}
          {item.unit && <span className="ml-0.5">{item.unit}</span>}
        </span>
      )}
      <button
        onClick={onRemove}
        aria-label="Remove item"
        className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}

function formatQty(n: number): string {
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n));
  return n.toFixed(1);
}
