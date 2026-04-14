# Migration history: kim1.ai monorepo split

> **Frozen reference.** This doc tracks the one-time restructure that moved
> kim out of 1tt.dev and into its own app. All 5 stages are complete — kim
> now runs on kim1.ai with its own worker, auth, and OAuth apps. Kept as a
> historical record of the decisions and the ordering. For current-state
> info see [architecture.md](./architecture.md) and [kim-and-1tt.md](./kim-and-1tt.md).

Living tracker for the monorepo restructure that split the kim life tool out
of `1tt.dev` into its own deployment at `kim1.ai`. Each stage was resumable.

## Target layout

```
1tt-monorepo/
├── apps/
│   ├── web/      ← 1tt.dev Next.js app
│   ├── kim/      ← kim1.ai Next.js app
│   └── api/      ← Go backend (unchanged)
└── packages/
    ├── ui/           ← shared UI primitives
    └── api-client/   ← shared API client + types
```

The Go API at `api/` stays a single instance at `api.1tt.dev` and both
apps call it via `/api/proxy/*` route handlers. Both apps share the same
Postgres database, including the better-auth `users` table, so a sign-in
with the same email produces a single user record referenced from both
sides (each side has its own OAuth app entries in `accounts`).

---

## Stage 1 — Workspace conversion

**Status:** ✅ complete
**Owner:** claude

Done:

- Root `package.json` is now a bun workspace (`apps/*`, `packages/*`).
- All Next.js-specific files moved to `apps/web/` via `git mv`:
  `src/`, `public/`, `next.config.ts`, `open-next.config.ts`, `postcss.config.mjs`,
  `eslint.config.mjs`, `components.json`, `next-env.d.ts`, `tsconfig.json`,
  `vitest.config.ts`, `playwright.config.ts`, `wrangler.jsonc`, `worker-entry.ts`,
  `kubb.config.ts`, `.env.web.*`, `.ee.web`.
- `apps/web/package.json` has all Next.js deps + added missing `@lezer/highlight`
  (previously a phantom dependency).
- Root `package.json` scripts delegate: `dev`, `dev:web`, `dev:api`, `cf:deploy:web`.
- `.ee.web` is now relative to `apps/web` so the old paths still resolve.
- `bun install` clean (2677 packages).
- `cd apps/web && bunx tsc --noEmit` clean.
- `cd api && go build ./...` clean.

Later caveats:

- The `kim.1tt.dev` host-based middleware in `apps/web/src/middleware.ts` still
  exists — removed in Stage 4.
- `apps/web/src/components/life/*` still exists — removed in Stage 4.

Goals:

