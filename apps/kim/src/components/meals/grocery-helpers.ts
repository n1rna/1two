import type {
  GroceryCategory,
  GroceryItem,
  MealItem,
  SupplementItem,
} from "@/lib/health";

// ─── Categorization ──────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[GroceryCategory, string[]]> = [
  [
    "produce",
    [
      "apple", "banana", "berry", "blueberry", "strawberry", "raspberry",
      "lemon", "lime", "orange", "grape", "melon", "mango", "pineapple",
      "avocado", "tomato", "cucumber", "lettuce", "spinach", "kale",
      "arugula", "broccoli", "cauliflower", "carrot", "celery", "onion",
      "garlic", "shallot", "pepper", "bell pepper", "chili", "potato",
      "sweet potato", "zucchini", "squash", "eggplant", "mushroom",
      "asparagus", "green bean", "cabbage", "cilantro", "parsley", "basil",
      "mint", "ginger", "scallion", "leek",
    ],
  ],
  [
    "dairy",
    [
      "milk", "yogurt", "greek yogurt", "cheese", "cheddar", "mozzarella",
      "parmesan", "feta", "cottage cheese", "ricotta", "butter", "cream",
      "sour cream", "kefir",
    ],
  ],
  [
    "proteins",
    [
      "chicken", "beef", "pork", "turkey", "lamb", "duck", "bacon", "ham",
      "sausage", "salmon", "tuna", "cod", "shrimp", "prawn", "fish",
      "tilapia", "trout", "egg", "tofu", "tempeh", "seitan", "edamame",
      "lentil", "chickpea", "black bean", "kidney bean", "bean",
    ],
  ],
  [
    "grains",
    [
      "rice", "brown rice", "quinoa", "oat", "oats", "oatmeal", "bread",
      "tortilla", "pasta", "spaghetti", "penne", "noodle", "couscous",
      "barley", "bulgur", "cereal", "granola", "bagel", "wrap",
    ],
  ],
  [
    "pantry",
    [
      "oil", "olive oil", "coconut oil", "vinegar", "soy sauce", "sauce",
      "salt", "pepper powder", "spice", "cumin", "paprika", "cinnamon",
      "sugar", "honey", "maple", "syrup", "flour", "baking", "vanilla",
      "almond", "peanut", "cashew", "walnut", "pecan", "nut", "seed",
      "chia", "flaxseed", "peanut butter", "almond butter", "stock",
      "broth",
    ],
  ],
  [
    "frozen",
    ["frozen"],
  ],
];

/** Rough keyword-based category guess for a grocery item name. */
export function guessCategory(name: string): GroceryCategory {
  const s = name.toLowerCase().trim();
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (s.includes(kw)) return cat;
    }
  }
  return "other";
}

// ─── Quantity parsing ────────────────────────────────────────────────────────

/**
 * Parses a free-form quantity string like "200g", "2 cups", "1 tbsp", "3",
 * "half an avocado" into { amount, unit }. Returns { amount: 0, unit: "" } for
 * unparseable inputs so auto-aggregation degrades gracefully.
 */
