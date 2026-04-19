//go:build integration

package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"testing"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/tmc/langchaingo/llms"

	"github.com/n1rna/1tt/api/internal/ai"
)

// ─── fake agent ──────────────────────────────────────────────────────────────

// fakeJourneyAgent records incoming ChatRequests and simulates the Kim agent
// by invoking ExecuteToolWithSource for a configured list of tool calls —
// exactly what the real agent would do when ActionableSource is set. Lets us
// verify the journey pipeline end-to-end without an LLM.
type fakeJourneyAgent struct {
	db             *sql.DB
	gcal           *GCalClient
	received       []ChatRequest
	toolCallsToRun []string
	toolArgs       []string
}

func (f *fakeJourneyAgent) Chat(ctx context.Context, req ChatRequest) (*ChatResult, error) {
	f.received = append(f.received, req)

	var effects []ai.ToolEffect
	for i, name := range f.toolCallsToRun {
		args := "{}"
		if i < len(f.toolArgs) {
			args = f.toolArgs[i]
		}
		call := llms.ToolCall{
			ID:   uuid.NewString(),
			Type: "function",
			FunctionCall: &llms.FunctionCall{
				Name:      name,
				Arguments: args,
			},
		}
		result := ExecuteToolWithSource(ctx, f.db, f.gcal, req.UserID, req.AutoApprove, call, req.ActionableSource)
		effects = append(effects, ai.ToolEffect{
			Tool:   name,
			ID:     call.ID,
			Result: result,
		})
	}

	return &ai.ToolAgentResult{Effects: effects}, nil
}

func (f *fakeJourneyAgent) ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error) {
	return f.Chat(ctx, req)
}

func (f *fakeJourneyAgent) ProcessActionableResponse(ctx context.Context, db *sql.DB, userID string, actionable ActionableRecord, response string) (*ChatResult, error) {
	return &ai.ToolAgentResult{}, nil
}

func (f *fakeJourneyAgent) GCalClient() *GCalClient  { return f.gcal }
func (f *fakeJourneyAgent) LLMConfig() *ai.LLMConfig { return &ai.LLMConfig{} }

// ─── DB setup ────────────────────────────────────────────────────────────────

// openTestDB opens the test database. Requires TEST_DATABASE_URL to be set and
// point at a throwaway database with the production schema applied (goose up).
// Skips otherwise.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to a Postgres instance with migrations applied to run journey DB integration tests")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("ping test db: %v", err)
	}
	return db
}

func cleanupUser(t *testing.T, db *sql.DB, userID string) {
	t.Helper()
	for _, stmt := range []string{
		`DELETE FROM life_actionables WHERE user_id = $1`,
		`DELETE FROM life_memories WHERE user_id = $1`,
		`DELETE FROM life_routines WHERE user_id = $1`,
		`DELETE FROM life_profiles WHERE user_id = $1`,
	} {
		if _, err := db.Exec(stmt, userID); err != nil {
			t.Logf("cleanup %q for %s: %v", stmt, userID, err)
		}
	}
}

// ─── tests ───────────────────────────────────────────────────────────────────

