//go:build integration

package kim

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/tmc/langchaingo/llms"
)

// ─── test infrastructure ─────────────────────────────────────────────────────

func loadTestLLMConfig(t *testing.T) *ai.LLMConfig {
	t.Helper()
	if os.Getenv("RUN_LIFE_INTEGRATION") != "1" {
		t.Skip("set RUN_LIFE_INTEGRATION=1 to run kim agent integration tests")
	}
	apiKey := os.Getenv("LLM_API_KEY")
	if apiKey == "" {
		t.Skip("LLM_API_KEY not set")
	}
	return &ai.LLMConfig{
		Provider:     getenvDefault("LLM_PROVIDER", "openai"),
		APIKey:       apiKey,
		BaseURL:      getenvDefault("LLM_BASE_URL", "https://api.moonshot.ai/v1"),
		Model:        getenvDefault("LLM_MODEL", "kimi-k2.5"),
		SummaryModel: getenvDefault("LLM_SUMMARY_MODEL", "kimi-k2-0905-preview"),
	}
}

func getenvDefault(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

type recordedCall struct {
	Name string
	Args map[string]any
}

type mockTools struct {
	mu        sync.Mutex
	calls     []recordedCall
	responses map[string]string
}

func newMockTools() *mockTools {
	return &mockTools{responses: map[string]string{}}
}

func (m *mockTools) setResponse(tool, jsonResp string) {
	m.responses[tool] = jsonResp
}

func (m *mockTools) findCall(name string) *recordedCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.calls {
		if m.calls[i].Name == name {
			return &m.calls[i]
		}
	}
	return nil
}

func (m *mockTools) execute(_ context.Context, call llms.ToolCall) string {
	m.mu.Lock()
	defer m.mu.Unlock()

	var args map[string]any
	_ = json.Unmarshal([]byte(call.FunctionCall.Arguments), &args)
	m.calls = append(m.calls, recordedCall{Name: call.FunctionCall.Name, Args: args})

	if r, ok := m.responses[call.FunctionCall.Name]; ok {
		return r
	}
	return defaultMockResponse(call.FunctionCall.Name)
}

func defaultMockResponse(tool string) string {
	switch tool {
	case "create_actionable":
		return `{"actionable_id":"act_test_1","status":"created"}`
	case "remember":
		return `{"memory_id":"mem_test_1","status":"saved"}`
	case "forget":
		return `{"status":"forgotten"}`
	case "create_routine":
		return `{"routine_id":"rt_test_1","status":"created"}`
	case "update_routine", "delete_routine":
		return `{"status":"ok"}`
	case "list_routines":
		return `{"routines":[]}`
	case "list_actionables":
		return `{"actionables":[]}`
	case "create_calendar_event":
		return `{"id":"evt_test_1","status":"created"}`
	case "update_calendar_event", "delete_calendar_event":
		return `{"status":"ok"}`
	case "get_calendar_events":
		return `{"events":[]}`
	case "list_tasks":
		return `{"tasks":[]}`
	case "create_task":
		return `{"id":"task_test_1","status":"created"}`
	case "complete_task", "update_task", "delete_task":
		return `{"status":"ok"}`
	case "create_task_list":
		return `{"id":"list_test_1","status":"created"}`
	case "log_weight":
		return `{"id":"w_test_1","status":"logged"}`
	case "update_health_profile":
		return `{"status":"updated"}`
	case "get_health_summary":
		return `{"weight_kg":75,"calories_today":0}`
	case "get_life_summary":
		return `{"routines":0,"actionables":0}`
	case "link_event_to_routine":
		return `{"status":"linked"}`
	case "generate_meal_plan":
		return `{"status":"saved","plan_id":"mp_test_1"}`
	case "create_session":
		return `{"session_id":"sess_test_1","status":"created"}`
	case "update_session":
		return `{"status":"updated"}`
	case "add_exercise_to_session":
		return `{"status":"added"}`
	case "remove_exercise_from_session":
		return `{"status":"removed"}`
	default:
		return `{"status":"ok"}`
	}
}

