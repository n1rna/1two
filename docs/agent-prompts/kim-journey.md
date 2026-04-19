# Agent prompt — Track C: Journey flows (QBL-42)

**Model:** Sonnet 4.6 (`/model claude-sonnet-4-6`). This prompt was assembled
by Opus 4.7 with the full context you need; don't re-explore files already
quoted below unless a change has obviously landed after prompt time.

**Worktree:** `/Users/nima/p/1tt-journey` on branch `kim/journey`.

---

## Mission

Ship the Journey Flows epic **QBL-42** — 5 issues. Async cascades: user
mutates a planning entity → agent detects downstream effects → surfaces
them as actionables tagged with a `source` so the UI can group and
explain them.

Triggers:

- `gym_session_updated` → cascade calendar events
- `meal_plan_updated` → cascade tasks + grocery list
- `routine_updated` → cascade calendar events

## Pre-flight

The working tree you were branched from **already contains a substantial
scaffold** (committed as `wip(kim/journey): ...` per the roadmap
pre-flight step). Verify by running:

```bash
git log --oneline -5
```

You should see a WIP commit with the files listed below. If anything is
missing, `git status` on branch base; if this commit wasn't created per
the roadmap, stop and surface it.

### Files already in place

- `api/internal/life/journey.go`
- `api/internal/life/journey_test.go`
- `api/internal/life/journey_integration_test.go`
- `api/internal/life/test_helpers_integration.go`
- `api/internal/life/tools_test.go`
- `api/internal/database/migrations/043_actionable_source.sql`
- Trigger wiring in `api/internal/handler/life.go:2295`,
  `api/internal/handler/health.go:891`, `api/internal/handler/health.go:1313`
- Actionables page change in `apps/kim/src/app/(app)/actionables/page.tsx`
  and `apps/kim/src/components/actionables/actionable-card.tsx`
- i18n actionables key additions across all 7 locales
- Client types `JourneyTrigger` and `ActionableSource` in
  `packages/api-client/src/life.ts`

### Your job

1. Audit and complete the scaffolding.
2. Confirm triggers actually fire in production code paths (not just
   behind an `if agent != nil` that always resolves true).
3. Finish journey grouping on the actionables page.
4. Write / update tests until they pass.
5. Ship as a single PR.

## The 5 issues

### QBL-42 parent — closes when children close.

### QBL-44 Gym session → calendar cascade

Trigger already fires from `UpdateHealthSession` at
`api/internal/handler/health.go:1310-1324`:

```go
if agent != nil {
    changeSummary := buildSessionChangeSummary(req.Title, req.Description, req.Active,
        req.TargetMuscleGroups, req.Equipment, req.EstimatedDuration, req.DifficultyLevel)
    go func(uid, entityID, entityTitle, summary string) {
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
        defer cancel()
        _ = life.ProcessJourneyEvent(ctx, db, agent, life.JourneyEvent{
            UserID:        uid,
            Trigger:       life.JourneyTriggerGymSessionUpdated,
            EntityID:      entityID,
            EntityTitle:   entityTitle,
            ChangeSummary: summary,
        })
    }(userID, s.ID, s.Title, changeSummary)
}
```

Verify `buildSessionChangeSummary` produces a useful diff string (agent
reads this to decide what changed). Add an integration test in
`api/internal/life/journey_integration_test.go` that seeds a gym session
+ a linked calendar event, triggers the flow, and asserts the agent
creates an actionable (mock the LLM with a deterministic output if
needed; see `test_helpers_integration.go`).

### QBL-45 Meal plan → tasks + grocery cascade

Trigger at `api/internal/handler/health.go:888-902`. Journey prompt in
`journey.go` mentions "grocery items, meal-prep tasks, or reminders"
(quoted below). Agent needs a stable diff string —
`buildMealPlanChangeSummary` should include:

- Added/removed meals by name
- Grocery list delta (if `p.Content.Grocery` changed)
- Macro target shifts if meaningful

Pay attention to the recent commit `2332db6 feat(kim): AI bulk meal
editing with multi-select + preview (QBL-50)`: bulk edits fire the same
update path, so the journey agent should run for each bulk save — one
run per save (not one per edit). Good: the handler fires the trigger
once per `UPDATE health_meal_plans`.

