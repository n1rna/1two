package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/life"
)

// summaryScanWorker runs periodically. It asks life.CheckStaleSummaries
// which user/date pairs need regeneration and enqueues one
// SummaryGenerateArgs per hit.
type summaryScanWorker struct {
	river.WorkerDefaults[jobs.SummaryScanArgs]
	db           *sql.DB
	insertClient *jobs.Client
}

func (w *summaryScanWorker) Work(ctx context.Context, _ *river.Job[jobs.SummaryScanArgs]) error {
	stale, err := life.CheckStaleSummaries(ctx, w.db)
	if err != nil {
		return err
	}
	for _, s := range stale {
		if _, err := w.insertClient.Insert(ctx, jobs.SummaryGenerateArgs{
			UserID: s.UserID,
			Date:   s.Date,
		}, &river.InsertOpts{
			Queue:       jobs.QueueAgent,
			MaxAttempts: 3,
			UniqueOpts: river.UniqueOpts{
				ByArgs:   true,
				ByPeriod: 30 * 60 * 1e9,
			},
		}); err != nil {
			log.Printf("summary_scan: insert %s/%s: %v", s.UserID, s.Date, err)
		}
	}
	return nil
}

// summaryGenerateWorker generates a single day summary.
type summaryGenerateWorker struct {
	river.WorkerDefaults[jobs.SummaryGenerateArgs]
	db    *sql.DB
	agent life.ChatAgent
}

func (w *summaryGenerateWorker) Work(ctx context.Context, job *river.Job[jobs.SummaryGenerateArgs]) error {
	return life.GenerateAndCacheDaySummary(ctx, w.db, w.agent, job.Args.UserID, job.Args.Date)
}
