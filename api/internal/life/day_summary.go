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
	Date        string     `json:"date"`        // "2026-03-25"
	Blocks      []DayBlock `json:"blocks"`
	GeneratedAt string     `json:"generatedAt"`
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
// Events are sorted by start time before hashing to ensure determinism.
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

// GetDaySummaries returns DaySummary objects for each day in [from, to).
// It checks the DB cache first; if the events hash has changed (or no cache exists),
// it calls the LLM to regenerate the summary.
func GetDaySummaries(ctx context.Context, db *sql.DB, agent *Agent, userID string, from, to time.Time) ([]DaySummary, error) {
	// Load profile for wake/sleep times and routines for context.
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

	llmCfg := agent.LLMConfig()

	var summaries []DaySummary
	for d := from; d.Before(to); d = d.AddDate(0, 0, 1) {
		dayStart := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		dayEnd := dayStart.AddDate(0, 0, 1)

		events, err := QueryLocalEvents(ctx, db, userID, dayStart, dayEnd)
		if err != nil {
			log.Printf("day summaries: query events for %s on %s: %v", userID, dayStart.Format("2006-01-02"), err)
			events = nil
		}

		hash := computeEventsHash(events)
		dateStr := dayStart.Format("2006-01-02")

		// Check cache.
		var cachedHash string
		var cachedBlocksJSON string
		var cachedAt time.Time
		err = db.QueryRowContext(ctx,
			`SELECT events_hash, blocks, generated_at FROM life_day_summaries WHERE user_id = $1 AND date = $2`,
			userID, dateStr,
		).Scan(&cachedHash, &cachedBlocksJSON, &cachedAt)

		if err == nil && cachedHash == hash {
			// Cache hit.
			var blocks []DayBlock
			if jsonErr := json.Unmarshal([]byte(cachedBlocksJSON), &blocks); jsonErr == nil {
				summaries = append(summaries, DaySummary{
					Date:        dateStr,
					Blocks:      blocks,
					GeneratedAt: cachedAt.UTC().Format(time.RFC3339),
				})
				continue
			}
		}

		// Cache miss or stale — generate.
		blocks, genErr := generateDaySummary(ctx, llmCfg, userID, dayStart, events, &profile, routines)
		if genErr != nil {
			log.Printf("day summaries: generate for %s on %s: %v", userID, dateStr, genErr)
			// Return an empty summary rather than failing the whole request.
			summaries = append(summaries, DaySummary{
				Date:        dateStr,
				Blocks:      []DayBlock{},
				GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			})
			continue
		}

		// Persist to cache.
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
			log.Printf("day summaries: persist for %s on %s: %v", userID, dateStr, dbErr)
		}

		summaries = append(summaries, DaySummary{
			Date:        dateStr,
			Blocks:      blocks,
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	return summaries, nil
}

// generateDaySummary calls the LLM directly (no tool loop) to produce []DayBlock for one day.
func generateDaySummary(ctx context.Context, llmCfg *ai.LLMConfig, userID string, date time.Time, events []GCalEvent, profile *Profile, routines []Routine) ([]DayBlock, error) {
	model, err := ai.NewLLM(llmCfg)
	if err != nil {
		return nil, fmt.Errorf("generate day summary: create llm: %w", err)
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
		return nil, fmt.Errorf("generate day summary: llm call: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("generate day summary: no choices returned")
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
		return nil, fmt.Errorf("generate day summary: parse json (%q): %w", raw[:min(len(raw), 200)], err)
	}

	_ = userID // available for future per-user logging
	return blocks, nil
}

// buildDaySummaryUserMessage constructs the user message for the day summary LLM call.
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