### QBL-46 Routine → calendar cascade

Trigger at `api/internal/handler/life.go:2295-2305`. Similar pattern.

### QBL-47 Wire into actionables system

Every journey-created actionable has `source = {kind:"journey",
trigger:..., entity_id:..., entity_title:...}` already — see
`buildJourneyChatRequest` in `journey.go` (quoted below). The actionables
page must:

- Group pending actionables by source. Create a "Journey" super-group
  above the flat list when any pending actionable has
  `source.kind === "journey"`.
- Within the Journey group, sub-group by `source.trigger`
  (gym_session_updated / meal_plan_updated / routine_updated). Label
  each sub-group with a human string (translation keys below).
- Each journey actionable card shows a small chip with the trigger +
  `source.entity_title` so the user knows WHY this was proposed.

Translation keys to add to all 7
`apps/kim/src/i18n/locales/{locale}/actionables.json` files:

```json
{
  "journey_group_title": "Journey",
  "journey_group_subtitle": "Cascading changes from recent updates",
  "journey_trigger_gym_session_updated": "Gym session update",
  "journey_trigger_meal_plan_updated":   "Meal plan update",
  "journey_trigger_routine_updated":     "Routine update",
  "journey_source_chip": "from {{title}}"
}
```

Translate manually into the 6 non-English locales. Run
`cd apps/kim && bun run test:i18n` to verify completeness.

## Quoted context (authoritative — don't re-discover)

### `api/internal/life/journey.go` (current contents)

```go
package life

import (
    "context"
    "database/sql"
    "fmt"
    "log"
)

const (
    JourneyTriggerGymSessionUpdated = "gym_session_updated"
    JourneyTriggerMealPlanUpdated   = "meal_plan_updated"
    JourneyTriggerRoutineUpdated    = "routine_updated"
)

type JourneyEvent struct {
    UserID        string
    Trigger       string
    EntityID      string
    EntityTitle   string
    ChangeSummary string
}

func ProcessJourneyEvent(ctx context.Context, db *sql.DB, agent ChatAgent, ev JourneyEvent) error {
    if ev.UserID == "" || ev.Trigger == "" {
        return fmt.Errorf("journey: user_id and trigger are required")
    }

    var profile Profile
    var wakeTime, sleepTime sql.NullString
    _ = db.QueryRowContext(ctx,
        `SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
        ev.UserID,
    ).Scan(&profile.Timezone, &wakeTime, &sleepTime)
    if wakeTime.Valid  { profile.WakeTime  = wakeTime.String  }
    if sleepTime.Valid { profile.SleepTime = sleepTime.String }

    var memories []Memory
    if rows, err := db.QueryContext(ctx,
        `SELECT id, category, content FROM life_memories
         WHERE user_id = $1 AND active = TRUE
         ORDER BY created_at DESC LIMIT 50`, ev.UserID,
    ); err == nil {
        for rows.Next() {
            var m Memory
            if err := rows.Scan(&m.ID, &m.Category, &m.Content); err == nil {
                memories = append(memories, m)
            }
        }
        rows.Close()
    }

    var routines []Routine
    if rows, err := db.QueryContext(ctx,
        `SELECT id, name, description FROM life_routines
         WHERE user_id = $1 AND active = TRUE`, ev.UserID,
    ); err == nil {
        for rows.Next() {
            var rt Routine
            if err := rows.Scan(&rt.ID, &rt.Name, &rt.Description); err == nil {
                routines = append(routines, rt)
            }
        }
        rows.Close()
    }

    var calendarEvents []GCalEvent
    if gcalCli := agent.GCalClient(); gcalCli != nil {
        if token, err := EnsureValidToken(ctx, db, gcalCli, ev.UserID); err == nil {
            if evs, err := gcalCli.ListEvents(ctx, token, 14); err == nil {
                calendarEvents = evs
            }
        }
    }

    req := buildJourneyChatRequest(ev, memories, routines, &profile, calendarEvents)

    result, err := agent.Chat(ctx, req)
    if err != nil {
        log.Printf("journey: agent chat for %s/%s: %v", ev.UserID, ev.Trigger, err)
        return fmt.Errorf("journey: agent chat: %w", err)
    }

    log.Printf("journey: %s for user %s → %d effects", ev.Trigger, ev.UserID, len(result.Effects))
    return nil
}

