# Development

Local setup, ports, commands. If a command isn't in the `justfile`, it's
probably not worth memorizing.

## Prerequisites

- **Bun** ≥ 1.3 — `curl -fsSL https://bun.sh/install | bash`
- **Go** 1.24
- **`ee`** CLI — `curl -sSfL https://ee.n1rna.net/install.sh | sh`
- **`just`** — `brew install just` (macOS) or
  `cargo install just`
- **`wrangler`** — comes via workspace install, you don't need it globally
  but you do need to be logged in: `bunx wrangler login`
- **`gh`** CLI — authenticated with `gh auth login` (for `ee push github`)
- `/etc/hosts` entry **optional but recommended** — `lvh.me` and its
  subdomains already resolve publicly to `127.0.0.1`, but some networks
  block public DNS for `.me` TLDs; adding `127.0.0.1 lvh.me` locally
  sidesteps that.

## Install

```bash
just install
```

Which runs:

```bash
bun install --frozen-lockfile
cd api && go mod download
```

## Ports

| Service | Port | URL |
|---|---|---|
| 1tt.dev web | `3000` | `http://lvh.me:3000` |
| kim1.ai web | `3001` | `http://lvh.me:3001` |
| Go API | `8090` | `http://localhost:8090` |
| Wrangler local dev (cf-preview) | varies | printed by wrangler |

Use `lvh.me` (not `localhost`) for the Next apps when you want cookies to
work across subdomains. See [auth.md](./auth.md) for why.

## Core commands

```bash
# Start the web app (1tt.dev)
just dev

# Start kim (kim1.ai)
just dev-kim

# Start the Go API
just api

# Start web + api together
just dev-all

# Start everything (web + kim + api)
just dev-everything
```

You almost always want `just dev-everything` when working on kim, because
it needs the Go API to be up for anything authenticated.

## Build

```bash
just build            # web prod build
just build-kim        # kim prod build
just api-build        # Go API binary
```

Builds are only occasionally useful locally — most of the time you let CI
handle prod builds.

## Cloudflare preview + deploy

```bash
# Preview a worker locally via wrangler dev
just cf-preview       # web
just cf-preview-kim   # kim

# Deploy a single worker
just cf-deploy        # web
just cf-deploy-kim    # kim
just cf-deploy-api    # Go API container

# Deploy everything
just deploy
```

Deploy scripts wrap everything in `ee apply production` so secrets are in
place during the build step. CI does the same thing via `ee-action`.

## Secrets

```bash
# Set a runtime secret on a live worker (interactive)
just cf-secret-web GOOGLE_CLIENT_ID
just cf-secret-kim GOOGLE_CLIENT_ID
just cf-secret-api DATABASE_URL
```

For bulk updates, see [env-and-secrets.md](./env-and-secrets.md).

## Testing

```bash
# Web unit tests
cd apps/web && bun test

# Web e2e tests
cd apps/web && bunx playwright test

# Type-check a single app
cd apps/web && bunx tsc --noEmit
cd apps/kim && bunx tsc --noEmit

# Go API tests
cd api && go test ./...
```

No test suite for kim yet.

## Database migrations

Goose migrations live in `api/internal/database/migrations/`:

```bash
# Run pending migrations against your configured DATABASE_URL
just db-migrate

# Roll back the most recent migration
just db-rollback

# Create a new migration
just db-create-migration add_widgets_table
```

Both apps talk to the same Postgres database, so a migration affects both.
Be gentle with anything touching `users`, `sessions`, or the life domain
tables.

## Adding a new app or package

### New workspace package

```bash
mkdir -p packages/my-pkg/src
cd packages/my-pkg
cat > package.json <<'JSON'
{
  "name": "@1tt/my-pkg",
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
JSON
```

Back at the root, `bun install` picks it up. Reference it from an app as
`@1tt/my-pkg` (after adding it as a dep in the app's `package.json` via
`"@1tt/my-pkg": "workspace:*"`). Add it to `transpilePackages` in the
consuming app's `next.config.ts` if it exports source files.

### New Next app

Use `apps/kim` as the template. Each app needs:

- `package.json` — own deps, own dev/build/cf scripts with `ee apply`
- `next.config.ts`
- `tsconfig.json` — with path aliases pointing at `packages/*`
- `wrangler.jsonc` — unique worker name + unique KV namespace
- `.ee.<app>` — schema, environments, origins (github + cloudflare)
- `.env.<app>.development` + `.env.<app>.production`
- Own GitHub OAuth app if you want sign-in
- Own Google OAuth client (same reason)
- Matching CI job in `.github/workflows/deploy.yml`
- `just` targets for dev/build/deploy

## Troubleshooting

### `bunx tsc --noEmit` complains about `.next/types/validator.ts`

That's a stale file from a previous build after route moves. Wipe
`apps/*/. next` and rerun.

### "Please sign in to continue" on a page that should work

Means the client-side `useSession()` returned a session but the API
proxy's `auth.api.getSession()` didn't find one. Usually cookies aren't
sticking — check you're on `lvh.me`, not `localhost`, and that
`BETTER_AUTH_URL` in `.env.*.development` matches your address bar host.

### OAuth redirect ends up on `https://kim1.ai/...` from local dev

Your `BETTER_AUTH_URL` is still pointing at production. Make sure
`apps/kim/.env.kim.development` has `BETTER_AUTH_URL=http://lvh.me:3001`
and restart `just dev-kim`.

### `wrangler` prompts interactive login in CI

CI uses `CLOUDFLARE_API_TOKEN` from repo secrets. Locally it uses your
`wrangler login` session. Don't commit a token to the repo.

### `ee push github production` says "command requires a .ee file"

`ee` expects the project file to be named exactly `.ee` in the working
directory. Symlink it:

```bash
cd apps/kim
ln -sf .ee.kim .ee
ee push github production
rm .ee
```
