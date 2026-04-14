# Architecture

How the repo is laid out and how the pieces talk to each other.

## Monorepo layout

Bun workspace rooted at the repo. Two Next.js apps, one Go API, shared
TypeScript packages.

```
1tt/
├── apps/
│   ├── web/            # 1tt.dev — developer tools platform
│   └── kim/            # kim1.ai — personal life agent
├── packages/
│   └── api-client/     # Shared Go-API client types + fetch helpers
│                       # (life, health, marketplace, auth-schema)
├── api/                # Go backend (single binary, NOT a workspace pkg)
├── workers/
│   ├── api-container/  # Cloudflare Container wrapper around the Go API
│   └── email-inbound/  # Email webhook worker
├── cli/                # 1tt CLI (Go) — standalone, released separately
├── scripts/            # One-off scripts (sitemap generator, etc.)
├── docs/               # You are here
└── justfile            # Task runner — every common command lives here
```

Workspaces are declared in the root `package.json`:

```json
"workspaces": ["apps/*", "packages/*"]
```

`api/` is deliberately **not** a workspace package — it's a Go module with
its own build story. Same for `cli/`.

## Apps

### `apps/web` — 1tt.dev

- Next.js 16 (App Router, webpack)
- The original developer-tools platform. Dozens of client-side tools under
  `/tools/*`, a marketplace (`/shop`, `/m/...` moved to kim), docs, guides.
- Authenticated features: account billing, hosted DBs, cloud sync.
- Deployed to Cloudflare Workers via OpenNext — worker name `onetruetool-web`,
  custom domain `1tt.dev`.

### `apps/kim` — kim1.ai

- Next.js 16 (App Router, webpack)
- A personal life agent: routines, actionables, calendar, meal plans, gym
  sessions, health tracking, chat with an LLM agent, a public marketplace
  for forking routines/plans.
- Authenticated behind `AuthGate`. The root layout is bare; the authenticated
  shell (header + nav + agent drawer) lives under an `(app)` route group so
  `/login` and `/m/[slug]` render clean.
- Deployed to Cloudflare Workers via OpenNext — worker name `kim1`, custom
  domains `kim1.ai` + `www.kim1.ai`.

Both apps are Next.js, both use OpenNext, both import from the same
`@1tt/api-client` package, and both call the same Go API.

## Packages

### `packages/api-client`

Thin TypeScript package exposing typed wrappers around the Go API. Four
entry points:

```
@1tt/api-client/life          → life.ts
@1tt/api-client/health        → health.ts
@1tt/api-client/marketplace   → marketplace.ts
@1tt/api-client/auth-schema   → auth-schema.ts  (Drizzle schema for better-auth)
```

Each file is self-contained — no `@/` project aliases, no framework-specific
imports. They use `fetch("/api/proxy/...")` (a same-origin proxy mounted in
each Next app) so the shared code doesn't need to know which app it's
running inside.

Both apps also have tsconfig path aliases mapping `@/lib/life` (etc.) to the
package source, so legacy call sites didn't need a mass rewrite when the
files moved:

```jsonc
// apps/web/tsconfig.json and apps/kim/tsconfig.json
"paths": {
  "@/lib/life":         ["../../packages/api-client/src/life"],
  "@/lib/health":       ["../../packages/api-client/src/health"],
  "@/lib/marketplace":  ["../../packages/api-client/src/marketplace"],
  "@/lib/auth-schema":  ["../../packages/api-client/src/auth-schema"],
  "@1tt/api-client/*":  ["../../packages/api-client/src/*"],
  "@/*":                ["./src/*"]
}
```

Both apps add `transpilePackages: ["@1tt/api-client"]` in `next.config.ts`
so Next compiles the package from source.

## Go API

Single binary at `api/cmd/server`. Exposes `/api/v1/...` over HTTP.

- **Locally**: runs on `:8090`, apps hit it directly via `API_BACKEND_URL`.
- **In prod**: wrapped by `workers/api-container` — a Cloudflare Container
  (Docker on Durable Objects) named `onetruetool-api`. The web and kim
  workers reach it through **service bindings**, not the public internet.

The Go API is the only thing with direct DB access. Both Next apps proxy
through `/api/proxy/[...path]/route.ts`, which forwards the better-auth
session token as `x-session-token` so the Go API can resolve the user.

## Service topology (prod)

```
                         ┌─────────────────┐
                         │  Neon Postgres  │
                         │  (shared DB)    │
                         └────────▲────────┘
                                  │
                                  │ SQL
                                  │
                         ┌────────┴────────┐
                         │  onetruetool-api │  Cloudflare Container
                         │  (Go binary)    │
                         └────▲───────▲────┘
                              │       │
              service binding │       │ service binding
                              │       │
              ┌───────────────┘       └────────────────┐
              │                                        │
     ┌────────┴─────────┐                    ┌─────────┴────────┐
     │  onetruetool-web │                    │      kim1        │
     │   (1tt.dev)      │                    │    (kim1.ai)     │
     └────────┬─────────┘                    └────────┬─────────┘
              │                                        │
              │  HTTPS                                 │  HTTPS
              ▼                                        ▼
        ┌──────────┐                              ┌──────────┐
        │ visitors │                              │ visitors │
        └──────────┘                              └──────────┘
```

Both Next workers have `services: [{ binding: "API_BACKEND", service:
"onetruetool-api" }]` in their `wrangler.jsonc`, so `apiFetch()` in
`apps/*/src/lib/api-fetch.ts` routes to the internal binding when running
on Cloudflare and falls back to `API_BACKEND_URL` locally.

## KV and caching

Each Next worker has its own KV namespace for OpenNext's incremental cache:

- `onetruetool-web` → `NEXT_CACHE_WORKERS_KV` (id: `be5941944a474baa9efc3f80305ed6b5`)
- `kim1`            → `NEXT_CACHE_WORKERS_KV` (id: `e26fc491d227449892659dcdcb5075fa`, title `kim1-cache`)

The binding name is the same in both workers; the namespace IDs differ so
caches don't collide.

## What's shared, what isn't

| Thing | Shared? |
|---|---|
| Postgres database | ✅ yes (one Neon DB, one `users` table) |
| Go API | ✅ yes (both apps hit the same binary) |
| `@1tt/api-client` package | ✅ yes |
| `better-auth` instance | ❌ each app has its own |
| OAuth apps (GitHub / Google) | ❌ each app has its own client ID/secret |
| Session cookies | ❌ scoped per domain (`.1tt.dev` vs `.kim1.ai`) |
| Cloudflare Worker | ❌ one per app |
| KV namespace | ❌ one per app |
| UI components | ❌ each app has its own copy (no shared UI package yet) |

See [kim-and-1tt.md](./kim-and-1tt.md) for why the split is this shape, and
[auth.md](./auth.md) for how two auth instances share a user identity.
