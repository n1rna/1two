// Package main is the always-on worker process. It drains River queues and
// runs River PeriodicJobs. Deployed as a separate CF Container with
// sleepAfter=never so it's always draining. Enqueuing happens from the HTTP
// API process in cmd/server via a river.Client built with NewInsertOnly.
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

	"github.com/n1rna/1tt/api/internal/config"
	"github.com/n1rna/1tt/api/internal/jobs"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := jobs.OpenPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: open pool: %v", err)
	}
	defer pool.Close()

	if err := jobs.MigrateUp(ctx, pool); err != nil {
		log.Fatalf("worker: river migrate: %v", err)
	}

	workers := river.NewWorkers()
	// TODO: register workers for llms, journey, actionable_followup,
	// daily_cycle, scheduler_scan as their migrations land.

	client, err := jobs.NewWorker(pool, jobs.WorkerConfig{
		Workers:      workers,
		PeriodicJobs: nil, // TODO: scheduler_scan every 5m once scheduler migrates
	})
	if err != nil {
		log.Fatalf("worker: build river client: %v", err)
	}

	if err := client.Start(ctx); err != nil {
		log.Fatalf("worker: start river client: %v", err)
	}
	log.Printf("worker: river client started")

	// Minimal HTTP for container healthchecks + future riverui mount.
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
