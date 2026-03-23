package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ── Google Calendar API response types ──────────────────────────────────────

type gcalAPIResponse struct {
	Items         []gcalAPIItem `json:"items"`
	NextPageToken string        `json:"nextPageToken"`
	NextSyncToken string        `json:"nextSyncToken"`
}

type gcalAPIItem struct {
	ID               string   `json:"id"`
	Summary          string   `json:"summary"`
	Description      string   `json:"description"`
	Location         string   `json:"location"`
	Status           string   `json:"status"`
	ColorID          string   `json:"colorId"`
	HtmlLink         string   `json:"htmlLink"`
	RecurringEventId string   `json:"recurringEventId"`
	Recurrence       []string `json:"recurrence"` // e.g. ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
	Start            struct {
		DateTime string `json:"dateTime"`
		Date     string `json:"date"`
	} `json:"start"`
	End struct {
		DateTime string `json:"dateTime"`
		Date     string `json:"date"`
	} `json:"end"`
	ExtendedProperties struct {
		Private map[string]string `json:"private"`
	} `json:"extendedProperties"`
}

// ── Sync ────────────────────────────────────────────────────────────────────

type SyncResult struct {
	Upserted int  `json:"upserted"`
	Deleted  int  `json:"deleted"`
	FullSync bool `json:"fullSync"`
}

var errSyncTokenExpired = fmt.Errorf("sync token expired")