func buildJourneyChatRequest(
    ev JourneyEvent,
    memories []Memory,
    routines []Routine,
    profile *Profile,
    calendarEvents []GCalEvent,
) ChatRequest {
    source := map[string]any{
        "kind":    "journey",
        "trigger": ev.Trigger,
    }
    if ev.EntityID    != "" { source["entity_id"]    = ev.EntityID    }
    if ev.EntityTitle != "" { source["entity_title"] = ev.EntityTitle }

    return ChatRequest{
        UserID:               ev.UserID,
        Message:              journeyPrompt(ev),
        Memories:             memories,
        Profile:              profile,
        Routines:             routines,
        CalendarEvents:       calendarEvents,
        AutoApprove:          false,
        ConversationCategory: "auto",
        SystemContext:        journeySystemContext(ev),
        ActionableSource:     source,
    }
}

// journeyPrompt, journeySystemContext — see journey.go for the full strings.
```

### Client types (already in `packages/api-client/src/life.ts`)

```ts
export type JourneyTrigger =
  | "gym_session_updated"
  | "meal_plan_updated"
  | "routine_updated";

export interface ActionableSource {
  kind: "journey" | string;
  trigger?: JourneyTrigger | string;
  entity_id?: string;
  entity_title?: string;
}

export interface LifeActionable {
  /* …existing fields… */
  source?: ActionableSource;
}
```

### Migration `043_actionable_source.sql`

```sql
-- +goose Up
ALTER TABLE life_actionables ADD COLUMN source JSONB;
CREATE INDEX idx_life_actionables_source_trigger
    ON life_actionables ((source->>'trigger'))
    WHERE source IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_life_actionables_source_trigger;
ALTER TABLE life_actionables DROP COLUMN IF EXISTS source;
```

### How actionables are inserted (for reference in `tools.go`)

```go
const q = `
    INSERT INTO life_actionables
        (id, user_id, type, status, title, description, options, due_at, action_type, action_payload, source)
    VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, created_at`
```

Verify the INSERT actually includes the `source` column — if not, add it
and pull the value from `req.ActionableSource` via the agent glue. Grep:

```bash
rg -n 'INSERT INTO life_actionables' api/internal/
```

The agent's `create_actionable` tool is in `api/internal/life/tools.go`.
Confirm it reads `ActionableSource` from the pending `ChatRequest` and
writes it into the INSERT. If not, wire it — this is critical for the
UI grouping to work.

### Existing tests (signatures only — bodies already written)

```
journey_test.go:
  TestJourneyPrompt_GymSession_MentionsEntityAndChange
  TestJourneyPrompt_MealPlan_MentionsGroceryAndTasks
  TestJourneyPrompt_Routine_MentionsCalendar
  TestJourneyPrompt_UnknownTrigger_IncludesAll
  TestJourneyPrompt_NoChangeSummary_UsesPlaceholder
  TestJourneySystemContext_MentionsTrigger
  TestJourneySystemContext_ForcesActionablePath
  TestBuildJourneyChatRequest_SetsSourceAndAutoApproveOff
  TestBuildJourneyChatRequest_EmptyIDAndTitleAreOmitted
  TestBuildJourneyChatRequest_EmbedsPromptAndSystemContext
  TestBuildJourneyChatRequest_PassesThroughPreloadedContext

journey_integration_test.go:
  TestProcessJourneyEvent_EndToEnd_RoutineUpdated
  TestProcessJourneyEvent_EndToEnd_DirectCreateActionable
```

Run them first:

```bash
cd api
go test ./internal/life/ -v -run Journey
RUN_LIFE_INTEGRATION=1 LLM_API_KEY=... go test -tags integration \
    ./internal/life/ -v -run Journey -timeout 600s
