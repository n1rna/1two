# ee CLI

`ee` is the tool we use for every environment-variable workflow in this
repo — local dev, CI, and Cloudflare Worker runtime secrets. If you're
touching env vars, read this first.

> **Authoritative reference**: <https://ee.n1rna.net/llms.txt> (agent-
> optimized; can be fetched and parsed directly). The official site is
> <https://ee.n1rna.net> and the source lives at
> <https://github.com/n1rna/ee-cli>.
>
> This doc is a pragmatic summary plus the conventions we use here.
> When the upstream reference and this doc disagree, trust upstream and
> fix the mismatch.

## Install

```bash
curl -sSfL https://ee.n1rna.net/install.sh | sh
```

## What ee is

A small CLI that brings structure to env-var management:

- **Schema-validated** env vars (types, required flags, regex, defaults).
- **Multiple environments** per project (`development`, `production`, …).
- **Remote origins**: push bundled or individual secrets to GitHub
  Actions and Cloudflare Workers from the same source of truth.
- **Shell integration**: run a command with a specific environment
  applied, or print the hydrated env in several formats.

Three kinds of files:

| File | Purpose |
|---|---|
| `.ee` (JSON) | Project config — schema, environments, origins |
| `schema.yaml` / `.json` | (Optional) external schema file referenced by `.ee` |
| `.env.*` | Plain dotenv files, one per environment |

## Core concepts

### 1. The `.ee` project file

JSON, one per service. Declares the project name, schema, environments,
and push origins.

```jsonc
{
  "project": "my-app",
  "schema": {
    "variables": {
      "DATABASE_URL": {
        "name": "DATABASE_URL",
        "type": "string",
        "title": "Postgres URL",
        "required": true,
        "secret": true
      }
    }
  },
  "environments": {
    "development": { "sheets": [".env.development"] },
    "production":  { "sheets": [".env.production"] }
  },
  "origins": {
    "github": {
      "type": "github",
      "mode": "bundled",
      "repo": "owner/repo",
      "secret_name": "ENV_VARS_MY_APP"
    },
    "cloudflare": {
      "type": "cloudflare",
      "mode": "individual",
      "worker": "my-worker"
    }
  }
}
```

Schemas can be inline (as above) or a file reference (`"schema": { "ref": "./schema.yaml" }`).

Environments can point at a single file (`"env": ".env.production"`) or
stack multiple sources (`"sources": [".env", ".env.prod", ".env.secrets"]`),
where later sources override earlier ones.

### 2. Origins

Origins are remote targets for `ee push`:

- **`github`** — pushes to repo secrets via the `gh` CLI.
  - `mode: "bundled"` (default): all vars serialized as a single
    multi-line `KEY=VALUE` secret. Designed to pair with
    [`n1rna/ee-action`](https://github.com/n1rna/ee-action) in CI.
  - `mode: "individual"`: each var becomes its own repo secret.
- **`cloudflare`** — pushes to Cloudflare Worker secrets via `wrangler`.
  - `mode: "individual"` (default): one `wrangler secret put` per var.
  - `mode: "bundled"`: one multi-line secret.

Prerequisites:
- GitHub push: `gh auth login`
- Cloudflare push: `wrangler login`

## Commands you'll use

### `ee apply <env> [-- <command>]`

Run a command with the environment applied, or open a subshell with it.

```bash
# Open a shell with the env loaded
ee apply development

# Run a command with the env loaded
ee apply production -- go run ./cmd/server

# Preview without running (good for debugging a file)
ee apply production --dry-run --format dotenv
ee apply production --dry-run --format json
```

This is what every `just dev`/`just dev-kim`/`just build`/`just cf-*`
command wraps under the hood.

### `ee push [origin] <env>`

Sync the local env file to a remote origin.

```bash
# Push to every configured origin for this environment
ee push production

# Push to one specific origin by name
ee push github production
ee push cloudflare production

# Preview
ee push github production --dry-run

# Override mode
ee push github production --mode individual
```

### `ee verify`

Validate that each environment file has everything the schema requires.

```bash
ee verify                     # check everything
ee verify --env development   # one environment only
ee verify --verbose           # detailed output
ee verify --fix               # auto-create missing files/vars
```

### `ee auth`

Check that origin CLI dependencies (`gh`, `wrangler`) are authenticated.

```bash
ee auth            # everything
ee auth gh         # just github
ee auth wrangler   # just cloudflare
```

### `ee` (no args)

Inspect and filter the current shell environment.

```bash
ee                                      # dump everything
ee --filter 'DB_*,DATABASE_*'           # include glob
ee --filter '!CLAUDE*,!PATH*'           # exclude glob
ee --filter '*KEY*,*SECRET*' --mask     # audit safely
ee --format json                        # JSON output
ee --format dotenv > current.env
```

## How we use ee in this repo

There's one quirk: `ee` expects the project file to be named exactly
`.ee` in the current working directory. Our files are named `.ee.web`,
`.ee.kim`, and `.ee.api` so they live next to each other without
clashing. Two ways to deal with that:

### Option A — package.json wrapper (how dev + deploy already work)

Inside each app's `package.json`, scripts use the `-c` flag (undocumented
but accepted by `ee apply`) to point at the right file:

