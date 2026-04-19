package kim

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/n1rna/1tt/api/internal/ai"
	"github.com/n1rna/1tt/api/internal/life"
	"github.com/tmc/langchaingo/llms"
)

// Agent is the Kim AI agent. It uses a skill-based architecture to dynamically
// compose system prompts and select tools based on the conversation category.
type Agent struct {
	llmCfg   ai.LLMConfig
	db       *sql.DB
	gcal     *life.GCalClient
	registry *SkillRegistry
}

// NewAgent creates a Kim agent with the default skill registry.
func NewAgent(llmCfg ai.LLMConfig, db *sql.DB, gcal *life.GCalClient) *Agent {
	return &Agent{
		llmCfg:   llmCfg,
		db:       db,
		gcal:     gcal,
		registry: DefaultRegistry(),
	}
}

// Registry returns the agent's skill registry for inspection or customization.
func (a *Agent) Registry() *SkillRegistry {
	return a.registry
}

// GCalClient returns the Google Calendar client, or nil if not configured.
func (a *Agent) GCalClient() *life.GCalClient {
	return a.gcal
}

// LLMConfig returns a pointer to the agent's LLM configuration.
func (a *Agent) LLMConfig() *ai.LLMConfig {
	return &a.llmCfg
}

// ChatRequest holds all inputs for a single chat turn.
// This is a drop-in replacement for life.ChatRequest.
type ChatRequest = life.ChatRequest

// ChatResult is the result of a chat turn (type alias for compatibility).
type ChatResult = ai.ToolAgentResult

// StreamEvent is a streaming event (type alias for compatibility).
type StreamEvent = ai.StreamEvent

// ToolEffect tracks side effects from tool execution (type alias).
type ToolEffect = ai.ToolEffect

// buildConfig constructs a ToolAgentConfig using skill-based prompt composition
// and category-filtered tools.
func (a *Agent) buildConfig(req ChatRequest) ai.ToolAgentConfig {
	pctx := PromptContext{
		Category:                req.ConversationCategory,
		Profile:                 req.Profile,
		Memories:                req.Memories,
		Routines:                req.Routines,
		PendingActionablesCount: req.PendingActionablesCount,
		CalendarEvents:          req.CalendarEvents,
		RoutineEventLinks:       req.RoutineEventLinks,
		AutoApprove:             req.AutoApprove,
		HealthProfile:           req.HealthProfile,
		ActiveSessions:          req.ActiveSessions,
		SystemContext:           req.SystemContext,
		Now:                     time.Now().UTC(),
	}

	systemPrompt := BuildSystemPrompt(a.registry, pctx)

	// Convert life.Message → ai.Message for BuildMessages.
	history := make([]ai.Message, len(req.History))
	for i, h := range req.History {
		history[i] = ai.Message{Role: h.Role, Content: h.Content}
	}

	// Select only tools relevant to the current category.
	tools := a.registry.ToolsForCategory(req.ConversationCategory)

	return ai.ToolAgentConfig{
		Messages: ai.BuildMessages(systemPrompt, history, req.Message),
		Tools:    tools,
		Execute: func(ctx context.Context, call llms.ToolCall) string {
			return life.ExecuteToolWithSource(ctx, a.db, a.gcal, req.UserID, req.AutoApprove, call, req.ActionableSource)
		},
		MaxRounds:   5,
		Temperature: 1.0,
		MaxTokens:   16384,
		LLMConfig:   &a.llmCfg,
	}
}

// Chat executes a single conversation turn with a ReAct tool-calling loop.
func (a *Agent) Chat(ctx context.Context, req ChatRequest) (*ChatResult, error) {
	req.History = life.CompactHistory(ctx, &a.llmCfg, req.History)

	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, err
	}
	return ai.RunToolAgent(ctx, model, a.buildConfig(req))
}

// ChatStream executes a single conversation turn with streaming.
func (a *Agent) ChatStream(ctx context.Context, req ChatRequest, onEvent func(StreamEvent)) (*ChatResult, error) {
	req.History = life.CompactHistory(ctx, &a.llmCfg, req.History)

	model, err := ai.NewLLM(&a.llmCfg)
	if err != nil {
		return nil, err
	}
	return ai.RunToolAgentStream(ctx, model, a.buildConfig(req), onEvent)
}

// ProcessActionableResponse handles a user's response to an actionable item.
// It feeds the response back to the agent so it can take follow-up actions.
func (a *Agent) ProcessActionableResponse(ctx context.Context, db *sql.DB, userID string, actionable life.ActionableRecord, response string) (*ChatResult, error) {
	log.Printf("kim: actionable %q (id=%s) resolved by user %s: %s",
		actionable.Title, actionable.ID, userID, response)

	prompt := fmt.Sprintf(
		"The user responded to the actionable \"%s\" (type: %s).\nTheir response: %s\n\n"+
			"Based on this response, take any appropriate follow-up actions: update calendar events, "+
			"create tasks, adjust routines, save preferences to memory, etc. "+
			"Use your tools — do NOT just acknowledge in text. If no action is needed, that's fine too.",
		actionable.Title, actionable.Type, response,
	)

	// Find the scheduler conversation for context
	var convID string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM life_conversations WHERE user_id = $1 AND channel = 'scheduler' ORDER BY updated_at DESC LIMIT 1`,
		userID,
	).Scan(&convID)
	if err != nil {
		convID = ""
	}

	// Load minimal history from the scheduler conversation
	var history []life.Message
	if convID != "" {
		rows, err := db.QueryContext(ctx,
			`SELECT role, content FROM life_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10`,
			convID,
		)
		if err == nil {
			for rows.Next() {
				var m life.Message
				if err := rows.Scan(&m.Role, &m.Content); err == nil {
					history = append(history, m)
				}
			}
			rows.Close()
			for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
				history[i], history[j] = history[j], history[i]
			}
		}
	}

	// Load user context
	var profile life.Profile
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

	memRows, _ := db.QueryContext(ctx,
		`SELECT id, category, content FROM life_memories WHERE user_id = $1 AND active = TRUE`, userID)
	var memories []life.Memory
	if memRows != nil {
		for memRows.Next() {
			var m life.Memory
			if err := memRows.Scan(&m.ID, &m.Category, &m.Content); err == nil {
				memories = append(memories, m)
			}
		}
		memRows.Close()
	}

	result, err := a.Chat(ctx, ChatRequest{
		UserID:      userID,
		Message:     prompt,
		History:     history,
		Memories:    memories,
		Profile:     &profile,
		AutoApprove: true,
		SystemContext: `The user just responded to an actionable. Take follow-up actions using tools.

IMPORTANT RULES for follow-up actions:
- If the user confirmed completing a task/todo: call complete_task to mark it done on Google Tasks. Do NOT store a memory instead.
- If the user confirmed completing a routine: do NOT create a memory — just acknowledge. Routine completion is tracked by the system.
- If the user chose a schedule option: update or create the relevant calendar events using update_calendar_event or create_calendar_event.
- If the user provided a preference: use remember to store it as a preference memory.
- Do NOT create new actionables asking the same question.
- Do NOT use remember for task/routine completions — those are transient facts, not preferences.
- Focus on executing the user's choice with the appropriate tool.`,
	})
	if err != nil {
		return nil, fmt.Errorf("process actionable response: %w", err)
	}

	log.Printf("kim: actionable response processed — %d effects", len(result.Effects))
	return result, nil
}
