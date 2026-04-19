# Agent prompt — Track B: Background agent activity (QBL-78)

**Model:** Sonnet 4.6 (`/model claude-sonnet-4-6`). This prompt was assembled
by Opus 4.7 with the full context you need; don't re-explore files already
quoted below unless a change has obviously landed after prompt time.

**Worktree:** `/Users/nima/p/1tt-activity` on branch `kim/activity`.

---

## Mission

Make every async Kim invocation (journey flows, scheduled jobs, actionable
replies) visible to the user. Implement the 8-issue Linear epic **QBL-78**.
Ship backend first; drawer UI last (after Track A merges).

Three user-visible outcomes:

1. Persistent log of every background agent run (`life_agent_runs` table).
2. Pulse indicator in the Kim drawer header when anything is running.
3. "Activity" section listing recent runs with status + tool calls +
   deep-links to the actionables they produced.

## Current async call sites you must retrofit

All use naked `go func()` — wrap with `tracked.Run(...)`.

**1. `api/internal/handler/life.go:1627`** — actionable response processing
after user confirms/chooses:

```go
// current
go func() {
    var title, aType string
    _ = db.QueryRowContext(context.Background(),
        `SELECT title, type FROM life_actionables WHERE id = $1`,
        actionableID,
    ).Scan(&title, &aType)
    responseStr, _ := json.Marshal(responseData)
    chatResult, err := agent.ProcessActionableResponse(
        context.Background(), db, userID,
        life.ActionableRecord{ID: actionableID, Type: aType, Title: title},
        string(responseStr),
    )
    _ = err
    _ = chatResult
}()

// target
tracked.Run(context.Background(), db, tracked.Run Args{
    UserID:  userID,
    Kind:    "actionable_response",
    Trigger: actionableID,
}, func(ctx context.Context) (tracked.RunOutput, error) {
    /* same body, return RunOutput with tool calls + summary + actionable_ids */
})
```

**2. `api/internal/handler/health.go:1313`** — gym session update → journey
event. Trigger: `life.JourneyTriggerGymSessionUpdated`. Coordinate with
Track C: their `ProcessJourneyEvent` is the callee; wrap its invocation.

**3. `api/internal/handler/health.go:891`** — meal plan update → journey
event. Trigger: `life.JourneyTriggerMealPlanUpdated`.

**4. `api/internal/handler/life.go:2295`** — routine update → journey
event. Trigger: `life.JourneyTriggerRoutineUpdated`.

**5. `api/internal/life/scheduler.go`** — `RunUserCycle()` executes morning
plan / evening plan / evening review. Wrap the top-level invocation inside
the scheduler cron loop (find the caller of `RunUserCycle`).

**6. Any other `go func()` in `api/internal/` that calls `agent.Chat()` /
`agent.ChatStream()` / `agent.ProcessActionableResponse()`.** Grep before
submitting:

```bash
rg -n 'go func|go life\.|go kim\.' api/internal/
```

## Interfaces quoted for you

### `ChatAgent` (what `tracked.Run` must not break)

`api/internal/life/agent.go` — full contents:

```go
package life

import (
    "context"
    "database/sql"

    "github.com/n1rna/1tt/api/internal/ai"
)

type ChatAgent interface {
    Chat(ctx context.Context, req ChatRequest) (*ChatResult, error)
    ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error)
    ProcessActionableResponse(ctx context.Context, db *sql.DB, userID string, actionable ActionableRecord, response string) (*ChatResult, error)
    GCalClient() *GCalClient
    LLMConfig() *ai.LLMConfig
}

type ToolEffect  = ai.ToolEffect
type StreamEvent = ai.StreamEvent
type ChatResult  = ai.ToolAgentResult

type ChatRequest struct {
    UserID                  string
    Message                 string
    History                 []Message
    Memories                []Memory
    Profile                 *Profile
    Routines                []Routine
    PendingActionablesCount int
    CalendarEvents          []GCalEvent
    RoutineEventLinks       map[string][]string
    AutoApprove             bool
    SystemContext           string
    ConversationCategory    string
    HealthProfile           *HealthProfile
    ActiveSessions          []SessionSummary
    ActionableSource        map[string]any
}

type ActionableRecord struct {
    ID, Type, Title, Description string
}
```