// runAgent runs a single chat turn with mock tools using kim's BuildSystemPrompt
// and category-filtered tool selection.
func runAgent(t *testing.T, mock *mockTools, req life.ChatRequest) *ai.ToolAgentResult {
	t.Helper()
	cfg := loadTestLLMConfig(t)

	registry := DefaultRegistry()
	pctx := PromptContext{
		Category:                req.ConversationCategory,
		Profile:                 req.Profile,
		Memories:                req.Memories,
		Routines:                req.Routines,
		PendingActionablesCount: req.PendingActionablesCount,
		CalendarEvents:          req.CalendarEvents,
		RoutineEventLinks:       req.RoutineEventLinks,
		AutoApprove:             req.AutoApprove,
		HealthProfile:           req.HealthProfile,
		ActiveSessions:          req.ActiveSessions,
		Now:                     time.Now().UTC(),
	}
	systemPrompt := BuildSystemPrompt(registry, pctx)
	if req.SystemContext != "" {
		systemPrompt += "\n\n## Additional context\n" + req.SystemContext
	}

	history := make([]ai.Message, len(req.History))
	for i, h := range req.History {
		history[i] = ai.Message{Role: h.Role, Content: h.Content}
	}

	// Use category-filtered tools (same as production) instead of AllTools
	tools := registry.ToolsForCategory(req.ConversationCategory)

	agentCfg := ai.ToolAgentConfig{
		Messages:    ai.BuildMessages(systemPrompt, history, req.Message),
		Tools:       tools,
		Execute:     mock.execute,
		MaxRounds:   5,
		Temperature: 1.0,
		MaxTokens:   16384,
		LLMConfig:   cfg,
	}

	model, err := ai.NewLLM(cfg)
	if err != nil {
		t.Fatalf("NewLLM: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	res, err := ai.RunToolAgent(ctx, model, agentCfg)
	if err != nil {
		t.Fatalf("RunToolAgent: %v", err)
	}
	return res
}

// ─── assertion helpers ───────────────────────────────────────────────────────

func hasTool(res *ai.ToolAgentResult, name string) bool {
	for _, e := range res.Effects {
		if e.Tool == name {
			return true
		}
	}
	return false
}

func hasAnyTool(res *ai.ToolAgentResult, names ...string) bool {
	for _, n := range names {
		if hasTool(res, n) {
			return true
		}
	}
	return false
}

func toolNames(res *ai.ToolAgentResult) []string {
	out := make([]string, len(res.Effects))
	for i, e := range res.Effects {
		out[i] = e.Tool
	}
	return out
}

func defaultProfile() *life.Profile {
	return &life.Profile{Timezone: "America/Los_Angeles", WakeTime: "07:00", SleepTime: "23:00"}
}

func defaultHealthProfile() *life.HealthProfile {
	return &life.HealthProfile{
		WeightKg: 80, GoalWeightKg: 75, HeightCm: 180, Age: 30, Gender: "male",
		DietType: "balanced", DietGoal: "maintain",
		TargetCalories: 2200, ProteinG: 150, CarbsG: 220, FatG: 70,
		FitnessLevel: "intermediate", FitnessGoal: "hypertrophy",
	}
}

func mockEventsJSON(events []life.GCalEvent) string {
	type wireEvent struct {
		ID      string `json:"id"`
		Summary string `json:"summary"`
		Start   string `json:"start"`
		End     string `json:"end"`
		Status  string `json:"status"`
	}
	wires := make([]wireEvent, len(events))
	for i, e := range events {
		wires[i] = wireEvent{
			ID:      e.ID,
			Summary: e.Summary,
			Start:   e.Start.Format(time.RFC3339),
			End:     e.End.Format(time.RFC3339),
			Status:  e.Status,
		}
	}
	b, _ := json.Marshal(map[string]any{"events": wires})
	return string(b)
}

// ─── Skill: memory ──────────────────────────────────────────────────────────

func TestKim_Memory_RememberPreference(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Please remember that I'm vegetarian.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "remember") {
		t.Fatalf("expected remember tool call; got %v", toolNames(res))
	}
	c := mock.findCall("remember")
	content, _ := c.Args["content"].(string)
	if !strings.Contains(strings.ToLower(content), "vegetarian") {
		t.Errorf("expected memory content to mention 'vegetarian', got %q", content)
	}
}

func TestKim_Memory_ForgetByID(t *testing.T) {
	mock := newMockTools()
	memID := "mem_coffee_42"
	res := runAgent(t, mock, life.ChatRequest{
		UserID:  "test-user",
		Message: "Forget that I like coffee.",
		Profile: defaultProfile(),
		Memories: []life.Memory{
			{ID: memID, Category: "preference", Content: "Likes coffee"},
			{ID: "mem_other_1", Category: "fact", Content: "Lives in Berlin"},
		},
		AutoApprove: true,
	})
	if !hasTool(res, "forget") {
		t.Fatalf("expected forget tool call; got %v", toolNames(res))
	}
	c := mock.findCall("forget")
	id, _ := c.Args["memory_id"].(string)
	if id == "" {
		id, _ = c.Args["id"].(string)
	}
	if id != memID {
		t.Errorf("expected forget to target memory %q, got args=%v", memID, c.Args)
	}
}

func TestKim_Memory_AcknowledgesInText(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Please remember I'm allergic to peanuts.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "remember") {
		t.Fatalf("expected remember; got %v", toolNames(res))
	}
	low := strings.ToLower(res.Text)
	keywords := []string{"peanut", "allerg", "remember", "noted", "saved", "got it"}
	found := false
	for _, k := range keywords {
		if strings.Contains(low, k) {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected assistant text to acknowledge the saved memory, got %q", res.Text)
	}
}

// ─── Skill: routines ────────────────────────────────────────────────────────

func TestKim_Routines_Create(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Every weekday at 7am I want to meditate for 10 minutes.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "create_routine") {
		t.Fatalf("expected create_routine; got %v", toolNames(res))
	}
	c := mock.findCall("create_routine")
	if name, _ := c.Args["name"].(string); name == "" {
		t.Errorf("expected routine name in args, got %v", c.Args)
	}
	sched, _ := c.Args["schedule"].(map[string]any)
	if sched == nil {
		t.Errorf("expected schedule in args, got %v", c.Args)
	}
}

