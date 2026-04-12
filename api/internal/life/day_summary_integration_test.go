//go:build integration

package life

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"
)

// ─── invariant checker ───────────────────────────────────────────────────────

// validBlockTypes mirrors the enum from daySummarySystemPrompt.
var validBlockTypes = map[string]bool{
	"sleep":           true,
	"morning_routine": true,
	"commute":         true,
	"work":            true,
	"tasks":           true,
	"meal":            true,
	"exercise":        true,
	"social":          true,
	"personal":        true,
	"project":         true,
	"rest":            true,
	"errand":          true,
}

// parseHHMM parses "HH:MM" into minutes-since-midnight. Returns -1 on error.
func parseHHMM(s string) int {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return -1
	}
	return t.Hour()*60 + t.Minute()
}

// assertBlockInvariants checks the structural rules from daySummarySystemPrompt
// that should hold for every generated day summary regardless of inputs.
func assertBlockInvariants(t *testing.T, blocks []DayBlock, inputEventIDs []string) {
	t.Helper()

	if len(blocks) == 0 {
		t.Fatalf("expected at least one block, got 0")
	}
	if len(blocks) < 4 || len(blocks) > 14 {
		t.Errorf("expected 4–14 blocks (system prompt aims for 6–10), got %d", len(blocks))
	}

	// 1. First block starts at 00:00 and is sleep.
	first := blocks[0]
	if first.Start != "00:00" {
		t.Errorf("first block must start at 00:00, got %q", first.Start)
	}
	if first.Type != "sleep" {
		t.Errorf("first block must be type=sleep, got %q", first.Type)
	}

	// 2. Last block ends at 23:59 and is sleep.
	last := blocks[len(blocks)-1]
	if last.End != "23:59" {
		t.Errorf("last block must end at 23:59, got %q", last.End)
	}
	if last.Type != "sleep" {
		t.Errorf("last block must be type=sleep, got %q", last.Type)
	}

	// 3. Every block has valid fields.
	for i, b := range blocks {
		if !validBlockTypes[b.Type] {
			t.Errorf("block[%d]: invalid type %q", i, b.Type)
		}
		if b.Label == "" {
			t.Errorf("block[%d] (%s): empty label", i, b.Type)
		}
		if parseHHMM(b.Start) < 0 {
			t.Errorf("block[%d] (%s): invalid start %q", i, b.Type, b.Start)
		}
		if parseHHMM(b.End) < 0 {
			t.Errorf("block[%d] (%s): invalid end %q", i, b.Type, b.End)
		}
		if parseHHMM(b.End) <= parseHHMM(b.Start) {
			t.Errorf("block[%d] (%s): end %q is not after start %q", i, b.Type, b.End, b.Start)
		}
	}

	// 4. No gaps and no overlaps between consecutive blocks.
	for i := 1; i < len(blocks); i++ {
		prevEnd := parseHHMM(blocks[i-1].End)
		curStart := parseHHMM(blocks[i].Start)
		if prevEnd != curStart {
			t.Errorf("gap or overlap between block[%d] (%s, ends %s) and block[%d] (%s, starts %s)",
				i-1, blocks[i-1].Type, blocks[i-1].End,
				i, blocks[i].Type, blocks[i].Start,
			)
		}
	}

	// 5. Every input event ID appears in some block's eventIds.
	if len(inputEventIDs) > 0 {
		seen := map[string]bool{}
		for _, b := range blocks {
			for _, id := range b.EventIDs {
				seen[id] = true
			}
		}
		for _, want := range inputEventIDs {
			if !seen[want] {
				t.Errorf("input event %q does not appear in any block's eventIds", want)
			}
		}
	}
}