`ChatResult.Effects` contains the list of tool calls. Each effect has at
least `.Tool` (string) and `.Result` (string). Use these to populate
`tool_calls` JSONB in the runs table.

### Middleware (user context)

`api/internal/middleware/auth.go`:

```go
type contextKey string
const UserIDKey contextKey = "userID"

func GetUserID(ctx context.Context) string {
    if v, ok := ctx.Value(UserIDKey).(string); ok { return v }
    return ""
}
```

## Implementation plan (strict order)

### Step 1 — QBL-79: schema + `tracked.Run` helper

**Migration** `api/internal/database/migrations/045_life_agent_runs.sql`:

```sql
-- +goose Up

CREATE TABLE life_agent_runs (
    id              TEXT        NOT NULL PRIMARY KEY,
    user_id         TEXT        NOT NULL,
    kind            TEXT        NOT NULL,                -- 'journey' | 'scheduler' | 'actionable_response' | ...
    trigger         TEXT        NOT NULL DEFAULT '',     -- free-form context (entity id, cycle name, actionable id)
    status          TEXT        NOT NULL DEFAULT 'running', -- 'running' | 'succeeded' | 'failed'
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    duration_ms     INTEGER,
    tool_calls      JSONB       NOT NULL DEFAULT '[]',    -- [{tool, args, result, error}]
    error           TEXT        NOT NULL DEFAULT '',
    output_summary  TEXT        NOT NULL DEFAULT '',
    actionable_ids  TEXT[]      NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_life_agent_runs_user_started
    ON life_agent_runs (user_id, started_at DESC);
CREATE INDEX idx_life_agent_runs_running
    ON life_agent_runs (user_id) WHERE status = 'running';

-- +goose Down
DROP INDEX IF EXISTS idx_life_agent_runs_running;
DROP INDEX IF EXISTS idx_life_agent_runs_user_started;
DROP TABLE IF EXISTS life_agent_runs;
```

**Package** `api/internal/tracked/tracked.go`:

```go
// Package tracked wraps background agent goroutines so every invocation
// lands a row in life_agent_runs, capturing status, tool calls, and the
// actionables it produced. Callers replace `go func() { ... }()` with
// `tracked.Run(ctx, db, args, func(ctx) (RunOutput, error) { ... })`.
package tracked

import (
    "context"
    "database/sql"
    "encoding/json"
    "log"
    "time"

    "github.com/google/uuid"
)

type Args struct {
    UserID  string
    Kind    string
    Trigger string
}

type RunOutput struct {
    ToolCalls      []ToolCall
    OutputSummary  string
    ActionableIDs  []string
}

type ToolCall struct {
    Tool   string `json:"tool"`
    Args   any    `json:"args,omitempty"`
    Result string `json:"result,omitempty"`
    Error  string `json:"error,omitempty"`
}

// Run spawns a goroutine that executes fn. The run is recorded in
// life_agent_runs before fn starts and updated with status / output /
// error after fn returns. Errors are logged but not returned — Run is
// fire-and-forget, matching the pattern it replaces.
func Run(parent context.Context, db *sql.DB, args Args, fn func(ctx context.Context) (RunOutput, error)) {
    runID := uuid.NewString()
    started := time.Now()

    if _, err := db.ExecContext(parent, `
        INSERT INTO life_agent_runs (id, user_id, kind, trigger, status, started_at)
        VALUES ($1, $2, $3, $4, 'running', $5)`,
        runID, args.UserID, args.Kind, args.Trigger, started,
    ); err != nil {
        log.Printf("tracked.Run: insert: %v", err)
        // continue anyway — don't lose the work
    }

    go func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
        defer cancel()

        out, err := fn(ctx)
        finished := time.Now()
        duration := finished.Sub(started).Milliseconds()

        status := "succeeded"
        errStr := ""
        if err != nil {
            status = "failed"
            errStr = err.Error()
        }

        toolCallsJSON, _ := json.Marshal(out.ToolCalls)
        if _, uerr := db.ExecContext(context.Background(), `
            UPDATE life_agent_runs
               SET status = $1, finished_at = $2, duration_ms = $3,
                   tool_calls = $4, error = $5, output_summary = $6,
                   actionable_ids = $7
             WHERE id = $8`,
            status, finished, duration, toolCallsJSON, errStr,
            out.OutputSummary, out.ActionableIDs, runID,
        ); uerr != nil {
            log.Printf("tracked.Run: update: %v", uerr)
        }
    }()
}
```