```

Add two more integration tests:

1. `TestProcessJourneyEvent_EndToEnd_GymSessionUpdated_CreatesActionable`
   — seed a gym session, fire the journey event, assert one pending
   `life_actionables` row with `source->>'trigger' = 'gym_session_updated'`.
2. `TestProcessJourneyEvent_EndToEnd_MealPlanUpdated_CreatesGroceryActionable`
   — similar for meal plans.

### Actionables page (current opening — yours to extend)

`apps/kim/src/app/(app)/actionables/page.tsx` (first 80 lines already
quoted in roadmap context). Your addition: a `groupByJourney` helper and
a rendered "Journey" section above the pending list.

```tsx
// example helper to add
function groupPendingActionables(actionables: LifeActionable[]) {
  const pending = actionables.filter((a) => a.status === "pending");
  const journey: Record<string, LifeActionable[]> = {};
  const other: LifeActionable[] = [];
  for (const a of pending) {
    if (a.source?.kind === "journey" && a.source.trigger) {
      (journey[a.source.trigger] ??= []).push(a);
    } else {
      other.push(a);
    }
  }
  return { journey, other };
}
```

Render the Journey super-group collapsed by default if it has > 5 items.

## Coordinate with Track B

Track B will wrap the `ProcessJourneyEvent` goroutine call sites in
`tracked.Run(...)`. Keep `ProcessJourneyEvent`'s signature stable:

```go
func ProcessJourneyEvent(ctx context.Context, db *sql.DB, agent ChatAgent, ev JourneyEvent) error
```

Do not change it. Track B's wrap looks like:

```go
tracked.Run(ctx, db, tracked.Args{UserID: ev.UserID, Kind: "journey", Trigger: ev.Trigger},
    func(ctx context.Context) (tracked.RunOutput, error) {
        err := life.ProcessJourneyEvent(ctx, db, agent, ev)
        /* adapter collects effects via closure over `result` — see Track B prompt */
        return tracked.RunOutput{}, err
    })
```

If you need to return effects from `ProcessJourneyEvent` for Track B to
summarize, add an optional out-parameter or a `ProcessJourneyEventWithResult`
variant — **don't break the existing signature**.

## Files you own (exclusive write access)

- `api/internal/life/journey.go`, `journey_*_test.go`,
  `test_helpers_integration.go` (journey portions)
- `api/internal/database/migrations/043_actionable_source.sql`
- Narrow additions:
  - `api/internal/life/tools.go` — `create_actionable` tool reads
    `ActionableSource` from the chat request and INSERTs it. Only
    touch the INSERT statement + the function that assembles it.
  - `api/internal/handler/life.go:2214..2310` — routine update journey
    trigger. Coordinate with Track B so they wrap cleanly.
  - `api/internal/handler/health.go:794..902` (meal plan) and
    `:1199..1324` (gym session). Same wrap coordination.
- `apps/kim/src/app/(app)/actionables/page.tsx`
- `apps/kim/src/components/actionables/actionable-card.tsx`
- `apps/kim/src/i18n/locales/*/actionables.json` (all 7)
- `packages/api-client/src/life.ts` — journey types only. Additive.

## Files you must NOT touch

- `apps/kim/src/app/(app)/layout.tsx` and the shell — Track A.
- `apps/kim/src/components/layout/**` — Track A.
- `apps/kim/src/components/kim/**` — Track A.
- `apps/kim/src/app/globals.css` — Track A.
- `api/internal/tracked/` (new package) — Track B.
- Any `life_agent_runs` schema/handlers — Track B.
- `apps/kim-mobile/**` — Track D.

## Success criteria

- Gym session update → visible journey actionable in `/actionables`
  within ~5s (manual test OK).
- Meal plan bulk save (from the `2332db6` flow) produces one journey run
  with 0–5 actionables.
- `cd api && go test ./internal/life/ -v -run Journey` passes.
- `RUN_LIFE_INTEGRATION=1 LLM_API_KEY=... go test -tags integration
  ./internal/life/ -v -run Journey -timeout 600s` passes.
- `cd apps/kim && bun run test:i18n && bun run lint && bunx tsc --noEmit`
  passes.
- Actionables page renders a Journey super-group with per-trigger
  sub-groups when journey actionables exist.

## Non-goals

- Undo / auto-accept. User always confirms journey actionables.
- Cross-entity cascades (routine → meal plan).
- Real-time delivery. Polling / page refresh is fine.

## When done

Open one PR: `feat(kim,api): journey flows cascade agents (QBL-42)`.
This track should land **first** since Tracks A (via habit schema) and B
(via `tracked.Run` wrapping journey calls) build on the `source` column
and the journey call sites.
