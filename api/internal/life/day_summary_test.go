package life

import (
	"testing"
	"time"
)

func TestLocalDateRange_AlwaysIncludesToday_LosAngeles(t *testing.T) {
	la, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}

	// 09:00 UTC on April 12 = 02:00 PDT (April 12 in LA, but server-UTC is also April 12).
	now := time.Date(2026, 4, 12, 9, 0, 0, 0, time.UTC)
	got := localDateRange(now, la, 7)

	if len(got) != 7 {
		t.Fatalf("expected 7 dates, got %d: %v", len(got), got)
	}
	if got[0] != "2026-04-12" {
		t.Errorf("expected first date to be 2026-04-12 (today in LA), got %q", got[0])
	}
	if got[6] != "2026-04-18" {
		t.Errorf("expected last date to be 2026-04-18, got %q", got[6])
	}
}

func TestLocalDateRange_LateUTC_StillReturnsLocalToday(t *testing.T) {
	// Critical regression test: this is the bug that was breaking prod.
	// At 07:00 UTC on April 13, an LA user is at 00:00 PDT on April 13 — JUST
	// rolled over. But at 06:00 UTC the LA user is still on April 12.
	la, err := time.LoadLocation("America/Los_Angeles")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}

	// 06:00 UTC April 13 = 23:00 PDT April 12 (LA is still on the 12th).
	now := time.Date(2026, 4, 13, 6, 0, 0, 0, time.UTC)
	got := localDateRange(now, la, 7)

	if got[0] != "2026-04-12" {
		t.Errorf("LA user at 23:00 local should see today=2026-04-12, got %q (whole list: %v)", got[0], got)
	}
}

func TestLocalDateRange_Tokyo(t *testing.T) {
	// Tokyo is UTC+9. At 18:00 UTC on April 12, Tokyo is already 03:00 on April 13.
	tokyo, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}

	now := time.Date(2026, 4, 12, 18, 0, 0, 0, time.UTC)
	got := localDateRange(now, tokyo, 7)

	if got[0] != "2026-04-13" {
		t.Errorf("Tokyo user at 03:00 local should see today=2026-04-13, got %q", got[0])
	}
}

func TestLocalDateRange_UTCFallback(t *testing.T) {
	now := time.Date(2026, 4, 12, 9, 0, 0, 0, time.UTC)
	got := localDateRange(now, time.UTC, 3)
	want := []string{"2026-04-12", "2026-04-13", "2026-04-14"}
	if len(got) != len(want) {
		t.Fatalf("expected %d dates, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("date[%d]: expected %q, got %q", i, want[i], got[i])
		}
	}
}

func TestLocalDayBounds_LosAngeles(t *testing.T) {
	la, _ := time.LoadLocation("America/Los_Angeles")
	start, end, err := localDayBounds("2026-04-12", la)
	if err != nil {
		t.Fatalf("localDayBounds: %v", err)
	}
	// April 12 in PDT (UTC-7) = April 12 07:00 UTC → April 13 07:00 UTC.
	wantStart := time.Date(2026, 4, 12, 7, 0, 0, 0, time.UTC)
	wantEnd := time.Date(2026, 4, 13, 7, 0, 0, 0, time.UTC)
	if !start.Equal(wantStart) {
		t.Errorf("start: want %v, got %v", wantStart, start)
	}
	if !end.Equal(wantEnd) {
		t.Errorf("end: want %v, got %v", wantEnd, end)
	}
}

func TestLocalDayBounds_DSTSpringForward(t *testing.T) {
	// Spring DST in LA: 2026-03-08 02:00 PST → 03:00 PDT. The day is 23 hours
	// long. Make sure localDayBounds still returns a sane half-open window.
	la, _ := time.LoadLocation("America/Los_Angeles")
	start, end, err := localDayBounds("2026-03-08", la)
	if err != nil {
		t.Fatalf("localDayBounds: %v", err)
	}
	// 23-hour day; end - start should equal 23 hours.
	gotDur := end.Sub(start)
	wantDur := 23 * time.Hour
	if gotDur != wantDur {
		t.Errorf("DST spring-forward day length: want %v, got %v", wantDur, gotDur)
	}
}

func TestLocalDayBounds_DSTFallBack(t *testing.T) {
	la, _ := time.LoadLocation("America/Los_Angeles")
	start, end, err := localDayBounds("2026-11-01", la)
	if err != nil {
		t.Fatalf("localDayBounds: %v", err)
	}
	// 25-hour fall-back day.
	gotDur := end.Sub(start)
	wantDur := 25 * time.Hour
	if gotDur != wantDur {
		t.Errorf("DST fall-back day length: want %v, got %v", wantDur, gotDur)
	}
}
