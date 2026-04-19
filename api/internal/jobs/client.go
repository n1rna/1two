// Package jobs wraps riverqueue for all background work. The HTTP API uses
// NewInsertOnly to enqueue; the cmd/worker binary builds a full client with
// workers + periodic jobs. River's own schema is migrated via MigrateUp.
package jobs

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

// Client is the concrete river client type used throughout the codebase.
type Client = river.Client[pgx.Tx]

// Queue names. Separate queues let us tune concurrency per workload.
const (
	QueueDefault = river.QueueDefault
	QueueAgent   = "agent"  // LLM-powered: journeys, actionable followups, scheduler cycles
	QueueIngest  = "ingest" // llms crawl + generate, og billing ingest
)

// OpenPool creates a pgxpool.Pool from the DATABASE_URL. River requires
// pgxpool rather than *sql.DB. The caller owns the pool.
func OpenPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if databaseURL == "" {
		return nil, fmt.Errorf("jobs: DATABASE_URL must not be empty")
	}
	sep := "?"
	if strings.Contains(databaseURL, "?") {
		sep = "&"
	}
	connStr := databaseURL + sep + "default_query_exec_mode=simple_protocol"
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("jobs: pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("jobs: pool.Ping: %w", err)
	}
	return pool, nil
}

// MigrateUp applies River's own schema migrations. Idempotent — River tracks
// its own version in river_migration table, independent of goose.
func MigrateUp(ctx context.Context, pool *pgxpool.Pool) error {
	migrator, err := rivermigrate.New(riverpgxv5.New(pool), nil)
	if err != nil {
		return fmt.Errorf("jobs: rivermigrate.New: %w", err)
	}
	if _, err := migrator.Migrate(ctx, rivermigrate.DirectionUp, nil); err != nil {
		return fmt.Errorf("jobs: river migrate up: %w", err)
	}
	return nil
}

// NewInsertOnly returns a river.Client with no workers configured. Used by
// the HTTP API process to enqueue jobs without draining queues.
func NewInsertOnly(pool *pgxpool.Pool) (*Client, error) {
	return river.NewClient(riverpgxv5.New(pool), &river.Config{})
}

// WorkerConfig bundles everything cmd/worker needs to build a full client.
type WorkerConfig struct {
	Workers      *river.Workers
	Queues       map[string]river.QueueConfig
	PeriodicJobs []*river.PeriodicJob
}

// NewWorker returns a river.Client configured to drain queues and run
// periodic jobs. Call Start on the returned client to begin processing.
func NewWorker(pool *pgxpool.Pool, cfg WorkerConfig) (*Client, error) {
	if cfg.Workers == nil {
		return nil, fmt.Errorf("jobs: NewWorker requires non-nil Workers")
	}
	queues := cfg.Queues
	if queues == nil {
		queues = map[string]river.QueueConfig{
			QueueDefault: {MaxWorkers: 10},
			QueueAgent:   {MaxWorkers: 3},
			QueueIngest:  {MaxWorkers: 3},
		}
	}
	return river.NewClient(riverpgxv5.New(pool), &river.Config{
		Workers:      cfg.Workers,
		Queues:       queues,
		PeriodicJobs: cfg.PeriodicJobs,
	})
}