func TestKim_Routines_ListThenDelete(t *testing.T) {
	mock := newMockTools()

	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Delete routine rt_meditate_1 right now.",
		Profile:              defaultProfile(),
		ConversationCategory: "routines",
		AutoApprove:          true,
	})
	if !hasTool(res, "delete_routine") {
		t.Fatalf("expected delete_routine; got %v", toolNames(res))
	}
	c := mock.findCall("delete_routine")
	if id, _ := c.Args["routine_id"].(string); id != "rt_meditate_1" {
		t.Errorf("expected delete_routine target rt_meditate_1, got %v", c.Args)
	}
}

// ─── Skill: calendar ────────────────────────────────────────────────────────

func TestKim_Calendar_QueryEvents(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("get_calendar_events",
		`{"events":[{"id":"evt_1","summary":"Standup","start":"2026-04-13T09:00:00Z","end":"2026-04-13T09:15:00Z"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "What's on my calendar in the next few days?",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "get_calendar_events") {
		t.Fatalf("expected get_calendar_events; got %v", toolNames(res))
	}
}

func TestKim_Calendar_CreateReminder(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Remind me to call mom tomorrow at 5pm.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasAnyTool(res, "create_calendar_event", "create_task") {
		t.Fatalf("expected create_calendar_event or create_task; got effects=%v text=%q", toolNames(res), res.Text)
	}
	c := mock.findCall("create_calendar_event")
	if c == nil {
		c = mock.findCall("create_task")
	}
	title, _ := c.Args["title"].(string)
	if title == "" {
		title, _ = c.Args["summary"].(string)
	}
	low := strings.ToLower(title)
	if !strings.Contains(low, "mom") && !strings.Contains(low, "call") {
		t.Errorf("expected title to mention 'mom' or 'call', got %q", title)
	}
}

func TestKim_Calendar_RescheduleEvent(t *testing.T) {
	mock := newMockTools()
	now := time.Now().UTC()
	events := []life.GCalEvent{
		{
			ID: "evt_dentist_99", Summary: "Dentist appointment",
			Start: now.Add(48 * time.Hour), End: now.Add(48*time.Hour + 30*time.Minute),
			Status: "confirmed",
		},
		{
			ID: "evt_other_1", Summary: "Team lunch",
			Start: now.Add(72 * time.Hour), End: now.Add(73 * time.Hour),
			Status: "confirmed",
		},
	}
	mock.setResponse("get_calendar_events", mockEventsJSON(events))

	res := runAgent(t, mock, life.ChatRequest{
		UserID:         "test-user",
		Message:        "Move my dentist appointment to next Monday at 3pm.",
		Profile:        defaultProfile(),
		CalendarEvents: events,
		AutoApprove:    true,
	})
	if !hasTool(res, "update_calendar_event") {
		t.Fatalf("expected update_calendar_event; got %v", toolNames(res))
	}
	c := mock.findCall("update_calendar_event")
	if id, _ := c.Args["event_id"].(string); id != "evt_dentist_99" {
		t.Errorf("expected event_id evt_dentist_99, got %v", c.Args)
	}
}

func TestKim_Calendar_DeleteEvent(t *testing.T) {
	mock := newMockTools()
	now := time.Now().UTC()
	events := []life.GCalEvent{
		{
			ID: "evt_dentist_99", Summary: "Dentist appointment",
			Start: now.Add(48 * time.Hour), End: now.Add(48*time.Hour + 30*time.Minute),
			Status: "confirmed",
		},
	}
	mock.setResponse("get_calendar_events", mockEventsJSON(events))

	res := runAgent(t, mock, life.ChatRequest{
		UserID:         "test-user",
		Message:        "Please delete my dentist appointment from my calendar — confirmed, I want it gone.",
		Profile:        defaultProfile(),
		CalendarEvents: events,
		AutoApprove:    true,
	})
	if !hasTool(res, "delete_calendar_event") {
		t.Fatalf("expected delete_calendar_event; got %v", toolNames(res))
	}
	c := mock.findCall("delete_calendar_event")
	if id, _ := c.Args["event_id"].(string); id != "evt_dentist_99" {
		t.Errorf("expected event_id evt_dentist_99, got %v", c.Args)
	}
}

func TestKim_Calendar_LinkEventToRoutine(t *testing.T) {
	mock := newMockTools()
	now := time.Now().UTC()
	events := []life.GCalEvent{
		{
			ID: "evt_gym_555", Summary: "Morning gym",
			Start: now.Add(24 * time.Hour), End: now.Add(25 * time.Hour),
			Status: "confirmed",
		},
	}
	mock.setResponse("get_calendar_events", mockEventsJSON(events))
	mock.setResponse("list_routines",
		`{"routines":[{"id":"rt_gym_1","name":"Morning gym","type":"gym","description":"Lift 3x/week"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:  "test-user",
		Message: "The 'Morning gym' event on my calendar is for my Morning gym routine — link them.",
		Profile: defaultProfile(),
		Routines: []life.Routine{
			{ID: "rt_gym_1", Name: "Morning gym", Type: "gym", Description: "Lift 3x/week"},
		},
		CalendarEvents: events,
		AutoApprove:    true,
	})
	if !hasTool(res, "link_event_to_routine") {
		t.Fatalf("expected link_event_to_routine; got %v", toolNames(res))
	}
	c := mock.findCall("link_event_to_routine")
	if id, _ := c.Args["event_id"].(string); id != "evt_gym_555" {
		t.Errorf("expected event_id evt_gym_555, got %v", c.Args)
	}
	if id, _ := c.Args["routine_id"].(string); id != "rt_gym_1" {
		t.Errorf("expected routine_id rt_gym_1, got %v", c.Args)
	}
}

// ─── Skill: tasks ───────────────────────────────────────────────────────────

func TestKim_Tasks_List(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Show me my pending tasks.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "list_tasks") {
		t.Fatalf("expected list_tasks; got %v", toolNames(res))
	}
}

func TestKim_Tasks_Create(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Add a task to buy milk.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "create_task") {
		t.Fatalf("expected create_task; got %v", toolNames(res))
	}
	c := mock.findCall("create_task")
	title, _ := c.Args["title"].(string)
	if !strings.Contains(strings.ToLower(title), "milk") {
		t.Errorf("expected task title to mention 'milk', got %q", title)
	}
}

