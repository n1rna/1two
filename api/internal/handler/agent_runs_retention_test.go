//go:build integration

package handler

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// Seeds a mix of recent + old agent runs and asserts that
// archiveOldAgentRuns removes only rows older than 30 days beyond the
// per-user top-100 cutoff. Gated behind RUN_LIFE_INTEGRATION=1 +
// TEST_DATABASE_URL to match the rest of the suite.
func TestArchiveOldAgentRuns_DeletesOnlyExpired(t *testing.T) {
	if os.Getenv("RUN_LIFE_INTEGRATION") != "1" {
		t.Skip("set RUN_LIFE_INTEGRATION=1 to run")
	}
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	uid := "retention_test_" + time.Now().Format("150405.000")
	t.Cleanup(func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM life_agent_runs WHERE user_id = $1`, uid)
	})

	insert := func(id string, startedAt time.Time) {
		_, err := db.ExecContext(ctx, `
			INSERT INTO life_agent_runs (id, user_id, kind, status, started_at)
			VALUES ($1, $2, 'test', 'completed', $3)`,
			id, uid, startedAt,
		)
		if err != nil {
			t.Fatalf("insert %s: %v", id, err)
		}
	}

	// 1 recent, 1 ancient — ancient should be deleted (single user far below
	// the 100 cutoff so row_number() > 100 only for the ancient if we seed
	// ≥ 101 rows; we only seed 2 so neither is > 100, ancient will survive
	// with the keep-100 rule). Instead seed 101 new + 1 ancient so ancient
	// is row 102 and gets pruned.
	now := time.Now().UTC()
	for i := 0; i < 101; i++ {
		insert("recent_"+time.Now().Format("150405.000000000")+"_"+itoa(i), now.Add(-time.Duration(i)*time.Minute))
	}
	insert("ancient_"+time.Now().Format("150405.000000000"), now.AddDate(0, 0, -45))

	n, err := archiveOldAgentRuns(ctx, db)
	if err != nil {
		t.Fatalf("archive: %v", err)
	}
	if n != 1 {
		t.Errorf("want 1 pruned, got %d", n)
	}
	var count int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM life_agent_runs WHERE user_id = $1`, uid,
	).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 101 {
		t.Errorf("want 101 rows remaining, got %d", count)
	}
}

func itoa(i int) string {
	b := make([]byte, 0, 4)
	if i == 0 {
		return "0"
	}
	for i > 0 {
		b = append([]byte{byte('0' + i%10)}, b...)
		i /= 10
	}
	return string(b)
}