- Create root `package.json` as a bun workspace (`workspaces: ["apps/*", "packages/*"]`).
- Move all Next.js-specific root files into `apps/web/`:
  - `src/`, `public/`, `next.config.ts`, `open-next.config.ts`
  - `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `next-env.d.ts`
  - `wrangler.jsonc`, `worker-entry.ts`
  - `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`
  - `.env.web.*`, `.ee.web`
  - `kubb.config.ts`
- Keep at root:
  - `api/` (Go backend — stays put, has its own build system)
  - `.github/`, `.gitignore`, `justfile`, `README.md`, `AGENTS.md`
  - `workers/` (infrastructure), `scripts/`, `cli/`, `extension/`, `e2e/`
  - `.env.api.*`, `.ee.api`
  - `bun.lock`, `CLAUDE.md`, `STAGES.md` (this file)
- Root `package.json` has top-level scripts that delegate into workspaces:
  - `bun run dev:web` → runs web app
  - `bun run dev:api` → runs Go backend
  - `bun run dev:kim` → runs kim app (added in Stage 3)
- Delete generated dirs before moving: `.next/`, `.wrangler/`, `tsconfig.tsbuildinfo`.
- Verify `bun install` completes and `bun run dev:web` serves the main site.
- Verify `go build ./...` still works for the API.

Notes:

- `apps/web/wrangler.jsonc` will need its build output paths updated (OpenNext
  writes into `apps/web/.open-next/`).
- `.env.web.development` path is now `apps/web/.env.web.development` — the
  `.ee.web` file's relative paths need updating accordingly.

---

## Stage 2 — Extract shared packages

**Status:** ✅ complete (scope reduced)
**Owner:** claude

Done:

- Created `packages/api-client/` with name `@1tt/api-client` and an exports map:
  - `./life` → `src/life.ts`
  - `./health` → `src/health.ts`
  - `./marketplace` → `src/marketplace.ts`
  - `./auth-schema` → `src/auth-schema.ts`
- Physically moved `apps/web/src/lib/{life,health,marketplace,auth-schema}.ts`
  → `packages/api-client/src/*.ts`.
- Added tsconfig path aliases in `apps/web/tsconfig.json` so existing
  `@/lib/life` imports still resolve — no touch to 100+ call sites.
- `apps/web/next.config.ts` got `transpilePackages: ["@1tt/api-client"]`.
- `apps/web/src/lib/auth.ts` rewired to `import * as schema from "@1tt/api-client/auth-schema"`.
- `@1tt/api-client` added to `apps/web` dependencies as `workspace:*`.
- `bun install` clean. `bunx tsc --noEmit` clean.

Deferred from original Stage 2 plan:

- **`packages/ui` extraction is skipped.** UI primitives (shadcn components,
  layout wrappers) are highly coupled to app-specific patterns and extracting
  them without rewriting imports carried more risk than value. In Stage 3
  apps/kim will duplicate the specific primitives it needs under
  `apps/kim/src/components/ui/`. If later we find ourselves fixing bugs in
  both copies, we can extract to `packages/ui` at that point.

Goals:

- Create `packages/ui/`:
  - `src/components/ui/*` (button, card, dialog, input, select, tooltip, etc. — shadcn primitives)
  - `src/components/layout/theme-provider.tsx`
  - `src/components/layout/cookie-consent.tsx`
  - `src/lib/utils.ts` (the `cn()` helper)
  - Re-exports via `packages/ui/src/index.ts`
  - Workspace name: `@1tt/ui`
- Create `packages/api-client/`:
  - `src/life.ts`, `src/health.ts`, `src/marketplace.ts` (types + fetch wrappers)
  - `src/auth-schema.ts` (shared Drizzle schema for better-auth tables)
  - Workspace name: `@1tt/api-client`
- Rewire `apps/web` to consume both packages instead of relative imports.
- Typecheck clean.

---

## Stage 3 — Scaffold apps/kim

**Status:** complete

Goals:

- `apps/kim/package.json` — independent Next.js app, own OpenNext + wrangler.
- `apps/kim/next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`.
- `apps/kim/tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `globals.css`.
- `apps/kim/src/app/layout.tsx`:
  - ThemeProvider, QueryProvider, fonts (Geist Sans/Mono, Instrument Serif).
  - KimHeader at the top, auth gate around children.
  - No host-based middleware rewriting — kim1.ai is its own domain with clean
    root-level URLs (`/routines`, `/calendar`, `/health`, `/actionables`, etc.).
- Copy from `apps/web/src/app/tools/life/*` into `apps/kim/src/app/*` with
  paths flattened (no `/tools/life/` prefix).
- Copy all kim-specific components:
  - `src/components/life/kim/*` → `apps/kim/src/components/kim/*`
  - `src/components/life/actionables/*` → `apps/kim/src/components/actionables/*`
  - `src/components/life/routines/*` → `apps/kim/src/components/routines/*`
  - `src/components/life/calendar/*` → `apps/kim/src/components/calendar/*`
  - `src/components/life/memories/*` → `apps/kim/src/components/memories/*`
  - `src/components/life/marketplace/*` → `apps/kim/src/components/marketplace/*`
  - `src/components/life/list-shell.tsx`, `life-nav.tsx`, `kim-header.tsx`,
    `page-shell.tsx`, `active-toggle.tsx` → `apps/kim/src/components/`
- Rewrite nav rail and header to point at kim1.ai's own routes; remove the
  "back to 1tt.dev" subtle link because kim is now its own brand (optional
  external link can stay).
- Drop the global `src/middleware.ts` host-rewriter from the `apps/kim` copy.
- Verify `apps/kim` typechecks and dev-runs on `localhost:3001` (or its own
  port — `next dev -p 3001`).

---

## Stage 4 — Remove kim from apps/web

**Status:** complete (also moved `/m/[slug]` public share route to kim)

Goals:

- Delete from `apps/web/src/app/`: `tools/life/*` (entire tree).
- Delete from `apps/web/src/components/`: `life/*`, `life-landing.tsx`.
- Remove `src/middleware.ts` kim host-rewriting (the file can go entirely if
  there's nothing else using it).
- Drop Kim-related imports from the root layout and the main nav / header.
- Leave `life-landing.tsx` CTA links pointing to `https://kim1.ai`.
- Ensure `apps/web` still typechecks + builds.

---

## Stage 5 — Auth + OAuth + env

**Status:** code-side complete; waiting on user-provided OAuth credentials + DNS route

Done:
- `apps/kim/src/lib/auth.ts`: cookie domain derived from `BETTER_AUTH_URL`
  hostname (`.kim1.ai` prod, `.lvh.me` dev). Trusted origins limited to kim
  hosts. Social providers unchanged (GitHub + Google).
- `apps/kim/.env.kim.production`: created with real `DATABASE_URL` +
  `BETTER_AUTH_SECRET` (freshly generated), `BETTER_AUTH_URL=https://kim1.ai`,
  OAuth placeholders, `API_BACKEND_URL=https://api.1tt.dev`.
- Cloudflare KV namespace `kim1-cache` created
  (id `e26fc491d227449892659dcdcb5075fa`); wired into `apps/kim/wrangler.jsonc`.

Pending (user-side):
- Create GitHub OAuth app for kim1.ai; fill `GITHUB_CLIENT_ID` /
  `GITHUB_CLIENT_SECRET` in both `.env.kim.development` and
  `.env.kim.production`.
- Create Google OAuth client for kim1.ai; fill `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET`.
- Point `kim1.ai` (+ `www.kim1.ai`) at the `kim1` worker via Cloudflare
  Workers Routes (or `routes` block in wrangler.jsonc).
- First `bun run cf:deploy:kim` + `wrangler secret put` for prod env vars.

Goals:

- `apps/kim/src/lib/auth.ts`: new better-auth instance
  - Same Postgres `DATABASE_URL`, same `authSchema` from `@1tt/api-client`.
  - `baseURL: BETTER_AUTH_URL` (e.g. `https://kim1.ai`).
  - `crossSubDomainCookies.domain = ".kim1.ai"` in prod, disabled on localhost.
  - Different `GITHUB_CLIENT_ID` / `GOOGLE_CLIENT_ID` from the web app.
  - `trustedOrigins` lists only kim1.ai domains.
- `apps/kim/.env.web.development`, `apps/kim/.env.web.production`:
  - `BETTER_AUTH_URL=http://lvh.me:3001` (dev) / `https://kim1.ai` (prod)
  - `BETTER_AUTH_SECRET` — fresh random value
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — kim GitHub OAuth app
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — kim Google OAuth client
  - `API_BACKEND_URL=http://localhost:8090` (dev) / `https://api.1tt.dev` (prod)
  - `DATABASE_URL` — same as web app (shared users table)
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — same or separate
- Go backend `api/internal/...` — add `https://kim1.ai` to any CORS / trusted
  origin list so the proxy accepts requests.
- Once deployed, `kim.1tt.dev` is gone. `life-landing.tsx` CTA on 1tt.dev
  points to `https://kim1.ai`.

External steps you must do manually:

1. Register domain `kim1.ai` and point DNS at your Cloudflare Workers zone.
2. Create a new GitHub OAuth app:
   - Name: Kim
   - Homepage URL: `https://kim1.ai`
   - Authorization callback URL: `https://kim1.ai/api/auth/callback/github`
   - (dev redundant URL: `http://lvh.me:3001/api/auth/callback/github`)
   - Copy client_id / client_secret into kim env files.
3. Create a new Google OAuth 2.0 Client ID:
   - Authorized JavaScript origins: `https://kim1.ai`, `http://lvh.me:3001`
   - Authorized redirect URIs:
     `https://kim1.ai/api/auth/callback/google`,
     `http://lvh.me:3001/api/auth/callback/google`
4. Provision a second Cloudflare Worker for kim (`wrangler.jsonc` at
   `apps/kim/wrangler.jsonc`).
5. Set production secrets via `wrangler secret put` on both workers.
6. Update Cloudflare Zone to route `kim1.ai/*` → kim worker.

---

## Resume notes

If the agent is interrupted mid-stage, find the current `Status: in progress`
line and read the stage's "Goals" list. Each goal is idempotent — re-running
a move is safe because there are no destructive DB changes in any stage.

Typecheck gates per stage:

- Stage 1: `cd apps/web && bunx tsc --noEmit` clean
- Stage 2: `cd apps/web && bunx tsc --noEmit` clean, `cd packages/ui && bunx tsc --noEmit` clean
- Stage 3: `cd apps/kim && bunx tsc --noEmit` clean
- Stage 4: `cd apps/web && bunx tsc --noEmit` clean (some unused imports may need cleanup)
- Stage 5: both apps + `go build ./...` clean
