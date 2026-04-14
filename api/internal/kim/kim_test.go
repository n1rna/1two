package kim

import (
	"strings"
	"testing"
	"time"

	"github.com/n1rna/1tt/api/internal/life"
)

func TestDefaultRegistry_SkillCount(t *testing.T) {
	r := DefaultRegistry()
	if len(r.skills) == 0 {
		t.Fatal("expected at least one skill registered")
	}
	// Verify key skills exist
	for _, id := range []string{"core", "memory", "actionables", "routines", "calendar", "tasks", "health", "meals", "gym", "cross-domain", "marketplace", "admin", "decision-framework", "auto-approve", "require-approval"} {
		if r.Get(id) == nil {
			t.Errorf("expected skill %q to be registered", id)
		}
	}
}

func TestDefaultRegistry_SkillPromptsLoaded(t *testing.T) {
	r := DefaultRegistry()
	for id, skill := range r.skills {
		// admin has no prompt — just tools
		if id == "admin" {
			continue
		}
		if skill.Prompt == "" {
			t.Errorf("skill %q has empty prompt", id)
		}
		if strings.Contains(skill.Prompt, "not found") {
			t.Errorf("skill %q prompt failed to load: %s", id, skill.Prompt)
		}
	}
}

func TestForCategory_AlwaysOnIncluded(t *testing.T) {
	r := DefaultRegistry()
	for _, cat := range []string{"", "life", "health", "meals", "gym", "routines", "calendar", "unknown"} {
		active := r.ForCategory(cat)
		ids := make(map[string]bool)
		for _, s := range active {
			ids[s.ID] = true
		}
		for _, must := range []string{"core", "memory", "actionables", "cross-domain", "marketplace", "decision-framework", "admin"} {
			if !ids[must] {
				t.Errorf("category %q missing always-on skill %q", cat, must)
			}
		}
	}
}

func TestForCategory_LifeIncludesRoutinesCalendarTasks(t *testing.T) {
	r := DefaultRegistry()
	active := r.ForCategory("life")
	ids := make(map[string]bool)
	for _, s := range active {
		ids[s.ID] = true
	}
	for _, want := range []string{"routines", "calendar", "tasks"} {
		if !ids[want] {
			t.Errorf("life category missing skill %q", want)
		}
	}
	// life should NOT include health-only skills
	for _, nope := range []string{"health", "meals", "gym"} {
		if ids[nope] {
			t.Errorf("life category should not include %q", nope)
		}
	}
}

func TestForCategory_HealthIncludesHealthMealsGym(t *testing.T) {
	r := DefaultRegistry()
	active := r.ForCategory("health")
	ids := make(map[string]bool)
	for _, s := range active {
		ids[s.ID] = true
	}
	for _, want := range []string{"health", "meals", "gym"} {
		if !ids[want] {
			t.Errorf("health category missing skill %q", want)
		}
	}
	// health should NOT include routines/calendar/tasks
	for _, nope := range []string{"routines", "calendar", "tasks"} {
		if ids[nope] {
			t.Errorf("health category should not include %q", nope)
		}
	}
}

func TestForCategory_MealsSubset(t *testing.T) {
	r := DefaultRegistry()
	active := r.ForCategory("meals")
	ids := make(map[string]bool)
	for _, s := range active {
		ids[s.ID] = true
	}
	if !ids["meals"] {
		t.Error("meals category missing meals skill")
	}
	if !ids["health"] {
		t.Error("meals category missing health skill (needed for profile context)")
	}
	if ids["gym"] {
		t.Error("meals category should NOT include gym skill")
	}
}

func TestForCategory_GymSubset(t *testing.T) {
	r := DefaultRegistry()
	active := r.ForCategory("gym")
	ids := make(map[string]bool)
	for _, s := range active {
		ids[s.ID] = true
	}
	if !ids["gym"] {
		t.Error("gym category missing gym skill")
	}
	if !ids["health"] {
		t.Error("gym category missing health skill")
	}
	if ids["meals"] {
		t.Error("gym category should NOT include meals skill")
	}
}

func TestForCategory_SortedByPriority(t *testing.T) {
	r := DefaultRegistry()
	active := r.ForCategory("health")
	for i := 1; i < len(active); i++ {
		if active[i].Priority < active[i-1].Priority {
			t.Errorf("skills not sorted by priority: %q (p=%d) before %q (p=%d)",
				active[i-1].ID, active[i-1].Priority, active[i].ID, active[i].Priority)
		}
	}
}

