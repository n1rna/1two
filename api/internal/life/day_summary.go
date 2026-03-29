package life

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/tmc/langchaingo/llms"
)

// DayBlock represents a semantic time block in a day summary.
type DayBlock struct {
	Type        string   `json:"type"`               // sleep, wake, commute, work, meal, exercise, social, personal, project, free, errand
	Label       string   `json:"label"`              // "Work", "Gym — Leg Day", "Dinner with family"
	Description string   `json:"description"`        // "Standup, deep work on API, code review"
	Start       string   `json:"start"`              // "09:00" (HH:MM)
	End         string   `json:"end"`                // "17:00"
	EventIDs    []string `json:"eventIds,omitempty"` // linked calendar event IDs
}

// DaySummary is the cached summary for one day.
type DaySummary struct {
	Date        string     `json:"date"`                  // "2026-03-25"
	Blocks      []DayBlock `json:"blocks"`                // nil when pending
	Pending     bool       `json:"pending,omitempty"`     // true if not yet generated
	GeneratedAt string     `json:"generatedAt,omitempty"` // empty when pending
}

// StaleSummary identifies a single user+date that needs (re)generation.
type StaleSummary struct {
	UserID string `json:"user_id"`
	Date   string `json:"date"` // "2026-03-25"
}

const daySummarySystemPrompt = `You are a day planner that consolidates calendar events into semantic time blocks. Given a list of events for a day, produce a JSON array of blocks that covers the full day from wake to sleep.

Rules:
- Merge adjacent/overlapping events into semantic blocks (e.g., multiple work meetings → one "Work" block)
- Include implicit blocks: sleep (before wake, after sleep time), commute (if applicable), free time gaps
- Block types: sleep, wake, commute, work, meal, exercise, social, personal, project, free, errand
- Each block has: type, label (short), description (what's in this block), start (HH:MM), end (HH:MM)
- eventIds: array of calendar event IDs that are part of this block (empty for implicit blocks)
- Cover the ENTIRE day from 00:00 to 23:59 — no gaps
- Output ONLY a JSON array, nothing else`

// computeEventsHash produces a stable SHA-256 hash over the given events.
func computeEventsHash(events []GCalEvent) string {
	sorted := make([]GCalEvent, len(events))
	copy(sorted, events)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Start.Before(sorted[j].Start)
	})

	var sb strings.Builder
	for _, ev := range sorted {
		sb.WriteString(ev.ID)
		sb.WriteString("|")
		sb.WriteString(ev.Start.UTC().Format(time.RFC3339))
		sb.WriteString(";")
	}
	sum := sha256.Sum256([]byte(sb.String()))
	return fmt.Sprintf("%x", sum)
}

// ─── Read-only: return cached summaries (used by HTTP handler) ───────────────

// GetCachedDaySummaries returns cached summaries for the date range.
// Days without a cached summary are returned with Pending=true.
func GetCachedDaySummaries(ctx context.Context, db *sql.DB, userID string, from, to time.Time) ([]DaySummary, error) {
	// Load all cached summaries in the range
	rows, err := db.QueryContext(ctx, `
		SELECT date, events_hash, blocks, generated_at
		FROM life_day_summaries
		WHERE user_id = $1 AND date >= $2 AND date < $3
		ORDER BY date`, userID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	if err != nil {
		return nil, fmt.Errorf("query cached summaries: %w", err)
	}
	defer rows.Close()

	cached := map[string]DaySummary{}
	cachedHashes := map[string]string{}
	for rows.Next() {
		var dateStr, hash, blocksJSON string
		var generatedAt time.Time
		if err := rows.Scan(&dateStr, &hash, &blocksJSON, &generatedAt); err != nil {
			continue
		}
		var blocks []DayBlock
		_ = json.Unmarshal([]byte(blocksJSON), &blocks)
		// Parse date — DB returns it as "2026-03-25T00:00:00Z", normalize
		if t, err := time.Parse(time.RFC3339, dateStr); err == nil {
			dateStr = t.Format("2006-01-02")
		} else if t, err := time.Parse("2006-01-02", dateStr); err == nil {
			dateStr = t.Format("2006-01-02")
		}
		cached[dateStr] = DaySummary{
			Date:        dateStr,
			Blocks:      blocks,
			GeneratedAt: generatedAt.UTC().Format(time.RFC3339),
		}
		cachedHashes[dateStr] = hash
	}

	// Check if cached summaries are still valid (events haven't changed)
	var summaries []DaySummary
	for d := from; d.Before(to); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")

		if summary, ok := cached[dateStr]; ok {
			// Verify hash is still valid
			dayStart := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
			dayEnd := dayStart.AddDate(0, 0, 1)
			events, err := QueryLocalEvents(ctx, db, userID, dayStart, dayEnd)
			if err != nil {
				events = nil
			}
			currentHash := computeEventsHash(events)

			if cachedHashes[dateStr] == currentHash {
				summaries = append(summaries, summary)
			} else {
				// Stale — mark as pending
				summaries = append(summaries, DaySummary{Date: dateStr, Pending: true})
			}
		} else {
			summaries = append(summaries, DaySummary{Date: dateStr, Pending: true})
		}
	}

	return summaries, nil
}

