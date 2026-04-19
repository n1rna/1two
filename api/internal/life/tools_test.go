package life

import (
	"reflect"
	"testing"
)

// ─── buildInterceptedActionableArgs ──────────────────────────────────────────

func TestBuildInterceptedActionableArgs_NoSource_OmitsSourceKey(t *testing.T) {
	args := map[string]any{"name": "Morning walk"}
	got := buildInterceptedActionableArgs("create_routine", "create_routine", args, nil)

	if _, has := got["source"]; has {
		t.Error("source key should be absent when source is nil")
	}
	if got["type"] != "confirm" {
		t.Errorf("type: got %v, want %q", got["type"], "confirm")
	}
	if got["action_type"] != "create_routine" {
		t.Errorf("action_type: got %v, want %q", got["action_type"], "create_routine")
	}
	if !reflect.DeepEqual(got["action_payload"], args) {
		t.Errorf("action_payload should carry raw args; got %v", got["action_payload"])
	}
}

func TestBuildInterceptedActionableArgs_WithSource_Propagates(t *testing.T) {
	source := map[string]any{
		"kind":         "journey",
		"trigger":      JourneyTriggerGymSessionUpdated,
		"entity_id":    "sess_123",
		"entity_title": "Push day",
	}
	args := map[string]any{"summary": "Gym – Push day", "start": "2026-04-18T07:00:00Z"}
	got := buildInterceptedActionableArgs("create_calendar_event", "create_calendar_event", args, source)

	gotSrc, ok := got["source"].(map[string]any)
	if !ok {
		t.Fatalf("source should be present and a map; got %T", got["source"])
	}
	if !reflect.DeepEqual(gotSrc, source) {
		t.Errorf("source mismatch:\ngot  %v\nwant %v", gotSrc, source)
	}

	// action_type and action_payload are preserved alongside source
	if got["action_type"] != "create_calendar_event" {
		t.Errorf("action_type: got %v, want %q", got["action_type"], "create_calendar_event")
	}
	if payload, _ := got["action_payload"].(map[string]any); payload["summary"] != args["summary"] {
		t.Error("action_payload.summary should survive into the actionable")
	}
}

func TestBuildInterceptedActionableArgs_TitleUsesToolActionTitle(t *testing.T) {
	got := buildInterceptedActionableArgs("create_routine", "create_routine",
		map[string]any{"name": "Bedtime"}, nil)
	title, _ := got["title"].(string)
	if title == "" {
		t.Fatal("title should be non-empty")
	}
	// toolActionTitle for create_routine with name yields "Create routine: Bedtime?".
	// We just check it mentions the name rather than pin to exact wording.
	if !contains(title, "Bedtime") {
		t.Errorf("title %q should reference the routine name", title)
	}
}

// tiny helper to avoid importing strings just for this; keeps file dependency-light
func contains(s, sub string) bool {
	return len(s) >= len(sub) && indexOf(s, sub) >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// ─── stampActionableSource ───────────────────────────────────────────────────

func TestStampActionableSource_SetsWhenAbsent(t *testing.T) {
	args := map[string]any{"title": "do the thing"}
	source := map[string]any{"kind": "journey", "trigger": "routine_updated"}

	stampActionableSource(args, source)

	got, ok := args["source"].(map[string]any)
	if !ok {
		t.Fatalf("source should have been stamped; got %T", args["source"])
	}
	if got["trigger"] != "routine_updated" {
		t.Errorf("stamped source missing trigger: %v", got)
	}
}

func TestStampActionableSource_PreservesCallerProvided(t *testing.T) {
	existing := map[string]any{"kind": "manual"}
	args := map[string]any{"title": "x", "source": existing}
	journeySrc := map[string]any{"kind": "journey"}

	stampActionableSource(args, journeySrc)

	got, _ := args["source"].(map[string]any)
	if got["kind"] != "manual" {
		t.Errorf("caller-provided source should win; got %v", got)
	}
}

func TestStampActionableSource_NilSource_NoOp(t *testing.T) {
	args := map[string]any{"title": "x"}
	stampActionableSource(args, nil)
	if _, has := args["source"]; has {
		t.Error("nil source should not inject a source key")
	}
}

func TestStampActionableSource_NilArgs_DoesNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("should not panic on nil args; got %v", r)
		}
	}()
	stampActionableSource(nil, map[string]any{"kind": "journey"})
}
