package life

import (
	"context"
	"database/sql"
	"fmt"
	"log"
)

// Journey trigger identifiers. These correspond to user-visible entity changes
// that may cascade to affect other parts of the user's planning (calendar,
// tasks, grocery list, etc.). Keep in sync with the TypeScript client and the
// actionables UI labels.
const (
	JourneyTriggerGymSessionUpdated = "gym_session_updated"
	JourneyTriggerMealPlanUpdated   = "meal_plan_updated"
	JourneyTriggerRoutineUpdated    = "routine_updated"
)

// JourneyEvent describes an entity change that may cascade to other planning
// surfaces. It is passed to ProcessJourneyEvent to kick off an async agent run.
type JourneyEvent struct {
	UserID        string // owner of the entity that changed
	Trigger       string // one of the JourneyTrigger* constants
	EntityID      string // primary key of the changed entity
	EntityTitle   string // human-readable label for the UI source badge
	ChangeSummary string // short natural-language description of what changed (agent input)
}

// ProcessJourneyEvent runs the Kim agent on a journey event and lets it
// propose cascading changes as actionables. All agent side effects are routed
// through the actionables system (AutoApprove=false) and tagged with a
// `source` field so the UI can group and explain them.
//
// Intended to be called from a goroutine after a successful entity update.
// Errors are logged; callers typically fire-and-forget.
func ProcessJourneyEvent(ctx context.Context, db *sql.DB, agent ChatAgent, ev JourneyEvent) error {
	if ev.UserID == "" || ev.Trigger == "" {
		return fmt.Errorf("journey: user_id and trigger are required")
	}

	// Load profile.
	var profile Profile
	var wakeTime, sleepTime sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
		ev.UserID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime)
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	// Load memories (best-effort).
	var memories []Memory
	if rows, err := db.QueryContext(ctx,
		`SELECT id, category, content FROM life_memories
		 WHERE user_id = $1 AND active = TRUE
		 ORDER BY created_at DESC LIMIT 50`,
		ev.UserID,
	); err == nil {
		for rows.Next() {
			var m Memory
			if err := rows.Scan(&m.ID, &m.Category, &m.Content); err == nil {
				memories = append(memories, m)
			}
		}
		rows.Close()
	}

	// Load active routines (best-effort).
	var routines []Routine
	if rows, err := db.QueryContext(ctx,
		`SELECT id, name, description FROM life_routines
		 WHERE user_id = $1 AND active = TRUE`,
		ev.UserID,
	); err == nil {
		for rows.Next() {
			var rt Routine
			if err := rows.Scan(&rt.ID, &rt.Name, &rt.Description); err == nil {
				routines = append(routines, rt)
			}
		}
		rows.Close()
	}

	// Load upcoming calendar events (best-effort).
	var calendarEvents []GCalEvent
	if gcalCli := agent.GCalClient(); gcalCli != nil {
		if token, err := EnsureValidToken(ctx, db, gcalCli, ev.UserID); err == nil {
			if evs, err := gcalCli.ListEvents(ctx, token, 14); err == nil {
				calendarEvents = evs
			}
		}
	}

	req := buildJourneyChatRequest(ev, memories, routines, &profile, calendarEvents)

	result, err := agent.Chat(ctx, req)
	if err != nil {
		log.Printf("journey: agent chat for %s/%s: %v", ev.UserID, ev.Trigger, err)
		return fmt.Errorf("journey: agent chat: %w", err)
	}

	log.Printf("journey: %s for user %s → %d effects", ev.Trigger, ev.UserID, len(result.Effects))
	return nil
}

// buildJourneyChatRequest composes the ChatRequest sent to the agent for a
// journey event. It is a pure function of its inputs so we can unit-test the
// wiring (source, AutoApprove, prompt, system context) without a DB or LLM.
func buildJourneyChatRequest(
	ev JourneyEvent,
	memories []Memory,
	routines []Routine,
	profile *Profile,
	calendarEvents []GCalEvent,
) ChatRequest {
	source := map[string]any{
		"kind":    "journey",
		"trigger": ev.Trigger,
	}
	if ev.EntityID != "" {
		source["entity_id"] = ev.EntityID
	}
	if ev.EntityTitle != "" {
		source["entity_title"] = ev.EntityTitle
	}

	return ChatRequest{
		UserID:               ev.UserID,
		Message:              journeyPrompt(ev),
		Memories:             memories,
		Profile:              profile,
		Routines:             routines,
		CalendarEvents:       calendarEvents,
		AutoApprove:          false,
		ConversationCategory: "auto",
		SystemContext:        journeySystemContext(ev),
		ActionableSource:     source,
	}
}

// journeyPrompt is the user-turn message given to the agent for a journey event.
func journeyPrompt(ev JourneyEvent) string {
	change := ev.ChangeSummary
	if change == "" {
		change = "(no change summary provided)"
	}

	switch ev.Trigger {
	case JourneyTriggerGymSessionUpdated:
		return fmt.Sprintf(
			"The user just updated a gym session: %q (id=%s).\n\nWhat changed:\n%s\n\n"+
				"Detect which calendar events or tasks may need to be adjusted as a result "+
				"(e.g. the workout block on the user's calendar, linked recovery reminders). "+
				"For each cascading change, create a confirm-type actionable so the user can approve it.",
			ev.EntityTitle, ev.EntityID, change)

	case JourneyTriggerMealPlanUpdated:
		return fmt.Sprintf(
			"The user just updated their meal plan: %q (id=%s).\n\nWhat changed:\n%s\n\n"+
				"Detect which grocery items, meal-prep tasks, or reminders should change to match the new plan. "+
				"For each cascading change, create a confirm-type actionable so the user can approve it.",
			ev.EntityTitle, ev.EntityID, change)

	case JourneyTriggerRoutineUpdated:
		return fmt.Sprintf(
			"The user just updated a routine: %q (id=%s).\n\nWhat changed:\n%s\n\n"+
				"Detect which linked calendar events or reminders should be rescheduled or edited to match the new routine. "+
				"For each cascading change, create a confirm-type actionable so the user can approve it.",
			ev.EntityTitle, ev.EntityID, change)

	default:
		return fmt.Sprintf(
			"A journey event fired: trigger=%s entity=%q (id=%s).\n\nChange summary:\n%s\n\n"+
				"Propose cascading changes as actionables.",
			ev.Trigger, ev.EntityTitle, ev.EntityID, change)
	}
}

// journeySystemContext appends journey-specific rules to the system prompt.
// It forces the agent to work through actionables only (it already runs with
// AutoApprove=false, which intercepts write tools) and reminds it not to
// spam duplicates.
func journeySystemContext(ev JourneyEvent) string {
	return fmt.Sprintf(`This is an async JOURNEY run triggered by a user action (trigger=%s).

Rules:
- You are proposing cascading changes only. NEVER modify entities directly; every change MUST be surfaced as an actionable for user confirmation.
- The current auto-approve mode is OFF, so calling a write tool (create_calendar_event, update_calendar_event, delete_calendar_event, create_task, update_task, delete_task, create_routine, update_routine, delete_routine) will be intercepted and converted into a confirm-type actionable automatically — this is the expected path.
- You MAY also call create_actionable directly for informational prompts or questions.
- Keep proposals specific and small: 0–5 actionables. If nothing obvious needs to cascade, create ZERO actionables and stop.
- Do NOT ask the user to confirm the original change — it already happened. Only propose downstream cascades.
- The actionables you create will automatically be tagged with the journey source; you do not need to pass a source field yourself.
`, ev.Trigger)
}
