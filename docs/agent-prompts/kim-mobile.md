# Agent prompt — Track D: Kim mobile v1 (QBL-67)

**Model:** Sonnet 4.6 (`/model claude-sonnet-4-6`). This prompt was assembled
by Opus 4.7 with the full context you need; don't re-explore files already
quoted below unless a change has obviously landed after prompt time.

**Worktree:** `/Users/nima/p/1tt-mobile` on branch `kim/mobile`.

---

## Mission

Ship the Kim Mobile v1 epic **QBL-67** — 11 issues. New Expo (React
Native) app at `apps/kim-mobile/` that lets a signed-in user:

1. Chat with Kim (streaming).
2. Triage actionables (list, respond, bulk dismiss, journey groups).
3. Receive push notifications for new actionables.

Everything else (health, meals, routines, calendar, marketplace) stays
web-only for v1.

## Current state — nothing exists yet

`rg -n 'expo|react-native|mobile' apps/ packages/` returns no matches.
You are greenfield. The `apps/kim-mobile/` directory doesn't exist.

Existing web-side things you'll integrate with:

- `packages/api-client/src/{life.ts,health.ts,marketplace.ts,auth-schema.ts}`
  — uses browser `fetch` + cookies today.
- `apps/kim/src/lib/auth.ts` — better-auth with GitHub + Google social
  providers, Drizzle adapter on Neon HTTP, cookies scoped to host family
  (`.kim1.ai` in prod, `.lvh.me` in dev, `undefined` on localhost).
- `api/internal/middleware/auth.go` — validates `X-Session-Token` header
  (forwarded by Next.js proxy) against the `"session"` and `"user"`
  tables. Token lookup:

  ```go
  SELECT s."userId", u.email, u.name, s."expiresAt"
    FROM "session" s JOIN "user" u ON s."userId" = u.id
   WHERE s.token = $1
  ```

  If you send the header `X-Session-Token` directly from the mobile app
  with a valid session token, the middleware accepts it. That's the
  easiest path — no new auth layer needed.

- `apps/kim/src/lib/api-fetch.ts` — uses Cloudflare Service Binding on
  Workers, direct fetch in dev. Mobile won't use this; it talks to the
  public API origin directly.

## Plan

### 1. QBL-68 — Bootstrap Expo workspace

```bash
cd /Users/nima/p/1tt-mobile/apps
bun create expo-app kim-mobile --template blank-typescript
```

Then:

- Set strict TS (`tsconfig.json` already strict from template).
- Install expo-router:
  `cd apps/kim-mobile && bun add expo-router react-native-safe-area-context react-native-screens`
  and follow `https://docs.expo.dev/router/installation/`.
- Add to root `package.json` workspaces: already `apps/*`, so it picks
  up automatically. Confirm `bun install` at root resolves.
- Justfile (see `/Users/nima/p/1tt/justfile`): add

  ```make
  dev-kim-mobile:
      bun run --filter ./apps/kim-mobile start
  ```

- `apps/kim-mobile/package.json` scripts:

  ```json
  {
    "scripts": {
      "start": "expo start",
      "android": "expo start --android",
      "ios": "expo start --ios",
      "lint": "eslint .",
      "test": "vitest run"
    }
  }
  ```

- Bun discipline: **never** npm/yarn/pnpm.
- File-based routing:

  ```
  apps/kim-mobile/src/app/
    _layout.tsx                // root Stack with auth gate
    login.tsx                  // OAuth entry
    (auth)/_layout.tsx         // bottom-tab
    (auth)/chat.tsx
    (auth)/actionables/index.tsx
    (auth)/actionables/[id].tsx
    (auth)/settings.tsx
  ```

### 2. QBL-70 — API client for React Native

The web client in `packages/api-client/src/life.ts` uses:

```ts
async function lifeApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/life${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  /* error mapping, JSON parse */
}
```

It assumes:

- Relative URL (same-origin via Next.js proxy at `/api/proxy/life`).
- Browser cookie auth.

Mobile needs absolute URL + bearer token. **Refactor by factoring, not
forking**: add a client factory while keeping existing exports working
on the web.