export function parseQuantity(q?: string): { amount: number; unit: string } {
  if (!q) return { amount: 0, unit: "" };
  const s = q.trim().toLowerCase();
  if (!s) return { amount: 0, unit: "" };
  const match = s.match(/^([\d.,/]+)\s*([a-zA-Z]+)?/);
  if (!match) return { amount: 0, unit: s };
  let numStr = match[1].replace(",", ".");
  let amount = 0;
  if (numStr.includes("/")) {
    const [n, d] = numStr.split("/").map(Number);
    amount = d ? n / d : 0;
  } else {
    amount = parseFloat(numStr);
  }
  if (!isFinite(amount)) amount = 0;
  const unit = (match[2] ?? "").toLowerCase();
  return { amount, unit };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

interface AggKey {
  name: string;
  unit: string;
}

function keyOf(k: AggKey): string {
  return `${k.name}\u0000${k.unit}`;
}

/**
 * Aggregate ingredients across all meals and supplements into a grocery list.
 * - Same (name, unit) pairs are summed.
 * - Supplement totals are computed per-day × plan days when possible.
 * - Preserves manual items and check-off state by matching against `previous`.
 */
export function aggregateGrocery(
  meals: MealItem[],
  supplements: SupplementItem[],
  planDays: number,
  previous: GroceryItem[] | undefined,
): GroceryItem[] {
  const agg = new Map<string, { item: GroceryItem }>();

  // Meals → ingredients
  for (const meal of meals) {
    const ingredients = meal.ingredients ?? [];
    for (const ing of ingredients) {
      const { amount, unit } = parseQuantity(ing.quantity);
      const name = ing.name.trim().toLowerCase();
      if (!name) continue;
      const k = keyOf({ name, unit });
      const existing = agg.get(k);
      if (existing) {
        existing.item.quantity += amount;
      } else {
        agg.set(k, {
          item: {
            name,
            quantity: amount,
            unit,
            category: guessCategory(name),
            checked: false,
            source: "auto",
          },
        });
      }
    }
  }

  // Supplements → one row per supplement, category "supplements". Total count
  // is best-effort: if the supplement has no `day` it runs every day; else 1×.
  for (const s of supplements) {
    const name = `${s.name.trim().toLowerCase()} ${s.dose}${s.unit}`.trim();
    const perDay = s.day && s.day.toLowerCase() !== "any" ? 1 : Math.max(planDays, 1);
    const k = keyOf({ name, unit: s.form });
    const existing = agg.get(k);
    if (existing) {
      existing.item.quantity += perDay;
    } else {
      agg.set(k, {
        item: {
          name,
          quantity: perDay,
          unit: s.form,
          category: "supplements",
          checked: false,
          source: "auto",
          note: s.timing,
        },
      });
    }
  }

  // Merge in previous state: preserve check-off + manual items, keep note.
  const prevByKey = new Map<string, GroceryItem>();
  for (const p of previous ?? []) {
    prevByKey.set(keyOf({ name: p.name, unit: p.unit }), p);
  }

  for (const [k, { item }] of agg.entries()) {
    const prev = prevByKey.get(k);
    if (prev) {
      item.checked = prev.checked;
      if (!item.note && prev.note) item.note = prev.note;
    }
  }

  // Keep manual items that weren't replaced.
  for (const [k, prev] of prevByKey.entries()) {
    if (prev.source === "manual" && !agg.has(k)) {
      agg.set(k, { item: prev });
    }
  }

  // Stable sort: category first (predictable order), then name.
  const CATEGORY_ORDER: GroceryCategory[] = [
    "produce",
    "proteins",
    "dairy",
    "grains",
    "pantry",
    "frozen",
    "supplements",
    "other",
  ];
  const catRank = (c: GroceryCategory) => CATEGORY_ORDER.indexOf(c);

  return Array.from(agg.values())
    .map((v) => v.item)
    .sort((a, b) => {
      const byCat = catRank(a.category) - catRank(b.category);
      if (byCat !== 0) return byCat;
      return a.name.localeCompare(b.name);
    });
}

// ─── Export ──────────────────────────────────────────────────────────────────

/** Format the grocery list as a checkable markdown shopping list. */
export function formatAsMarkdown(items: GroceryItem[], title = "Grocery list"): string {
  const byCat = new Map<GroceryCategory, GroceryItem[]>();
  for (const item of items) {
    const list = byCat.get(item.category) ?? [];
    list.push(item);
    byCat.set(item.category, list);
  }
  const CATEGORY_ORDER: GroceryCategory[] = [
    "produce", "proteins", "dairy", "grains", "pantry", "frozen", "supplements", "other",
  ];
  const CATEGORY_LABEL: Record<GroceryCategory, string> = {
    produce: "Produce",
    proteins: "Proteins",
    dairy: "Dairy",
    grains: "Grains",
    pantry: "Pantry",
    frozen: "Frozen",
    supplements: "Supplements",
    other: "Other",
  };

  const lines: string[] = [`# ${title}`, ""];
  for (const cat of CATEGORY_ORDER) {
    const list = byCat.get(cat);
    if (!list || list.length === 0) continue;
    lines.push(`## ${CATEGORY_LABEL[cat]}`);
    for (const item of list) {
      const qty = item.quantity > 0
        ? `${formatNumber(item.quantity)}${item.unit ? ` ${item.unit}` : ""}`
        : "";
      const prefix = item.checked ? "- [x]" : "- [ ]";
      const rest = [item.name, qty && `— ${qty}`, item.note && `(${item.note})`]
        .filter(Boolean)
        .join(" ");
      lines.push(`${prefix} ${rest}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatNumber(n: number): string {
  if (!isFinite(n)) return "";
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n));
  return n.toFixed(1);
}

export const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  produce: "Produce",
  proteins: "Proteins",
  dairy: "Dairy",
  grains: "Grains",
  pantry: "Pantry",
  frozen: "Frozen",
  supplements: "Supplements",
  other: "Other",
};
