package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/life"
)

// schedulerScanWorker runs periodically. It asks life.CheckDueCycles which
// users/cycles are due right now and enqueues one DailyCycleArgs per hit.
// Per-user cycle execution happens in dailyCycleWorker.
type schedulerScanWorker struct {
	river.WorkerDefaults[jobs.SchedulerScanArgs]
	db           *sql.DB
	insertClient *jobs.Client
}

func (w *schedulerScanWorker) Work(ctx context.Context, _ *river.Job[jobs.SchedulerScanArgs]) error {
	due, err := life.CheckDueCycles(ctx, w.db)
	if err != nil {
		return err
	}
	if len(due) == 0 {
		return nil
	}
	for _, d := range due {
		if _, err := w.insertClient.Insert(ctx, jobs.DailyCycleArgs{
			UserID: d.UserID,
			Cycle:  string(d.Cycle),
		}, &river.InsertOpts{
			Queue:       jobs.QueueAgent,
			MaxAttempts: 3,
			// De-dup: one cycle per user per day. River's unique flag keys
			// off the args hash + a time window so a second scan within the
			// same run period is a no-op.
			UniqueOpts: river.UniqueOpts{
				ByArgs:   true,
				ByPeriod: 30 * 60 * 1e9, // 30 minutes
			},
		}); err != nil {
			log.Printf("scheduler: insert %s/%s: %v", d.UserID, d.Cycle, err)
		}
	}
	return nil
}

// dailyCycleWorker runs one planning cycle for one user.
type dailyCycleWorker struct {
	river.WorkerDefaults[jobs.DailyCycleArgs]
	db    *sql.DB
	agent life.ChatAgent
}

func (w *dailyCycleWorker) Work(ctx context.Context, job *river.Job[jobs.DailyCycleArgs]) error {
	return life.RunUserCycle(ctx, w.db, w.agent, job.Args.UserID, life.PlanCycle(job.Args.Cycle))
}