```ts
// packages/api-client/src/client.ts (NEW)
export interface ApiClientOptions {
  baseUrl: string;                              // e.g. "https://kim1.ai/api/proxy/life" (web) or "https://api.kim1.ai/life" (mobile)
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  credentials?: RequestCredentials;             // "include" for web cookies; omit on mobile
}

export function createApiClient(opts: ApiClientOptions) {
  return async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };
    if (opts.getAuthHeaders) {
      Object.assign(headers, await opts.getAuthHeaders());
    }
    const res = await fetch(opts.baseUrl + path, {
      ...(opts.credentials ? { credentials: opts.credentials } : {}),
      ...init,
      headers,
    });
    /* same error mapping as lifeApiFetch */
  };
}
```

Then refactor `life.ts` to accept an `apiFetch` function at module
init. Two variants:

```ts
// packages/api-client/src/life.ts — keep the web default working
const defaultFetch = createApiClient({
  baseUrl: "/api/proxy/life",
  credentials: "include",
});

let _fetch = defaultFetch;
export function configureLifeClient(apiFetch: typeof defaultFetch) {
  _fetch = apiFetch;
}

export async function listLifeActionables(status?: string): Promise<LifeActionable[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await _fetch<{ actionables: LifeActionable[] }>(`/actionables${qs}`);
  return res.actionables;
}
```

Web app needs no change (defaults preserved). Mobile app calls
`configureLifeClient(createApiClient({ baseUrl: ..., getAuthHeaders: ... }))`
once on boot.

**Streaming** (`streamLifeChat` at `packages/api-client/src/life.ts:386`
approximately). RN's `fetch` doesn't natively support
`ReadableStream`. Use `expo-network` + `react-native-sse` OR raw
`XMLHttpRequest` chunked reading, OR migrate the streaming endpoint to
NDJSON and poll-read with `response.text()` — NDJSON is simpler cross-
platform. Pick the path with least friction; document the decision in
`apps/kim-mobile/docs/streaming.md`.

### 3. QBL-69 — OAuth sign-in

Simplest approach: web browser → existing better-auth OAuth flow →
custom deep-link scheme redirect back to the app with a session token.

- `expo-auth-session` manages the in-app browser launch + deep-link
  round-trip.
- `expo-secure-store` persists the token on device.
- Scheme: set `"scheme": "kim1"` in `app.json`. Deep-link target:
  `kim1://auth/callback?token=...`.
- Server: add a new route `GET /auth/mobile/token-exchange` on the Go
  API that, given a valid session cookie, returns the session token in
  the response body. Or skip the server addition and let the web app's
  `/auth/mobile-callback?next=kim1://auth/callback` page do the work
  (render the token into a deep-link anchor the user clicks after
  completing OAuth).
- Document the chosen flow in `apps/kim-mobile/docs/auth.md`.

Boot flow:

```ts
// apps/kim-mobile/src/lib/auth.ts
export async function getAuthHeaders() {
  const token = await SecureStore.getItemAsync("session_token");
  return token ? { "X-Session-Token": token } : {};
}
```

Configure api-client with that:

```ts
// apps/kim-mobile/src/lib/client.ts
import { configureLifeClient, createApiClient } from "@1tt/api-client";
import { getAuthHeaders } from "./auth";

configureLifeClient(createApiClient({
  baseUrl: Constants.expoConfig!.extra!.API_BASE_URL as string,   // e.g. "https://kim1.ai/api/proxy/life"
  getAuthHeaders,
}));
```

### 4. QBL-71 — Chat screen

`apps/kim-mobile/src/app/(auth)/chat.tsx`. Full-screen chat. Streaming
bubbles. Feature subset vs. web `/chat`:

- No slash commands
- No page-context attachment (there are no pages)
- Copy message
- History list via existing `listLifeConversations()` / `getLifeConversationMessages(id)`

Use `FlatList` inverted for performance. `react-native-markdown-display`
for markdown-lite rendering.

### 5. QBL-72 — Actionables screen

Mirror the web `/actionables` UX. Implement:

- List pending + optional toggle for resolved
- Pull-to-refresh
- Bulk-dismiss (select mode with long-press)
- Journey grouping (depends on Track C having shipped the `source`
  field — it ships before you, see roadmap)
- Respond actions: confirm / dismiss / choose option

Reuse the existing API client: `listLifeActionables()`,
`respondToActionable(id, action, data?)`, `bulkDismissActionables({...})`.

**Do not share code with the web UI** — RN primitives differ too much.
Copy patterns, not components.

### 6. QBL-73 — Push notifications (client)