Unit test `tracked_test.go`: use `sqlmock` to verify INSERT + UPDATE
called with expected columns. Also test that `fn` returning an error
writes `status='failed'` + `error` column populated.

### Step 2 — QBL-80: retrofit call sites

Replace the 4 known `go func()` blocks and any others grep finds.
Helper to turn a `life.ChatResult` into a `tracked.RunOutput`:

```go
// place near tracked.Run, or in a separate adapter if it needs to import life
func ResultToRunOutput(res *life.ChatResult) RunOutput {
    if res == nil {
        return RunOutput{}
    }
    calls := make([]ToolCall, 0, len(res.Effects))
    actionableIDs := []string{}
    for _, e := range res.Effects {
        calls = append(calls, ToolCall{
            Tool:   e.Tool,
            Result: e.Result,
        })
        if e.Tool == "create_actionable" {
            // parse e.Result JSON to extract actionable_id
            var r struct{ ActionableID string `json:"actionable_id"` }
            _ = json.Unmarshal([]byte(e.Result), &r)
            if r.ActionableID != "" {
                actionableIDs = append(actionableIDs, r.ActionableID)
            }
        }
    }
    return RunOutput{
        ToolCalls:     calls,
        OutputSummary: res.Text,
        ActionableIDs: actionableIDs,
    }
}
```

If `tracked` importing `life` creates a cycle, put the adapter in a new
package `api/internal/agentruns/` instead — OK.

### Step 3 — QBL-81: API

New file `api/internal/handler/agent_runs.go`:

```go
func ListAgentRuns(db *sql.DB) http.HandlerFunc     // GET /life/agent-runs?limit=50&since=...
func GetAgentRun(db *sql.DB) http.HandlerFunc       // GET /life/agent-runs/{id}
func AgentRunsPulse(db *sql.DB) http.HandlerFunc    // GET /life/agent-runs/pulse  -> { running: bool, count: int }
```

Register in `api/cmd/server/main.go` inside the existing
`if db != nil { /* Life tool */ }` block:

```go
r.Get("/life/agent-runs",         handler.ListAgentRuns(db))
r.Get("/life/agent-runs/pulse",   handler.AgentRunsPulse(db))
r.Get("/life/agent-runs/{id}",    handler.GetAgentRun(db))
```

Client in `packages/api-client/src/life.ts` — **additive only**:

```ts
export interface LifeAgentRun {
  id: string;
  userId: string;
  kind: string;
  trigger: string;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  toolCalls: { tool: string; args?: unknown; result?: string; error?: string }[];
  error: string;
  outputSummary: string;
  actionableIds: string[];
}
export interface LifeAgentRunsPulse { running: boolean; count: number; }

export async function listLifeAgentRuns(opts?: { limit?: number; since?: string }): Promise<LifeAgentRun[]>
export async function getLifeAgentRun(id: string): Promise<LifeAgentRun>
export async function getLifeAgentRunsPulse(): Promise<LifeAgentRunsPulse>
```

### Step 4 — QBL-85: retention

Add a new job inside the existing scheduler loop (same file as
`CheckDueCycles`). Function:

```go
// ArchiveOldAgentRuns deletes succeeded runs older than 30d and failed
// runs older than 90d. Called from the scheduler cron every hour.
func ArchiveOldAgentRuns(ctx context.Context, db *sql.DB) (int, error) {
    res, err := db.ExecContext(ctx, `
        DELETE FROM life_agent_runs
         WHERE (status = 'succeeded' AND finished_at < NOW() - INTERVAL '30 days')
            OR (status = 'failed'    AND finished_at < NOW() - INTERVAL '90 days')`)
    if err != nil { return 0, err }
    n, _ := res.RowsAffected()
    return int(n), nil
}
```

