// Package tracked wraps background agent goroutines so every invocation
// lands a row in life_agent_runs, capturing status, tool calls, and the
// actionables it produced. Callers replace `go func() { ... }()` with
// `tracked.Run(ctx, db, args, func(ctx, runID) (RunOutput, error) { ... })`.
package tracked

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"github.com/n1rna/1tt/api/internal/ai"
)

// Meta describes the invocation being wrapped. UserID and Kind are required;
// everything else is optional context surfaced in the activity UI.
type Meta struct {
	UserID      string // required
	Kind        string // required — e.g. "journey", "actionable_followup", "scheduler"
	Title       string // user-visible label — "Processing gym session update"
	Subtitle    string // secondary line — typically the entity title
	Trigger     string // free-form context (journey trigger, actionable id, cycle name)
	EntityID    string // primary key of the originating entity (if any)
	EntityTitle string // human label for the originating entity
}

// RunOutput is what the wrapped function returns to persist on the run row.
type RunOutput struct {
	ToolCalls     []ToolCall
	Summary       string
	ActionableIDs []string
}

// ToolCall is one entry in the run's tool_calls JSONB array.
type ToolCall struct {
	Tool   string `json:"tool"`
	ID     string `json:"id,omitempty"`
	Args   any    `json:"args,omitempty"`
	Result string `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

// Run synchronously inserts a life_agent_runs row (status='running'), then
// spawns a goroutine that executes fn and updates the row to
// 'completed' / 'failed' depending on the outcome. Panics inside fn are
// recovered, stored in the error column, and do not propagate.
//
// The parent context is used for the initial INSERT only; fn gets a fresh
// background context with a 5-minute timeout so the request lifecycle does
// not cancel the tracked work.
//
// If db is nil or meta is malformed the call degrades to running fn in a
// plain goroutine without persistence — activity tracking is best-effort.
func Run(parent context.Context, db *sql.DB, meta Meta, fn func(ctx context.Context, runID string) (RunOutput, error)) string {
	if fn == nil {
		return ""
	}
	if meta.UserID == "" || meta.Kind == "" || db == nil {
		go func() {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("tracked.Run: panic in untracked fn: %v\n%s", rec, debug.Stack())
				}
			}()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			_, _ = fn(ctx, "")
		}()
		return ""
	}

	runID := uuid.NewString()
	started := time.Now()

	if _, err := db.ExecContext(parent, `
		INSERT INTO life_agent_runs
		    (id, user_id, kind, status, title, subtitle, trigger, entity_id, entity_title, started_at)
		VALUES ($1, $2, $3, 'running', $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), $9)`,
		runID, meta.UserID, meta.Kind, meta.Title, meta.Subtitle, meta.Trigger,
		meta.EntityID, meta.EntityTitle, started,
	); err != nil {
		log.Printf("tracked.Run: insert %s: %v", runID, err)
		// continue anyway — don't lose the work
	} else {
		// Notify SSE subscribers so the activity drawer sees the new running
		// row without waiting for its next poll.
		publishSnapshot(db, runID, meta.UserID)
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		var (
			out    RunOutput
			runErr error
		)

		func() {
			defer func() {
				if rec := recover(); rec != nil {
					runErr = fmt.Errorf("panic: %v", rec)
					log.Printf("tracked.Run: panic in fn (run %s): %v\n%s", runID, rec, debug.Stack())
				}
			}()
			out, runErr = fn(ctx, runID)
		}()

		finish(db, runID, started, out, runErr)
	}()

	return runID
}

// RunSync executes fn in the calling goroutine and persists the life_agent_runs
// row before returning. Intended for use inside a River worker so the worker
// goroutine owns the lifecycle and River can track retries/attempts.
// Returns fn's error unchanged. Panics in fn are recovered and returned as an
// error so River treats them as a normal failure.
func RunSync(ctx context.Context, db *sql.DB, meta Meta, fn func(ctx context.Context, runID string) (RunOutput, error)) (string, error) {
	if fn == nil {
		return "", nil
	}
	if meta.UserID == "" || meta.Kind == "" || db == nil {
		out, err := safeCall(ctx, "", fn)
		_ = out
		return "", err
	}

	runID := uuid.NewString()
	started := time.Now()

	if _, err := db.ExecContext(ctx, `
		INSERT INTO life_agent_runs
		    (id, user_id, kind, status, title, subtitle, trigger, entity_id, entity_title, started_at)
		VALUES ($1, $2, $3, 'running', $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), $9)`,
		runID, meta.UserID, meta.Kind, meta.Title, meta.Subtitle, meta.Trigger,
		meta.EntityID, meta.EntityTitle, started,
	); err != nil {
		log.Printf("tracked.RunSync: insert %s: %v", runID, err)
	} else {
		publishSnapshot(db, runID, meta.UserID)
	}

	out, runErr := safeCall(ctx, runID, fn)
	finish(db, runID, started, out, runErr)
	return runID, runErr
}

func safeCall(ctx context.Context, runID string, fn func(ctx context.Context, runID string) (RunOutput, error)) (out RunOutput, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			err = fmt.Errorf("panic: %v", rec)
			log.Printf("tracked.RunSync: panic in fn (run %s): %v\n%s", runID, rec, debug.Stack())
		}
	}()
	out, err = fn(ctx, runID)
	return
}

func finish(db *sql.DB, runID string, started time.Time, out RunOutput, runErr error) {
	finished := time.Now()
	duration := int(finished.Sub(started).Milliseconds())

	status := "completed"
	errStr := ""
	if runErr != nil {
		status = "failed"
		errStr = runErr.Error()
	}

	toolCallsJSON, err := json.Marshal(out.ToolCalls)
	if err != nil || len(out.ToolCalls) == 0 {
		toolCallsJSON = []byte("[]")
	}

	ids := out.ActionableIDs
	if ids == nil {
		ids = []string{}
	}

	var userID string
	if uerr := db.QueryRowContext(context.Background(), `
		UPDATE life_agent_runs
		   SET status = $1,
		       completed_at = $2,
		       duration_ms = $3,
		       tool_calls = $4::jsonb,
		       result_summary = $5,
		       produced_actionable_ids = $6,
		       error = $7
		 WHERE id = $8
		 RETURNING user_id`,
		status, finished, duration, string(toolCallsJSON),
		out.Summary, pq.Array(ids), errStr, runID,
	).Scan(&userID); uerr != nil {
		log.Printf("tracked.Run: update %s: %v", runID, uerr)
		return
	}

	// Fan the terminal snapshot out to any live SSE subscribers.
	publishSnapshot(db, runID, userID)
}

// FromToolResult converts an ai.ToolAgentResult into a RunOutput, extracting
// tool calls and the ids of any actionables created during the run. It looks
// for the `create_actionable` tool name (the canonical path to creating an
// actionable in the Kim agent) and parses `actionable_id` out of the result
// JSON. Unknown tool results are still captured in the tool_calls JSONB.
func FromToolResult(res *ai.ToolAgentResult, fallbackSummary string) RunOutput {
	if res == nil {
		return RunOutput{Summary: fallbackSummary}
	}
	calls := make([]ToolCall, 0, len(res.Effects))
	actionableIDs := make([]string, 0)

	for _, e := range res.Effects {
		tc := ToolCall{Tool: e.Tool, ID: e.ID, Result: e.Result}
		if e.Error != "" {
			tc.Error = e.Error
		}
		calls = append(calls, tc)

		// Track which actionables this run produced. Any tool call that
		// returns an `actionable_id` in its JSON result is considered a
		// producer — the AutoApprove=false intercept converts write tools
		// into confirm actionables, so this covers both `create_actionable`
		// and the intercepted tool names.
		if e.Result != "" {
			var parsed struct {
				ActionableID string `json:"actionable_id"`
			}
			if json.Unmarshal([]byte(e.Result), &parsed) == nil && parsed.ActionableID != "" {
				actionableIDs = append(actionableIDs, parsed.ActionableID)
			}
		}
	}

	summary := fallbackSummary
	if summary == "" {
		if len(actionableIDs) > 0 {
			summary = fmt.Sprintf("Created %d actionables", len(actionableIDs))
		} else if res.Text != "" {
			// Keep summary short — it renders inline in the activity row.
			summary = res.Text
			if len(summary) > 140 {
				summary = summary[:137] + "..."
			}
		}
	}

	return RunOutput{
		ToolCalls:     calls,
		Summary:       summary,
		ActionableIDs: actionableIDs,
	}
}
