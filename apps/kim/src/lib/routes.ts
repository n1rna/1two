/**
 * Centralized route registry for the kim app.
 *
 * Use this module for every `href` and `router.push` instead of hand-writing
 * URL strings. Static routes are plain constants; parameterized routes are
 * functions that take the dynamic segments and return the full path.
 *
 * When a new route is added or moved, update it here and every consumer
 * stays in sync.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

type QueryValue = string | number | boolean | null | undefined;
type QueryInput = Record<string, QueryValue>;

function qs(query?: QueryInput): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const routes = {
  // Public
  home: "/" as const,
  login: (opts?: { redirect?: string }) =>
    opts?.redirect
      ? `/login?redirect=${encodeURIComponent(opts.redirect)}`
      : "/login",

  // Authenticated app
  today: "/today" as const,
  actionables: "/actionables" as const,
  calendar: "/calendar" as const,
  memories: "/memories" as const,
  channels: "/channels" as const,
  chat: "/chat" as const,
  chatSession: (id: string) => `/chat/${id}`,
  settings: "/settings" as const,
  onboarding: "/onboarding" as const,

  // Health
  health: "/health" as const,
  healthWeight: "/health/weight" as const,
  healthProfile: "/health/profile" as const,

  // Routines
  routines: "/routines" as const,
  routineNew: "/routines/create" as const,
  routine: (id: string) => `/routines/${id}`,

  // Meal plans
  meals: "/meals" as const,
  mealNew: "/meals/create" as const,
  meal: (id: string) => `/meals/${id}`,

  // Gym sessions
  sessions: "/sessions" as const,
  sessionNew: "/sessions/create" as const,
  session: (id: string) => `/sessions/${id}`,

  // Travel
  travel: "/travel" as const,
  trip: (id: string) => `/travel/${id}`,

  // Marketplace
  marketplace: (opts?: { kind?: "routine" | "gym_session" | "meal_plan" }) =>
    `/marketplace${qs(opts ? { kind: opts.kind } : undefined)}`,
  marketplaceMine: "/marketplace/mine" as const,
  marketplaceItem: (slug: string) => `/m/${slug}`,
} as const;

/**
 * Given a marketplace kind and the forked source id, return the route that
 * opens the forked instance in the user's own library. Used by the fork flow
 * in `PublicMarketplacePage`.
 */
export function marketplaceForkDestination(
  kind: "routine" | "gym_session" | "meal_plan",
  sourceId: string,
): string {
  if (kind === "routine") return routes.routine(sourceId);
  if (kind === "gym_session") return routes.session(sourceId);
  return routes.meal(sourceId);
}