func TestToolsForCategory_NoDuplicates(t *testing.T) {
	r := DefaultRegistry()
	for _, cat := range []string{"", "life", "health"} {
		tools := r.ToolsForCategory(cat)
		seen := make(map[string]bool)
		for _, tool := range tools {
			if tool.Function == nil {
				continue
			}
			if seen[tool.Function.Name] {
				t.Errorf("category %q: duplicate tool %q", cat, tool.Function.Name)
			}
			seen[tool.Function.Name] = true
		}
	}
}

func TestToolsForCategory_HealthHasGymTools(t *testing.T) {
	r := DefaultRegistry()
	tools := r.ToolsForCategory("health")
	names := make(map[string]bool)
	for _, tl := range tools {
		if tl.Function != nil {
			names[tl.Function.Name] = true
		}
	}
	for _, want := range []string{"create_session", "update_session", "add_exercise_to_session", "remove_exercise_from_session", "generate_meal_plan", "log_weight", "update_health_profile"} {
		if !names[want] {
			t.Errorf("health category missing tool %q", want)
		}
	}
}

func TestToolsForCategory_LifeHasRoutineCalendarTools(t *testing.T) {
	r := DefaultRegistry()
	tools := r.ToolsForCategory("life")
	names := make(map[string]bool)
	for _, tl := range tools {
		if tl.Function != nil {
			names[tl.Function.Name] = true
		}
	}
	for _, want := range []string{"create_routine", "update_routine", "delete_routine", "list_routines", "get_calendar_events", "create_calendar_event", "create_task", "complete_task"} {
		if !names[want] {
			t.Errorf("life category missing tool %q", want)
		}
	}
}

func TestToolsForCategory_LifeExcludesGymTools(t *testing.T) {
	r := DefaultRegistry()
	tools := r.ToolsForCategory("life")
	names := make(map[string]bool)
	for _, tl := range tools {
		if tl.Function != nil {
			names[tl.Function.Name] = true
		}
	}
	for _, nope := range []string{"create_session", "add_exercise_to_session", "generate_meal_plan"} {
		if names[nope] {
			t.Errorf("life category should NOT include %q", nope)
		}
	}
}

func TestAllTools_SupersetOfAllCategories(t *testing.T) {
	r := DefaultRegistry()
	all := r.AllTools()
	allNames := make(map[string]bool)
	for _, tl := range all {
		if tl.Function != nil {
			allNames[tl.Function.Name] = true
		}
	}

	for _, cat := range []string{"", "life", "health", "meals", "gym", "routines", "calendar"} {
		catTools := r.ToolsForCategory(cat)
		for _, tl := range catTools {
			if tl.Function != nil && !allNames[tl.Function.Name] {
				t.Errorf("AllTools missing %q which is in category %q", tl.Function.Name, cat)
			}
		}
	}
}

// ─── BuildSystemPrompt ─────────────────────────────────────────────────────

func TestBuildSystemPrompt_ContainsCorePrompt(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile: &life.Profile{Timezone: "UTC"},
		Now:     time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "Kim") {
		t.Error("prompt should contain core skill content (Kim)")
	}
}

func TestBuildSystemPrompt_IncludesDateContext(t *testing.T) {
	r := DefaultRegistry()
	now := time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC)
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile: &life.Profile{Timezone: "America/New_York"},
		Now:     now,
	})
	if !strings.Contains(prompt, "2026") {
		t.Error("prompt should contain the year")
	}
	if !strings.Contains(prompt, "America/New_York") {
		t.Error("prompt should contain timezone")
	}
}

func TestBuildSystemPrompt_IncludesMemories(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile: &life.Profile{Timezone: "UTC"},
		Memories: []life.Memory{
			{ID: "mem_1", Category: "preference", Content: "Likes spicy food"},
		},
		Now: time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "spicy food") {
		t.Error("prompt should contain user memory content")
	}
	if !strings.Contains(prompt, "mem_1") {
		t.Error("prompt should contain memory ID")
	}
}

