package handler

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/n1rna/1tt/api/internal/life"
	"github.com/n1rna/1tt/api/internal/middleware"
)

// loadCalendarEventsForChat returns upcoming calendar events for the chat
// system prompt using the local cache. Errors are logged but not returned —
// calendar context is optional.
func loadCalendarEventsForChat(ctx context.Context, db *sql.DB, gcalClient *life.GCalClient, userID string) []life.GCalEvent {
	if gcalClient == nil || db == nil {
		return nil
	}

	// Trigger a sync if the cache is stale (5-minute threshold for chat context).
	needs, err := life.NeedsSync(ctx, db, userID, 5*time.Minute)
	if err != nil {
		log.Printf("life: NeedsSync for %s: %v", userID, err)
	}
	if needs {
		accessToken, err := life.EnsureValidToken(ctx, db, gcalClient, userID)
		if err == nil {
			if _, err := gcalClient.SyncEvents(ctx, db, userID, accessToken); err != nil {
				log.Printf("life: background sync for %s: %v", userID, err)
			}
		}
	}

	now := time.Now()
	events, err := life.QueryLocalEvents(ctx, db, userID, now, now.AddDate(0, 0, 7))
	if err != nil {
		log.Printf("life: load calendar events for %s: %v", userID, err)
		return nil
	}
	return events
}

// generateState produces a random 16-byte hex state string for OAuth CSRF protection.
func generateState() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// GetGCalAuthURL handles GET /life/gcal/auth-url.
// Returns the Google OAuth2 authorization URL.
func GetGCalAuthURL(gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if gcalClient == nil {
			http.Error(w, `{"error":"Google Calendar is not configured on this server"}`, http.StatusServiceUnavailable)
			return
		}

		state := generateState()
		authURL := gcalClient.GetAuthURL(state)
		json.NewEncoder(w).Encode(map[string]any{
			"url":   authURL,
			"state": state,
		})
	}
}

// GCalCallback handles POST /life/gcal/callback.
// Body: {"code": "<authorization_code>"}
// Exchanges the code for tokens, stores them, and kicks off an initial sync in
// the background so the cache is populated before the first request.
func GCalCallback(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if gcalClient == nil {
			http.Error(w, `{"error":"Google Calendar is not configured on this server"}`, http.StatusServiceUnavailable)
			return
		}

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if req.Code == "" {
			http.Error(w, `{"error":"code is required"}`, http.StatusBadRequest)
			return
		}

		tokens, err := gcalClient.ExchangeCode(r.Context(), req.Code)
		if err != nil {
			log.Printf("gcal callback: exchange code for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to exchange authorization code"}`, http.StatusBadRequest)
			return
		}

		const q = `
			INSERT INTO life_gcal_connections
				(user_id, google_email, access_token, refresh_token, token_expiry)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id) DO UPDATE SET
				google_email  = EXCLUDED.google_email,
				access_token  = EXCLUDED.access_token,
				refresh_token = EXCLUDED.refresh_token,
				token_expiry  = EXCLUDED.token_expiry,
				updated_at    = NOW()`

		if _, err := db.ExecContext(r.Context(), q,
			userID, tokens.Email, tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresAt,
		); err != nil {
			log.Printf("gcal callback: store tokens for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to save calendar connection"}`, http.StatusInternalServerError)
			return
		}

		// Kick off initial sync in the background so the cache is ready.
		go func() {
			ctx := context.Background()
			if _, err := gcalClient.SyncEvents(ctx, db, userID, tokens.AccessToken); err != nil {
				log.Printf("gcal callback: initial sync for user %s: %v", userID, err)
			}
		}()

		json.NewEncoder(w).Encode(map[string]any{
			"connected": true,
			"email":     tokens.Email,
		})
	}
}

// gcalStatusRecord is the JSON representation of the GCal connection status.
type gcalStatusRecord struct {
	Connected   bool    `json:"connected"`
	Email       *string `json:"email,omitempty"`
	TokenExpiry *string `json:"tokenExpiry,omitempty"`
}

// GetGCalStatus handles GET /life/gcal/status.
// Returns the connection status for the authenticated user.
func GetGCalStatus(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var email string
		var tokenExpiry time.Time
		err := db.QueryRowContext(r.Context(),
			`SELECT google_email, token_expiry FROM life_gcal_connections WHERE user_id = $1`,
			userID,
		).Scan(&email, &tokenExpiry)

		if err == sql.ErrNoRows {
			json.NewEncoder(w).Encode(gcalStatusRecord{Connected: false})
			return
		}
		if err != nil {
			log.Printf("gcal status: query for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to query calendar status"}`, http.StatusInternalServerError)
			return
		}

		expStr := tokenExpiry.UTC().Format(time.RFC3339)
		json.NewEncoder(w).Encode(gcalStatusRecord{
			Connected:   true,
			Email:       &email,
			TokenExpiry: &expStr,
		})
	}
}

// DisconnectGCal handles DELETE /life/gcal.
// Removes the Google Calendar connection and all cached event data for the user.
func DisconnectGCal(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Remove cached events and day metadata before removing the connection.
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_gcal_events WHERE user_id = $1`, userID,
		); err != nil {
			log.Printf("gcal disconnect: delete events for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to clear cached events"}`, http.StatusInternalServerError)
			return
		}
		if _, err := db.ExecContext(r.Context(),
			`DELETE FROM life_day_metadata WHERE user_id = $1`, userID,
		); err != nil {
			log.Printf("gcal disconnect: delete day metadata for user %s: %v", userID, err)
			// Non-fatal — proceed with disconnection.
		}

		res, err := db.ExecContext(r.Context(),
			`DELETE FROM life_gcal_connections WHERE user_id = $1`, userID,
		)
		if err != nil {
			log.Printf("gcal disconnect: delete connection for user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to disconnect calendar"}`, http.StatusInternalServerError)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			http.Error(w, `{"error":"no calendar connection found"}`, http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"disconnected": true})
	}
}

