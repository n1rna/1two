package life

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
)

// ChannelEvent is the normalised input from any external channel.
type ChannelEvent struct {
	UserID     string
	Channel    string            // "telegram", "email", "web"
	ChannelUID string            // telegram chat ID as string, email address
	Content    string            // extracted message text
	Metadata   map[string]string // optional: email subject, telegram message_id, etc.
}

// ChannelResponse is the result returned after processing a ChannelEvent.
type ChannelResponse struct {
	Text           string
	ConversationID string
	Effects        []ToolEffect
}

// IngestChannelEvent processes a message from any external channel through the
// AI agent. It finds or creates a conversation, loads context, calls the agent,
// persists both messages, and returns the assistant response.
func IngestChannelEvent(ctx context.Context, db *sql.DB, agent ChatAgent, event ChannelEvent) (*ChannelResponse, error) {
	userID := event.UserID

	// ── 1. Find existing conversation for this channel + uid ─────────────
	var convID string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM life_conversations
		 WHERE user_id = $1 AND channel = $2 AND channel_ref = $3
		 ORDER BY updated_at DESC LIMIT 1`,
		userID, event.Channel, event.ChannelUID,
	).Scan(&convID)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("ingest: look up conversation: %w", err)
	}

	// ── 2. Create conversation if none found ─────────────────────────────
	if convID == "" {
		convID = uuid.NewString()
		title := deriveChannelTitle(event.Content)
		if _, err := db.ExecContext(ctx,
			`INSERT INTO life_conversations (id, user_id, channel, channel_ref, title)
			 VALUES ($1, $2, $3, $4, $5)`,
			convID, userID, event.Channel, event.ChannelUID, title,
		); err != nil {
			return nil, fmt.Errorf("ingest: create conversation: %w", err)
		}
	}

	// ── 3. Load last 50 messages as history ──────────────────────────────
	histRows, err := db.QueryContext(ctx,
		`SELECT role, content FROM life_messages
		 WHERE conversation_id = $1
		 ORDER BY created_at ASC
		 LIMIT 50`,
		convID,
	)
	if err != nil {
		return nil, fmt.Errorf("ingest: load history: %w", err)
	}
	var history []Message
	for histRows.Next() {
		var m Message
		if err := histRows.Scan(&m.Role, &m.Content); err != nil {
			histRows.Close()
			return nil, fmt.Errorf("ingest: scan history row: %w", err)
		}
		history = append(history, m)
	}
	histRows.Close()
	if err := histRows.Err(); err != nil {
		return nil, fmt.Errorf("ingest: iterate history: %w", err)
	}

	// ── 4. Load active memories ───────────────────────────────────────────
	memRows, err := db.QueryContext(ctx,
		`SELECT id, category, content FROM life_memories
		 WHERE user_id = $1 AND active = TRUE
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("ingest: load memories: %w", err)
	}
	var memories []Memory
	for memRows.Next() {
		var m Memory
		if err := memRows.Scan(&m.ID, &m.Category, &m.Content); err != nil {
			memRows.Close()
			return nil, fmt.Errorf("ingest: scan memory row: %w", err)
		}
		memories = append(memories, m)
	}
	memRows.Close()
	if err := memRows.Err(); err != nil {
		return nil, fmt.Errorf("ingest: iterate memories: %w", err)
	}

	// ── 5. Load / ensure user profile ────────────────────────────────────
	if _, err := db.ExecContext(ctx,
		`INSERT INTO life_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
		userID,
	); err != nil {
		log.Printf("life ingest: ensure profile for %s: %v", userID, err)
	}

	var profile Profile
	var wakeTime, sleepTime sql.NullString
	if err := db.QueryRowContext(ctx,
		`SELECT timezone, wake_time, sleep_time FROM life_profiles WHERE user_id = $1`,
		userID,
	).Scan(&profile.Timezone, &wakeTime, &sleepTime); err != nil && err != sql.ErrNoRows {
		log.Printf("life ingest: load profile for %s: %v", userID, err)
	}
	if wakeTime.Valid {
		profile.WakeTime = wakeTime.String
	}
	if sleepTime.Valid {
		profile.SleepTime = sleepTime.String
	}

	// ── 6. Load active routines (summary only for system prompt) ─────────
	routineRows, err := db.QueryContext(ctx,
		`SELECT id, name, description FROM life_routines
		 WHERE user_id = $1 AND active = TRUE
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("ingest: load routines: %w", err)
	}
	var routines []Routine
	for routineRows.Next() {
		var rt Routine
		if err := routineRows.Scan(&rt.ID, &rt.Name, &rt.Description); err != nil {
			routineRows.Close()
			return nil, fmt.Errorf("ingest: scan routine row: %w", err)
		}
		routines = append(routines, rt)
	}
	routineRows.Close()
	if err := routineRows.Err(); err != nil {
		return nil, fmt.Errorf("ingest: iterate routines: %w", err)
	}

	// ── 7. Count pending actionables ─────────────────────────────────────
	var pendingActionablesCount int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM life_actionables WHERE user_id = $1 AND status = 'pending'`,
		userID,
	).Scan(&pendingActionablesCount); err != nil {
		log.Printf("life ingest: count pending actionables for %s: %v", userID, err)
	}

	// ── 8. Build system context ───────────────────────────────────────────
	systemCtx := fmt.Sprintf("User is messaging via %s. Keep responses concise.", event.Channel)
	if event.Channel == "email" {
		if subject, ok := event.Metadata["subject"]; ok && subject != "" {
			systemCtx += fmt.Sprintf(" Email subject: %q.", subject)
		}
		systemCtx += `
