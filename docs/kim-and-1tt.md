# kim and 1tt

Why kim is a separate app on its own domain, what lives where, and how
the two sites relate.

## TL;DR

**1tt.dev** is a developer-tools platform. Free, fast, no sign-up for most
things. Brand: utilitarian, technical, a junk drawer of small useful tools.

**kim1.ai** is a personal life agent. Sign-in required. Brand: quiet,
personal, editorial. The whole experience is built around one conversation
with kim — routines, meals, workouts, calendar, actionables, reviews.

They share a user identity (same email = same account) and a backend, but
they're otherwise separate: separate domains, separate better-auth
instances, separate Cloudflare workers, separate OAuth apps, separate UIs.

## Why separate

The "life agent" surface grew inside `1tt.dev/tools/life/*` and ended up
having nothing in common with the rest of the tools platform:

- **Audience**: devs visiting for a JSON beautifier don't want a sidebar
  full of meal plans. Users of kim don't care about SSL checkers.
- **Aesthetic**: 1tt is utilitarian (dense info, lots of color), kim is
  quiet (serif display font, amber accents, generous whitespace).
- **Engagement model**: 1tt is hit-and-run, kim is a daily-driver app.
- **Branding**: "1tt.dev/tools/life" was long and forgettable. "kim1.ai"
  is a name, with its own identity.

Splitting also let us:

- Drop most of the 1tt.dev JS bundle from kim's deploy.
- Drop the entire kim surface from 1tt.dev's deploy.
- Iterate on kim's design language without worrying about regressions on
  the developer-tools side.
- Scale the two independently (different caches, different rate limits,
  different release cadences).

The alternative — keeping everything on `1tt.dev` with host-based middleware
rewriting for `kim.1tt.dev` — worked, but never felt right. Two products
wearing one coat.

## Public URL layout

### 1tt.dev

| Path | Purpose |
|---|---|
| `/` | Landing + search |
| `/tools/*` | Every dev tool (JSON, JWT, QR, …) |
| `/shop`, `/shop/*` | Merch (Medusa) |
| `/account/*` | Hosted DB dashboards, billing, sync |
| `/docs/*`, `/guides/*` | Reference + long-form guides |
| `/p/[id]` | Pasted snippets (paste tool) |
| `/s/[slug]` | Short links |
| `/login` | Sign-in (optional for most tools) |

1tt.dev no longer serves any `/tools/life/*` routes. It no longer serves
`/m/[slug]` either — public marketplace shares moved to kim.

### kim1.ai

| Path | Purpose |
|---|---|
| `/` | Dashboard — today's actionables, events, routines |
| `/routines` | Routine list + create + detail |
| `/calendar` | Google Calendar view |
| `/health` | Health tracking (weight, meals, sessions) |
| `/actionables` | Task list / inbox |
| `/memories` | Long-term kim memory entries |
| `/marketplace` | Browse community-published routines, meal plans, gym sessions |
| `/marketplace/mine` | Your own published items |
| `/marketplace/[id]` | Detail + fork |
| `/chat`, `/chat/[id]` | Full-screen kim chat history |
| `/channels` | Kim notification channels |
| `/settings` | Profile + preferences |
| `/login` | Sign-in (required for everything except `/login` and `/m`) |
| `/m/[slug]` | Public share page for a published marketplace item |

There is no `/tools/life` prefix anywhere in kim — routes are flat.

## Route grouping in kim

`apps/kim/src/app/` looks like this:

```
src/app/
├── layout.tsx           # Bare root layout (fonts, theme, providers)
├── (app)/
│   ├── layout.tsx       # Authenticated shell (AuthGate, KimHeader, LifeNav, KimDrawer)
│   ├── page.tsx         # Dashboard
│   ├── routines/
│   ├── calendar/
│   ├── health/
│   ├── actionables/
│   ├── memories/
│   ├── marketplace/
│   ├── chat/
│   ├── channels/
│   └── settings/
├── login/               # Bare — no shell
│   ├── page.tsx
│   └── login-content.tsx
├── m/[slug]/            # Bare public share pages — no shell
└── api/                 # API routes (auth, proxy)
```

The `(app)` route group is the thing that gives kim its "agent UI" — header
on top, nav rail on the left, main content, kim drawer on the right. It's
wrapped in `AuthGate`, which redirects to `/login` if there's no session.

`/login` and `/m/[slug]` inherit the bare root layout so they render
full-bleed without the authenticated shell around them.

## Brand cues (for future design work)

- **Typography**: Instrument Serif italic for display, JetBrains Mono for
  metadata and labels, Geist Sans for body. Avoid Inter.
- **Accent color**: amber (`#fbbf24` / `#f59e0b`). Used sparingly — glows,
  status dots, tool-call chips in the chat.
- **Surface**: near-black (`#0a0a0a`). Dark-first, with subtle radial
  gradients and grid overlays, never flat.
- **Voice**: lowercase, quiet, a little wry. "come in." not "Sign in!".
- **Motion**: restrained. Staggered rise on mount, typed transcripts,
  slow orbiting accents. Never bouncing or flashing.

See the login page (`apps/kim/src/app/login/login-content.tsx`) for a
concrete example of the direction.

## What still lives on 1tt.dev

The things that stayed:

- The full tools platform at `/tools/*` (JWT, JSON, QR, diff, …).
- The shop.
- Account dashboards (hosted Postgres/SQLite/Redis/R2).
- Marketing, docs, guides, blog.
- The developer CLI at `1tt.dev/cli/install.sh`.

None of these have a kim equivalent, and none of them need to move.