```json
{
  "scripts": {
    "dev":       "ee apply development -c .ee.kim -- next dev -p 3001",
    "cf:build":  "ee apply production -c .ee.kim -- opennextjs-cloudflare build",
    "cf:deploy": "ee apply production -c .ee.kim -- bash -c 'opennextjs-cloudflare build && wrangler deploy'"
  }
}
```

`just dev-kim`, `just cf-deploy-kim`, etc. call into these via `bun run
--filter ./apps/kim <script>`, so in practice you almost never type `ee`
yourself for runtime work.

### Option B — symlink (for `ee push`, which doesn't accept `-c`)

`ee push` doesn't take a `-c` flag, so it won't find `.ee.kim`
automatically. Drop a temporary symlink and remove it after:

```bash
cd apps/kim
ln -sf .ee.kim .ee
ee push github production
ee push cloudflare production
rm .ee
```

Do the same pattern in `apps/web/` with `.ee.web`, and at the repo root
with `.ee.api`.

## Repo cheatsheet

### Inventory

| Project file | `project` name | Environments | GitHub secret | Worker |
|---|---|---|---|---|
| `apps/web/.ee.web` | `onetruetool-web` | `development`, `production` | `ENV_VARS_WEB` | `onetruetool-web` |
| `apps/kim/.ee.kim` | `kim1-web` | `development`, `production` | `ENV_VARS_KIM` | `kim1` |
| `.ee.api` (root) | `onetruetool-api` | `development`, `production` | (none) | `onetruetool-api` |

The Go API doesn't have a GitHub origin because CI deploys the container
directly via `cloudflare/wrangler-action` without build-time env
injection. Web and kim need bundled GitHub secrets because Next collects
page data at build time and that evaluation needs `DATABASE_URL` etc.

### Common workflows

**Update an existing secret** (e.g. rotate `GOOGLE_CLIENT_SECRET` for kim):

```bash
# 1. Edit the source of truth
vim apps/kim/.env.kim.production

# 2. Sync both tiers
cd apps/kim
ln -sf .ee.kim .ee
ee push github production        # tier 2: CI build secret
ee push cloudflare production    # tier 3: live worker runtime
rm .ee

# 3. (Optional) trigger a redeploy to pick up build-time changes
just cf-deploy-kim
```

**Add a brand new secret**: see
[env-and-secrets.md](./env-and-secrets.md#adding-a-new-secret--step-by-step).

**Dry-run to see what would be pushed** (useful before touching prod):

```bash
cd apps/kim && ln -sf .ee.kim .ee
ee push github production --dry-run
ee push cloudflare production --dry-run
rm .ee
```

**Verify a file before deploy** (catches missing required vars):

```bash
cd apps/kim && ln -sf .ee.kim .ee
ee verify --env production --verbose
rm .ee
```

**Inspect the hydrated environment** (like `just dev-kim` would see):

```bash
cd apps/kim && ln -sf .ee.kim .ee
ee apply development --dry-run --format dotenv
rm .ee
```

## GitHub Actions integration

We use [`n1rna/ee-action`](https://github.com/n1rna/ee-action) to hydrate
env files from the bundled GitHub secret inside CI. See
`.github/workflows/deploy.yml` — both `deploy-web` and `deploy-kim` have
the same shape:

```yaml
- uses: n1rna/ee-action@main
  with:
    environment: production
    config_path: apps/kim/.ee.kim
    env_file: apps/kim/.env.kim.production
    gh_secret: ${{ secrets.ENV_VARS_KIM }}
```

After this step runs, the `.env.kim.production` file exists in the
runner's workspace; the Build step `source`s it before calling
`opennextjs-cloudflare build`.

## Agent-facing quickstart

If you're an AI agent dropped into this repo and asked to touch env vars,
do this:

1. **Read the reference**: fetch <https://ee.n1rna.net/llms.txt> — it's
   the authoritative, agent-optimized spec of every `ee` command.
2. **Look at the relevant `.ee.*` file** to understand what env vars the
   target service knows about.
3. **Look at the matching `.env.*.production` (or `.development`) file**
   for current values. These are gitignored — they exist only on the
   user's machine and in the GitHub bundled secret.
4. **Use `ee apply --dry-run`** to preview what gets loaded before
   running anything destructive.
5. **Before `ee push`**, symlink `.ee.<service>` → `.ee` in the service
   directory (see "Option B" above) and remember to remove the symlink
   after.
6. **Never commit** anything from `.env.*` files. Check `.gitignore`
   covers them before adding any new env file.

## Where to go next

- [env-and-secrets.md](./env-and-secrets.md) — our three-tier secret
  model in more depth, with the add-a-new-secret walkthrough.
- [development.md](./development.md) — how `ee` fits into the `just`
  command surface you'll actually type.
- <https://ee.n1rna.net/llms.txt> — the authoritative reference.