// ─── Check which summaries are stale (used by queue producer) ────────────────

// CheckStaleSummaries finds all user+date pairs in the next 7 days that need
// summary (re)generation. Returns one StaleSummary per stale day.
func CheckStaleSummaries(ctx context.Context, db *sql.DB) ([]StaleSummary, error) {
	// Get all users with agent enabled
	userRows, err := db.QueryContext(ctx,
		`SELECT user_id FROM life_profiles WHERE agent_enabled = TRUE`)
	if err != nil {
		return nil, fmt.Errorf("check stale summaries: load users: %w", err)
	}
	defer userRows.Close()

	var users []string
	for userRows.Next() {
		var uid string
		if err := userRows.Scan(&uid); err == nil {
			users = append(users, uid)
		}
	}

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endDate := today.AddDate(0, 0, 7)

	var stale []StaleSummary
	for _, userID := range users {
		for d := today; d.Before(endDate); d = d.AddDate(0, 0, 1) {
			dateStr := d.Format("2006-01-02")
			dayEnd := d.AddDate(0, 0, 1)

			events, err := QueryLocalEvents(ctx, db, userID, d, dayEnd)
			if err != nil {
				continue
			}
			currentHash := computeEventsHash(events)

			// Check if we have a cached summary with this hash
			var cachedHash string
			err = db.QueryRowContext(ctx,
				`SELECT events_hash FROM life_day_summaries WHERE user_id = $1 AND date = $2`,
				userID, dateStr,
			).Scan(&cachedHash)

			if err != nil || cachedHash != currentHash {
				stale = append(stale, StaleSummary{UserID: userID, Date: dateStr})
			}
		}
	}

	log.Printf("day summaries: checked %d users, %d stale summaries", len(users), len(stale))
	return stale, nil
}

// ─── Generate a single day summary (used by queue consumer) ──────────────────

// GenerateAndCacheDaySummary generates a summary for a single user+date and caches it.
func GenerateAndCacheDaySummary(ctx context.Context, db *sql.DB, agent *Agent, userID, dateStr string) error {
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return fmt.Errorf("parse date %q: %w", dateStr, err)
	}

	dayEnd := date.AddDate(0, 0, 1)
	events, err := QueryLocalEvents(ctx, db, userID, date, dayEnd)
	if err != nil {
		return fmt.Errorf("query events: %w", err)
	}

	hash := computeEventsHash(events)

	// Double-check cache hasn't been filled in the meantime
	var cachedHash string
	if err := db.QueryRowContext(ctx,
		`SELECT events_hash FROM life_day_summaries WHERE user_id = $1 AND date = $2`,
		userID, dateStr,
	).Scan(&cachedHash); err == nil && cachedHash == hash {
		return nil // already up to date
	}

	// Load profile + routines
	var profile Profile
	var wakeTime, sleepTime sql.NullString
	_ = db.QueryRowContext(ctx,
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
		userID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime)
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	routineRows, _ := db.QueryContext(ctx,
		`SELECT id, name, type, description FROM life_routines WHERE user_id = $1 AND active = TRUE`, userID)
	var routines []Routine
	if routineRows != nil {
		for routineRows.Next() {
			var rt Routine
			if err := routineRows.Scan(&rt.ID, &rt.Name, &rt.Type, &rt.Description); err == nil {
				routines = append(routines, rt)
			}
		}
		routineRows.Close()
	}

	blocks, err := generateDaySummary(ctx, agent.LLMConfig(), userID, date, events, &profile, routines)
	if err != nil {
		return fmt.Errorf("generate: %w", err)
	}

	blocksJSON, _ := json.Marshal(blocks)
	id := fmt.Sprintf("%s_%s", userID, dateStr)
	_, dbErr := db.ExecContext(ctx, `
		INSERT INTO life_day_summaries (id, user_id, date, events_hash, blocks, generated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id, date) DO UPDATE SET
			events_hash  = EXCLUDED.events_hash,
			blocks       = EXCLUDED.blocks,
			generated_at = NOW()`,
		id, userID, dateStr, hash, string(blocksJSON),
	)
	if dbErr != nil {
		return fmt.Errorf("persist: %w", dbErr)
	}

	log.Printf("day summaries: generated %s for user %s — %d blocks", dateStr, userID, len(blocks))
	return nil
}

