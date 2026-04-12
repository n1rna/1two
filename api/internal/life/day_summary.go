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

const daySummarySystemPrompt = `You produce a high-level day summary as a JSON array of time blocks covering the FULL 24 hours from 00:00 to 23:59 with NO GAPS and NO OVERLAPS.

The summary must be VERY high-level — think of it as a bird's eye view of the day, not a detailed schedule. Aim for 6–10 blocks total. Fewer is better.

# Allowed block types (use ONLY these — never invent new types)
sleep, morning_routine, commute, work, tasks, meal, exercise, social, personal, project, rest, errand

CRITICAL: "gym", "lunch", "dinner", "evening", "free", "downtime" are NOT valid types. They are LABELS. The TYPE for a gym session is "exercise" (label can be "Gym"). The TYPE for lunch/dinner is "meal" (label can be "Lunch" or "Dinner"). The TYPE for relaxing in the evening is "rest" or "personal".

# Contiguity rule (CRITICAL — most important rule)
Consecutive blocks MUST touch exactly: blocks[i].end == blocks[i+1].start, character-for-character.
There must be ZERO gaps and ZERO overlaps. If you finish a "work" block at 17:00 and the next event starts at 18:00, you MUST insert a filler block (type "rest" or "personal") from 17:00 to 18:00. If a "rest" block ends at 22:30 and the closing "sleep" block starts at 23:00, you MUST extend one of them so they meet — never leave 22:30–23:00 uncovered.

Walk through the blocks before emitting and verify: does each block's "end" exactly equal the next block's "start"? If not, fix it.

# Sleep bookends
- The FIRST block MUST be {"type":"sleep","start":"00:00","end":"<wake_time>"}.
- The LAST block MUST be {"type":"sleep","start":"<sleep_time>","end":"23:59"}.

# Event linking rule
Every calendar event in the input MUST appear in exactly one block's eventIds array. Do not drop events. A "lunch" calendar event goes in a "meal" block. A 1:1 or meeting goes in the single "work" block. A doctor visit goes in an "errand" block. A coffee with a friend goes in a "social" block.

# Merge rules
- Merge ALL work meetings/calls into a SINGLE "work" block spanning the full work window (e.g. first meeting → last meeting). Do NOT split into multiple work blocks even if there are gaps between meetings — the gaps are inside the work block.
- Merge ALL small todos into a single "tasks" block with label "Daily tasks".
- Keep project blocks generic — use label "Project time", not specific project names.

# Block schema
{"type":"<one of allowed types>","label":"<short human label>","description":"<brief summary>","start":"HH:MM","end":"HH:MM","eventIds":["id1",...]}
- eventIds: calendar event IDs that fall in this block. Use [] for implicit blocks (sleep, rest, morning_routine, commute) that have no events.

# Output
Output ONLY the JSON array. No markdown, no commentary, no explanation, no code fence.

# Example (note: contiguous, all events linked, valid types only)
Input events:
- [ev1] 09:00–09:15 Standup
- [ev2] 11:00–12:00 Design review
- [ev3] 12:00–13:00 Lunch
- [ev4] 17:30–18:30 Gym
- [ev5] 19:00–20:00 Dinner

Output:
[{"type":"sleep","label":"Sleep","description":"","start":"00:00","end":"07:00","eventIds":[]},{"type":"morning_routine","label":"Morning routine","description":"Wake up, breakfast","start":"07:00","end":"08:00","eventIds":[]},{"type":"commute","label":"Commute","description":"","start":"08:00","end":"08:30","eventIds":[]},{"type":"work","label":"Work","description":"Standup, design review, lunch break","start":"08:30","end":"17:00","eventIds":["ev1","ev2","ev3"]},{"type":"personal","label":"Personal time","description":"","start":"17:00","end":"17:30","eventIds":[]},{"type":"exercise","label":"Gym","description":"Workout","start":"17:30","end":"18:30","eventIds":["ev4"]},{"type":"personal","label":"Personal time","description":"","start":"18:30","end":"19:00","eventIds":[]},{"type":"meal","label":"Dinner","description":"","start":"19:00","end":"20:00","eventIds":["ev5"]},{"type":"rest","label":"Evening","description":"Relax, reading","start":"20:00","end":"23:00","eventIds":[]},{"type":"sleep","label":"Sleep","description":"","start":"23:00","end":"23:59","eventIds":[]}]`

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
	userMsg := buildDaySummaryUserMessage(date, events, profile, routines)

	messages := []ai.KimiMessage{
		{Role: "system", Content: daySummarySystemPrompt},
		{Role: "user", Content: userMsg},
	}

	// Day summary is a one-shot structured generation — use the non-thinking
	// summary model when configured. Thinking models like kimi-k2.5 spend
	// 5–28k tokens of reasoning on these calls (3–6 minutes per day).
	cfgCopy := *llmCfg
	if cfgCopy.SummaryModel != "" {
		cfgCopy.Model = cfgCopy.SummaryModel
	}

	resp, err := ai.KimiChatCompletion(ctx, &cfgCopy, messages, nil, 1.0, 4096)
	if err != nil {
		return nil, fmt.Errorf("llm call: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no choices returned")
	}

	content := resp.Choices[0].Message.Content
	reasoning := resp.Choices[0].Message.ReasoningContent
	log.Printf("day summary LLM response: content=%d chars, reasoning=%d chars", len(content), len(reasoning))

	// K2.5 thinking models may return the JSON in content after reasoning
	raw := strings.TrimSpace(content)
	if raw == "" && reasoning != "" {
		// Try extracting JSON from the end of reasoning content
		log.Printf("day summary: content empty, checking reasoning content")
		raw = strings.TrimSpace(reasoning)
	}

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
