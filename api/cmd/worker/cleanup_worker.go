package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/storage"
)

// cleanupWorker runs nightly (River PeriodicJob). Deletes expired files from
// R2 and the database, and trims life_agent_runs retention. Mirrors the
// legacy handleCleanup HTTP handler from the api-container CF cron path.
type cleanupWorker struct {
	river.WorkerDefaults[jobs.CleanupArgs]
	db *sql.DB
	r2 *storage.R2Client
}

func (w *cleanupWorker) Work(ctx context.Context, _ *river.Job[jobs.CleanupArgs]) error {
	if w.db == nil || w.r2 == nil {
		log.Printf("cleanup: skipped — missing db or r2")
		return nil
	}

	// Expired file sweep.
	rows, err := w.db.QueryContext(ctx, `
		SELECT id, r2_key FROM files
		WHERE NOT permanent
		  AND last_accessed_at < NOW() - INTERVAL '90 days'
		LIMIT 500`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var deleted int
	for rows.Next() {
		var id, r2Key string
		if err := rows.Scan(&id, &r2Key); err != nil {
			continue
		}
		if err := w.r2.Delete(ctx, r2Key); err != nil {
			log.Printf("cleanup: r2 delete %s: %v", r2Key, err)
			continue
		}
		if _, err := w.db.ExecContext(ctx, `DELETE FROM files WHERE id = $1`, id); err != nil {
			log.Printf("cleanup: db delete %s: %v", id, err)
			continue
		}
		deleted++
	}

	// life_agent_runs retention: drop rows older than 30 days except the
	// most recent 100 per user.
	agentRunsDeleted := 0
	res, err := w.db.ExecContext(ctx, `
		WITH ranked AS (
		    SELECT id, user_id, started_at,
		           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY started_at DESC) AS rn
		    FROM life_agent_runs
		)
		DELETE FROM life_agent_runs
		 WHERE id IN (
		     SELECT id FROM ranked
		     WHERE started_at < NOW() - INTERVAL '30 days'
		       AND rn > 100
		 )`)
	if err != nil {
		log.Printf("cleanup: agent runs retention: %v", err)
	} else if n, _ := res.RowsAffected(); n > 0 {
		agentRunsDeleted = int(n)
	}

	log.Printf("cleanup: deleted %d files, pruned %d agent runs", deleted, agentRunsDeleted)
	return nil
}