// runDaySummary calls generateDaySummary against the real LLM with the test config.
func runDaySummary(t *testing.T, events []GCalEvent, profile *Profile, routines []Routine) []DayBlock {
	t.Helper()
	cfg := loadTestLLMConfig(t)

	// Day-summary generation uses a thinking model that produces 5–22k chars of
	// reasoning per call. Many-event days routinely take 3–5 minutes — this is
	// itself a known issue worth addressing (simpler prompt or non-thinking model).
	ctx, cancel := context.WithTimeout(context.Background(), 360*time.Second)
	defer cancel()

	date := time.Date(2026, 4, 13, 0, 0, 0, 0, time.UTC) // Monday
	blocks, err := generateDaySummary(ctx, cfg, "test-user", date, events, profile, routines)
	if err != nil {
		t.Fatalf("generateDaySummary: %v", err)
	}
	return blocks
}

// fixedDate returns a UTC time at the given hour/minute on 2026-04-13 (Monday).
func fixedDate(hour, minute int) time.Time {
	return time.Date(2026, 4, 13, hour, minute, 0, 0, time.UTC)
}

func eventIDsOf(events []GCalEvent) []string {
	out := make([]string, len(events))
	for i, e := range events {
		out[i] = e.ID
	}
	return out
}

func countBlocksOfType(blocks []DayBlock, typ string) int {
	n := 0
	for _, b := range blocks {
		if b.Type == typ {
			n++
		}
	}
	return n
}

func dumpBlocks(blocks []DayBlock) string {
	var sb strings.Builder
	for _, b := range blocks {
		sb.WriteString(fmt.Sprintf("  [%s–%s] %s (%s) ids=%v\n", b.Start, b.End, b.Label, b.Type, b.EventIDs))
	}
	return sb.String()
}

// ─── tests ───────────────────────────────────────────────────────────────────

func TestDaySummary_TypicalWorkday(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "07:00", SleepTime: "23:00"}
	events := []GCalEvent{
		{ID: "ev_standup", Summary: "Standup", Start: fixedDate(9, 0), End: fixedDate(9, 15)},
		{ID: "ev_design", Summary: "Design review", Start: fixedDate(10, 0), End: fixedDate(11, 0)},
		{ID: "ev_lunch", Summary: "Lunch", Start: fixedDate(12, 0), End: fixedDate(13, 0)},
		{ID: "ev_1on1", Summary: "1:1 with Sara", Start: fixedDate(14, 0), End: fixedDate(14, 30)},
		{ID: "ev_review", Summary: "Code review", Start: fixedDate(15, 0), End: fixedDate(16, 0)},
		{ID: "ev_gym", Summary: "Gym — leg day", Start: fixedDate(18, 0), End: fixedDate(19, 0)},
		{ID: "ev_dinner", Summary: "Dinner with family", Start: fixedDate(20, 0), End: fixedDate(21, 0)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, eventIDsOf(events))

	// Domain-specific: should produce exactly one work block (rule: merge meetings).
	if n := countBlocksOfType(blocks, "work"); n != 1 {
		t.Errorf("expected exactly 1 'work' block (meetings should be merged), got %d", n)
	}
	// Should produce an exercise block for the gym session.
	if n := countBlocksOfType(blocks, "exercise"); n < 1 {
		t.Errorf("expected at least 1 'exercise' block, got %d", n)
	}
}

func TestDaySummary_EmptyDay(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "08:00", SleepTime: "22:30"}
	blocks := runDaySummary(t, nil, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, nil)

	// With no events, the day should still be fully covered. We expect at
	// least: opening sleep, some midday filler, closing sleep (>= 3 blocks).
	if len(blocks) < 3 {
		t.Errorf("empty day should still have at least 3 blocks (sleep + filler + sleep), got %d", len(blocks))
	}
}

