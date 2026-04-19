package life

import (
	"strings"
	"testing"
)

// ─── journeyPrompt ───────────────────────────────────────────────────────────

func TestJourneyPrompt_GymSession_MentionsEntityAndChange(t *testing.T) {
	p := journeyPrompt(JourneyEvent{
		Trigger:       JourneyTriggerGymSessionUpdated,
		EntityID:      "sess_123",
		EntityTitle:   "Push day A",
		ChangeSummary: "duration → 90 min",
	})

	for _, want := range []string{
		"gym session", "Push day A", "sess_123", "duration → 90 min",
		"calendar events", "confirm",
	} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt missing %q:\n%s", want, p)
		}
	}
}

func TestJourneyPrompt_MealPlan_MentionsGroceryAndTasks(t *testing.T) {
	p := journeyPrompt(JourneyEvent{
		Trigger:       JourneyTriggerMealPlanUpdated,
		EntityID:      "plan_42",
		EntityTitle:   "Cut phase week 3",
		ChangeSummary: "meals content changed",
	})

	if !strings.Contains(p, "meal plan") {
		t.Error("meal plan prompt should mention meal plan")
	}
	if !strings.Contains(p, "Cut phase week 3") {
		t.Error("meal plan prompt should mention entity title")
	}
	if !strings.Contains(p, "grocery") {
		t.Error("meal plan prompt should mention grocery")
	}
}

func TestJourneyPrompt_Routine_MentionsCalendar(t *testing.T) {
	p := journeyPrompt(JourneyEvent{
		Trigger:     JourneyTriggerRoutineUpdated,
		EntityID:    "rt_7",
		EntityTitle: "Morning stretch",
	})
	if !strings.Contains(p, "routine") {
		t.Error("routine prompt should mention routine")
	}
	if !strings.Contains(p, "calendar") {
		t.Error("routine prompt should mention calendar events")
	}
	if !strings.Contains(p, "Morning stretch") {
		t.Error("routine prompt should mention entity title")
	}
}

func TestJourneyPrompt_UnknownTrigger_IncludesAll(t *testing.T) {
	p := journeyPrompt(JourneyEvent{
		Trigger:       "some_future_trigger",
		EntityID:      "x1",
		EntityTitle:   "Something",
		ChangeSummary: "a change happened",
	})
	if !strings.Contains(p, "some_future_trigger") {
		t.Error("fallback prompt should mention trigger name")
	}
	if !strings.Contains(p, "a change happened") {
		t.Error("fallback prompt should include change summary")
	}
}

func TestJourneyPrompt_NoChangeSummary_UsesPlaceholder(t *testing.T) {
	p := journeyPrompt(JourneyEvent{
		Trigger:     JourneyTriggerRoutineUpdated,
		EntityID:    "rt_1",
		EntityTitle: "X",
	})
	if !strings.Contains(p, "no change summary provided") {
		t.Error("empty change summary should fall back to placeholder")
	}
}

// ─── journeySystemContext ───────────────────────────────────────────────────

func TestJourneySystemContext_MentionsTrigger(t *testing.T) {
	ctx := journeySystemContext(JourneyEvent{Trigger: JourneyTriggerGymSessionUpdated})
	if !strings.Contains(ctx, JourneyTriggerGymSessionUpdated) {
		t.Errorf("system context should echo the trigger: %s", ctx)
	}
}

func TestJourneySystemContext_ForcesActionablePath(t *testing.T) {
	ctx := journeySystemContext(JourneyEvent{Trigger: JourneyTriggerRoutineUpdated})

	// Rules agent must follow: no direct mutation; auto-approve is off;
	// keep proposals small; don't re-confirm the user's original change.
	mustMention := []string{
		"actionable",
		"auto-approve",
		"0–5",
	}
	for _, want := range mustMention {
		if !strings.Contains(ctx, want) {
			t.Errorf("system context missing required guidance %q:\n%s", want, ctx)
		}
	}
}

// ─── buildJourneyChatRequest ─────────────────────────────────────────────────

