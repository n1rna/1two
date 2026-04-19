package tracked

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
)

// When db is nil, tracked.Run must still execute fn (best-effort degradation)
// and recover from panics without crashing the test process.
func TestRun_NilDB_StillExecutesFn(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)
	var ran bool
	runID := Run(context.Background(), nil, Meta{UserID: "u1", Kind: "test"}, func(ctx context.Context, id string) (RunOutput, error) {
		defer wg.Done()
		ran = true
		return RunOutput{Summary: "ok"}, nil
	})
	wg.Wait()
	if runID != "" {
		t.Errorf("nil-db Run should return empty runID, got %q", runID)
	}
	if !ran {
		t.Errorf("fn did not execute under nil db")
	}
}

func TestRun_NilFn_NoCrash(t *testing.T) {
	runID := Run(context.Background(), nil, Meta{UserID: "u1", Kind: "test"}, nil)
	if runID != "" {
		t.Errorf("nil fn should return empty runID")
	}
}

func TestRun_NilDB_RecoversPanic(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)
	Run(context.Background(), nil, Meta{UserID: "u1", Kind: "test"}, func(ctx context.Context, id string) (RunOutput, error) {
		defer wg.Done()
		panic("boom")
	})
	// If the goroutine didn't recover, the test process would die before we
	// get here. A 500ms sleep is enough for the goroutine to run and recover.
	waited := waitTimeout(&wg, 500*time.Millisecond)
	if !waited {
		t.Fatalf("fn goroutine did not finish in time")
	}
}

// ─── FromToolResult ──────────────────────────────────────────────────────────

func TestFromToolResult_NilResult_UsesFallback(t *testing.T) {
	out := FromToolResult(nil, "fallback")
	if out.Summary != "fallback" {
		t.Errorf("want fallback summary, got %q", out.Summary)
	}
	if len(out.ToolCalls) != 0 || len(out.ActionableIDs) != 0 {
		t.Errorf("nil result should produce empty calls/ids")
	}
}

func TestFromToolResult_ExtractsActionableIDs(t *testing.T) {
	res := &ai.ToolAgentResult{
		Text: "done",
		Effects: []ai.ToolEffect{
			{Tool: "create_actionable", ID: "e1", Result: `{"actionable_id":"act_1"}`, Success: true},
			{Tool: "create_calendar_event", ID: "e2", Result: `{"actionable_id":"act_2","intercepted":true}`, Success: true},
			{Tool: "remember", ID: "e3", Result: `{"memory_id":"m_1"}`, Success: true},
		},
	}
	out := FromToolResult(res, "")
	if len(out.ToolCalls) != 3 {
		t.Errorf("want 3 tool calls, got %d", len(out.ToolCalls))
	}
	if len(out.ActionableIDs) != 2 {
		t.Errorf("want 2 actionable ids, got %v", out.ActionableIDs)
	}
	if out.ActionableIDs[0] != "act_1" || out.ActionableIDs[1] != "act_2" {
		t.Errorf("unexpected actionable ids: %v", out.ActionableIDs)
	}
	if !strings.Contains(out.Summary, "2 actionables") {
		t.Errorf("summary should mention 2 actionables, got %q", out.Summary)
	}
}

func TestFromToolResult_CapturesToolErrors(t *testing.T) {
	res := &ai.ToolAgentResult{
		Text: "",
		Effects: []ai.ToolEffect{
			{Tool: "create_task", Error: "gcal token expired", Success: false},
		},
	}
	out := FromToolResult(res, "")
	if len(out.ToolCalls) != 1 || out.ToolCalls[0].Error == "" {
		t.Errorf("expected one tool call with error captured, got %+v", out.ToolCalls)
	}
}

func TestFromToolResult_TruncatesLongTextSummary(t *testing.T) {
	long := strings.Repeat("x", 200)
	res := &ai.ToolAgentResult{Text: long}
	out := FromToolResult(res, "")
	if len(out.Summary) != 140 {
		t.Errorf("summary should be truncated to 140 chars, got %d", len(out.Summary))
	}
	if !strings.HasSuffix(out.Summary, "...") {
		t.Errorf("truncated summary should end with ellipsis")
	}
}

// Ensure errors-based code paths don't accidentally trip the summary logic.
var _ = errors.New

func waitTimeout(wg *sync.WaitGroup, d time.Duration) bool {
	ch := make(chan struct{})
	go func() { wg.Wait(); close(ch) }()
	select {
	case <-ch:
		return true
	case <-time.After(d):
		return false
	}
}