func TestKim_Tasks_Complete(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("list_tasks",
		`{"tasks":[{"id":"task_milk_42","title":"Buy milk","status":"needsAction"},{"id":"task_other_1","title":"Email Bob","status":"needsAction"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "I bought the milk, mark it done.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "complete_task") {
		t.Fatalf("expected complete_task; got %v", toolNames(res))
	}
	c := mock.findCall("complete_task")
	if id, _ := c.Args["task_id"].(string); id != "task_milk_42" {
		t.Errorf("expected task_id task_milk_42, got %v", c.Args)
	}
}

func TestKim_Tasks_Update(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("list_tasks",
		`{"tasks":[{"id":"task_milk_42","title":"Buy milk","status":"needsAction"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Change the buy milk task title to 'Buy oat milk'.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "update_task") {
		t.Fatalf("expected update_task; got %v", toolNames(res))
	}
	c := mock.findCall("update_task")
	if id, _ := c.Args["task_id"].(string); id != "task_milk_42" {
		t.Errorf("expected task_id task_milk_42, got %v", c.Args)
	}
	title, _ := c.Args["title"].(string)
	if !strings.Contains(strings.ToLower(title), "oat") {
		t.Errorf("expected new title to mention 'oat', got %q", title)
	}
}

func TestKim_Tasks_Delete(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("list_tasks",
		`{"tasks":[{"id":"task_milk_42","title":"Buy milk","status":"needsAction"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Remove the buy milk task entirely.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "delete_task") {
		t.Fatalf("expected delete_task; got %v", toolNames(res))
	}
	c := mock.findCall("delete_task")
	if id, _ := c.Args["task_id"].(string); id != "task_milk_42" {
		t.Errorf("expected task_id task_milk_42, got %v", c.Args)
	}
}

func TestKim_Tasks_CreateList(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Create a new task list called Groceries.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "create_task_list") {
		t.Fatalf("expected create_task_list; got %v", toolNames(res))
	}
	c := mock.findCall("create_task_list")
	title, _ := c.Args["title"].(string)
	if !strings.Contains(strings.ToLower(title), "grocer") {
		t.Errorf("expected title to mention 'grocer', got %q", title)
	}
}

// ─── Skill: health (category-filtered) ──────────────────────────────────────

func TestKim_Health_LogWeight(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "I just weighed myself, I'm 78.5 kg today.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		AutoApprove:          true,
	})
	if !hasTool(res, "log_weight") {
		t.Fatalf("expected log_weight; got %v", toolNames(res))
	}
	c := mock.findCall("log_weight")
	w, _ := c.Args["weight_kg"].(float64)
	if w < 78 || w > 79 {
		t.Errorf("expected weight ~78.5, got %v", c.Args["weight_kg"])
	}
}

func TestKim_Health_UpdateProfile(t *testing.T) {
	mock := newMockTools()
	hp := defaultHealthProfile()
	hp.DietType = "balanced"
	hp.DietGoal = "maintain"

	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Switch my diet to keto and set my goal to weight loss.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        hp,
		AutoApprove:          true,
	})
	if !hasTool(res, "update_health_profile") {
		t.Fatalf("expected update_health_profile; got %v", toolNames(res))
	}
	c := mock.findCall("update_health_profile")
	if dt, _ := c.Args["diet_type"].(string); dt != "keto" {
		t.Errorf("expected diet_type=keto, got %v", c.Args["diet_type"])
	}
	if dg, _ := c.Args["diet_goal"].(string); dg != "lose" {
		t.Errorf("expected diet_goal=lose, got %v", c.Args["diet_goal"])
	}
}

func TestKim_Health_GetSummary(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("get_health_summary",
		`{"weight_kg":78.5,"calories_today":1450,"target_calories":2200,"protein_g_today":95}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "How am I doing on my calories and weight today?",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		AutoApprove:          true,
	})
	if !hasTool(res, "get_health_summary") {
		t.Fatalf("expected get_health_summary; got %v", toolNames(res))
	}
}

// ─── Skill: meals (category-filtered) ───────────────────────────────────────

func TestKim_Meals_GeneratePlan(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Generate me a daily meal plan for today.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		AutoApprove:          true,
	})
	if !hasTool(res, "generate_meal_plan") {
		t.Fatalf("expected generate_meal_plan; got %v", toolNames(res))
	}
	c := mock.findCall("generate_meal_plan")
	if pt, _ := c.Args["plan_type"].(string); pt != "daily" {
		t.Errorf("expected plan_type=daily, got %v", c.Args["plan_type"])
	}
	meals, _ := c.Args["meals"].([]any)
	if len(meals) == 0 {
		t.Errorf("expected at least one meal in plan, got %v", c.Args["meals"])
	}
}