When the user forwards an email, analyze it for actionable content:
- If it contains an event, webinar, meeting, or appointment: create a calendar event for it.
- If it contains a task or to-do: create a task for it.
- If it contains useful information to remember: save it to memory.
- Extract dates, times, locations, and details from the email content.
Always create actionables for detected items so the user can approve them.`
	}

	// ── 9. Save the user message ──────────────────────────────────────────
	userMsgID := uuid.NewString()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content, channel)
		 VALUES ($1, $2, $3, 'user', $4, $5)`,
		userMsgID, convID, userID, event.Content, event.Channel,
	); err != nil {
		return nil, fmt.Errorf("ingest: save user message: %w", err)
	}

	// ── 10. Load calendar events (best-effort) ───────────────────────────
	var calendarEvents []GCalEvent
	if gcalCli := agent.GCalClient(); gcalCli != nil {
		if token, err := EnsureValidToken(ctx, db, gcalCli, userID); err == nil {
			if evs, err := gcalCli.ListEvents(ctx, token, 7); err == nil {
				calendarEvents = evs
			}
		}
	}

	// ── 11. Call the agent ────────────────────────────────────────────────
	chatResult, err := agent.Chat(ctx, ChatRequest{
		UserID:                  userID,
		Message:                 event.Content,
		History:                 history,
		Memories:                memories,
		Profile:                 &profile,
		Routines:                routines,
		PendingActionablesCount: pendingActionablesCount,
		CalendarEvents:          calendarEvents,
		SystemContext:            systemCtx,
	})
	if err != nil {
		return nil, fmt.Errorf("ingest: agent chat: %w", err)
	}

	// ── 11. Build effects list ────────────────────────────────────────────
	var effects []map[string]any
	for _, eff := range chatResult.Effects {
		item := map[string]any{
			"tool": eff.Tool,
			"id":   eff.ID,
		}
		var parsed map[string]any
		if json.Unmarshal([]byte(eff.Result), &parsed) == nil {
			if eff.Tool == "remember" || eff.Tool == "create_routine" {
				item["data"] = parsed
			}
		}
		effects = append(effects, item)
	}

	var toolCallsJSON []byte
	if len(effects) > 0 {
		toolCallsJSON, _ = json.Marshal(effects)
	}

	// ── 12. Save the assistant message ───────────────────────────────────
	assistantMsgID := uuid.NewString()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO life_messages (id, conversation_id, user_id, role, content, channel, tool_calls)
		 VALUES ($1, $2, $3, 'assistant', $4, $5, $6)`,
		assistantMsgID, convID, userID, chatResult.Text, event.Channel,
		func() any {
			if len(toolCallsJSON) > 0 {
				return string(toolCallsJSON)
			}
			return nil
		}(),
	); err != nil {
		return nil, fmt.Errorf("ingest: save assistant message: %w", err)
	}

	// ── 13. Bump conversation updated_at ─────────────────────────────────
	if _, err := db.ExecContext(ctx,
		`UPDATE life_conversations SET updated_at = NOW() WHERE id = $1`, convID,
	); err != nil {
		log.Printf("life ingest: update conversation timestamp %s: %v", convID, err)
	}

	// ── 14. Build ToolEffect slice for the caller ─────────────────────────
	toolEffects := make([]ToolEffect, len(chatResult.Effects))
	copy(toolEffects, chatResult.Effects)

	return &ChannelResponse{
		Text:           chatResult.Text,
		ConversationID: convID,
		Effects:        toolEffects,
	}, nil
}

// deriveChannelTitle produces a short conversation title from the first message.
func deriveChannelTitle(msg string) string {
	if len(msg) <= 50 {
		return msg
	}
	truncated := msg[:50]
	for i := 49; i > 10; i-- {
		if msg[i] == ' ' {
			truncated = msg[:i]
			break
		}
	}
	return truncated + "..."
}