func TestDaySummary_MergesMultipleMeetingsIntoSingleWorkBlock(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "07:00", SleepTime: "23:00"}
	// Heavy meeting day — 6 separate meetings spread across the workday.
	events := []GCalEvent{
		{ID: "m1", Summary: "Standup", Start: fixedDate(9, 0), End: fixedDate(9, 15)},
		{ID: "m2", Summary: "Backend sync", Start: fixedDate(10, 0), End: fixedDate(10, 30)},
		{ID: "m3", Summary: "Sprint planning", Start: fixedDate(11, 0), End: fixedDate(12, 0)},
		{ID: "m4", Summary: "1:1 with Alice", Start: fixedDate(13, 30), End: fixedDate(14, 0)},
		{ID: "m5", Summary: "Architecture review", Start: fixedDate(14, 30), End: fixedDate(15, 30)},
		{ID: "m6", Summary: "Demo prep", Start: fixedDate(16, 0), End: fixedDate(17, 0)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, eventIDsOf(events))

	// CRITICAL: merge rule. All meetings should land in a single work block.
	if n := countBlocksOfType(blocks, "work"); n != 1 {
		t.Errorf("expected 1 'work' block when merging 6 meetings, got %d. blocks:\n%s", n, dumpBlocks(blocks))
	}
}

func TestDaySummary_HasExerciseBlockForGym(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "06:30", SleepTime: "22:30"}
	events := []GCalEvent{
		{ID: "gym1", Summary: "Morning gym — push day", Start: fixedDate(7, 0), End: fixedDate(8, 0)},
		{ID: "work1", Summary: "Team standup", Start: fixedDate(9, 30), End: fixedDate(9, 45)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, eventIDsOf(events))

	if n := countBlocksOfType(blocks, "exercise"); n != 1 {
		t.Errorf("expected 1 'exercise' block for gym session, got %d", n)
	}

	// The gym event id should specifically be in an exercise block.
	for _, b := range blocks {
		for _, id := range b.EventIDs {
			if id == "gym1" && b.Type != "exercise" {
				t.Errorf("gym event landed in block type %q, expected 'exercise'", b.Type)
			}
		}
	}
}

func TestDaySummary_RespectsWakeAndSleepTimes(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "06:00", SleepTime: "22:00"}
	events := []GCalEvent{
		{ID: "ev_meeting", Summary: "Team meeting", Start: fixedDate(10, 0), End: fixedDate(11, 0)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, eventIDsOf(events))

	// Opening sleep block should end at the wake time (06:00).
	if blocks[0].End != "06:00" {
		t.Errorf("opening sleep block should end at wake time 06:00, got %q", blocks[0].End)
	}
	// Closing sleep block should start at the sleep time (22:00).
	last := blocks[len(blocks)-1]
	if last.Start != "22:00" {
		t.Errorf("closing sleep block should start at sleep time 22:00, got %q", last.Start)
	}
}

func TestDaySummary_AllEventIDsAreLinked(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "07:00", SleepTime: "23:00"}
	events := []GCalEvent{
		{ID: "abc123", Summary: "Coffee with friend", Start: fixedDate(8, 30), End: fixedDate(9, 30)},
		{ID: "def456", Summary: "Project work block", Start: fixedDate(10, 0), End: fixedDate(12, 0)},
		{ID: "ghi789", Summary: "Doctor appointment", Start: fixedDate(15, 0), End: fixedDate(16, 0)},
		{ID: "jkl012", Summary: "Yoga class", Start: fixedDate(18, 30), End: fixedDate(19, 30)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	// invariant check already covers this, but make it explicit:
	assertBlockInvariants(t, blocks, eventIDsOf(events))
}

func TestDaySummary_WeekendNoMeetings(t *testing.T) {
	profile := &Profile{Timezone: "UTC", WakeTime: "08:30", SleepTime: "23:30"}
	events := []GCalEvent{
		{ID: "brunch", Summary: "Brunch with parents", Start: fixedDate(11, 0), End: fixedDate(12, 30)},
		{ID: "movie", Summary: "Movie night", Start: fixedDate(20, 0), End: fixedDate(22, 0)},
	}

	blocks := runDaySummary(t, events, profile, nil)
	t.Logf("blocks:\n%s", dumpBlocks(blocks))
	assertBlockInvariants(t, blocks, eventIDsOf(events))

	// Should NOT have a 'work' block on a meeting-free day.
	if n := countBlocksOfType(blocks, "work"); n != 0 {
		t.Errorf("expected 0 'work' blocks on a meeting-free day, got %d", n)
	}
}