```bash
cd apps/kim-mobile && bun expo install expo-notifications expo-device
```

Permission flow on first launch after login:

1. `Notifications.getPermissionsAsync()` → request if not granted.
2. `Notifications.getExpoPushTokenAsync()` → register with server
   via `POST /life/push-tokens`.
3. Subscribe a listener; on notification tap, route to
   `/actionables/${payload.actionableId}`.

### 7. QBL-74 — Push notifications (server)

Migration `api/internal/database/migrations/046_life_push_tokens.sql`:

```sql
-- +goose Up
CREATE TABLE life_push_tokens (
    id           TEXT        NOT NULL PRIMARY KEY,
    user_id      TEXT        NOT NULL,
    token        TEXT        NOT NULL,
    platform     TEXT        NOT NULL,     -- 'ios' | 'android'
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);
CREATE INDEX idx_life_push_tokens_user ON life_push_tokens (user_id);

-- +goose Down
DROP TABLE IF EXISTS life_push_tokens;
```

New package `api/internal/life/push.go`:

```go
package life

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"
)

type PushMessage struct {
    To    string         `json:"to"`
    Title string         `json:"title"`
    Body  string         `json:"body"`
    Data  map[string]any `json:"data,omitempty"`
    Sound string         `json:"sound,omitempty"` // "default"
}

// SendPush delivers messages via the Expo Push API.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/
func SendPush(ctx context.Context, messages []PushMessage) error {
    if len(messages) == 0 { return nil }
    body, _ := json.Marshal(messages)
    req, _ := http.NewRequestWithContext(ctx, "POST",
        "https://exp.host/--/api/v2/push/send", bytes.NewReader(body))
    req.Header.Set("Accept", "application/json")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{Timeout: 10 * time.Second}
    res, err := client.Do(req)
    if err != nil { return fmt.Errorf("expo push: %w", err) }
    defer res.Body.Close()
    if res.StatusCode >= 300 {
        log.Printf("expo push: http %d", res.StatusCode)
        return fmt.Errorf("expo push: status %d", res.StatusCode)
    }
    return nil
}
```

Handlers in new file `api/internal/handler/push.go`:

```go
POST   /life/push-tokens          → RegisterPushToken
DELETE /life/push-tokens/{token}  → DeletePushToken
```

Register in `api/cmd/server/main.go` inside the `Life tool` block.
**Put your route registrations at the BOTTOM of that block** in a
comment-delimited "Push notifications" section, far from Track B's
routes (which live near the top).

### 8. QBL-75 — Notification triggers

Every call site that INSERTs into `life_actionables` should fire push
to the user's registered devices (if any). Grep:

```bash
rg -n 'INSERT INTO life_actionables' api/internal/
```

Main hits:

- `api/internal/life/tools.go` — agent's `create_actionable` tool. Fire
  push after successful INSERT.
- `api/internal/life/day_summary.go` — scheduler-produced actionables.
- `api/internal/life/scheduler.go` — same.

Helper in `life/push.go`:

```go
func DispatchActionableNotification(ctx context.Context, db *sql.DB, userID, actionableID, title string) {
    var tokens []string
    rows, err := db.QueryContext(ctx,
        `SELECT token FROM life_push_tokens WHERE user_id = $1`, userID)
    if err != nil { return }
    defer rows.Close()
    for rows.Next() {
        var t string
        if err := rows.Scan(&t); err == nil { tokens = append(tokens, t) }
    }
    if len(tokens) == 0 { return }

    // Respect user preference
    var enabled bool = true
    _ = db.QueryRowContext(ctx,
        `SELECT push_enabled FROM user_preferences WHERE user_id = $1`, userID,
    ).Scan(&enabled)
    if !enabled { return }

    messages := make([]PushMessage, 0, len(tokens))
    for _, tok := range tokens {
        messages = append(messages, PushMessage{
            To: tok, Title: "Kim", Body: title, Sound: "default",
            Data: map[string]any{"actionableId": actionableID},
        })
    }
    if err := SendPush(ctx, messages); err != nil {
        log.Printf("push dispatch: %v", err)
    }
}
```

Preference column — migration
`api/internal/database/migrations/047_user_push_preferences.sql`:

```sql
-- +goose Up
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE;
-- +goose Down
ALTER TABLE user_preferences DROP COLUMN IF EXISTS push_enabled;
```