func TestProcessJourneyEvent_EndToEnd_RoutineUpdated(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	userID := "test_user_journey_" + uuid.NewString()
	cleanupUser(t, db, userID)
	defer cleanupUser(t, db, userID)

	if _, err := db.Exec(
		`INSERT INTO life_profiles (user_id, timezone) VALUES ($1, 'UTC')`,
		userID,
	); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	// Agent simulates calling create_calendar_event (a write tool). With
	// AutoApprove=false it should be intercepted into a confirm actionable
	// tagged with the journey source.
	agent := &fakeJourneyAgent{
		db:             db,
		toolCallsToRun: []string{"create_calendar_event"},
		toolArgs: []string{
			`{"summary":"Reschedule morning stretch","start":"2026-04-18T07:00:00Z","end":"2026-04-18T07:15:00Z"}`,
		},
	}

	err := ProcessJourneyEvent(context.Background(), db, agent, JourneyEvent{
		UserID:        userID,
		Trigger:       JourneyTriggerRoutineUpdated,
		EntityID:      "rt_xyz",
		EntityTitle:   "Morning stretch",
		ChangeSummary: "time → 07:00",
	})
	if err != nil {
		t.Fatalf("ProcessJourneyEvent: %v", err)
	}

	if len(agent.received) != 1 {
		t.Fatalf("expected 1 chat request, got %d", len(agent.received))
	}
	req := agent.received[0]
	if req.AutoApprove {
		t.Error("AutoApprove must be false on journey runs")
	}
	if req.ActionableSource == nil {
		t.Fatal("ActionableSource must be set")
	}
	if req.ActionableSource["trigger"] != JourneyTriggerRoutineUpdated {
		t.Errorf("source.trigger: got %v", req.ActionableSource["trigger"])
	}

	// Verify the intercepted tool produced a properly-tagged actionable row.
	var aType, status, actionType string
	var sourceJSON []byte
	if err := db.QueryRow(
		`SELECT type, status, action_type, source
		 FROM life_actionables WHERE user_id = $1`, userID,
	).Scan(&aType, &status, &actionType, &sourceJSON); err != nil {
		t.Fatalf("load actionable: %v", err)
	}

	if aType != "confirm" {
		t.Errorf("type: got %q, want %q", aType, "confirm")
	}
	if status != "pending" {
		t.Errorf("status: got %q, want %q", status, "pending")
	}
	if actionType != "create_calendar_event" {
		t.Errorf("action_type: got %q, want %q", actionType, "create_calendar_event")
	}

	if len(sourceJSON) == 0 {
		t.Fatal("source column is empty — journey source did not persist")
	}
	var source map[string]any
	if err := json.Unmarshal(sourceJSON, &source); err != nil {
		t.Fatalf("unmarshal source: %v", err)
	}
	wantSource := map[string]any{
		"kind":         "journey",
		"trigger":      JourneyTriggerRoutineUpdated,
		"entity_id":    "rt_xyz",
		"entity_title": "Morning stretch",
	}
	for k, want := range wantSource {
		if source[k] != want {
			t.Errorf("source.%s: got %v, want %v", k, source[k], want)
		}
	}
}

func TestProcessJourneyEvent_EndToEnd_GymSessionUpdated_CreatesActionable(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	userID := "test_user_journey_" + uuid.NewString()
	cleanupUser(t, db, userID)
	defer cleanupUser(t, db, userID)

	if _, err := db.Exec(
		`INSERT INTO life_profiles (user_id, timezone) VALUES ($1, 'UTC')`,
		userID,
	); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	// Simulate the agent proposing a calendar reschedule after the user
	// extended a gym session's duration. Write tool intercepts with
	// AutoApprove=false → confirm actionable tagged with the journey source.
	agent := &fakeJourneyAgent{
		db:             db,
		toolCallsToRun: []string{"update_calendar_event"},
		toolArgs: []string{
			`{"event_id":"evt_abc","summary":"Gym – Push day","start":"2026-04-18T07:00:00Z","end":"2026-04-18T08:30:00Z"}`,
		},
	}

	err := ProcessJourneyEvent(context.Background(), db, agent, JourneyEvent{
		UserID:        userID,
		Trigger:       JourneyTriggerGymSessionUpdated,
		EntityID:      "sess_123",
		EntityTitle:   "Push day",
		ChangeSummary: "estimated_duration → 90 min",
	})
	if err != nil {
		t.Fatalf("ProcessJourneyEvent: %v", err)
	}

	var aType, status, actionType string
	var sourceJSON []byte
	if err := db.QueryRow(
		`SELECT type, status, action_type, source
		 FROM life_actionables WHERE user_id = $1`, userID,
	).Scan(&aType, &status, &actionType, &sourceJSON); err != nil {
		t.Fatalf("load actionable: %v", err)
	}
	if aType != "confirm" || status != "pending" || actionType != "update_calendar_event" {
		t.Errorf("actionable metadata: type=%q status=%q actionType=%q", aType, status, actionType)
	}
	var source map[string]any
	if err := json.Unmarshal(sourceJSON, &source); err != nil {
		t.Fatalf("unmarshal source: %v", err)
	}
	if source["trigger"] != JourneyTriggerGymSessionUpdated {
		t.Errorf("source.trigger: got %v, want %v", source["trigger"], JourneyTriggerGymSessionUpdated)
	}
	if source["entity_id"] != "sess_123" {
		t.Errorf("source.entity_id: got %v", source["entity_id"])
	}
}

