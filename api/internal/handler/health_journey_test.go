package handler

import (
	"strings"
	"testing"
)

// ─── buildSessionChangeSummary ──────────────────────────────────────────────

func TestBuildSessionChangeSummary_MentionsAllProvidedFields(t *testing.T) {
	title := "Push day"
	desc := "Updated notes"
	active := true
	groups := []string{"chest", "triceps"}
	equip := []string{"barbell"}
	dur := 75
	diff := "advanced"

	got := buildSessionChangeSummary(&title, &desc, &active, &groups, &equip, &dur, &diff)

	for _, want := range []string{
		"Push day", "description updated", "activated",
		"chest, triceps", "barbell", "75 min", "advanced",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("summary missing %q:\n%s", want, got)
		}
	}
}

func TestBuildSessionChangeSummary_OmitsNilFields(t *testing.T) {
	dur := 45
	got := buildSessionChangeSummary(nil, nil, nil, nil, nil, &dur, nil)

	if !strings.Contains(got, "45 min") {
		t.Errorf("summary should mention duration: %s", got)
	}
	if strings.Contains(got, "activated") || strings.Contains(got, "description") {
		t.Errorf("summary should not mention unset fields: %s", got)
	}
}

func TestBuildSessionChangeSummary_DeactivatedUsesRightVerb(t *testing.T) {
	active := false
	got := buildSessionChangeSummary(nil, nil, &active, nil, nil, nil, nil)
	if !strings.Contains(got, "deactivated") {
		t.Errorf("expected 'deactivated', got %s", got)
	}
}

func TestBuildSessionChangeSummary_EmptyRequest_ReturnsEmpty(t *testing.T) {
	got := buildSessionChangeSummary(nil, nil, nil, nil, nil, nil, nil)
	if got != "" {
		t.Errorf("expected empty summary, got %q", got)
	}
}

// ─── buildMealPlanChangeSummary ─────────────────────────────────────────────

func TestBuildMealPlanChangeSummary_FlagsContentChange(t *testing.T) {
	got := buildMealPlanChangeSummary(nil, nil, nil, nil, true, nil)
	if !strings.Contains(got, "content updated") {
		t.Errorf("summary should flag content changes so agent refreshes grocery list: %s", got)
	}
}

func TestBuildMealPlanChangeSummary_MentionsTargetCalories(t *testing.T) {
	cals := 2200
	got := buildMealPlanChangeSummary(nil, nil, nil, &cals, false, nil)
	if !strings.Contains(got, "2200") {
		t.Errorf("summary missing calorie target: %s", got)
	}
}