(If `user_preferences` doesn't exist, create it in the same migration.
Grep first.)

### 9. QBL-76 — Settings screen

`apps/kim-mobile/src/app/(auth)/settings.tsx`:

- Account info (name, email from `/auth/session` or similar)
- Sign out: clear SecureStore, route to `/login`
- Push toggle → `PUT /life/preferences/push` (add a handler if missing)

### 10. QBL-77 — EAS Build

```bash
cd apps/kim-mobile
bun add -d eas-cli
bunx eas login
bunx eas build:configure
```

Then `eas.json`:

```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview":     { "distribution": "internal" },
    "production":  { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

GitHub Action `.github/workflows/eas-build.yml` — **manual trigger
only** (`workflow_dispatch`), not on every push. Use `EXPO_TOKEN`
secret (you'll need the user to add this).

### 11. QBL-84 — Activity pulse (stretch)

Only if Track B has shipped. Call `getLifeAgentRunsPulse()` every 5s in
the chat header, show an amber dot.

## Files you own (exclusive write access)

- `apps/kim-mobile/**` — everything
- `eas.json`, `.github/workflows/eas-build.yml`
- Root `package.json` — add workspace script only if template doesn't
  auto-pick up
- `justfile` — add mobile dev recipe
- Additive refactor in `packages/api-client/src/`:
  - New: `client.ts`
  - Modify: `life.ts`, `health.ts`, `marketplace.ts` to delegate fetch
    to a module-configured function. **Web app behavior must not
    change.** Test by running `cd apps/kim && bun run lint && bunx tsc
    --noEmit`.
- New backend:
  - `api/internal/life/push.go`
  - `api/internal/handler/push.go`
  - Migrations `046_life_push_tokens.sql`,
    `047_user_push_preferences.sql` (rename if Track A already took
    044, or B took 045 — coordinate via file existence check)
  - Route registrations in `api/internal/handler/life.go` /
    `api/cmd/server/main.go` — ADDITIVE ONLY

## Files you must NOT touch

- `apps/kim/**` and `apps/web/**`. The only exception: adjust
  `packages/api-client` call sites only if you changed function
  signatures — **don't** change signatures.
- `api/internal/life/journey.go` — Track C (read-only OK).
- `api/internal/tracked/` — Track B.
- `api/internal/handler/life.go` existing handlers — **narrow
  additions only** (push routes + push dispatch call from
  `RespondToActionable`). Do not refactor existing code.
- Migrations `043`, `044`, `045` — other tracks.

## Cross-team seams

1. **`packages/api-client/src/life.ts`** — Tracks A, B, D all add
   exports here. You go LAST in this file; keep your additions below
   the final newline after their blocks. If you must refactor the
   module (step 2 above), time it so Tracks A and B are merged — then
   your refactor cleanly includes their new functions. Or refactor
   BEFORE them via a lightweight coordination commit on main. Pick
   based on merge order.
2. **`api/cmd/server/main.go`** — Track B adds routes too. Put your
   push routes in a block labeled `// Push notifications (mobile)` at
   the BOTTOM of the `Life tool` `if db != nil {}` block.

## Success criteria

- `cd apps/kim-mobile && bunx expo start` opens in simulator.
- OAuth flow works end-to-end on a real device (iOS tested manually;
  Android best-effort).
- Chat screen streams responses.
- Triaging an actionable succeeds; web `/actionables` reflects the
  state change.
- Creating an actionable on web fires a push to a registered device
  (manual test OK).
- `cd api && go test ./...` passes.
- `cd apps/kim-mobile && bunx tsc --noEmit && bun run lint` passes.
- `cd apps/kim && bunx tsc --noEmit && bun run lint` still passes
  (web didn't regress from api-client refactor).
- `eas build --profile preview --platform ios` produces an archive.

## Non-goals

- Parity with web health / meals / routines / calendar / marketplace.
- Offline queueing.
- Android-first pixel fidelity (iOS-first; Android "works").
- Replacing better-auth with a different provider.
- Watch or iPad app variants.

## When done

Open one PR: `feat(kim-mobile): v1 — chat + actionables + push
(QBL-67)`. Attach a TestFlight / EAS Update link in the description.
Note explicitly in the PR body: "Web app behavior unchanged; tsc + lint
for apps/kim still pass." so reviewers know to spot-check.