func TestProcessJourneyEvent_EndToEnd_MealPlanUpdated_CreatesGroceryActionable(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	userID := "test_user_journey_" + uuid.NewString()
	cleanupUser(t, db, userID)
	defer cleanupUser(t, db, userID)

	if _, err := db.Exec(
		`INSERT INTO life_profiles (user_id, timezone) VALUES ($1, 'UTC')`,
		userID,
	); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	// The agent proposes a grocery-prep task after the meal plan changed.
	// We use create_task (intercepted) to produce a grocery-oriented
	// actionable, verifying the cascade reaches the task surface.
	agent := &fakeJourneyAgent{
		db:             db,
		toolCallsToRun: []string{"create_task"},
		toolArgs: []string{
			`{"title":"Refresh grocery list for new meal plan","notes":"Added: tofu, spinach"}`,
		},
	}

	err := ProcessJourneyEvent(context.Background(), db, agent, JourneyEvent{
		UserID:        userID,
		Trigger:       JourneyTriggerMealPlanUpdated,
		EntityID:      "plan_9",
		EntityTitle:   "Cut phase week 3",
		ChangeSummary: "meals/content updated",
	})
	if err != nil {
		t.Fatalf("ProcessJourneyEvent: %v", err)
	}

	var actionType string
	var sourceJSON []byte
	if err := db.QueryRow(
		`SELECT action_type, source FROM life_actionables WHERE user_id = $1`, userID,
	).Scan(&actionType, &sourceJSON); err != nil {
		t.Fatalf("load actionable: %v", err)
	}
	if actionType != "create_task" {
		t.Errorf("action_type: got %q, want %q", actionType, "create_task")
	}
	var source map[string]any
	_ = json.Unmarshal(sourceJSON, &source)
	if source["trigger"] != JourneyTriggerMealPlanUpdated {
		t.Errorf("source.trigger: got %v, want %v", source["trigger"], JourneyTriggerMealPlanUpdated)
	}
	if source["entity_title"] != "Cut phase week 3" {
		t.Errorf("source.entity_title: got %v", source["entity_title"])
	}
}

func TestProcessJourneyEvent_EndToEnd_DirectCreateActionable(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	userID := "test_user_journey_" + uuid.NewString()
	cleanupUser(t, db, userID)
	defer cleanupUser(t, db, userID)

	agent := &fakeJourneyAgent{
		db:             db,
		toolCallsToRun: []string{"create_actionable"},
		toolArgs: []string{
			`{"type":"info","title":"Heads up: grocery list may need refresh"}`,
		},
	}

	err := ProcessJourneyEvent(context.Background(), db, agent, JourneyEvent{
		UserID:      userID,
		Trigger:     JourneyTriggerMealPlanUpdated,
		EntityID:    "plan_9",
		EntityTitle: "Cut phase",
	})
	if err != nil {
		t.Fatalf("ProcessJourneyEvent: %v", err)
	}

	var sourceJSON []byte
	if err := db.QueryRow(
		`SELECT source FROM life_actionables WHERE user_id = $1`, userID,
	).Scan(&sourceJSON); err != nil {
		t.Fatalf("load actionable: %v", err)
	}
	if len(sourceJSON) == 0 {
		t.Fatal("source should be stamped on direct create_actionable calls in a journey run")
	}
	var source map[string]any
	_ = json.Unmarshal(sourceJSON, &source)
	if source["trigger"] != JourneyTriggerMealPlanUpdated {
		t.Errorf("source.trigger: got %v", source["trigger"])
	}
}