func TestBuildJourneyChatRequest_SetsSourceAndAutoApproveOff(t *testing.T) {
	ev := JourneyEvent{
		UserID:        "user_abc",
		Trigger:       JourneyTriggerGymSessionUpdated,
		EntityID:      "sess_9",
		EntityTitle:   "Pull day",
		ChangeSummary: "muscle_groups → [back, biceps]",
	}
	req := buildJourneyChatRequest(ev, nil, nil, &Profile{Timezone: "UTC"}, nil)

	if req.UserID != "user_abc" {
		t.Errorf("user_id: got %q, want %q", req.UserID, "user_abc")
	}
	if req.AutoApprove {
		t.Error("AutoApprove must be false so write tools are intercepted into actionables")
	}
	if req.ConversationCategory != "auto" {
		t.Errorf("ConversationCategory: got %q, want %q", req.ConversationCategory, "auto")
	}

	if req.ActionableSource == nil {
		t.Fatal("ActionableSource must be set so agent-created actionables get tagged")
	}
	gotKind, _ := req.ActionableSource["kind"].(string)
	if gotKind != "journey" {
		t.Errorf("source.kind: got %q, want %q", gotKind, "journey")
	}
	gotTrigger, _ := req.ActionableSource["trigger"].(string)
	if gotTrigger != JourneyTriggerGymSessionUpdated {
		t.Errorf("source.trigger: got %q, want %q", gotTrigger, JourneyTriggerGymSessionUpdated)
	}
	gotEntity, _ := req.ActionableSource["entity_id"].(string)
	if gotEntity != "sess_9" {
		t.Errorf("source.entity_id: got %q, want %q", gotEntity, "sess_9")
	}
	gotTitle, _ := req.ActionableSource["entity_title"].(string)
	if gotTitle != "Pull day" {
		t.Errorf("source.entity_title: got %q, want %q", gotTitle, "Pull day")
	}
}

func TestBuildJourneyChatRequest_EmptyIDAndTitleAreOmitted(t *testing.T) {
	ev := JourneyEvent{
		UserID:  "u",
		Trigger: JourneyTriggerMealPlanUpdated,
	}
	req := buildJourneyChatRequest(ev, nil, nil, nil, nil)

	if _, has := req.ActionableSource["entity_id"]; has {
		t.Error("entity_id should be omitted when EntityID is empty")
	}
	if _, has := req.ActionableSource["entity_title"]; has {
		t.Error("entity_title should be omitted when EntityTitle is empty")
	}
}

func TestBuildJourneyChatRequest_EmbedsPromptAndSystemContext(t *testing.T) {
	ev := JourneyEvent{
		UserID:      "u",
		Trigger:     JourneyTriggerRoutineUpdated,
		EntityTitle: "Bedtime",
	}
	req := buildJourneyChatRequest(ev, nil, nil, nil, nil)

	if !strings.Contains(req.Message, "Bedtime") {
		t.Error("prompt should mention entity title")
	}
	if !strings.Contains(req.SystemContext, JourneyTriggerRoutineUpdated) {
		t.Error("system context should mention the trigger")
	}
}

func TestBuildJourneyChatRequest_PassesThroughPreloadedContext(t *testing.T) {
	memories := []Memory{{ID: "m1", Category: "preference", Content: "likes mornings"}}
	routines := []Routine{{ID: "r1", Name: "Wake up"}}
	profile := &Profile{Timezone: "Europe/Berlin"}
	events := []GCalEvent{{ID: "e1", Summary: "Call mom"}}

	req := buildJourneyChatRequest(JourneyEvent{
		UserID:  "u",
		Trigger: JourneyTriggerMealPlanUpdated,
	}, memories, routines, profile, events)

	if len(req.Memories) != 1 || req.Memories[0].ID != "m1" {
		t.Error("memories not threaded through")
	}
	if len(req.Routines) != 1 || req.Routines[0].Name != "Wake up" {
		t.Error("routines not threaded through")
	}
	if req.Profile == nil || req.Profile.Timezone != "Europe/Berlin" {
		t.Error("profile not threaded through")
	}
	if len(req.CalendarEvents) != 1 || req.CalendarEvents[0].Summary != "Call mom" {
		t.Error("calendar events not threaded through")
	}
}