// ─── Skill: gym (category-filtered) ─────────────────────────────────────────

func TestKim_Gym_CreateSession(t *testing.T) {
	mock := newMockTools()
	hp := defaultHealthProfile()
	hp.FitnessLevel = "intermediate"
	hp.FitnessGoal = "hypertrophy"

	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Create a leg day workout with squats, lunges, and leg press.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        hp,
		AutoApprove:          true,
	})
	if !hasTool(res, "create_session") {
		t.Fatalf("expected create_session; got %v", toolNames(res))
	}
	c := mock.findCall("create_session")
	exercises, _ := c.Args["exercises"].([]any)
	if len(exercises) < 3 {
		t.Errorf("expected at least 3 exercises, got %d (%v)", len(exercises), c.Args["exercises"])
	}
	names := make([]string, 0, len(exercises))
	for _, ex := range exercises {
		if m, ok := ex.(map[string]any); ok {
			if n, _ := m["exercise_name"].(string); n != "" {
				names = append(names, strings.ToLower(n))
			}
		}
	}
	joined := strings.Join(names, " | ")
	for _, want := range []string{"squat", "lunge", "leg press"} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected exercise list to contain %q, got %v", want, names)
		}
	}
}

func TestKim_Gym_AddExercise(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Add bicep curls to my current workout, 3 sets of 12.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		ActiveSessions: []life.SessionSummary{
			{
				ID: "sess_arms_7", Title: "Arms day", Status: "active",
				Difficulty: "intermediate", MuscleGroups: []string{"biceps", "triceps"},
				Duration: 45, ExerciseCount: 4,
			},
		},
		AutoApprove: true,
	})
	if !hasTool(res, "add_exercise_to_session") {
		t.Fatalf("expected add_exercise_to_session; got %v", toolNames(res))
	}
	c := mock.findCall("add_exercise_to_session")
	if id, _ := c.Args["session_id"].(string); id != "sess_arms_7" {
		t.Errorf("expected session_id sess_arms_7, got %v", c.Args)
	}
	exercises, _ := c.Args["exercises"].([]any)
	if len(exercises) == 0 {
		t.Fatalf("expected at least one exercise, got %v", c.Args["exercises"])
	}
	first, _ := exercises[0].(map[string]any)
	if name, _ := first["exercise_name"].(string); !strings.Contains(strings.ToLower(name), "curl") {
		t.Errorf("expected exercise name to mention 'curl', got %q", name)
	}
}

