// Package main is the always-on worker process. It drains River queues and
// runs River PeriodicJobs. Deployed as a separate CF Container; a minute
// cron pings /healthz to keep it warm. Enqueuing happens from the HTTP API
// process in cmd/server via a river.Client built with NewInsertOnly.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/riverqueue/river"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/crawl"
	"github.com/n1rna/1tt/api/internal/database"
	"github.com/n1rna/1tt/api/internal/jobs"
	"github.com/n1rna/1tt/api/internal/kim"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/llms"
	"github.com/n1rna/1tt/api/internal/storage"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db, err := database.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: open db: %v", err)
	}
	defer db.Close()

	pool, err := jobs.OpenPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: open pool: %v", err)
	}
	defer pool.Close()

	if err := jobs.MigrateUp(ctx, pool); err != nil {
		log.Fatalf("worker: river migrate: %v", err)
	}

	// Worker dependencies.
	var r2 *storage.R2Client
	if cfg.R2AccountID != "" {
		r2, err = storage.NewR2Client(cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2BucketName)
		if err != nil {
			log.Printf("WARNING: R2 init failed: %v (llms uploads will fail)", err)
		}
	}

	var crawlClient *crawl.Client
	if cfg.CfAccountID != "" {
		crawlClient = crawl.NewClient(cfg.CfAccountID, cfg.CfAPIToken)
	}

	var gcalClient *life.GCalClient
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		gcalClient = life.NewGCalClient(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	}

	lifeAgent := kim.NewAgent(ai.LLMConfig{
		Provider:     cfg.LLMProvider,
		APIKey:       cfg.LLMAPIKey,
		BaseURL:      cfg.LLMBaseURL,
		Model:        cfg.LLMModel,
		SummaryModel: cfg.LLMSummaryModel,
	}, db, gcalClient)

	insertClient, err := jobs.NewInsertOnly(pool)
	if err != nil {
		log.Fatalf("worker: build insert client: %v", err)
	}

	llmsSvc := llms.NewService(db, r2, crawlClient, ai.LLMConfig{
		Provider: cfg.LLMProvider,
		APIKey:   cfg.LLMAPIKey,
		BaseURL:  cfg.LLMBaseURL,
		Model:    cfg.LLMModel,
	}, insertClient)

	workers := river.NewWorkers()
	if err := river.AddWorkerSafely(workers, &llmsWorker{svc: llmsSvc}); err != nil {
		log.Fatalf("worker: register llms: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &journeyEventWorker{db: db, agent: lifeAgent}); err != nil {
		log.Fatalf("worker: register journey: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &actionableFollowupWorker{db: db, agent: lifeAgent}); err != nil {
		log.Fatalf("worker: register actionable: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &schedulerScanWorker{db: db, insertClient: insertClient}); err != nil {
		log.Fatalf("worker: register scheduler scan: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &dailyCycleWorker{db: db, agent: lifeAgent}); err != nil {
		log.Fatalf("worker: register daily cycle: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &summaryScanWorker{db: db, insertClient: insertClient}); err != nil {
		log.Fatalf("worker: register summary scan: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &summaryGenerateWorker{db: db, agent: lifeAgent}); err != nil {
		log.Fatalf("worker: register summary generate: %v", err)
	}
	if err := river.AddWorkerSafely(workers, &cleanupWorker{db: db, r2: r2}); err != nil {
		log.Fatalf("worker: register cleanup: %v", err)
	}

	// PeriodicJobs replace the previous external CF cron + CF Queue dispatch.
	periodic := []*river.PeriodicJob{
		// Every 5 minutes: find users whose planning cycle is due.
		river.NewPeriodicJob(
			river.PeriodicInterval(5*time.Minute),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.SchedulerScanArgs{}, &river.InsertOpts{
					Queue:       jobs.QueueAgent,
					MaxAttempts: 2,
				}
			},
			&river.PeriodicJobOpts{RunOnStart: true},
		),
		// Every 15 minutes: regenerate stale day summaries.
		river.NewPeriodicJob(
			river.PeriodicInterval(15*time.Minute),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.SummaryScanArgs{}, &river.InsertOpts{
					Queue:       jobs.QueueAgent,
					MaxAttempts: 2,
				}
			},
			nil,
		),
		// Once a day: housekeeping sweep.
		river.NewPeriodicJob(
			river.PeriodicInterval(24*time.Hour),
			func() (river.JobArgs, *river.InsertOpts) {
				return jobs.CleanupArgs{}, &river.InsertOpts{
					Queue:       jobs.QueueIngest,
					MaxAttempts: 2,
				}
			},
			nil,
		),
	}

	client, err := jobs.NewWorker(pool, jobs.WorkerConfig{
		Workers:      workers,
		PeriodicJobs: periodic,
	})
	if err != nil {
		log.Fatalf("worker: build river client: %v", err)
	}

	if err := client.Start(ctx); err != nil {
		log.Fatalf("worker: start river client: %v", err)
	}
	log.Printf("worker: river client started")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "ok")
	})

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("worker: HTTP listening on :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("worker: http: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	log.Printf("worker: shutdown signal received")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.Printf("worker: http shutdown: %v", err)
	}
	if err := client.Stop(shutdownCtx); err != nil {
		log.Printf("worker: river stop: %v", err)
	}
	log.Printf("worker: bye")
}
