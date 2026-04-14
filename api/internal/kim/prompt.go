package kim

import (
	"fmt"
	"strings"
	"time"

	"github.com/n1rna/1tt/api/internal/health"
	"github.com/n1rna/1tt/api/internal/life"
)

// PromptContext holds all the dynamic data needed to compose a system prompt.
type PromptContext struct {
	Category                string
	Profile                 *life.Profile
	Memories                []life.Memory
	Routines                []life.Routine
	PendingActionablesCount int
	CalendarEvents          []life.GCalEvent
	RoutineEventLinks       map[string][]string
	AutoApprove             bool
	HealthProfile           *life.HealthProfile
	ActiveSessions          []life.SessionSummary
	SystemContext           string // optional extra context appended at end
	Now                     time.Time
}

// BuildSystemPrompt composes a system prompt from active skills and dynamic context.
// Skills are selected from the registry based on the conversation category.
func BuildSystemPrompt(registry *SkillRegistry, pctx PromptContext) string {
	var sb strings.Builder

	active := registry.ForCategory(pctx.Category)

	// ── Skill prompts ───────────────────────────────────────────────────
	for _, s := range active {
		if s.Prompt != "" {
			sb.WriteString(s.Prompt)
			sb.WriteString("\n\n")
		}
	}

	// ── Date & time context ─────────────────────────────────────────────
	now := pctx.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	loc := time.UTC
	if pctx.Profile != nil && pctx.Profile.Timezone != "" {
		if l, err := time.LoadLocation(pctx.Profile.Timezone); err == nil {
			loc = l
		}
	}
	localNow := now.In(loc)
	sb.WriteString("## Current context\n")
	sb.WriteString(fmt.Sprintf("- Date/time: %s\n", localNow.Format("Monday, January 2, 2006 at 3:04 PM (MST)")))
	if pctx.Profile != nil {
		if pctx.Profile.Timezone != "" {
			sb.WriteString(fmt.Sprintf("- Timezone: %s\n", pctx.Profile.Timezone))
		}
		if pctx.Profile.WakeTime != "" {
			sb.WriteString(fmt.Sprintf("- Wake time: %s\n", pctx.Profile.WakeTime))
		}
		if pctx.Profile.SleepTime != "" {
			sb.WriteString(fmt.Sprintf("- Sleep time: %s\n", pctx.Profile.SleepTime))
		}
	}
	sb.WriteString("\n")

	// ── User memories ───────────────────────────────────────────────────
	if len(pctx.Memories) > 0 {
		sb.WriteString("## What you know about this user\n")
		for _, m := range pctx.Memories {
			sb.WriteString(fmt.Sprintf("- [id=%s, %s] %s\n", m.ID, m.Category, m.Content))
		}
		sb.WriteString("\n")
	}

	// ── Mode focus hint ─────────────────────────────────────────────────
	if focus := registry.FocusPrompt(pctx.Category); focus != "" {
		sb.WriteString("## Current focus\n")
		sb.WriteString(focus)
		sb.WriteString("\n\n")
	}

	// ── Dynamic data sections ───────────────────────────────────────────
	healthBranch := pctx.Category == "health" || pctx.Category == "meals" || pctx.Category == "gym"

	if healthBranch {
		writeHealthContext(&sb, pctx.HealthProfile, pctx.ActiveSessions)
	} else {
		writeLifeContext(&sb, pctx.Routines, pctx.CalendarEvents, pctx.RoutineEventLinks, pctx.PendingActionablesCount)
	}

	// ── Auto-approve / require-approval mode ────────────────────────────
	if pctx.AutoApprove {
		if s := registry.Get("auto-approve"); s != nil && s.Prompt != "" {
			sb.WriteString(s.Prompt)
			sb.WriteString("\n\n")
		}
	} else {
		if s := registry.Get("require-approval"); s != nil && s.Prompt != "" {
			sb.WriteString(s.Prompt)
			sb.WriteString("\n\n")
		}
	}

	// ── Extra context ───────────────────────────────────────────────────
	if pctx.SystemContext != "" {
		sb.WriteString("## Additional context\n")
		sb.WriteString(pctx.SystemContext)
		sb.WriteString("\n\n")
	}

	return sb.String()
}

