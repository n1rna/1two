package main

import (
	"context"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/llms"
)

// llmsWorker runs the llms.txt generation pipeline for a single job row.
// The DB row is the source of truth for status; this worker just drives the
// state machine and River handles retries/attempts.
type llmsWorker struct {
	river.WorkerDefaults[jobs.LlmsProcessArgs]
	svc *llms.Service
}

func (w *llmsWorker) Work(ctx context.Context, job *river.Job[jobs.LlmsProcessArgs]) error {
	return w.svc.RunJob(ctx, job.Args.JobID)
}