// ─── LLM generation ─────────────────────────────────────────────────────────

func generateDaySummary(ctx context.Context, llmCfg *ai.LLMConfig, userID string, date time.Time, events []GCalEvent, profile *Profile, routines []Routine) ([]DayBlock, error) {
	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		return nil, fmt.Errorf("create llm: %w", err)
	}

	userMsg := buildDaySummaryUserMessage(date, events, profile, routines)

	messages := []llms.MessageContent{
		{
			Role:  llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{llms.TextPart(daySummarySystemPrompt)},
		},
		{
			Role:  llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{llms.TextPart(userMsg)},
		},
	}

	resp, err := model.GenerateContent(ctx, messages,
		llms.WithTemperature(0.3),
		llms.WithMaxTokens(2048),
	)
	if err != nil {
		return nil, fmt.Errorf("llm call: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned")
	}

	raw := strings.TrimSpace(resp.Choices[0].Content)

	// Strip optional markdown code fence.
	if strings.HasPrefix(raw, "```") {
		if idx := strings.Index(raw, "\n"); idx != -1 {
			raw = raw[idx+1:]
		}
		if idx := strings.LastIndex(raw, "```"); idx != -1 {
			raw = raw[:idx]
		}
		raw = strings.TrimSpace(raw)
	}

	var blocks []DayBlock
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return nil, fmt.Errorf("parse json (%q): %w", raw[:min(len(raw), 200)], err)
	}

	_ = userID
	return blocks, nil
}

func buildDaySummaryUserMessage(date time.Time, events []GCalEvent, profile *Profile, routines []Routine) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Date: %s\n", date.Format("2006-01-02 (Monday)")))

	if profile != nil {
		if profile.WakeTime != "" {
			sb.WriteString(fmt.Sprintf("Wake time: %s\n", profile.WakeTime))
		}
		if profile.SleepTime != "" {
			sb.WriteString(fmt.Sprintf("Sleep time: %s\n", profile.SleepTime))
		}
		if profile.Timezone != "" {
			sb.WriteString(fmt.Sprintf("Timezone: %s\n", profile.Timezone))
		}
	}

	sb.WriteString("\nCalendar events:\n")
	if len(events) == 0 {
		sb.WriteString("(no events)\n")
	} else {
		for _, ev := range events {
			startStr := ev.Start.Format("15:04")
			endStr := ev.End.Format("15:04")
			title := ev.Summary
			if title == "" {
				title = "(Untitled)"
			}
			sb.WriteString(fmt.Sprintf("- [%s] %s – %s: %s", ev.ID, startStr, endStr, title))
			if ev.Description != "" {
				desc := ev.Description
				if len(desc) > 80 {
					desc = desc[:80] + "..."
				}
				sb.WriteString(fmt.Sprintf(" (%s)", desc))
			}
			sb.WriteString("\n")
		}
	}

	if len(routines) > 0 {
		sb.WriteString("\nActive routines (for context):\n")
		for _, rt := range routines {
			sb.WriteString(fmt.Sprintf("- %s (%s): %s\n", rt.Name, rt.Type, rt.Description))
		}
	}

	sb.WriteString("\nProduce a JSON array of DayBlock objects covering the entire day 00:00–23:59.")
	return sb.String()
}
