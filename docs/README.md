# Docs

Permanent documentation for the 1tt monorepo. Start here.

## Index

| Doc | What's in it |
|---|---|
| [architecture.md](./architecture.md) | Monorepo layout, apps and packages, how services wire together, where each thing is deployed |
| [kim-and-1tt.md](./kim-and-1tt.md) | Why kim1.ai is a separate app, what lives where, public URL layout for both sites |
| [auth.md](./auth.md) | Shared users table + two better-auth instances, cookie domains, session forwarding through the API proxy |
| [env-and-secrets.md](./env-and-secrets.md) | The three-tier secret model (local, CI, runtime), adding a new secret |
| [ee-cli.md](./ee-cli.md) | The `ee` CLI — what it is, key commands, how we use it in this repo (read this if you're touching env vars) |
| [kim-agent.md](./kim-agent.md) | Kim agent architecture — skills, tools, prompt composition, how to add a new skill |
| [development.md](./development.md) | Local setup, `just` commands, ports, `lvh.me`, what to run for which workflow |
| [migration-history.md](./migration-history.md) | The 5-stage monorepo split — frozen record of how we got here |

## Writing new docs

Keep each doc short, practical, and grounded in current state. Prefer pointing
at code locations over paraphrasing their contents — code rots less than prose.

- Don't document what can be read from the file tree or a two-line `grep`.
- Do document the *why*: tradeoffs, constraints, decisions that aren't obvious
  from the code alone.
- If a doc gets longer than ~300 lines, split it.

If a doc drifts out of date, fix it in the same PR that made it drift.
