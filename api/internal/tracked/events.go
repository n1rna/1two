// events.go defines a tiny in-process pub/sub bus for life_agent_runs state
// changes. The SSE handler (handler.StreamLifeAgentRuns) subscribes for a
// given user and forwards every run snapshot over the wire so the Kim
// drawer's Activity section can render updates without polling.
//
// The bus is intentionally trivial: a per-user slice of buffered channels
// protected by a mutex. Publish is non-blocking — if a subscriber is slow
// the event is dropped rather than stalling tracked.Run. Subscribers that
// miss events can re-hydrate with a plain list call; SSE is a nicety, not a
// durable queue.
package tracked

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/lib/pq"
)

// RunSnapshot mirrors the JSON shape exposed by handler.ListAgentRuns so a
// client can upsert these events into the same LifeAgentRun map it seeded
// from the REST endpoint.
type RunSnapshot struct {
	ID                    string          `json:"id"`
	UserID                string          `json:"userId"`
	Kind                  string          `json:"kind"`
	Status                string          `json:"status"`
	Title                 string          `json:"title"`
	Subtitle              string          `json:"subtitle"`
	Trigger               string          `json:"trigger"`
	EntityID              *string         `json:"entityId"`
	EntityTitle           *string         `json:"entityTitle"`
	StartedAt             string          `json:"startedAt"`
	CompletedAt           *string         `json:"completedAt"`
	DurationMs            *int            `json:"durationMs"`
	ToolCalls             json.RawMessage `json:"toolCalls"`
	ResultSummary         string          `json:"resultSummary"`
	ProducedActionableIDs []string        `json:"producedActionableIds"`
	Error                 string          `json:"error"`
}

// RunEvent is what subscribers receive.
type RunEvent struct {
	UserID string
	Run    RunSnapshot
}

// Bus is a per-user fan-out of RunEvents. The zero value is not usable;
// callers must use NewBus.
type Bus struct {
	mu   sync.RWMutex
	subs map[string][]chan RunEvent
}

// NewBus returns an empty bus.
func NewBus() *Bus {
	return &Bus{subs: make(map[string][]chan RunEvent)}
}

// Subscribe returns a receive-only channel that delivers events for the
// given userID, and a cancel function the caller must invoke to
// unsubscribe. The channel is buffered; if it fills up events are dropped
// (Publish does not block).
func (b *Bus) Subscribe(userID string) (<-chan RunEvent, func()) {
	if b == nil {
		ch := make(chan RunEvent)
		close(ch)
		return ch, func() {}
	}
	ch := make(chan RunEvent, 16)

	b.mu.Lock()
	b.subs[userID] = append(b.subs[userID], ch)
	b.mu.Unlock()

	cancel := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		list := b.subs[userID]
		for i, c := range list {
			if c == ch {
				b.subs[userID] = append(list[:i], list[i+1:]...)
				close(ch)
				break
			}
		}
		if len(b.subs[userID]) == 0 {
			delete(b.subs, userID)
		}
	}
	return ch, cancel
}

// Publish fans an event out to every subscriber for ev.UserID. Slow
// subscribers drop events rather than block the publisher.
func (b *Bus) Publish(ev RunEvent) {
	if b == nil || ev.UserID == "" {
		return
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subs[ev.UserID] {
		select {
		case ch <- ev:
		default:
			// buffer full — drop
		}
	}
}

// defaultBus is the package-level bus used by tracked.Run automatically.
// main.go passes this same bus to the SSE handler via DefaultBus().
var defaultBus = NewBus()

// DefaultBus exposes the package singleton so handlers can subscribe to the
// same bus tracked.Run publishes to.
func DefaultBus() *Bus { return defaultBus }

// publishSnapshot loads the current state of runID and publishes it on the
// default bus. Errors are logged and swallowed — the persisted row is the
// source of truth; losing a notification just means the drawer won't tick
// until the next event or reconnect.
func publishSnapshot(db *sql.DB, runID, userID string) {
	if db == nil || runID == "" || userID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var (
		snap                           RunSnapshot
		entityID, entityTitle, errCol  sql.NullString
		startedAt                      time.Time
		completedAt                    sql.NullTime
		duration                       sql.NullInt32
		toolCalls                      []byte
		ids                            pq.StringArray
	)
	err := db.QueryRowContext(ctx, `
		SELECT id, user_id, kind, status, title, subtitle, trigger,
		       entity_id, entity_title, started_at, completed_at, duration_ms,
		       tool_calls, result_summary, produced_actionable_ids, error
		FROM life_agent_runs
		WHERE id = $1`, runID).Scan(
		&snap.ID, &snap.UserID, &snap.Kind, &snap.Status, &snap.Title, &snap.Subtitle, &snap.Trigger,
		&entityID, &entityTitle, &startedAt, &completedAt, &duration,
		&toolCalls, &snap.ResultSummary, &ids, &errCol,
	)
	if err != nil {
		log.Printf("tracked.publishSnapshot: load %s: %v", runID, err)
		return
	}
	if entityID.Valid {
		s := entityID.String
		snap.EntityID = &s
	}
	if entityTitle.Valid {
		s := entityTitle.String
		snap.EntityTitle = &s
	}
	snap.StartedAt = startedAt.UTC().Format(time.RFC3339)
	if completedAt.Valid {
		s := completedAt.Time.UTC().Format(time.RFC3339)
		snap.CompletedAt = &s
	}
	if duration.Valid {
		d := int(duration.Int32)
		snap.DurationMs = &d
	}
	if len(toolCalls) > 0 {
		snap.ToolCalls = json.RawMessage(toolCalls)
	} else {
		snap.ToolCalls = json.RawMessage("[]")
	}
	snap.ProducedActionableIDs = []string(ids)
	if snap.ProducedActionableIDs == nil {
		snap.ProducedActionableIDs = []string{}
	}
	if errCol.Valid {
		snap.Error = errCol.String
	}

	defaultBus.Publish(RunEvent{UserID: userID, Run: snap})
}
