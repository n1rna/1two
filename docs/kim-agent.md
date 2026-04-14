# Kim Agent Architecture

How the AI agent works, how to extend it, and the design decisions behind it.

## Overview

Kim is a skill-based AI agent that powers the personal assistant in
`apps/kim`. It handles life planning (routines, calendar, tasks) and
health/fitness (nutrition, workouts, tracking) through a composable
architecture where **skills** define what the agent knows and can do.

The agent lives in `api/internal/kim/`. Skill prompts are markdown files in
`api/skills/`, embedded at build time via Go's `embed.FS`. Tool
implementations stay in `api/internal/life/`.

```
api/
├── skills/                     # Skill prompt markdown files
│   ├── embed.go                # Go embed directive (//go:embed *.md)
│   ├── core.md                 # Personality, formatting, health guidance
│   ├── memory.md               # Remember/forget instructions
│   ├── routines.md             # Routine management
│   ├── calendar.md             # Calendar operations
│   ├── tasks.md                # Task management
│   ├── health.md               # Health profile, weight tracking
│   ├── meals.md                # Meal planning
│   ├── gym.md                  # Workout sessions
│   ├── actionables.md          # Actionable creation
│   ├── cross-domain.md         # Cross-domain utilities
│   ├── marketplace.md          # Marketplace browsing/forking
│   ├── decision-framework.md   # Decision-making guidance
│   ├── auto-approve.md         # Auto-execute mode instructions
│   ├── require-approval.md     # Confirmation mode instructions
│   ├── day-summary.md          # Daily summary generation
│   ├── scheduler-context.md    # Shared scheduler context
│   ├── scheduler-morning-plan.md
│   ├── scheduler-evening-plan.md
│   └── scheduler-evening-review.md
├── internal/
│   ├── kim/
│   │   ├── skill.go            # Skill type, SkillRegistry, DefaultRegistry
│   │   ├── tools.go            # Tool definitions organized by skill
│   │   ├── prompt.go           # System prompt composition
│   │   ├── agent.go            # Agent struct, Chat, ChatStream
│   │   ├── kim_test.go         # Unit tests (no LLM needed)
│   │   └── agent_integration_test.go  # Integration tests (real LLM)
│   └── life/
│       ├── agent.go            # ChatAgent interface, shared data types
│       └── tools.go            # Tool implementations (ExecuteTool)
```

## Core concepts

### Skills

A skill is a self-contained unit of agent capability. Each skill has:

| Field | Purpose |
|---|---|
| `ID` | Unique identifier, matches the markdown filename |
| `Name` | Human-readable label |
| `Prompt` | Instructions loaded from `api/skills/{id}.md` |
| `Tools` | Tool definitions (JSON schemas) this skill provides |
| `Categories` | Which conversation categories activate this skill |
| `AlwaysOn` | If true, included in every conversation regardless of category |
| `Priority` | Controls ordering in prompt assembly (lower = earlier) |
| `FocusPrompt` | Optional hint shown when this skill's category is active |

Skills are registered in `DefaultRegistry()` in `skill.go`.

### Categories

The frontend sends a `ConversationCategory` with each chat request. The
agent uses it to select which skills and tools are active:

| Category | Active skills (beyond always-on) |
|---|---|
| `""`, `"life"`, `"general"`, `"auto"` | routines, calendar, tasks |
| `"routines"` | routines |
| `"calendar"` | calendar, tasks |
| `"health"` | health, meals, gym |
| `"meals"` | health, meals |
| `"gym"` | health, gym |

Always-on skills (core, memory, actionables, cross-domain, marketplace,
decision-framework, admin) are included in every category.

This keeps the tool count focused — a health conversation doesn't see
calendar tools, and vice versa.

### Prompt composition

`BuildSystemPrompt()` assembles the system prompt from active skills and
dynamic context. The sections are composed in this order:

1. **Skill prompts** — markdown content from each active skill, in priority
   order
2. **Date/time context** — current date, time, day of week in user's timezone,
   plus wake/sleep times from the user's profile
3. **User memories** — facts, preferences, instructions, habits stored by the
   agent (with IDs so the agent can reference or forget them)
