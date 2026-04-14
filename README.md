![1tt.dev](https://1tt.dev/badge/1tt.dev-Tools_that_just_work-blue.svg?style=for-the-badge) ![status](https://1tt.dev/badge/status-active-brightgreen.svg) ![license](https://1tt.dev/badge/license-MIT-green.svg) ![TypeScript](https://1tt.dev/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white) ![Next.js](https://1tt.dev/badge/Next.js-16-000.svg?logo=nextdotjs&logoColor=white) ![Go](https://1tt.dev/badge/Go-1.24-00ADD8.svg?logo=go&logoColor=white) ![Cloudflare](https://1tt.dev/badge/deployed_on-Cloudflare-F38020.svg?logo=cloudflare&logoColor=white)

# 1tt.dev

The developer tools you actually need. Free, fast, no sign-up.

## Tools

**Encoding & Formatting** — JWT parser, JSON beautifier, Base64 codec, SQL formatter, Markdown editor, CSV viewer

**Web & Network** — WebSocket tester, DNS lookup, SSL checker, CORS debugger, OG checker, API tester, IP lookup

**Generators** — QR code generator, badge generator, logo builder, OG image builder, random generators, config generators

**Crypto & Text** — Hash generator, htpasswd generator, regex tester, diff viewer, string tools

**Databases** — PostgreSQL studio (Neon), SQLite browser (Turso), Redis studio (Upstash), Elasticsearch explorer

**Planning** — Planning poker, calendar, pomodoro timer, world clock

**Infrastructure** — Object storage (R2), database tunnels, cloud sync, llms.txt generator

## Stack

![Next.js](https://1tt.dev/badge/Next.js-16-000.svg?logo=nextdotjs&logoColor=white&style=flat-square) ![Tailwind](https://1tt.dev/badge/Tailwind-v4-06B6D4.svg?logo=tailwindcss&logoColor=white&style=flat-square) ![Go](https://1tt.dev/badge/Go-1.24-00ADD8.svg?logo=go&logoColor=white&style=flat-square) ![Cloudflare](https://1tt.dev/badge/Cloudflare-Workers-F38020.svg?logo=cloudflare&logoColor=white&style=flat-square) ![PostgreSQL](https://1tt.dev/badge/PostgreSQL-Neon-4169E1.svg?logo=postgresql&logoColor=white&style=flat-square) ![Redis](https://1tt.dev/badge/Redis-Upstash-DC382D.svg?logo=redis&logoColor=white&style=flat-square)

- **Frontend**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Go API server with langchaingo AI agents
- **Hosting**: Cloudflare Workers (web) + Cloudflare Containers (API)
- **Databases**: Neon (Postgres), Turso (SQLite), Upstash (Redis)
- **Storage**: Cloudflare R2

## Monorepo layout

This repo is a bun workspace with two Next.js apps, one Go API, and shared
packages.

```
apps/web       → 1tt.dev          — developer tools platform
apps/kim       → kim1.ai          — personal life agent
packages/      → shared TS libs (api-client, …)
api/           → Go backend
workers/       → Cloudflare Container + email inbound workers
cli/           → 1tt CLI (Go)
docs/          → architecture, auth, env, dev setup — read this first
```

## Development

```bash
# Install dependencies
just install

# Start everything (web + kim + api)
just dev-everything

# Or individually
just dev           # 1tt.dev web   (port 3000)
just dev-kim       # kim1.ai       (port 3001)
just api           # Go API        (port 8090)
```

Use `http://lvh.me:3000` and `http://lvh.me:3001` in your browser, not
`localhost` — see [docs/auth.md](./docs/auth.md) for why.

## Docs

Permanent documentation lives in [`docs/`](./docs):

- [architecture.md](./docs/architecture.md) — monorepo layout, service topology
- [kim-and-1tt.md](./docs/kim-and-1tt.md) — the split, URL layout, brand cues
- [auth.md](./docs/auth.md) — shared users, two better-auth instances, cookies
- [env-and-secrets.md](./docs/env-and-secrets.md) — three-tier secret model
- [ee-cli.md](./docs/ee-cli.md) — the `ee` CLI, commands, and repo conventions
- [development.md](./docs/development.md) — local setup, ports, troubleshooting
- [migration-history.md](./docs/migration-history.md) — how the kim split happened

## Links

- **1tt.dev** — [1tt.dev](https://1tt.dev) · [shop](https://1tt.dev/shop) · [guides](https://1tt.dev/guides)
- **kim1.ai** — [kim1.ai](https://kim1.ai)
