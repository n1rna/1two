package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"

	"github.com/n1rna/1tt/api/internal/middleware"
	"github.com/n1rna/1tt/api/internal/tracked"
)

// lifeAgentRunRecord mirrors the life_agent_runs row as JSON. Uses
// camelCased keys to match the rest of the life API surface.
type lifeAgentRunRecord struct {
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

// selectLifeAgentRuns is the canonical SELECT list for the list + detail
// endpoints. Keeping the column order fixed lets both handlers share
// scanAgentRun below.
const selectLifeAgentRuns = `
	SELECT id, user_id, kind, status, title, subtitle, trigger,
	       entity_id, entity_title, started_at, completed_at, duration_ms,
	       tool_calls, result_summary, produced_actionable_ids, error
	FROM life_agent_runs`

// scanAgentRun reads a single life_agent_runs row using the column order
// defined in selectLifeAgentRuns.
func scanAgentRun(rows interface {
	Scan(...any) error
}) (lifeAgentRunRecord, error) {
	var r lifeAgentRunRecord
	var entityID, entityTitle, errorCol sql.NullString
	var startedAt time.Time
	var completedAt sql.NullTime
	var duration sql.NullInt32
	var toolCalls []byte
	var ids pq.StringArray

	if err := rows.Scan(
		&r.ID, &r.UserID, &r.Kind, &r.Status, &r.Title, &r.Subtitle, &r.Trigger,
		&entityID, &entityTitle, &startedAt, &completedAt, &duration,
		&toolCalls, &r.ResultSummary, &ids, &errorCol,
	); err != nil {
		return r, err
	}

	if entityID.Valid {
		s := entityID.String
		r.EntityID = &s
	}
	if entityTitle.Valid {
		s := entityTitle.String
		r.EntityTitle = &s
	}
	r.StartedAt = startedAt.UTC().Format(time.RFC3339)
	if completedAt.Valid {
		s := completedAt.Time.UTC().Format(time.RFC3339)
		r.CompletedAt = &s
	}
	if duration.Valid {
		d := int(duration.Int32)
		r.DurationMs = &d
	}
	if len(toolCalls) > 0 {
		r.ToolCalls = json.RawMessage(toolCalls)
	} else {
		r.ToolCalls = json.RawMessage("[]")
	}
	r.ProducedActionableIDs = []string(ids)
	if r.ProducedActionableIDs == nil {
		r.ProducedActionableIDs = []string{}
	}
	if errorCol.Valid {
		r.Error = errorCol.String
	}
	return r, nil
}

// ListAgentRuns returns recent background agent runs for the authenticated
// user. Supports:
//
//	status=running|completed|failed|active|all  (default: active)
//	since=<RFC3339>                              (only started_at >= since)
//	limit=<int>                                  (default 50, max 200)
//
// The `active` filter returns any running run plus anything that completed
// or failed in the last 60 seconds — the set the drawer wants to surface
// "what's happening now". `hasActive` is a convenience flag for polling.
func ListAgentRuns(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		status := strings.ToLower(r.URL.Query().Get("status"))
		if status == "" {
			status = "active"
		}

		limit := 50
		if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
			limit = l
		}
		if limit > 200 {
			limit = 200
		}

		var since *time.Time
		if s := r.URL.Query().Get("since"); s != "" {
			if t, err := time.Parse(time.RFC3339, s); err == nil {
				since = &t
			}
		}

		where := []string{"user_id = $1"}
		args := []any{userID}
		idx := 2

		switch status {
		case "running", "completed", "failed":
			where = append(where, "status = $"+strconv.Itoa(idx))
			args = append(args, status)
			idx++
		case "active":
			where = append(where,
				"(status = 'running' OR (status IN ('completed','failed') AND completed_at > NOW() - INTERVAL '60 seconds'))",
			)
		case "all":
			// no extra filter
		default:
			http.Error(w, `{"error":"invalid status"}`, http.StatusBadRequest)
			return
		}

		if since != nil {
			where = append(where, "started_at >= $"+strconv.Itoa(idx))
			args = append(args, *since)
			idx++
		}

		args = append(args, limit)
		query := selectLifeAgentRuns +
			" WHERE " + strings.Join(where, " AND ") +
			" ORDER BY started_at DESC LIMIT $" + strconv.Itoa(idx)

		rows, err := db.QueryContext(r.Context(), query, args...)
		if err != nil {
			http.Error(w, `{"error":"failed to list agent runs"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		runs := make([]lifeAgentRunRecord, 0)
		for rows.Next() {
			rec, serr := scanAgentRun(rows)
			if serr != nil {
				http.Error(w, `{"error":"failed to read agent run"}`, http.StatusInternalServerError)
				return
			}
			runs = append(runs, rec)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate agent runs"}`, http.StatusInternalServerError)
			return
		}

		hasActive := false
		for _, rr := range runs {
			if rr.Status == "running" {
				hasActive = true
				break
			}
		}

		json.NewEncoder(w).Encode(map[string]any{
			"runs":      runs,
			"hasActive": hasActive,
		})
	}
}

// GetAgentRun returns a single run by id, scoped to the authenticated user.
func GetAgentRun(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")
		if id == "" {
			http.Error(w, `{"error":"missing id"}`, http.StatusBadRequest)
			return
		}

		row := db.QueryRowContext(r.Context(),
			selectLifeAgentRuns+" WHERE id = $1 AND user_id = $2",
			id, userID,
		)
		rec, err := scanAgentRun(row)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to read agent run"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"run": rec})
	}
}

// AgentRunsPulse is a cheap endpoint the drawer polls while closed — it only
// returns whether there is anything running and how many, so the UI can show
// a pulse dot without fetching the full list.
func AgentRunsPulse(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var count int
		if err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM life_agent_runs WHERE user_id = $1 AND status = 'running'`,
			userID,
		).Scan(&count); err != nil {
			http.Error(w, `{"error":"failed to read pulse"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{
			"running": count > 0,
			"count":   count,
		})
	}
}

// StreamLifeAgentRuns serves GET /life/agent-runs/stream as a Server-Sent
// Events feed. It emits a `run` event every time tracked.Run publishes a
// state change for the authenticated user (start, completion, failure) and
// a `ping` event every 20s so intermediaries don't idle-close the
// connection. Clients re-hydrate the initial state via ListAgentRuns and
// apply incoming events as upserts-by-id.
//
// Pattern borrowed from handler.LifeChatStream: set SSE headers, grab the
// http.Flusher, loop on select until the request context cancels.
func StreamLifeAgentRuns(db *sql.DB, bus *tracked.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		// Disable proxy buffering (nginx, Cloudflare) so events flush
		// immediately instead of getting batched.
		w.Header().Set("X-Accel-Buffering", "no")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
			return
		}

		ch, cancel := bus.Subscribe(userID)
		defer cancel()

		// Initial heartbeat tells the client the stream is live. Without
		// this, some proxies don't forward response headers until the first
		// body byte.
		fmt.Fprintf(w, "event: ready\ndata: {}\n\n")
		flusher.Flush()

		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				fmt.Fprintf(w, "event: ping\ndata: {}\n\n")
				flusher.Flush()
			case ev, ok := <-ch:
				if !ok {
					return
				}
				data, err := json.Marshal(ev.Run)
				if err != nil {
					continue
				}
				fmt.Fprintf(w, "event: run\ndata: %s\n\n", data)
				flusher.Flush()
			}
		}
	}
}