4. **Focus prompt** — a category-specific hint (e.g., "User is on the routines
   page — focus on routine management")
5. **Dynamic data** — varies by category:
   - **Health/meals/gym**: health profile stats, nutrition targets, BMI/BMR/TDEE,
     active workout sessions
   - **Life/general**: active routines (with linked calendar events), upcoming
     events (7 days), pending actionable count
6. **Approval mode** — either auto-approve or require-approval instructions
7. **Additional context** — extra system context appended by the caller

The prompt builder includes entity IDs (routine IDs, event IDs, session IDs)
so the agent can call tools like `update_calendar_event(id="evt_abc")` directly
without a lookup round-trip.

## Tool inventory

33 tools organized across 11 skill functions in `tools.go`:

| Skill | Tools |
|---|---|
| **memory** | `remember`, `forget` |
| **actionables** | `create_actionable`, `list_actionables` |
| **routines** | `create_routine`, `update_routine`, `delete_routine`, `list_routines` |
| **calendar** | `get_calendar_events`, `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`, `link_event_to_routine` |
| **tasks** | `list_tasks`, `create_task`, `complete_task`, `update_task`, `delete_task`, `create_task_list` |
| **health** | `update_health_profile`, `log_weight`, `complete_onboarding`, `get_health_summary` |
| **meals** | `generate_meal_plan` |
| **gym** | `create_session`, `update_session`, `add_exercise_to_session`, `remove_exercise_from_session` |
| **cross-domain** | `get_life_summary`, `search_marketplace`, `fork_marketplace_item` |
| **marketplace** | _(tools in cross-domain above)_ |
| **admin** | `dismiss_actionables`, `draft_form` |

Tool definitions are Go code (JSON schemas need strong typing). Tool
**implementations** live in `life.ExecuteTool()` in `api/internal/life/tools.go`.

## Agent execution flow

```
ChatRequest
  │
  ├─ CompactHistory() — compress old turns if conversation is long
  │
  ├─ buildConfig()
  │   ├─ PromptContext from ChatRequest fields
  │   ├─ BuildSystemPrompt(registry, promptCtx)
  │   ├─ ToolsForCategory(category) — deduplicated, category-filtered
  │   └─ ToolAgentConfig { messages, tools, execute, maxRounds=5 }
  │
  └─ ai.RunToolAgent() — ReAct loop
      ├─ Call LLM with system prompt + tools
      ├─ If LLM returns tool calls → execute via life.ExecuteTool()
      ├─ Feed results back to LLM
      ├─ Repeat (up to 5 rounds)
      └─ Return ChatResult { Text, Effects }
```

The `ChatAgent` interface in `life/agent.go` abstracts the agent so handlers
don't need to know the implementation:

```go
type ChatAgent interface {
    Chat(ctx context.Context, req ChatRequest) (*ChatResult, error)
    ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error)
    ProcessActionableResponse(ctx, db, userID, actionable, response) (*ChatResult, error)
    GCalClient() *GCalClient
    LLMConfig() *ai.LLMConfig
}
```

## How to add a new skill

### 1. Write the skill prompt

Create `api/skills/my-skill.md`:

```markdown
## My skill

Instructions for the agent about this skill's domain.

### tool_name
When to use this tool, what it does, edge cases to handle.

### another_tool
More tool-specific guidance.
```

Keep it focused — the agent's context window is shared across all active
skills. Write instructions the way you'd brief a human assistant: what to
do, when to do it, what to avoid.

The embed directive in `api/skills/embed.go` uses `//go:embed *.md` so new
files are picked up automatically.

### 2. Define tool schemas

Add a function in `api/internal/kim/tools.go`:

```go
func mySkillTools() []llms.Tool {
    return []llms.Tool{
        {
            Type: "function",
            Function: &llms.FunctionDefinition{
                Name:        "my_tool",
                Description: "Clear description of what this tool does",
                Parameters: map[string]any{
                    "type": "object",
                    "properties": map[string]any{
                        "param1": map[string]any{
                            "type":        "string",
                            "description": "What this parameter means",
                        },
                    },
                    "required": []string{"param1"},
                },
            },
        },
    }
}
```

**Tool definition conventions:**
- Tool names use `snake_case`
- Descriptions should be action-oriented ("Create a...", "Update the...")
- Include `enum` constraints where possible to guide the LLM
- Mark truly required parameters in `required` — optional ones let the LLM
  make reasonable defaults
- Keep parameter descriptions short but unambiguous

### 3. Implement the tool

Add a case in `life.ExecuteTool()` in `api/internal/life/tools.go`:

```go
case "my_tool":
    // Parse args, validate, execute, return JSON result
    param1, _ := args["param1"].(string)
    result, err := doMyThing(ctx, db, userID, param1)
    if err != nil {
        return fmt.Sprintf(`{"error":"%s"}`, err), nil
    }
    return fmt.Sprintf(`{"status":"ok","id":"%s"}`, result.ID), nil
```

Tool implementations return a JSON string. The agent reads this to decide
next steps or compose a response.

### 4. Register the skill

In `DefaultRegistry()` in `skill.go`:

```go
r.Register(&Skill{
    ID:         "my-skill",
    Name:       "My Skill",
    Prompt:     loadSkillPrompt("my-skill.md"),
    Tools:      mySkillTools(),
    Categories: []string{"my-category", "life", "general", "auto", ""},
    AlwaysOn:   false,       // true if needed in every conversation
    Priority:   250,         // ordering relative to other skills
    FocusPrompt: "The user is focused on [domain] — prioritize [domain] operations.",
})
```

**Priority guidelines:**
- 0–99: foundational (core personality)
- 100–199: always-on utilities (memory, actionables)
- 200–399: domain-specific skills (routines, calendar, health)
- 900+: meta-skills (decision framework, approval modes)

### 5. Write tests

**Unit test** — verify skill registration, tool presence, category
filtering. Add to `kim_test.go`:

```go
func TestForCategory_MyCategory(t *testing.T) {
    r := DefaultRegistry()
    skills := r.ForCategory("my-category")
    found := false
    for _, s := range skills {
        if s.ID == "my-skill" { found = true }
    }
    if !found {
        t.Error("my-skill should be active for my-category")
    }
}
```

**Integration test** — verify the LLM uses the tool correctly. Add to
`agent_integration_test.go`:

```go
func TestKim_MySkill_DoSomething(t *testing.T) {
    mock := newMockTools()
    res := runAgent(t, mock, life.ChatRequest{
        UserID:               "test-user",
        Message:              "Please do the thing with param1=hello",
        Profile:              defaultProfile(),
        ConversationCategory: "my-category",
        AutoApprove:          true,
    })
    if !hasTool(res, "my_tool") {
        t.Errorf("expected my_tool; got %v", toolNames(res))
    }
}
```

### 6. Run tests

```bash
cd api

# Unit tests (instant, no LLM)
go test ./internal/kim/ -v

# Integration tests (requires LLM API key)
RUN_LIFE_INTEGRATION=1 LLM_API_KEY=... go test -tags integration ./internal/kim/ -v -timeout 600s
```

## Design decisions and patterns

These patterns were informed by studying production agent architectures
(including Claude Code) and adapted for our use case.

### Skill-based composition over monolithic prompts

**Before:** One giant `buildSystemPrompt()` function (400+ lines) with all
instructions inlined as Go string constants. Hard to read, edit, or
understand what the agent was told.

**After:** Each skill's instructions are a standalone markdown file. You can
read `api/skills/meals.md` and immediately understand what the agent knows
about meal planning. Editing a prompt doesn't require touching Go code.

### Category-filtered tool selection

The agent only sees tools relevant to the current conversation. A health
chat gets 15 tools instead of 33. This reduces confusion, lowers token
usage, and makes the LLM more likely to pick the right tool.

The registry handles deduplication — if two active skills provide the same
tool (e.g., `get_health_summary` in both health and meals contexts), it
appears once.

### Entity IDs in prompt context

The prompt builder injects IDs for routines, events, sessions, and
actionables directly into the system prompt. This lets the agent call
mutation tools (update, delete) without a fetch round-trip:

```
Your routines:
- [rt_abc] Morning gym — Lift 3x/week
- [rt_def] Evening reading — 30min before bed

Upcoming events:
- [evt_123] Standup — Mon 9:00–9:15
```

The agent sees `[rt_abc]` and can directly call
`delete_routine(routine_id="rt_abc")` instead of first calling
`list_routines` to find the ID.

### Separation of definition vs implementation

Tool **definitions** (JSON schemas, names, descriptions) live in `kim/tools.go`.
Tool **implementations** (database calls, API calls, business logic) live in
`life/tools.go`. This keeps the kim package focused on agent orchestration
while life handles the actual work.

The boundary is the `life.ExecuteTool()` function — kim calls it with a tool
name and arguments, life executes it and returns a JSON string.

### Embedded skill files

Skill markdown files are embedded at compile time via `//go:embed *.md` in
`api/skills/embed.go`. This means:

- No filesystem access needed at runtime (important for Cloudflare Workers)
- Adding a new `.md` file is automatically picked up by the embed directive
- The binary is fully self-contained

### Approval modes

Two skill files (`auto-approve.md` and `require-approval.md`) control whether
the agent executes actions directly or creates actionables for user
confirmation. The prompt builder loads one or the other based on the
`AutoApprove` flag in the request — they're never both active.

### History compaction

Long conversations are compressed via `life.CompactHistory()` before being
sent to the LLM. This keeps the agent within context limits while preserving
the essential information from earlier turns.

## Writing effective skill prompts

Lessons from building and testing 19 skill prompts:

1. **Be specific about tool usage.** Don't just describe tools — explain
   *when* to use them and *when not to*. "Use `generate_meal_plan` only when
   the user explicitly asks for a meal plan, not for general nutrition
   questions."

2. **Include edge cases.** "If the user asks to delete all routines, confirm
   first even in auto-approve mode."

3. **Cross-reference other skills.** "After creating a routine, suggest
   linking it to a calendar event using `link_event_to_routine`."

4. **Keep it concise.** Every token in the system prompt competes with
   conversation context. Write instructions as if briefing a competent
   assistant — don't over-explain obvious things.

5. **Use markdown structure.** Headers, lists, and bold text help the LLM
   parse instructions. Use `### tool_name` sections so the agent can quickly
   find guidance for a specific tool.

6. **Test with integration tests.** Write a test that gives the agent a
   natural language request and verifies it picks the right tool. If it
   doesn't, the prompt needs work — not the code.

## Writing good tool definitions

1. **Descriptions matter more than parameter names.** The LLM reads the
   `description` field to decide which tool to call. Make descriptions
   action-oriented and unambiguous.

2. **Use enums.** If a parameter has a fixed set of valid values, use
   `"enum": [...]`. This prevents hallucinated values and gives the LLM a
   menu to pick from.

3. **Don't over-require parameters.** If a parameter has a sensible default
   (e.g., `date` defaults to today), make it optional. The LLM will fill it
   in when the user specifies, and the implementation handles the default.

4. **Return structured JSON.** Tool results should be parseable JSON with
   consistent fields (`status`, `id`, `error`). The agent uses these to
   compose its response and decide follow-up actions.

5. **Include IDs in results.** When creating something, return its ID. When
   listing, include IDs for each item. This lets the agent chain tools
   (create → then update/link) without asking the user.

## Integration test conventions

Integration tests in `agent_integration_test.go` use a mock tool executor
that records calls and returns configurable responses. This tests the full
LLM → tool-selection → execution pipeline without hitting a real database.

**Key patterns:**

- **`mockTools`** — records every tool call (name, arguments) and returns
  pre-configured JSON responses
- **`runAgent()`** — builds the real system prompt and tool list from
  `DefaultRegistry()`, runs `ai.RunToolAgent()` against the LLM, returns the
  result
- **`hasTool(res, name)`** — checks if a specific tool was called
- **`toolNames(res)`** — returns all tool names called, for error messages

**Environment:**
- `RUN_LIFE_INTEGRATION=1` — gate flag, tests skip without it
- `LLM_API_KEY` — API key for the LLM provider
- `LLM_BASE_URL` — defaults to `https://api.moonshot.ai/v1`
- `LLM_MODEL` — defaults to `kimi-k2.5`

**Writing resilient tests:**
- LLM behavior is non-deterministic. Test that the *right tool* was called,
  not the exact sequence of calls
- Provide enough context in the message that the LLM doesn't need to guess
  (e.g., include IDs when asking to delete something)
- For multi-tool tests, verify the minimum expected behavior (e.g., "at
  least 2 tool calls") rather than an exact list
- Use `AutoApprove: true` so the agent acts without creating actionables
- Set `ConversationCategory` so the right tools are available