func writeHealthContext(sb *strings.Builder, hp *life.HealthProfile, sessions []life.SessionSummary) {
	if hp != nil {
		sb.WriteString("## Health profile\n")
		if hp.Gender != "" {
			sb.WriteString(fmt.Sprintf("- Gender: %s\n", hp.Gender))
		}
		if hp.Age > 0 {
			sb.WriteString(fmt.Sprintf("- Age: %d\n", hp.Age))
		}
		if hp.HeightCm > 0 {
			sb.WriteString(fmt.Sprintf("- Height: %.0f cm\n", hp.HeightCm))
		}
		if hp.WeightKg > 0 {
			sb.WriteString(fmt.Sprintf("- Weight: %.1f kg\n", hp.WeightKg))
		}
		if hp.GoalWeightKg > 0 {
			sb.WriteString(fmt.Sprintf("- Goal weight: %.1f kg\n", hp.GoalWeightKg))
		}
		if hp.ActivityLevel != "" {
			sb.WriteString(fmt.Sprintf("- Activity level: %s\n", hp.ActivityLevel))
		}
		if hp.DietType != "" {
			sb.WriteString(fmt.Sprintf("- Diet type: %s\n", health.DietTypeLabel(hp.DietType)))
		}
		if hp.DietGoal != "" {
			sb.WriteString(fmt.Sprintf("- Diet goal: %s weight\n", hp.DietGoal))
		}
		if len(hp.Restrictions) > 0 {
			sb.WriteString(fmt.Sprintf("- Dietary restrictions: %s\n", strings.Join(hp.Restrictions, ", ")))
		}
		if hp.FitnessLevel != "" {
			sb.WriteString(fmt.Sprintf("- Fitness level: %s\n", hp.FitnessLevel))
		}
		if hp.FitnessGoal != "" {
			sb.WriteString(fmt.Sprintf("- Fitness goal: %s\n", health.FitnessGoalLabel(hp.FitnessGoal)))
		}
		if len(hp.AvailableEquipment) > 0 {
			sb.WriteString(fmt.Sprintf("- Equipment: %s\n", strings.Join(hp.AvailableEquipment, ", ")))
		}
		if len(hp.PhysicalLimitations) > 0 {
			sb.WriteString(fmt.Sprintf("- Physical limitations: %s\n", strings.Join(hp.PhysicalLimitations, ", ")))
		}
		if len(hp.WorkoutLikes) > 0 {
			sb.WriteString(fmt.Sprintf("- Enjoys: %s\n", strings.Join(hp.WorkoutLikes, ", ")))
		}
		if len(hp.WorkoutDislikes) > 0 {
			sb.WriteString(fmt.Sprintf("- Dislikes: %s\n", strings.Join(hp.WorkoutDislikes, ", ")))
		}
		if hp.PreferredDuration > 0 {
			sb.WriteString(fmt.Sprintf("- Preferred session duration: %d min\n", hp.PreferredDuration))
		}
		if hp.DaysPerWeek > 0 {
			sb.WriteString(fmt.Sprintf("- Training days/week: %d\n", hp.DaysPerWeek))
		}
		sb.WriteString("\n")

		if hp.BMI > 0 {
			sb.WriteString("## Nutrition stats\n")
			sb.WriteString(fmt.Sprintf("- BMI: %.1f (%s)\n", hp.BMI, health.BMICategory(hp.BMI)))
			if hp.BMR > 0 {
				sb.WriteString(fmt.Sprintf("- BMR: %.0f kcal/day\n", hp.BMR))
			}
			if hp.TDEE > 0 {
				sb.WriteString(fmt.Sprintf("- TDEE: %.0f kcal/day\n", hp.TDEE))
			}
			if hp.TargetCalories > 0 {
				sb.WriteString(fmt.Sprintf("- Daily calorie target: %d kcal\n", hp.TargetCalories))
			}
			if hp.ProteinG > 0 || hp.CarbsG > 0 || hp.FatG > 0 {
				sb.WriteString(fmt.Sprintf("- Macros: %dg protein, %dg carbs, %dg fat\n",
					hp.ProteinG, hp.CarbsG, hp.FatG))
			}
			sb.WriteString("\n")
		}
	}

	if len(sessions) > 0 {
		sb.WriteString("## Active workout sessions\n")
		for _, s := range sessions {
			muscles := "—"
			if len(s.MuscleGroups) > 0 {
				muscles = strings.Join(s.MuscleGroups, ", ")
			}
			sb.WriteString(fmt.Sprintf("- [id=%s, %s] **%s** — %s, %d exercises, ~%dmin, %s\n",
				s.ID, s.Status, s.Title, muscles, s.ExerciseCount, s.Duration, s.Difficulty))
		}
		sb.WriteString("\n")
	}
}

func writeLifeContext(sb *strings.Builder, routines []life.Routine, events []life.GCalEvent, links map[string][]string, pendingCount int) {
	if len(routines) > 0 {
		sb.WriteString("## User's active routines\n")
		for _, r := range routines {
			if r.Description != "" {
				sb.WriteString(fmt.Sprintf("- [id=%s] **%s**: %s\n", r.ID, r.Name, r.Description))
			} else {
				sb.WriteString(fmt.Sprintf("- [id=%s] **%s**\n", r.ID, r.Name))
			}
			if ll, ok := links[r.ID]; ok && len(ll) > 0 {
				sb.WriteString(fmt.Sprintf("  Linked calendar events: %s\n", strings.Join(ll, ", ")))
			}
		}
		sb.WriteString("\n")
	}

	if len(events) > 0 {
		sb.WriteString("## Upcoming calendar events (next 7 days)\n")
		for _, ev := range events {
			var line string
			if ev.AllDay {
				line = fmt.Sprintf("- [id=%s] %s — %s (all day)",
					ev.ID, ev.Start.Format("Mon Jan 2"), ev.Summary)
			} else {
				line = fmt.Sprintf("- [id=%s] %s %s–%s — %s",
					ev.ID, ev.Start.Format("Mon Jan 2"),
					ev.Start.Format("3:04 PM"), ev.End.Format("3:04 PM"), ev.Summary)
			}
			if ev.RoutineName != "" {
				line += fmt.Sprintf(" [routine: %s]", ev.RoutineName)
			}
			sb.WriteString(line + "\n")
		}
		sb.WriteString("Use the ids above directly with update_calendar_event / delete_calendar_event / link_event_to_routine. Only call get_calendar_events if you need an event that is not listed here.\n\n")
	}

	if pendingCount > 0 {
		sb.WriteString(fmt.Sprintf("The user has **%d pending actionable(s)** awaiting their response. You can mention this if relevant.\n\n", pendingCount))
	}
}