// ListGCalEvents handles GET /life/gcal/events?days=7.
// Reads events from the local cache, triggering a sync first if the cache is
// stale (older than 5 minutes).
func ListGCalEvents(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if gcalClient == nil {
			json.NewEncoder(w).Encode(map[string]any{"events": []any{}})
			return
		}

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Parse date range: ?from=2026-03-22&to=2026-03-29 or ?days=7 (from today)
		var from, to time.Time
		if fromStr := r.URL.Query().Get("from"); fromStr != "" {
			if t, err := time.Parse("2006-01-02", fromStr); err == nil {
				from = t
			}
		}
		if toStr := r.URL.Query().Get("to"); toStr != "" {
			if t, err := time.Parse("2006-01-02", toStr); err == nil {
				to = t.AddDate(0, 0, 1) // include the full "to" day
			}
		}
		if from.IsZero() {
			from = time.Now().Truncate(24 * time.Hour) // start of today
		}
		if to.IsZero() {
			daysAhead := 7
			if d := r.URL.Query().Get("days"); d != "" {
				if n, err := strconv.Atoi(d); err == nil && n > 0 {
					daysAhead = n
				}
			}
			to = from.AddDate(0, 0, daysAhead)
		}

		// Sync if stale (5-minute threshold for the interactive UI).
		needs, err := life.NeedsSync(r.Context(), db, userID, 5*time.Minute)
		if err != nil {
			log.Printf("gcal list events: NeedsSync for %s: %v", userID, err)
		}
		if needs {
			accessToken, err := life.EnsureValidToken(r.Context(), db, gcalClient, userID)
			if err != nil {
				http.Error(w, `{"error":"calendar not connected"}`, http.StatusBadRequest)
				return
			}
			if _, err := gcalClient.SyncEvents(r.Context(), db, userID, accessToken); err != nil {
				log.Printf("gcal list events: sync for %s: %v", userID, err)
			}
		}

		events, err := life.QueryLocalEvents(r.Context(), db, userID, from, to)
		if err != nil {
			log.Printf("gcal list events: query local for %s: %v", userID, err)
			http.Error(w, `{"error":"failed to fetch calendar events"}`, http.StatusInternalServerError)
			return
		}

		if events == nil {
			events = []life.GCalEvent{}
		}
		json.NewEncoder(w).Encode(map[string]any{"events": events})
	}
}

// GetDaySummaries handles GET /life/calendar/summaries?from=2026-03-25&to=2026-03-31.
// Returns AI-generated semantic day summaries for the requested date range.
// Results are cached by events hash; regenerated only when the day's events change.
func GetDaySummaries(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		fromStr := r.URL.Query().Get("from")
		toStr := r.URL.Query().Get("to")

		var from, to time.Time
		if fromStr != "" {
			if t, err := time.Parse("2006-01-02", fromStr); err == nil {
				from = t
			}
		}
		if toStr != "" {
			if t, err := time.Parse("2006-01-02", toStr); err == nil {
				to = t.AddDate(0, 0, 1)
			}
		}
		if from.IsZero() {
			from = time.Now().Truncate(24 * time.Hour)
		}
		if to.IsZero() {
			to = from.AddDate(0, 0, 7)
		}
		if to.Sub(from) > 14*24*time.Hour {
			to = from.AddDate(0, 0, 14)
		}

		summaries, err := life.GetCachedDaySummaries(r.Context(), db, userID, from, to)
		if err != nil {
			log.Printf("day summaries: user %s: %v", userID, err)
			http.Error(w, `{"error":"failed to load day summaries"}`, http.StatusInternalServerError)
			return
		}

		if summaries == nil {
			summaries = []life.DaySummary{}
		}
		json.NewEncoder(w).Encode(map[string]any{"summaries": summaries})
	}
}

// SyncGCalEvents handles POST /life/gcal/sync.
// Forces a sync regardless of cache staleness and returns the sync result.
func SyncGCalEvents(db *sql.DB, gcalClient *life.GCalClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if gcalClient == nil {
			http.Error(w, `{"error":"Google Calendar is not configured on this server"}`, http.StatusServiceUnavailable)
			return
		}

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		accessToken, err := life.EnsureValidToken(r.Context(), db, gcalClient, userID)
		if err != nil {
			http.Error(w, `{"error":"calendar not connected"}`, http.StatusBadRequest)
			return
		}

		result, err := gcalClient.SyncEvents(r.Context(), db, userID, accessToken)
		if err != nil {
			log.Printf("gcal sync: force sync for %s: %v", userID, err)
			http.Error(w, `{"error":"sync failed"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(result)
	}
}
