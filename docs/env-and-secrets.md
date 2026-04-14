# Env and secrets

How environment variables are defined, where they live, and how to change
one safely. The whole system runs on the [`ee`](https://ee.n1rna.net) CLI.

## The three-tier model

Every secret exists (potentially) in **three** places:

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ 1. Local dev    │     │ 2. Build-time    │     │ 3. Runtime       │
│                 │     │                  │     │                  │
│ .env.*          │     │ GitHub secrets   │     │ Cloudflare       │
│ (gitignored)    │     │ (bundled dotenv) │     │ worker secrets   │
│                 │     │                  │     │                  │
│ via ee apply    │     │ via ee-action    │     │ via wrangler     │
│ in dev scripts  │     │ in CI workflow   │     │ secret put       │
└────────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         └──────────── ee push github ────────┐            │
         │                                    ▼            │
         │                          ┌─────────────────┐    │
         └──── ee push cloudflare ─▶│                 │────┘
                                    │                 │
                                    └─────────────────┘
```

- **Tier 1** is just a `.env.*` file you edit locally.
- **Tier 2** is a single GitHub secret (e.g. `ENV_VARS_KIM`) that bundles
  every production variable in dotenv format. The CI workflow decodes it
  at build time via `n1rna/ee-action` so the Next build has access to
  `NEXT_PUBLIC_*` and any vars the build-time page collection needs.
- **Tier 3** is the live Cloudflare Worker's own secrets, accessed at
  runtime via `process.env.FOO` on the worker.

`ee push github production` syncs tier 1 → tier 2.
`ee push cloudflare production` syncs tier 1 → tier 3.

## The `.ee.*` project files

Each app/service has a project file in JSON. Three exist today:

| File | Project | Consumers |
|---|---|---|
| `apps/web/.ee.web` | `onetruetool-web` | 1tt.dev Next app |
| `apps/kim/.ee.kim` | `kim1-web` | kim1.ai Next app |
| `.ee.api` (root) | `onetruetool-api` | Go API container |

Each file declares:

- **`schema.variables`** — every env var this app knows about, with type,
  title, required flag, and whether it's secret.
- **`environments`** — named environments (`development`, `production`)
  each pointing at one or more `.env.*` files.
- **`origins`** — remote targets for `ee push`. Each service has both a
  `github` origin (for `ENV_VARS_*`) and a `cloudflare` origin (for
  `wrangler secret put ... --name <worker>`).

Example from `apps/kim/.ee.kim`:

```jsonc
"origins": {
  "cloudflare": {
    "type": "cloudflare",
    "mode": "individual",
    "worker": "kim1"
  },
  "github": {
    "type": "github",
    "mode": "bundled",
    "repo": "n1rna/1tt",
    "secret_name": "ENV_VARS_KIM"
  }
}
```

Modes:

- **`bundled`** (default for github): every var gets serialized as
  `KEY=VALUE` lines and pushed as a single multi-line GitHub secret.
  `n1rna/ee-action` hydrates it back into a file at CI time.
- **`individual`** (default for cloudflare): each var becomes its own
  `wrangler secret put` call.

## Local dev env files

| File | Used by |
|---|---|
| `apps/web/.env.web.development` | `apps/web/package.json` dev script |
| `apps/web/.env.web.production` | CI build for 1tt.dev prod |
| `apps/kim/.env.kim.development` | `apps/kim/package.json` dev script |
| `apps/kim/.env.kim.production` | CI build for kim1.ai prod |
| `.env.api.development` (root) | Go API dev |
| `.env.api.production` (root) | Go API prod |

All are gitignored. The dev scripts wrap commands in
`ee apply development -c .ee.<app> -- …` so the env is loaded before the
process starts. Same for CI builds, but with `production`.

## GitHub Actions integration

`.github/workflows/deploy.yml` has two Next-app deploy jobs
(`deploy-web`, `deploy-kim`) that share the same shape:

```yaml
- uses: n1rna/ee-action@main
  with:
    environment: production
    config_path: apps/kim/.ee.kim
    env_file: apps/kim/.env.kim.production
    gh_secret: ${{ secrets.ENV_VARS_KIM }}

- name: Build
  working-directory: apps/kim
  run: |
    set -a
    source .env.kim.production
    set +a
    bunx opennextjs-cloudflare build

- name: Deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    workingDirectory: apps/kim
    command: deploy
    packageManager: bun
```

ee-action writes the `env_file` from the bundled `gh_secret` content. The
build step `source`s that file into the environment so Next has
`DATABASE_URL`, `BETTER_AUTH_URL`, etc. while collecting page data.

## Cloudflare runtime secrets

Set once via `wrangler secret put` (or `wrangler secret bulk` for many at
once). They persist across deploys until you change them. Wrangler scopes
them to the worker by name, so you need the right `wrangler.jsonc`'s
`name` field.

```bash
# One at a time (interactive)
just cf-secret-kim GITHUB_CLIENT_SECRET
just cf-secret-web GOOGLE_CLIENT_ID

# Bulk (JSON file)
cd apps/kim
cat > /tmp/kim-secrets.json <<'JSON'
{ "GOOGLE_CLIENT_ID": "...", "GOOGLE_CLIENT_SECRET": "..." }
JSON
bunx wrangler secret bulk /tmp/kim-secrets.json
rm /tmp/kim-secrets.json
```

Or do it via ee:

```bash
cd apps/kim && ln -sf .ee.kim .ee
ee push cloudflare production      # pushes all prod vars as individual secrets
rm .ee
```

(The symlink hack is because `ee push` looks for a `.ee` file by name. The
aliased name needed by each app is why we haven't renamed them.)

## Adding a new secret — step by step

Say you want to add `OPENAI_API_KEY` to kim.

1. **Add to schema** — `apps/kim/.ee.kim`:

   ```jsonc
   "OPENAI_API_KEY": {
     "name": "OPENAI_API_KEY",
     "title": "OpenAI API key for kim agent",
     "type": "string",
     "required": true,
     "secret": true
   }
   ```

2. **Fill the dev value** — `apps/kim/.env.kim.development`:

   ```
   OPENAI_API_KEY=sk-dev-...
   ```

3. **Fill the prod value** — `apps/kim/.env.kim.production`:

   ```
   OPENAI_API_KEY=sk-prod-...
   ```

4. **Push to GitHub** (so CI builds can use it):

   ```bash
   cd apps/kim && ln -sf .ee.kim .ee
   ee push github production
   rm .ee
   ```

5. **Push to the live worker** (so the running prod worker sees it without
   waiting for a deploy):

   ```bash
   cd apps/kim
   echo 'sk-prod-...' | bunx wrangler secret put OPENAI_API_KEY
   ```

   Or bulk with `ee push cloudflare production` using the symlink trick.

6. **Consume it** — in Next, `process.env.OPENAI_API_KEY` works on both
   server components and route handlers.

If it's a public variable (baked into the client bundle), name it
`NEXT_PUBLIC_*` and make sure it's set during CI build (`ENV_VARS_KIM`
already covers this — step 4 is the important one).

## Removing or rotating

- **Rotate**: change the value in the `.env.*.production` file, rerun
  `ee push github production` and update the Cloudflare secret with
  `wrangler secret put`. Two separate operations because GitHub and
  Cloudflare don't know about each other.
- **Remove**: delete from the schema + `.env.*` files, then
  `ee push github production` to refresh the bundle, and
  `wrangler secret delete FOO` on each worker where it was set.

## Current state

| Secret | Web | Kim | API |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ (same Neon URL) |
| `BETTER_AUTH_SECRET` | ✅ | ✅ (separate values) | ❌ |
| `BETTER_AUTH_URL` | ✅ (`https://1tt.dev`) | ✅ (`https://kim1.ai`) | ❌ |
| `GITHUB_CLIENT_*` | ✅ (1tt OAuth app) | ✅ (kim OAuth app) | ❌ |
| `GOOGLE_CLIENT_*` | ✅ (1tt OAuth) | ✅ (kim OAuth) | ❌ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ | ❌ | ❌ |
| `NEXT_PUBLIC_MEDUSA_*`, `NEXT_PUBLIC_STRIPE_*` | ✅ | ❌ | ❌ |

See each `.ee.*` file for the authoritative list.