// SyncEvents performs an incremental or full sync for a user.
func (c *GCalClient) SyncEvents(ctx context.Context, db *sql.DB, userID, accessToken string) (*SyncResult, error) {
	var syncToken sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT sync_token FROM life_gcal_connections WHERE user_id = $1`, userID,
	).Scan(&syncToken)

	if syncToken.Valid && syncToken.String != "" {
		result, err := c.incrementalSync(ctx, db, userID, accessToken, syncToken.String)
		if err == errSyncTokenExpired {
			return c.fullSync(ctx, db, userID, accessToken)
		}
		return result, err
	}
	return c.fullSync(ctx, db, userID, accessToken)
}

// fullSync fetches all events (master + exceptions) with singleEvents=false.
func (c *GCalClient) fullSync(ctx context.Context, db *sql.DB, userID, accessToken string) (*SyncResult, error) {
	now := time.Now().UTC()
	params := url.Values{}
	params.Set("singleEvents", "false") // get master events with recurrence rules
	params.Set("timeMin", now.AddDate(0, 0, -30).Format(time.RFC3339))
	params.Set("timeMax", now.AddDate(0, 0, 90).Format(time.RFC3339))
	params.Set("maxResults", "2500")

	apiResp, err := c.fetchEvents(ctx, accessToken, params)
	if err != nil {
		return nil, fmt.Errorf("full sync: %w", err)
	}

	// Delete all existing cached events for this user (fresh start)
	if _, err := db.ExecContext(ctx,
		`DELETE FROM life_gcal_events WHERE user_id = $1`, userID,
	); err != nil {
		return nil, fmt.Errorf("full sync: clear cache: %w", err)
	}

	upserted, err := upsertEvents(ctx, db, userID, apiResp.Items)
	if err != nil {
		return nil, fmt.Errorf("full sync: upsert: %w", err)
	}

	// Store sync state
	windowMin := now.AddDate(0, 0, -30).Format("2006-01-02")
	windowMax := now.AddDate(0, 0, 90).Format("2006-01-02")
	if _, err := db.ExecContext(ctx, `
		UPDATE life_gcal_connections
		SET sync_token = $2, last_full_sync = NOW(), last_sync = NOW(),
		    sync_window_min = $3, sync_window_max = $4
		WHERE user_id = $1`,
		userID, apiResp.NextSyncToken, windowMin, windowMax,
	); err != nil {
		return nil, fmt.Errorf("full sync: update sync state: %w", err)
	}

	return &SyncResult{Upserted: upserted, FullSync: true}, nil
}

// incrementalSync uses the stored sync token to fetch only changes.
func (c *GCalClient) incrementalSync(ctx context.Context, db *sql.DB, userID, accessToken, syncToken string) (*SyncResult, error) {
	params := url.Values{}
	params.Set("syncToken", syncToken)
	params.Set("singleEvents", "false")

	apiResp, err := c.fetchEventsRaw(ctx, accessToken, params)
	if err != nil {
		if strings.Contains(err.Error(), "410") {
			return nil, errSyncTokenExpired
		}
		return nil, fmt.Errorf("incremental sync: %w", err)
	}

	var upserted, deleted int
	for _, item := range apiResp.Items {
		if item.Status == "cancelled" {
			if _, err := db.ExecContext(ctx,
				`UPDATE life_gcal_events SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1 AND id = $2`,
				userID, item.ID,
			); err == nil {
				deleted++
			}
		} else {
			n, _ := upsertEvents(ctx, db, userID, []gcalAPIItem{item})
			upserted += n
		}
	}

	if _, err := db.ExecContext(ctx, `
		UPDATE life_gcal_connections SET sync_token = $2, last_sync = NOW() WHERE user_id = $1`,
		userID, apiResp.NextSyncToken,
	); err != nil {
		return nil, fmt.Errorf("incremental sync: update sync state: %w", err)
	}

	return &SyncResult{Upserted: upserted, Deleted: deleted}, nil
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

// fetchEvents calls the Google Calendar API with pagination, collecting all items.
func (c *GCalClient) fetchEvents(ctx context.Context, accessToken string, params url.Values) (*gcalAPIResponse, error) {
	var allItems []gcalAPIItem
	var lastSyncToken string

	for {
		resp, err := c.fetchEventsRaw(ctx, accessToken, params)
		if err != nil {
			return nil, err
		}
		allItems = append(allItems, resp.Items...)
		lastSyncToken = resp.NextSyncToken

		if resp.NextPageToken == "" {
			break
		}
		params.Set("pageToken", resp.NextPageToken)
	}

	return &gcalAPIResponse{Items: allItems, NextSyncToken: lastSyncToken}, nil
}

// fetchEventsRaw makes a single API call (one page).
func (c *GCalClient) fetchEventsRaw(ctx context.Context, accessToken string, params url.Values) (*gcalAPIResponse, error) {
	u := "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 410 {
		return nil, fmt.Errorf("410: sync token expired")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:min(len(body), 200)]))
	}

	var apiResp gcalAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return &apiResp, nil
}

// ── DB operations ───────────────────────────────────────────────────────────

// upsertEvents inserts or updates events in the cache.
func upsertEvents(ctx context.Context, db *sql.DB, userID string, items []gcalAPIItem) (int, error) {
	count := 0
	for _, item := range items {
		start, end, allDay, err := parseItemTimes(item)
		if err != nil {
			continue
		}

		var recurrenceJSON *string
		if len(item.Recurrence) > 0 {
			b, _ := json.Marshal(item.Recurrence)
			s := string(b)
			recurrenceJSON = &s
		}

		rawJSON, _ := json.Marshal(item)

		// Extract routine_id from extendedProperties if present
		var routineID *string
		if rid, ok := item.ExtendedProperties.Private["routineId"]; ok && rid != "" {
			routineID = &rid
		}

		// Compute duration in minutes for recurring events
		var durationMinutes *int
		if len(item.Recurrence) > 0 {
			dur := int(end.Sub(start).Minutes())
			durationMinutes = &dur
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO life_gcal_events
				(id, user_id, summary, description, location, start_time, end_time,
				 all_day, status, color_id, html_link, recurring_event_id,
				 recurrence, duration_minutes, raw_json, routine_id, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
			ON CONFLICT (user_id, id) DO UPDATE SET
				summary = EXCLUDED.summary,
				description = EXCLUDED.description,
				location = EXCLUDED.location,
				start_time = EXCLUDED.start_time,
				end_time = EXCLUDED.end_time,
				all_day = EXCLUDED.all_day,
				status = EXCLUDED.status,
				color_id = EXCLUDED.color_id,
				html_link = EXCLUDED.html_link,
				recurring_event_id = EXCLUDED.recurring_event_id,
				recurrence = EXCLUDED.recurrence,
				duration_minutes = EXCLUDED.duration_minutes,
				raw_json = EXCLUDED.raw_json,
				routine_id = EXCLUDED.routine_id,
				updated_at = NOW()`,
			item.ID, userID, item.Summary, item.Description, item.Location,
			start, end, allDay, item.Status, item.ColorID, item.HtmlLink,
			nullStr(item.RecurringEventId), recurrenceJSON, durationMinutes,
			string(rawJSON), routineID,
		)
		if err != nil {
			continue
		}
		count++
	}
	return count, nil
}