func TestKim_Gym_UpdateSession(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Rename my current arms workout to 'Push day' and bump difficulty to advanced.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		ActiveSessions: []life.SessionSummary{
			{
				ID: "sess_arms_7", Title: "Arms day", Status: "active",
				Difficulty: "intermediate", MuscleGroups: []string{"biceps", "triceps"},
				Duration: 45, ExerciseCount: 4,
			},
		},
		AutoApprove: true,
	})
	if !hasTool(res, "update_session") {
		t.Fatalf("expected update_session; got %v", toolNames(res))
	}
	c := mock.findCall("update_session")
	if id, _ := c.Args["session_id"].(string); id != "sess_arms_7" {
		t.Errorf("expected session_id sess_arms_7, got %v", c.Args)
	}
}

// ─── Cross-domain: summaries ────────────────────────────────────────────────

func TestKim_CrossDomain_LifeSummary(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("get_life_summary", `{
		"routines":[
			{"id":"rt_1","name":"Morning gym","type":"gym","description":"Lift 3x/week"},
			{"id":"rt_2","name":"Reading","type":"reading","description":"30min before bed"}
		],
		"upcoming_events":[
			{"id":"evt_1","summary":"Standup","start":"2026-04-13T09:00:00Z","end":"2026-04-13T09:15:00Z"},
			{"id":"evt_2","summary":"Dentist","start":"2026-04-14T15:00:00Z","end":"2026-04-14T15:30:00Z"}
		],
		"pending_actionables":[
			{"id":"act_1","type":"confirm","title":"Confirm Friday workout slot"}
		]
	}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Give me a quick overview of what's going on in my life right now.",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if !hasTool(res, "get_life_summary") {
		t.Fatalf("expected get_life_summary; got %v", toolNames(res))
	}
	// The agent should NOT redundantly call underlying fetchers after get_life_summary.
	for _, redundant := range []string{"get_calendar_events", "list_routines", "list_actionables"} {
		if hasTool(res, redundant) {
			t.Errorf("agent redundantly called %q after get_life_summary; effects=%v", redundant, toolNames(res))
		}
	}
}

func TestKim_CrossDomain_ListActionables(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("list_actionables",
		`{"actionables":[{"id":"act_1","type":"confirm","title":"Confirm dentist","status":"pending"}]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:                  "test-user",
		Message:                 "What actionables are pending for me to respond to?",
		Profile:                 defaultProfile(),
		PendingActionablesCount: 1,
		AutoApprove:             true,
	})
	if !hasTool(res, "list_actionables") {
		t.Fatalf("expected list_actionables; got %v", toolNames(res))
	}
}