Wire into whatever cron driver the scheduler uses (reuse existing
cadence or add an hourly tick). Unit test with seeded old rows.

### Step 5 — QBL-82: drawer UI (blocks on Track A merge)

**Until Track A merges: do not touch `kim-drawer.tsx`.** Everything in
steps 1-4 ships independently.

Drawer wiring:

- Add a pulse dot to the drawer header. Amber `--warning`,
  1.4s pulse animation. Bound to `getLifeAgentRunsPulse()` polled every
  5s while drawer is open.
- Add an "Activity" collapsible section to the drawer. Rendered above
  the thread when thread is empty (in place of or next to starter chips
  per final design); collapsible below when thread has content.
- Each row: kind label, trigger, elapsed time, status chip. Tap expands
  to show tool calls.
- i18n namespace: add keys to `common.json` (all 7 locales):
  `activity_title`, `activity_running`, `activity_empty`,
  `activity_view_actionables`.

### Step 6 — QBL-83: deep link

Add `source=run_{id}` filter to the actionables page filter. Track C
owns `apps/kim/src/app/(app)/actionables/page.tsx`; coordinate so your
filter change lands after their journey-grouping change.

Minimum piece on your side: the "View N actionables" button in the
activity row routes to
`routes.actionables + '?source=run_' + run.id`. The actionables page
reads `searchParams.source` and filters by `run_id` prefix.

### Step 7 — QBL-84 (stretch): mobile parity

Only after Track D has shipped an initial app shell. Mirror pulse + list
via the same API client functions (once Track D's bearer-auth client
exists they work unchanged).

## Files you own (exclusive write access)

- New: `api/internal/database/migrations/045_life_agent_runs.sql`
- New: `api/internal/tracked/*.go` (and optionally `api/internal/agentruns/*.go`)
- New: `api/internal/handler/agent_runs.go`
- Narrow additions only:
  - `api/internal/life/scheduler.go` — retention cron hook + wrap cycle runner
  - `api/internal/life/journey.go` — wrap the outgoing agent call site (coordinate with Track C so your wrap sits AROUND their call, not inside)
  - `api/internal/handler/life.go` — wrap lines ~1627 goroutine
  - `api/internal/handler/health.go` — wrap lines ~891, ~1313 goroutines
  - `api/cmd/server/main.go` — register new `/life/agent-runs*` routes
- Additive in `packages/api-client/src/life.ts`
- AFTER Track A merges: drawer Activity + pulse pieces in
  `apps/kim/src/components/kim/` + `apps/kim/src/i18n/locales/*/common.json`

## Files you must NOT touch

- `apps/kim/src/app/**` layout / pages / global CSS — Track A.
- `apps/kim/src/components/layout/**` — Track A.
- `api/internal/life/journey.go` core logic (the prompt, buildJourneyChatRequest
  — only wrap the outer goroutine) — Track C owns this file's body.
- `apps/kim-mobile/**` — Track D.
- Migrations `043` (exists, Track C) or `044` (Track A). Take `045`.

## Success criteria

- `cd api && go test ./internal/tracked/... ./internal/handler/... -v` passes.
- Firing a journey event manually (update a meal plan) lands a row in
  `life_agent_runs` with `status='succeeded'`, populated `tool_calls`
  JSONB, and `actionable_ids` array if the run created actionables.
- `GET /life/agent-runs/pulse` returns `{"running": true, "count": N}`
  while a run is in flight.
- Retention query tested: insert a succeeded run dated 31d ago, run
  `ArchiveOldAgentRuns`, assert it's deleted.
- After Track A merges: pulse dot animates in the drawer header while a
  run is active; Activity section lists recent runs; "View N
  actionables" deep-links correctly.

## Non-goals

- Rewriting agent logic. `tracked.Run` is a thin wrapper.
- Backfilling historic runs.
- Server-sent events for the pulse. Polling every 5s is fine.
- Per-user rate limiting of background runs.

## When done

Open a PR: `feat(kim): background agent activity tracker (QBL-78)`.
The drawer-UI commit (QBL-82) can be a follow-up PR if Track A merges
late — don't block the backend ship.