// QueryLocalEvents reads cached events and expands recurring events for a date range.
func QueryLocalEvents(ctx context.Context, db *sql.DB, userID string, from, to time.Time) ([]GCalEvent, error) {
	// 1. Get non-recurring events in the range
	rows, err := db.QueryContext(ctx, `
		SELECT id, summary, description, location, start_time, end_time,
		       all_day, status, color_id, html_link, routine_id
		FROM life_gcal_events
		WHERE user_id = $1 AND recurrence IS NULL AND recurring_event_id IS NULL
		  AND start_time < $3 AND end_time > $2 AND status != 'cancelled'
		ORDER BY start_time`,
		userID, from, to,
	)
	if err != nil {
		return nil, fmt.Errorf("query non-recurring events: %w", err)
	}
	defer rows.Close()

	var events []GCalEvent
	for rows.Next() {
		var ev GCalEvent
		var routineID sql.NullString
		if err := rows.Scan(&ev.ID, &ev.Summary, &ev.Description, &ev.Location,
			&ev.Start, &ev.End, &ev.AllDay, &ev.Status, &ev.ColorID, &ev.HtmlLink,
			&routineID,
		); err != nil {
			continue
		}
		ev.RoutineID = routineID.String
		events = append(events, ev)
	}

	// 2. Get recurring master events and expand them
	recurRows, err := db.QueryContext(ctx, `
		SELECT id, summary, description, location, start_time, end_time,
		       all_day, status, color_id, html_link, recurrence, duration_minutes, routine_id
		FROM life_gcal_events
		WHERE user_id = $1 AND recurrence IS NOT NULL AND status != 'cancelled'`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("query recurring events: %w", err)
	}
	defer recurRows.Close()

	for recurRows.Next() {
		var ev GCalEvent
		var recurrenceJSON sql.NullString
		var durationMinutes sql.NullInt64
		var routineID sql.NullString
		if err := recurRows.Scan(&ev.ID, &ev.Summary, &ev.Description, &ev.Location,
			&ev.Start, &ev.End, &ev.AllDay, &ev.Status, &ev.ColorID, &ev.HtmlLink,
			&recurrenceJSON, &durationMinutes, &routineID,
		); err != nil {
			continue
		}
		ev.RoutineID = routineID.String

		if !recurrenceJSON.Valid {
			continue
		}

		var rules []string
		if err := json.Unmarshal([]byte(recurrenceJSON.String), &rules); err != nil {
			continue
		}

		dur := time.Duration(0)
		if durationMinutes.Valid {
			dur = time.Duration(durationMinutes.Int64) * time.Minute
		} else {
			dur = ev.End.Sub(ev.Start)
		}

		// Expand instances in the requested range
		instances := expandRRule(rules, ev.Start, dur, from, to)
		for _, inst := range instances {
			events = append(events, GCalEvent{
				ID:          ev.ID + "_" + inst.Format("20060102T150405Z"),
				Summary:     ev.Summary,
				Description: ev.Description,
				Location:    ev.Location,
				Start:       inst,
				End:         inst.Add(dur),
				AllDay:      ev.AllDay,
				Status:      ev.Status,
				ColorID:     ev.ColorID,
				HtmlLink:    ev.HtmlLink,
				RoutineID:   ev.RoutineID,
			})
		}
	}

	// 3. Get exceptions (edited instances of recurring events) in the range
	excRows, err := db.QueryContext(ctx, `
		SELECT id, summary, description, location, start_time, end_time,
		       all_day, status, color_id, html_link, routine_id
		FROM life_gcal_events
		WHERE user_id = $1 AND recurring_event_id IS NOT NULL
		  AND start_time < $3 AND end_time > $2 AND status != 'cancelled'
		ORDER BY start_time`,
		userID, from, to,
	)
	if err == nil {
		defer excRows.Close()
		for excRows.Next() {
			var ev GCalEvent
			var routineID sql.NullString
			if err := excRows.Scan(&ev.ID, &ev.Summary, &ev.Description, &ev.Location,
				&ev.Start, &ev.End, &ev.AllDay, &ev.Status, &ev.ColorID, &ev.HtmlLink,
				&routineID,
			); err != nil {
				continue
			}
			ev.RoutineID = routineID.String
			events = append(events, ev)
		}
	}

	// Enrich events with routine names via individual lookups
	routineNameMap := make(map[string]string)
	for _, ev := range events {
		if ev.RoutineID != "" {
			routineNameMap[ev.RoutineID] = "" // mark as needing lookup
		}
	}
	for rid := range routineNameMap {
		var name string
		if err := db.QueryRowContext(ctx,
			`SELECT name FROM life_routines WHERE id = $1 AND user_id = $2`,
			rid, userID).Scan(&name); err == nil {
			routineNameMap[rid] = name
		}
	}
	for i := range events {
		if events[i].RoutineID != "" {
			events[i].RoutineName = routineNameMap[events[i].RoutineID]
		}
	}

	// Sort by start time
	sortEvents(events)
	return events, nil
}