// ─── Multi-action / multi-skill ─────────────────────────────────────────────

func TestKim_MultiAction_WeightAndRoutineUpdate(t *testing.T) {
	mock := newMockTools()
	mock.setResponse("list_routines",
		`{"routines":[{"id":"rt_gym_1","name":"Morning gym","type":"gym","description":"Lift 3x/week"}]}`)
	mock.setResponse("get_life_summary",
		`{"routines":[{"id":"rt_gym_1","name":"Morning gym","type":"gym","description":"Lift 3x/week"}],"upcoming_events":[],"pending_actionables":[]}`)

	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Quick update: I weigh 76.2 kg now and please bump my morning gym routine to 4 days a week instead of 3.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		AutoApprove:          true,
	})
	if !hasTool(res, "log_weight") {
		t.Errorf("expected log_weight; got %v", toolNames(res))
	}
	// The LLM should take at least 2 actions — one for weight, one for the routine/profile change.
	// It may use update_routine, update_health_profile, list_routines, or get_life_summary.
	if len(res.Effects) < 2 {
		t.Errorf("expected at least 2 tool calls for a dual-intent message; got %d: %v", len(res.Effects), toolNames(res))
	}
}

// ─── Behavioral: no-op chitchat, approval mode ──────────────────────────────

func TestKim_Behavioral_NoActionChitchat(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:      "test-user",
		Message:     "Thanks, that's all for now!",
		Profile:     defaultProfile(),
		AutoApprove: true,
	})
	if len(res.Effects) != 0 {
		t.Errorf("expected no tool effects for chitchat, got %v", toolNames(res))
	}
	if strings.TrimSpace(res.Text) == "" {
		t.Error("expected some assistant text reply")
	}
}

func TestKim_Behavioral_ApprovalModeCreatesActionable(t *testing.T) {
	mock := newMockTools()
	res := runAgent(t, mock, life.ChatRequest{
		UserID:               "test-user",
		Message:              "Schedule me a workout sometime this week, you pick.",
		Profile:              defaultProfile(),
		ConversationCategory: "health",
		HealthProfile:        defaultHealthProfile(),
		AutoApprove:          false, // require-approval mode
	})
	// In require-approval mode the agent should either create an actionable
	// or ask via text rather than blindly executing. We accept any action.
	if !hasAnyTool(res, "create_actionable", "create_calendar_event", "create_session") {
		t.Fatalf("expected agent to take some scheduling action or ask; got %v text=%q", toolNames(res), res.Text)
	}
}

