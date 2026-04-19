package main

import (
	"context"
	"database/sql"
	"log"
	"strings"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/tracked"
)

// journeyEventWorker runs the cascading agent for a single journey event
// (gym_session_updated, meal_plan_updated, routine_updated). It wraps the
// call in tracked.RunSync so the activity feed sees every invocation.
type journeyEventWorker struct {
	river.WorkerDefaults[jobs.JourneyEventArgs]
	db    *sql.DB
	agent life.ChatAgent
}

func (w *journeyEventWorker) Work(ctx context.Context, job *river.Job[jobs.JourneyEventArgs]) error {
	ev := life.JourneyEvent{
		UserID:        job.Args.UserID,
		Trigger:       job.Args.Trigger,
		EntityID:      job.Args.EntityID,
		EntityTitle:   job.Args.EntityTitle,
		ChangeSummary: job.Args.Payload,
	}
	_, err := tracked.RunSync(ctx, w.db, tracked.Meta{
		UserID:      ev.UserID,
		Kind:        "journey",
		Title:       journeyRunTitle(ev.Trigger),
		Subtitle:    ev.EntityTitle,
		Trigger:     ev.Trigger,
		EntityID:    ev.EntityID,
		EntityTitle: ev.EntityTitle,
	}, func(ctx context.Context, _ string) (tracked.RunOutput, error) {
		result, err := life.ProcessJourneyEventWithResult(ctx, w.db, w.agent, ev)
		if err != nil {
			log.Printf("journey: %s for user %s: %v", ev.Trigger, ev.UserID, err)
			return tracked.RunOutput{Summary: "Journey run failed"}, err
		}
		return tracked.FromToolResult(result, ""), nil
	})
	return err
}

func journeyRunTitle(trigger string) string {
	switch trigger {
	case life.JourneyTriggerGymSessionUpdated:
		return "Processing gym session update"
	case life.JourneyTriggerMealPlanUpdated:
		return "Processing meal plan update"
	case life.JourneyTriggerRoutineUpdated:
		return "Processing routine update"
	default:
		return "Processing " + strings.ReplaceAll(trigger, "_", " ")
	}
}