func sortEvents(events []GCalEvent) {
	for i := 1; i < len(events); i++ {
		for j := i; j > 0 && events[j].Start.Before(events[j-1].Start); j-- {
			events[j], events[j-1] = events[j-1], events[j]
		}
	}
}

// NeedsSync checks if the user's cache is stale.
func NeedsSync(ctx context.Context, db *sql.DB, userID string, maxAge time.Duration) (bool, error) {
	var lastSync sql.NullTime
	err := db.QueryRowContext(ctx,
		`SELECT last_sync FROM life_gcal_connections WHERE user_id = $1`, userID,
	).Scan(&lastSync)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil // no connection
		}
		return false, err
	}
	if !lastSync.Valid {
		return true, nil // never synced
	}
	return time.Since(lastSync.Time) > maxAge, nil
}

// ── RRULE expansion (simplified) ────────────────────────────────────────────

// expandRRule generates occurrences of a recurring event in [from, to).
// Supports: FREQ=DAILY, WEEKLY, MONTHLY, YEARLY with INTERVAL, BYDAY, COUNT, UNTIL.
func expandRRule(rules []string, dtstart time.Time, duration time.Duration, from, to time.Time) []time.Time {
	var instances []time.Time

	for _, rule := range rules {
		if !strings.HasPrefix(rule, "RRULE:") {
			continue
		}
		parts := parseRRuleParts(rule[6:])

		freq := parts["FREQ"]
		interval := 1
		if v, ok := parts["INTERVAL"]; ok {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				interval = n
			}
		}

		var until time.Time
		hasUntil := false
		if v, ok := parts["UNTIL"]; ok {
			if t, err := parseRRuleTime(v); err == nil {
				until = t
				hasUntil = true
			}
		}

		maxCount := 0
		if v, ok := parts["COUNT"]; ok {
			if n, err := strconv.Atoi(v); err == nil {
				maxCount = n
			}
		}

		var byDay []string
		if v, ok := parts["BYDAY"]; ok {
			byDay = strings.Split(v, ",")
		}

		// Generate instances
		cur := dtstart
		count := 0
		maxInstances := 1000 // safety limit

		for i := 0; i < maxInstances; i++ {
			if hasUntil && cur.After(until) {
				break
			}
			if maxCount > 0 && count >= maxCount {
				break
			}
			if cur.After(to) {
				break
			}

			// Check BYDAY filter for WEEKLY frequency
			if freq == "WEEKLY" && len(byDay) > 0 {
				// For WEEKLY with BYDAY, we need to check each day in the week
				weekStart := cur
				for d := 0; d < 7; d++ {
					day := weekStart.AddDate(0, 0, d)
					if hasUntil && day.After(until) {
						break
					}
					if maxCount > 0 && count >= maxCount {
						break
					}
					if matchesByDay(day, byDay) {
						if !day.Before(from) && day.Before(to) {
							instances = append(instances, day)
						}
						count++
					}
				}
				cur = cur.AddDate(0, 0, 7*interval)
				continue
			}

			if !cur.Before(from) && cur.Before(to) {
				instances = append(instances, cur)
			}
			count++

			switch freq {
			case "DAILY":
				cur = cur.AddDate(0, 0, interval)
			case "WEEKLY":
				cur = cur.AddDate(0, 0, 7*interval)
			case "MONTHLY":
				cur = cur.AddDate(0, interval, 0)
			case "YEARLY":
				cur = cur.AddDate(interval, 0, 0)
			default:
				return instances
			}
		}
	}

	return instances
}

