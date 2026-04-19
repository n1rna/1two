package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/kim"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/tracked"
)

// actionableFollowupWorker runs the Kim agent after a user responds to an
// actionable. Mirrors the legacy in-process tracked.Run block from
// handler/life.go:RespondToActionable so the activity feed + follow-up
// effect persistence keep working.
type actionableFollowupWorker struct {
	river.WorkerDefaults[jobs.ActionableFollowupArgs]
	db    *sql.DB
	agent *kim.Agent
}

func (w *actionableFollowupWorker) Work(ctx context.Context, job *river.Job[jobs.ActionableFollowupArgs]) error {
	actionableID := job.Args.ActionableID
	userID := job.Args.UserID

	// Load actionable for title/type context — needed both for the run meta
	// and for the agent call.
	var aTitle, aType string
	_ = w.db.QueryRowContext(ctx,
		`SELECT title, type FROM life_actionables WHERE id = $1`,
		actionableID,
	).Scan(&aTitle, &aType)

	_, err := tracked.RunSync(ctx, w.db, tracked.Meta{
		UserID:      userID,
		Kind:        "actionable_followup",
		Title:       "Following up on your response",
		Subtitle:    aTitle,
		Trigger:     actionableID,
		EntityID:    actionableID,
		EntityTitle: aTitle,
	}, func(ctx context.Context, _ string) (tracked.RunOutput, error) {
		chatResult, err := w.agent.ProcessActionableResponse(
			ctx, w.db, userID,
			life.ActionableRecord{ID: actionableID, Type: aType, Title: aTitle},
			job.Args.Response,
		)
		if err != nil {
			log.Printf("actionable_followup: %s: %v", actionableID, err)
			return tracked.RunOutput{Summary: "Follow-up failed"}, err
		}

		// Persist follow-up effects onto the actionable row (verifies the
		// agent actually took action).
		if chatResult != nil && len(chatResult.Effects) > 0 {
			var effectsSummary []map[string]any
			for _, eff := range chatResult.Effects {
				item := map[string]any{"tool": eff.Tool, "id": eff.ID}
				var parsed map[string]any
				if json.Unmarshal([]byte(eff.Result), &parsed) == nil {
					item["data"] = parsed
				}
				effectsSummary = append(effectsSummary, item)
			}
			var existing map[string]any
			var existingJSON sql.NullString
			_ = w.db.QueryRowContext(ctx,
				`SELECT response FROM life_actionables WHERE id = $1`, actionableID,
			).Scan(&existingJSON)
			if existingJSON.Valid {
				_ = json.Unmarshal([]byte(existingJSON.String), &existing)
			}
			if existing == nil {
				existing = map[string]any{}
			}
			existing["follow_up_effects"] = effectsSummary
			updatedJSON, _ := json.Marshal(existing)
			_, _ = w.db.ExecContext(ctx,
				`UPDATE life_actionables SET response = $1 WHERE id = $2`,
				string(updatedJSON), actionableID,
			)
		}

		return tracked.FromToolResult(chatResult, ""), nil
	})
	return err
}