func TestBuildSystemPrompt_AutoApproveMode(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile:     &life.Profile{Timezone: "UTC"},
		AutoApprove: true,
		Now:         time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	lower := strings.ToLower(prompt)
	if !strings.Contains(lower, "auto") || !strings.Contains(lower, "approve") {
		t.Error("prompt should contain auto-approve instructions")
	}
}

func TestBuildSystemPrompt_RequireApprovalMode(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile:     &life.Profile{Timezone: "UTC"},
		AutoApprove: false,
		Now:         time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	lower := strings.ToLower(prompt)
	if !strings.Contains(lower, "actionable") {
		t.Error("require-approval prompt should mention actionables")
	}
}

func TestBuildSystemPrompt_IncludesRoutinesContext(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Category: "life",
		Profile:  &life.Profile{Timezone: "UTC"},
		Routines: []life.Routine{
			{ID: "rt_1", Name: "Morning meditation", Type: "morning", Description: "10 min meditation"},
		},
		Now: time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "Morning meditation") {
		t.Error("prompt should contain routine name")
	}
	if !strings.Contains(prompt, "rt_1") {
		t.Error("prompt should contain routine ID")
	}
}

func TestBuildSystemPrompt_IncludesCalendarEvents(t *testing.T) {
	r := DefaultRegistry()
	now := time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC)
	prompt := BuildSystemPrompt(r, PromptContext{
		Category: "life",
		Profile:  &life.Profile{Timezone: "UTC"},
		CalendarEvents: []life.GCalEvent{
			{ID: "evt_1", Summary: "Team standup", Start: now.Add(time.Hour), End: now.Add(2 * time.Hour), Status: "confirmed"},
		},
		Now: now,
	})
	if !strings.Contains(prompt, "Team standup") {
		t.Error("prompt should contain calendar event summary")
	}
}

func TestBuildSystemPrompt_HealthCategoryIncludesHealthContext(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Category: "health",
		Profile:  &life.Profile{Timezone: "UTC"},
		HealthProfile: &life.HealthProfile{
			WeightKg: 80, HeightCm: 180, Age: 30, Gender: "male",
			BMI: 24.7, BMR: 1800, TDEE: 2400,
			TargetCalories: 2200, ProteinG: 150,
			DietType: "keto", FitnessLevel: "intermediate",
		},
		Now: time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "80") {
		t.Error("prompt should contain weight")
	}
	// DietTypeLabel("keto") may produce "Keto" or "Ketogenic" — check case-insensitive
	if !strings.Contains(strings.ToLower(prompt), "keto") {
		t.Error("prompt should contain diet type")
	}
	if !strings.Contains(prompt, "2200") {
		t.Error("prompt should contain target calories")
	}
}

func TestBuildSystemPrompt_IncludesActiveSessions(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Category:      "health",
		Profile:       &life.Profile{Timezone: "UTC"},
		HealthProfile: &life.HealthProfile{WeightKg: 80, HeightCm: 180, Age: 30, Gender: "male"},
		ActiveSessions: []life.SessionSummary{
			{ID: "sess_1", Title: "Leg day", Status: "active", Difficulty: "hard", MuscleGroups: []string{"quads", "hamstrings"}, Duration: 60, ExerciseCount: 5},
		},
		Now: time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "Leg day") {
		t.Error("prompt should contain active session title")
	}
	if !strings.Contains(prompt, "sess_1") {
		t.Error("prompt should contain session ID")
	}
}

func TestBuildSystemPrompt_FocusPromptForCategory(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Category: "routines",
		Profile:  &life.Profile{Timezone: "UTC"},
		Now:      time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	// Routines category should include the focus prompt about routine tools
	lower := strings.ToLower(prompt)
	if !strings.Contains(lower, "routine") {
		t.Error("routines category prompt should mention routine focus")
	}
}

func TestBuildSystemPrompt_SystemContextAppended(t *testing.T) {
	r := DefaultRegistry()
	prompt := BuildSystemPrompt(r, PromptContext{
		Profile:       &life.Profile{Timezone: "UTC"},
		SystemContext: "CUSTOM INJECTION TEST 42",
		Now:           time.Date(2026, 4, 14, 12, 0, 0, 0, time.UTC),
	})
	if !strings.Contains(prompt, "CUSTOM INJECTION TEST 42") {
		t.Error("prompt should contain SystemContext")
	}
}