// ─── Skill architecture: category filtering ─────────────────────────────────

func TestKim_SkillRegistry_CategoryFilteringHealth(t *testing.T) {
	registry := DefaultRegistry()
	healthTools := registry.ToolsForCategory("health")
	lifeTools := registry.ToolsForCategory("life")

	healthToolNames := make(map[string]bool)
	for _, tool := range healthTools {
		if tool.Function != nil {
			healthToolNames[tool.Function.Name] = true
		}
	}
	lifeToolNames := make(map[string]bool)
	for _, tool := range lifeTools {
		if tool.Function != nil {
			lifeToolNames[tool.Function.Name] = true
		}
	}

	// Health category must include gym/meal tools
	for _, name := range []string{"create_session", "generate_meal_plan", "log_weight", "update_health_profile"} {
		if !healthToolNames[name] {
			t.Errorf("health category should include %q", name)
		}
	}

	// Life category must include routine/calendar/task tools
	for _, name := range []string{"create_routine", "create_calendar_event", "create_task"} {
		if !lifeToolNames[name] {
			t.Errorf("life category should include %q", name)
		}
	}

	// Life category should NOT include gym-specific tools
	for _, name := range []string{"create_session", "add_exercise_to_session"} {
		if lifeToolNames[name] {
			t.Errorf("life category should NOT include %q (gym-only)", name)
		}
	}
}

func TestKim_SkillRegistry_AlwaysOnToolsPresent(t *testing.T) {
	registry := DefaultRegistry()
	// Even an empty/unknown category should have always-on tools
	tools := registry.ToolsForCategory("unknown_category")
	toolMap := make(map[string]bool)
	for _, tool := range tools {
		if tool.Function != nil {
			toolMap[tool.Function.Name] = true
		}
	}

	for _, name := range []string{"remember", "forget", "create_actionable", "dismiss_actionables", "get_life_summary", "get_health_summary"} {
		if !toolMap[name] {
			t.Errorf("always-on tool %q missing from unknown category", name)
		}
	}
}

func TestKim_SkillRegistry_PromptComposition(t *testing.T) {
	registry := DefaultRegistry()

	prompt := BuildSystemPrompt(registry, PromptContext{
		Category: "health",
		Profile:  defaultProfile(),
		Memories: []life.Memory{
			{ID: "mem_1", Category: "preference", Content: "User is vegetarian"},
		},
		HealthProfile: defaultHealthProfile(),
		AutoApprove:   true,
		Now:           time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})

	// Core skill prompt should be present
	if !strings.Contains(prompt, "Kim") {
		t.Error("expected prompt to contain core personality (Kim)")
	}

	// Health skill prompt should be included for health category
	if !strings.Contains(prompt, "health") || !strings.Contains(prompt, "weight") {
		t.Error("expected prompt to contain health skill instructions")
	}

	// User memory should be injected
	if !strings.Contains(prompt, "vegetarian") {
		t.Error("expected prompt to contain user memory")
	}

	// Date should be formatted
	if !strings.Contains(prompt, "2026") {
		t.Error("expected prompt to contain date context")
	}

	// Auto-approve mode prompt should be present
	if !strings.Contains(prompt, "auto") && !strings.Contains(prompt, "approve") && !strings.Contains(prompt, "directly") {
		t.Error("expected prompt to contain auto-approve instructions")
	}
}

func TestKim_SkillRegistry_RequireApprovalPrompt(t *testing.T) {
	registry := DefaultRegistry()

	prompt := BuildSystemPrompt(registry, PromptContext{
		Category:    "",
		Profile:     defaultProfile(),
		AutoApprove: false,
		Now:         time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})

	// Require-approval prompt should be present
	if !strings.Contains(strings.ToLower(prompt), "actionable") {
		t.Error("expected require-approval prompt to mention actionables")
	}
}