func parseRRuleParts(rrule string) map[string]string {
	parts := make(map[string]string)
	for _, seg := range strings.Split(rrule, ";") {
		kv := strings.SplitN(seg, "=", 2)
		if len(kv) == 2 {
			parts[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
		}
	}
	return parts
}

func parseRRuleTime(s string) (time.Time, error) {
	// Try common RRULE date/datetime formats
	for _, layout := range []string{
		"20060102T150405Z",
		"20060102T150405",
		"20060102",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unparseable RRULE time: %s", s)
}

var dayMap = map[string]time.Weekday{
	"SU": time.Sunday,
	"MO": time.Monday,
	"TU": time.Tuesday,
	"WE": time.Wednesday,
	"TH": time.Thursday,
	"FR": time.Friday,
	"SA": time.Saturday,
}

func matchesByDay(t time.Time, byDay []string) bool {
	wd := t.Weekday()
	for _, d := range byDay {
		d = strings.TrimSpace(d)
		// Handle "2MO" (second Monday) by stripping numeric prefix
		for len(d) > 2 && d[0] >= '0' && d[0] <= '9' {
			d = d[1:]
		}
		if len(d) >= 2 {
			if mapped, ok := dayMap[d[:2]]; ok && mapped == wd {
				return true
			}
		}
	}
	return false
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// parseItemTimes extracts start/end times from a Google Calendar API item.
func parseItemTimes(item gcalAPIItem) (start, end time.Time, allDay bool, err error) {
	if item.Start.DateTime != "" {
		start, err = time.Parse(time.RFC3339, item.Start.DateTime)
		if err != nil {
			return
		}
		end, err = time.Parse(time.RFC3339, item.End.DateTime)
		return start, end, false, err
	}
	if item.Start.Date != "" {
		start, err = time.Parse("2006-01-02", item.Start.Date)
		if err != nil {
			return
		}
		end, err = time.Parse("2006-01-02", item.End.Date)
		return start, end, true, err
	}
	return time.Time{}, time.Time{}, false, fmt.Errorf("no start time")
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
