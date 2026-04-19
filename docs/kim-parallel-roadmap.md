# Kim Parallel Roadmap

Plan for shipping the 4 open Kim epics as **4 parallel feature branches**,
each worked on in its own git worktree, by its own dedicated agent.

The goal is to maximize parallelism while keeping branches merge-friendly.
Non-Kim tracks (crypto-vault orgs, standalone vault bugs, `ee` CLI) are out of
scope here — they live in separate products and don't interact with these
files.

## TL;DR

| Track | Branch | Worktree path | Linear | Scope |
|---|---|---|---|---|
| A — Smart UI + Add-to-context | `kim/smart-ui` | `../1tt-smart-ui` | [QBL-103 epic](https://linear.app/qblok/issue/QBL-103) (8 issues) | `AskKimButton` CTA, drawer polish, context chip row, smart-UI primitives + per-kind modules (meal / exercise / event / task / metric), quick-vs-agent dispatch |
| B — Background activity | `kim/activity` | `../1tt-activity` | [QBL-78 epic](https://linear.app/qblok/issue/QBL-78) (8 issues) | `life_agent_runs` schema + tracked.Run + `/life/agent-runs` API + drawer activity feed |
| C — Journey flows | `kim/journey` | `../1tt-journey` | [QBL-42 epic](https://linear.app/qblok/issue/QBL-42) (5 issues) | Cascade agents: gym → cal, meal → tasks/grocery, routine → cal; wire into actionables |
| D — Kim mobile | `kim/mobile` | `../1tt-mobile` | [QBL-67 epic](https://linear.app/qblok/issue/QBL-67) (11 issues) | Expo app at `apps/kim-mobile/`: OAuth, chat, actionables, push, EAS |

Agent prompts: [`docs/agent-prompts/`](./agent-prompts/) for tracks B, C, D.
Track A runs directly off the Linear tickets (QBL-103..111) — no separate
agent prompt.

**Note on older agent prompts**: `kim-activity.md`, `kim-journey.md`,
`kim-mobile.md` contain coordination notes referencing an earlier "Track A
redesign" (QBL-86..102, cancelled 2026-04-19). Those notes are stale —
proceed independently; there is no shell rewrite to wait on.

## Model strategy

Each agent prompt is **self-contained** — it quotes the real state
machine, function signatures, migration templates, handler patterns, and
file paths the implementer needs. The prompts were assembled by Opus 4.7
with repo context so the implementation agents don't waste turns
re-discovering facts.

Run each track on **Sonnet 4.6** (`/model claude-sonnet-4-6`). Sonnet is
fast, cheaper per token, and the prompts supply enough context that it
rarely needs to branch into exploration. Escalate a track to Opus 4.7 only
when:

- The agent reports a genuine architectural question not anticipated by
  the prompt.
- A cross-track merge conflict needs a judgment call.
- An integration test keeps failing in non-obvious ways.

Rule of thumb: if Sonnet is executing a plan, stay on Sonnet; if it's
deciding a plan, use Opus.

## Conflict map

Branches intentionally avoid touching the same files, except at narrow wiring
seams. The seams are additive (new routes, new fields on an existing type),
not rewrites.

```
                       apps/kim/src/**                        api/internal/**            apps/kim-mobile/**   packages/api-client/**
Track A (smart-ui)     +components/kim/smart-ui/,             unchanged                  n/a                  unchanged
                        +ask-kim-button.tsx,
                        +ctx-chip.tsx,
                        minor edits to kim-drawer/list
Track B (activity)     +1 file (drawer activity feed)         +life_agent_runs,          n/a                  additive: agent-runs client
                                                               tracked.Run, handler
Track C (journey)      unchanged                              +journey.go (done),        n/a                  unchanged
                                                               wires into actionables
Track D (mobile)       unchanged                              +push tokens handler,      NEW app              additive: bearer auth + URL helpers
                                                               push sender
```

### Drawer seam

Track A polishes `apps/kim/src/components/kim/kim-drawer.tsx` (trace rows,
empty state, context-chip row in composer). Track B's drawer piece (QBL-82)
adds an Activity section above the thread.

**Resolution:** Track A merges first; Track B's drawer piece rebases on
Track A's changes. Track B's backend (QBL-79/80/81/83/85) is independent
and can ship immediately.

### Two secondary seams

- **`packages/api-client/src/life.ts`** — Tracks B and D add new client
  methods. These are purely additive exports; merges are trivial (Git merges
  disjoint `export function` additions without conflict).
- **`api/internal/handler/life.go`** — Tracks B and D add new HTTP handlers.
  Also additive. Each track registers its routes in its own block in
  `api/cmd/server/main.go`, kept far apart in the file.

## Worktree workflow

Create one worktree per track, off `main`:

```bash
cd /Users/nima/p/1tt
git worktree add -b kim/smart-ui ../1tt-smart-ui main
git worktree add -b kim/activity ../1tt-activity main
git worktree add -b kim/journey  ../1tt-journey  main
git worktree add -b kim/mobile   ../1tt-mobile   main
```

Each worktree is a full checkout sharing the same `.git`. Bun/Go caches are
shared via the monorepo. Each worktree gets its own `.wrangler/` and
`.next/`; that's fine.

**Clean up when merged:**

```bash
git worktree remove ../1tt-smart-ui
git branch -d kim/smart-ui
```

## Recommended merge order

1. **Track C (journey flows)** — smallest, Go-only, already mostly written.
   Ship first to de-risk the rest.
2. **Track A (smart UI)** — touches `components/kim/**`. Small surface.
   Merge before Track B's drawer piece.
3. **Track B (activity)** — backend merges anytime; drawer UI merges after A.
4. **Track D (mobile)** — independent; merges whenever ready. Blocks only on
   Track B if you want push for new agent-run events (nice-to-have, not v1).

## Safety rails (shared across all 4 tracks)

Every agent prompt includes these baseline rules, repeated here for the human:

- **Do not touch files outside the track's declared scope.** If a cross-cutting
  change is needed, stop and surface it.
- **No app shell, theme, or route rewrites.** All four tracks keep the
  existing pages, sidebar, topbar, and tokens as-is.
- **i18n discipline.** Any new user-visible string in `apps/kim` MUST be a
  translation key across all 7 locales. Run `cd apps/kim && bun run test:i18n`
  before declaring done. See `docs/i18n.md`.
- **Never `--no-verify` on commits.** Let hooks run.
- **Small, focused commits.** One logical change per commit.
- **Conventional commit format** matching recent history:
  `feat(kim): …`, `fix(kim): …`, `feat(api): …`, etc. Include `(QBL-XX)` for
  the primary issue the commit closes.
- **Tests before done.** Go unit tests for new packages, integration test
  gated behind `RUN_LIFE_INTEGRATION=1` where LLM is involved, Playwright
  e2e for new UI flows.
- **Don't rebase `main` into the worktree daily** — it creates churn. Rebase
  only when you actually need a change from main.

## Current working-tree state (pre-flight)

The `main` branch currently has uncommitted changes that are partly Track C
groundwork and partly in-flight actionables work:

- `api/internal/life/journey.go` + tests — Track C scaffolding, **move to
  `kim/journey` worktree** before anyone else forks off main.
- `api/internal/database/migrations/043_actionable_source.sql` — adds
  `source` to actionables; belongs with Track C (journey flows tag actionables
  with a source).
- `apps/kim/src/app/(app)/actionables/page.tsx` + `actionable-card.tsx` +
  i18n actionables — UI for journey-grouped actionables; also Track C.
- `packages/api-client/src/life.ts`, `api/internal/handler/life.go`,
  `api/cmd/server/main.go`, `api/internal/handler/health.go`,
  `api/internal/kim/agent.go`, `api/internal/life/agent.go` — mix. Most are
  journey wiring.

**Do this before spawning agents:**

1. Stage and commit the in-flight work on `main` as `wip(kim/journey): ...`
   and push to `kim/journey` branch (or into the journey worktree directly).
2. Reset `main` so each other worktree forks off a clean base.

## Per-track summary

### Track A — Smart UI + Add-to-context (QBL-103 epic)

Parent: [QBL-103](https://linear.app/qblok/issue/QBL-103). 8 sub-issues
(QBL-104..111).

Suggested implementation order:

```
QBL-107 primitives → QBL-108 meal/exercise
                   → QBL-109 event/task
                   → QBL-110 metric
QBL-111 dispatch contract (parallel with modules)
QBL-104 AskKimButton + wire into pages (parallel)
QBL-105 drawer polish (parallel)
QBL-106 ctx-chip composer row (depends on 105)
```

**Non-goals (locked)**:

- No new app shell, sidebar, topbar, or route group.
- No design token / font / theme replacement.
- No deleting existing routes.
- No new DB tables or migrations.
- No page rewrites.

Work directly off the Linear tickets — no separate agent prompt needed
for this track; scope is focused enough.

### Track B — Background agent activity (QBL-78 epic)

Parent: [QBL-78](https://linear.app/qblok/issue/QBL-78). 8 sub-issues.

Make async Kim work visible: when journey flows or scheduled jobs run in the
background, users see "Kim is thinking…" pulse + a list of recent activity
deep-linkable to actionables.

- Backend first: new `life_agent_runs` table, `tracked.Run` goroutine wrapper,
  `GET /life/agent-runs`, and retrofits every existing `go func()` call site.
- Front-end last: pulse dot in drawer header + Activity section.

Full prompt: [`docs/agent-prompts/kim-activity.md`](./agent-prompts/kim-activity.md).

### Track C — Journey flows (QBL-42 epic)

Parent: [QBL-42](https://linear.app/qblok/issue/QBL-42). 5 sub-issues.

Async cascades: user updates a gym session → agent reschedules its calendar
event. User changes a meal plan → agent diffs it and regenerates the tasks /
grocery list. User updates a routine → agent updates its recurring calendar
blocks. All cascades surface as actionables tagged with a `source` (the
triggering entity).

Scaffolding already exists in `api/internal/life/journey.go` (uncommitted).
This track finishes it, wires triggers into the existing update handlers, and
surfaces the results in `/actionables` with journey grouping.

Full prompt: [`docs/agent-prompts/kim-journey.md`](./agent-prompts/kim-journey.md).

### Track D — Kim mobile v1 (QBL-67 epic)

Parent: [QBL-67](https://linear.app/qblok/issue/QBL-67). 11 sub-issues.

New Expo (React Native) app at `apps/kim-mobile/`: chat with Kim, triage
actionables, receive push notifications. Explicit non-goals for v1: health
page, meals, routines, calendar view. Web stays canonical.

Shared plumbing: `packages/api-client` gains bearer-token auth mode; server
gains `life_push_tokens` storage + Expo Push API sender; actionable-create
call sites fan out push notifications.

Full prompt: [`docs/agent-prompts/kim-mobile.md`](./agent-prompts/kim-mobile.md).

## After all four land

The Kim backlog collapses to long-tail polish (QBL-85 retention cron,
QBL-84 mobile activity parity), plus anything new that accumulates during
parallel work. The vault / orgs / ee tracks remain untouched and can be
picked up independently.
